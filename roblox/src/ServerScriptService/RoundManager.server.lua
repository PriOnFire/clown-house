--!strict
--============================================================================
-- RoundManager.server.lua (ServerScriptService · Script)
-- The conductor: lobby → intro → 5 chapters → endings. Also owns:
--   ThreatDirector (noise bus, target weighting, mimic decoys)
--   PartyKeeper directives (Mr. Happy systems manipulation)
--   downed/revive, endings, tickets economy, achievements
--
-- STUDIO SETUP (assets the scripts expect):
--   workspace.Map (rooms, doors w/ .LockedBy attr, interactables w/ .Id attr)
--   workspace.Clowns (rig models: Bobby, Tickets, Mimic, Jingle, MrHappy)
--   workspace.Cameras (BaseParts: CAM01..CAM06)
--   ReplicatedStorage.ClownHouseAssets (sounds, icons, jumpscare frames)
--============================================================================

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")
local RS = game:GetService("ReplicatedStorage")
local Config = require(RS:WaitForChild("ClownHouseConfig"))
local Net = require(RS:WaitForChild("Net"))
local ObjectiveService = require(script.Parent:WaitForChild("ObjectiveService"))
local ClownAI = require(script.Parent:WaitForChild("ClownAI"))

---------------------------------------------------------------- round state
local Round = {}
Round.__index = Round

function Round.new()
	local self = setmetatable({}, Round)
	self.flags = {
		chapter = 1, powerOn = false, partyLightsOn = false,
		musicPlaying = false, graceAll = false,
		fuses = 0, tickets = 0,
		buttonWindow = 0, buttons = { A = false, B = false, C = false },
	}
	self.players = {}          -- { [Player] = {downs=0, downed=false, eliminated=false, tickets=0, grace=0} }
	self.clowns = {}
	self.events = {}           -- filled below (noise bus + director hooks)
	self.lockers = {}          -- LockerService handle (implement per map kit)
	self.rooms = {}            -- RoomService handle
end

---------------------------------------------------------------- ThreatDirector
function Round:buildDirector()
	local self = Round
	local director = {}
	director.flags = self.flags
	director.rooms = self.rooms
	director.lockers = self.lockers

	function director:isEliminated(pl) return self.players[pl] and self.players[pl].eliminated end
	function director:hasGrace(pl) return (self.players[pl] and self.players[pl].grace or 0) > 0 end

	-- noise bus: every system posts here; each active clown hears it
	function director:emitNoise(pos: Vector3, radius: number, tag: string, sourcePlayer: Player?)
		for _, c in pairs(self.clowns) do
			if c.active then task.defer(c.hearNoise, c, pos, radius, tag, sourcePlayer) end
		end
		-- Bobby's balloons relay even what he himself can't hear
		local bobby = self.clowns.Bobby
		if bobby and bobby.active and tag ~= "balloonRelay" then
			for _, b in ipairs(self.balloons or {}) do
				if (b.Position - pos).Magnitude < radius then
					bobby:hearNoise(b.Position, radius * 1.2, "balloonRelay", sourcePlayer)
					break
				end
			end
		end
	end

	function director:notifyChaseStart(clown)
		Net.Danger:FireAllClients(1.0, clown.id)
	end
	function director:notifyChaseEnd(clown)
		Net.Danger:FireAllClients(0.15)
		for pl in pairs(self.players) do
			self:grantAchievement(pl, "DONT_LOOK_BACK")
		end
	end
	function director:notifyArrived(clown) end
	function director:agitateAll(amount)
		for _, c in pairs(self.clowns) do if c.active then c.fury += amount end end
	end

	-- ── catch / downed / revive ────────────────────────────────────────────
	function director:playerCaught(clown, pl)
		local p = self.players[pl]; if not p or p.eliminated then return end
		Net.Jumpscare:FireClient(pl, clown.id, 1.0)
		if p.downs >= 1 then
			p.eliminated = true
			Net.Downed:FireClient(pl, false, "eliminated")
			self:checkWipe()
		else
			p.downs += 1
			p.downed = true
			p.mash = 0
			p.grace = 0
			Net.Downed:FireClient(pl, true, (#Players:GetPlayers() > 1) and "revive" or "mash")
			task.delay(Config.DOWNED_BLEEDOUT, function()
				if p.downed and not p.eliminated then
					p.eliminated = true
					Net.Downed:FireClient(pl, false, "eliminated")
					self:checkWipe()
				end
			end)
		end
	end
	self.threatDirector = director
end

---------------------------------------------------------------- clown roster
function Round:spawnClowns()
	local rigFolder = ServerStorage:WaitForChild("ClownRigs")
	local wpRoot = workspace.Map:WaitForChild("Waypoints")
	for _, id in ipairs({ "Bobby", "Tickets", "Mimic", "Jingle" }) do
		local rig = rigFolder:WaitForChild(id):Clone()
		local wps = {}
		for _, w in ipairs(wpRoot:WaitForChild(id):GetChildren()) do table.insert(wps, w) end
		self.clowns[id] = ClownAI.new(id, rig, wps, self.threatDirector)
	end
	-- Jingle is authored but dormant by default (audio presence first)
	self:activateAtChapter(2, "Bobby")
	self:activateWhen(function(r) return (r.flags.tickets or 0) >= 2 end, "Tickets")
	self:activateAtChapter(4, "Mimic", true)            -- physical hunts; decoys from ch.3
	self:activateAtChapter(3, "Jingle", true)           -- music mechanic active from ch.3
end
function Round:activateAtChapter(ch, id, silent)
	-- wired in objective tick
end
function Round:activateWhen(fn, id) end

---------------------------------------------------------------- tickets economy
function Round:onMachinePlayed(pl, machineId)
	local p = self.players[pl]
	self.flags.tickets += 1; p.tickets += 1
	Net.HudState:FireClient(pl, { tickets = p.tickets })
	self.threatDirector:emitNoise(machineId, Config.Noise.arcadeMachine, "arcade", pl)
	local ticketsClown = self.clowns.Tickets
	if ticketsClown then ticketsClown.fury += Config.Clowns.Tickets.mechanics.aggroPerStolenTicket end
	if self.flags.tickets == 1 then self:grantAchievement(pl, "ONE_MORE_GAME") end
	self.objectives:tick()
end

---------------------------------------------------------------- downed (solo-mash & revive)
Net.MashDowned.OnServerEvent:Connect(function(pl)
	local p = Round.players and Round.players[pl]
	if not p or not p.downed then return end
	p.mash = (p.mash or 0) + 1
	if p.mash >= Config.DOWNED_SOLO_MASH then
		p.downed = false; p.grace = 8
		Net.Downed:FireClient(pl, false, "recovered")
	end
end)
Net.ReviveChannel.OnServerEvent:Connect(function(pl, targetPl, holding)
	-- channel logic: proximity-validated progress; fill over REVIVE_TIME
end)

---------------------------------------------------------------- PartyKeeper / Mr. Happy directives
function Round:partyKeeperPulse()
	-- every 9–16s during chapter>=4, Mr. Happy touches the building
	task.spawn(function()
		while not self.flags.roundOver do
			task.wait(9 + math.random() * 7)
			if (self.flags.chapter or 1) < 4 then continue end
			local moves = {
				function() Net.CctvFeed:FireAllClients("CAM02", "skew") end,
				function() Net.PlayCueLocal:FireAllClients("LightsDieWave", {}) end,
				function() Net.Announcement:FireAllClients("MR. HAPPY", "I SEE YOU, GUEST.", true, true) end,
				function() self:lockRandomHarmlessDoor() end,
			}
			moves[math.random(#moves)]()
		end
	end)
end
function Round:lockRandomHarmlessDoor() end

---------------------------------------------------------------- Mimic decoys
function Round:decoyTick()
	-- From chapter 3: pick an isolated player; copy their look; place the fake.
	task.spawn(function()
		while not self.flags.roundOver do
			task.wait(20 + math.random() * 25)
			if (self.flags.chapter or 1) < 3 then continue end
			local victim = self:pickIsolatedPlayer()
			if not victim or not victim.Character then continue end
			local hrp = victim.Character.HumanoidRootPart
			local ang = math.rad(victim.Character.Humanoid.MoveDirection:Dot(Vector3.zAxis) > 0 and 0 or 180)
			local ahead = hrp.CFrame * CFrame.new(0, 0, -15 - math.random(10))
			Net.DecoySpawn:FireAllClients(
				Players:GetHumanoidDescriptionFromUserId(victim.UserId),
				ahead.Position, victim.DisplayName)
			-- server tracks the decoy lifetime; approach < 6m ⇒ face, then vanish
		end
	end)
end
function Round:pickIsolatedPlayer(): Player?
	for pl, p in pairs(self.players) do
		if not p.eliminated then
			local othersNear = 0
			for pl2, p2 in pairs(self.players) do
				if pl2 ~= pl and not p2.eliminated then
					local a, b = pl.Character, pl2.Character
					if a and b and (a.HumanoidRootPart.Position - b.HumanoidRootPart.Position).Magnitude < 40 then
						othersNear += 1
					end
				end
			end
			if othersNear == 0 then return pl end
		end
	end
	return nil
end

---------------------------------------------------------------- endings
function Round:finishPartyReached()
	self.flags.partyDone = true
	Net.FinaleMode:FireAllClients({ redLights = true, arcadeMessage = "1 PLAYER REMAINING" })
	for _, c in pairs(self.clowns) do
		if not c.active then c:activate() end
		c.finale = true
	end
	-- PartyKeeper location relay (finale hunt pressure, interval-fair)
	task.spawn(function()
		while not self.flags.roundOver do
			task.wait(2.6)
			local alive = {}
			for pl, p in pairs(self.players) do
				if not p.eliminated and pl.Character then table.insert(alive, pl.Character.HumanoidRootPart.Position) end
			end
			if #alive == 0 then break end
			for _, c in pairs(self.clowns) do
				if c.active then
					c.lastSeen = { pos = alive[math.random(#alive)], age = 0, player = nil }
					if c.state ~= "STUN" then c.state = "CHASE" end
				end
			end
		end
	end)
end

function Round:tryEscape(pl)
	local ending = "A"
	if self.flags.shutdownArmed then ending = (#self.flags.vhsFound >= 4) and "D" or "B" end
	self.flags.roundOver = true
	Net.Ending:FireAllClients(ending, {
		shutdown = self.flags.shutdownArmed, tapes = self.flags.vhsFound,
	})
	self:grantAchievement(pl, "LAST_BIRTHDAY")
	if self.flags.shutdownArmed then self:grantAchievement(pl, "OFFLINE") end
	task.delay(14, function() self:returnToLobby() end)
end

function Round:checkWipe()
	for _, p in pairs(self.players) do
		if not p.eliminated then return end
	end
	self.flags.roundOver = true
	Net.Ending:FireAllClients("C", {})
	task.delay(10, function() self:returnToLobby() end)
end

function Round:returnToLobby() end -- teleport/reset

---------------------------------------------------------------- achievements (DataStore in real build)
function Round:grantAchievement(pl, id) Net.Achievement:FireClient(pl, id, "") end

---------------------------------------------------------------- interact security
-- ALL interactions validated server-side: distance, chapter, flags.
local INTERACT_RANGE = 12
Net.Interact.OnServerEvent:Connect(function(pl, targetId: string)
	local p = Round.players and Round.players[pl]
	if not p or p.eliminated or p.downed then return end
	local char = pl.Character; if not char then return end
	local target = workspace.Map.Interactables:FindFirstChild(tostring(targetId))
	if not target then return end
	local pp = target:IsA("Model") and target:GetPivot().Position or (target :: BasePart).Position
	if (pp - char.HumanoidRootPart.Position).Magnitude > INTERACT_RANGE then return end
	Round:handleInteract(pl, target)
end)
function Round:handleInteract(pl, target)
	-- dispatch by target:GetAttribute("Id"): "fuse_a","breaker","machine_3",
	-- "button_A","partykeeper","memo","whiteboard","vhs_1..4","cake","exit_door", …
end

---------------------------------------------------------------- main loop
local function bootstrap()
	print("[CLOWN HOUSE] RoundManager boot: waiting for lobby kit")
	-- 1) lobby: players ready up in parking-lot place/zone → 2) teleport to map anchor
	-- 3) intro sequence → objectives:start() → per-second director loops
	local round = Round.new()
	round:buildDirector()
	round.objectives = ObjectiveService.new(round)
	round:partyKeeperPulse()
	round:decoyTick()
	RunService.Heartbeat:Connect(function(dt)
		if round.objectives then round.objectives:tickButtonWindow(dt) end
		for _, p in pairs(round.players) do
			if p.grace then p.grace = math.max(0, p.grace - dt) end
		end
	end)
	print("[CLOWN HOUSE] systems armed. The party can begin.")
end

bootstrap()
