--!strict
--============================================================================
-- ClownAI.lua (ModuleScript, ServerScriptService)
-- Server-side agent: PERCEPTION → STATE MACHINE → PATHFINDING.
-- One instance per clown; shared sympathetic last-seen relay via ThreatDirector.
--
-- MAP INTEGRATION POINTS (build in Studio):
--   workspace.Map.Waypoints.<ClownId>  : Folder of patrol BaseParts
--   workspace.Map.Rooms                : Folder of room volumes (for territory)
--   workspace.Map.Lockers              : hiding spot models with .Occupant attr
--   workspace.Clowns.<ClownId>.Model   : the rig (Humanoid + Animator loaded)
--============================================================================

local Players = game:GetService("Players")
local PathfindingService = game:GetService("PathfindingService")
local RunService = game:GetService("RunService")
local RS = game:GetService("ReplicatedStorage")
local Config = require(RS:WaitForChild("ClownHouseConfig"))
local Net = require(RS:WaitForChild("Net"))

local Clown = {}
Clown.__index = Clown

export type State = "DORMANT"|"PATROL"|"INVESTIGATE"|"CHASE"|"SEARCH"|"STUN"

local function distXZ(a: Vector3, b: Vector3): number
	return (Vector3.new(a.X, 0, a.Z) - Vector3.new(b.X, 0, b.Z)).Magnitude
end

function Clown.new(clownId: string, rig: Model, waypoints: {BasePart}, director: any)
	local def = Config.Clowns[clownId]
	assert(def, "unknown clown " .. clownId)
	local humanoid = rig:WaitForChild("Humanoid") :: Humanoid
	humanoid.WalkSpeed = def.patrolSpeed
	local self = setmetatable({}, Clown)
	self.id = clownId
	self.def = def
	self.rig = rig
	self.humanoid = humanoid
	self.root = rig:WaitForChild("HumanoidRootPart") :: BasePart
	self.waypoints = waypoints
	self.director = director          -- ThreatDirector (noise bus, target weighting)
	self.state = "DORMANT" :: State
	self.waypointIdx = 1
	self.lastSeen = nil               -- {pos=Vector3, age=number, player=Player?}
	self.investigatePos = nil
	self.searchTimer = 0
	self.catchCooldown = 0
	self.unseenTime = 0
	self.fury = 0                     -- Tickets aggro / Bobby pop boost share this
	self.stunTimer = 0
	self.active = false
	self.finale = false
	self.path = nil
	self._conn = nil
	rig.Parent = workspace.Clowns
	rig:SetAttribute("ClownId", clownId)
	rig:SetAttribute("State", "DORMANT")
	return self
end

-- ───────────────────────────────── lifecycle ────────────────────────────
function Clown:activate(spawnCFrame: CFrame?)
	if spawnCFrame then self.rig:PivotTo(spawnCFrame) end
	self.active = true
	self.rig:SetAttribute("State", "PATROL")
	self:_setState("PATROL")
	if not self._conn then
		self._conn = RunService.Heartbeat:Connect(function(dt) self:_tick(dt) end)
	end
end

function Clown:deactivate()
	self.active = false
	self:_setState("DORMANT")
	self.rig:SetAttribute("State", "DORMANT")
	if self._conn then self._conn:Disconnect(); self._conn = nil end
end

function Clown:_setState(s: State)
	if self.state == s then return end
	local prev = self.state
	self.state = s
	self.rig:SetAttribute("State", s)
	if s == "CHASE" and prev ~= "CHASE" and prev ~= "STUN" then
		Net.PlayCueLocal:FireAllClients("ClownScream", { who = self.id })
		self.director:notifyChaseStart(self)
	elseif prev == "CHASE" and s ~= "CHASE" then
		self.director:notifyChaseEnd(self)
	end
end

-- ───────────────────────────────── perception ───────────────────────────
-- noise bus entry (ThreatDirector forwards all Noise.* events here)
function Clown:hearNoise(pos: Vector3, radius: number, tag: string, sourcePlayer: Player?)
	if not self.active or self.state == "DORMANT" or self.state == "STUN" then return end
	local eff = radius * self.def.hearingMult
	-- Jingle hears music way further
	if tag == "musicGate" and self.def.mechanics.musicHearingMult then
		eff *= self.def.mechanics.musicHearingMult
	end
	-- Jingle is deaf to ordinary steps while his song plays
	if tag == "step" and self.def.mechanics.silenceBlinds and self.director.flags.musicPlaying then
		return
	end
	if distXZ(self.root.Position, pos) > eff then return end
	-- territory clamp (Tickets ignores distant noise until furious)
	if self.def.territory and self.fury < (self.def.mechanics.furiousAt or math.huge) then
		if not self.director.rooms:positionInAny(self.def.territory, pos)
			and distXZ(self.root.Position, pos) > 40 then
			return
		end
	end
	if self.state ~= "CHASE" then
		self.investigatePos = pos
		self.lastSeen = { pos = pos, age = 999, player = sourcePlayer } -- echo-only
		self:_setState("INVESTIGATE")
		self.path = nil
	end
end

local function canSeeRig(self, targetChar: Model, def): boolean
	local head = self.rig:FindFirstChild("Head") :: BasePart?
	local rootPos = self.root.Position
	local targetRoot = targetChar:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not targetRoot then return false end
	-- hidden players are invisible to normal senses
	if targetChar:GetAttribute("Hidden") then return false end
	local d = distXZ(rootPos, targetRoot.Position)
	local range = def.viewRange * (self.finale and 1.25 or 1)
	-- light discipline: unlit players are harder to see
	if not (targetChar:GetAttribute("FlashlightOn") or self.director.flags.partyLightsOn) then
		range *= 0.62
	end
	if d > range then return false end
	-- FOV
	local look = self.root.CFrame.LookVector
	local toT = (targetRoot.Position - rootPos).Unit
	if look:Dot(toT) < math.cos(math.rad(def.fovDeg * 0.5)) and d > 8 then
		return false
	end
	-- raycast LOS (walls + blocked props are in the "Architecture" collision group)
	local params = RaycastParams.new()
	params.FilterDescendantsInstances = { workspace.Map.Architecture }
	params.FilterType = Enum.RaycastFilterType.Include
	local from = (head and head.Position or rootPos + Vector3.new(0, 2, 0))
	local hit = workspace:Raycast(from, (targetRoot.Position - from), params)
	return hit == nil
end

function Clown:_visiblePlayer(): Player?
	if self.director.flags.graceAll then return nil end
	local best: Player? = nil
	local bd = math.huge
	for _, pl in ipairs(Players:GetPlayers()) do
		if not self.director:isEliminated(pl) and not self.director:hasGrace(pl) then
			local ch = pl.Character
			local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
			if hrp and canSeeRig(self, ch, self.def) then
				local d = distXZ(self.root.Position, hrp.Position)
				if d < bd then bd = d; best = pl end
			end
		end
	end
	return best
end

-- flashlight stun (Tickets) — ThreatDirector pings this when a beam is held on him
function Clown:litByFlashlight()
	if self.def.mechanics.flashlightStunSec and self.state == "CHASE" then
		self.stunTimer = self.def.mechanics.flashlightStunSec
		self:_setState("STUN")
		Net.PlayCueLocal:FireAllClients("TicketsStunned", {})
	end
end

-- ───────────────────────────────── locomotion ───────────────────────────
function Clown:_speedFor(s: State): number
	local d = self.def
	local v = d.patrolSpeed
	if s == "INVESTIGATE" then v = (d.patrolSpeed + d.chaseSpeed) * 0.5
	elseif s == "CHASE" then
		v = d.chaseSpeed * (self.finale and d.finaleMult or 1)
		v *= (1 + math.min(0.35, self.fury * 0.06))
	end
	return v
end

function Clown:_followPath(stepwise: boolean): boolean -- true when path done
	if not self.path then return true end
	local wp, i = self.path.waypoints, self.path.index
	if i > #wp then return true end
	local target = wp[i].Position
	if distXZ(self.root.Position, target) < 2.5 then
		self.path.index += 1
		return self.path.index > #wp
	end
	self.humanoid:MoveTo(target)
	return false
end

function Clown:_pathTo(pos: Vector3)
	local ok, path = pcall(function()
		local p = PathfindingService:CreatePath({
			AgentRadius = 3, AgentHeight = 7,
			AgentCanJump = false, AgentCanClimb = false,
			Costs = { BallPit = 2.2, Water = math.huge }, -- materials alter clown routes
		})
		p:ComputeAsync(self.root.Position, pos)
		return p
	end)
	if ok and path and path.Status == Enum.PathStatus.Success then
		self.path = { waypoints = path:GetWaypoints(), index = 2 }
	else
		self.path = nil
	end
end

-- ───────────────────────────────── tick ─────────────────────────────────
function Clown:_tick(dt: number)
	if not self.active then return end
	self.catchCooldown = math.max(0, self.catchCooldown - dt)
	if self.state == "STUN" then
		self.stunTimer -= dt
		if self.stunTimer <= 0 then self:_setState("SEARCH"); self.searchTimer = 6 end
		return
	end

	-- PERCEPTION
	local seen = self:_visiblePlayer()
	if seen then
		local hrp = seen.Character.HumanoidRootPart
		self.lastSeen = { pos = hrp.Position, age = 0, player = seen }
		self.unseenTime = 0
		if self.state ~= "CHASE" then self:_setState("CHASE") end
	elseif self.state == "CHASE" then
		self.unseenTime += dt
		if self.unseenTime > 3.2 then
			self:_setState("SEARCH")
			self.searchTimer = 6 + self.def.searchSkill * 5
		end
	end

	-- BEHAVIOR
	if self.state == "PATROL" then
		if not self.path then
			local wp = self.waypoints[self.waypointIdx % #self.waypoints + 1]
			if distXZ(self.root.Position, wp.Position) < 4 then self.waypointIdx += 1 end
			self:_pathTo(wp.Position)
		elseif self:_followPath() then
			self.path = nil; task.wait(0.3)
		end

	elseif self.state == "INVESTIGATE" then
		local p = self.investigatePos
		if not p then self:_setState("PATROL")
		else
			if not self.path then self:_pathTo(p)
			elseif self:_followPath() or distXZ(self.root.Position, p) < 5 then
				self.path = nil
				self:_setState("SEARCH")
				self.searchTimer = 3.5 + self.def.searchSkill * 3
				self.director:notifyArrived(self)
			end
		end

	elseif self.state == "CHASE" then
		if not self.path or (self._repathT or 0) <= 0 then
			self._repathT = 0.55
			if self.lastSeen then self:_pathTo(self.lastSeen.pos) end
		else
			self._repathT -= dt
		end
		self:_followPath()
		-- catch
		if self.lastSeen and self.lastSeen.player then
			local pl = self.lastSeen.player
			local hrp = pl.Character and pl.Character:FindFirstChild("HumanoidRootPart")
			if hrp and self.catchCooldown <= 0
				and distXZ(self.root.Position, hrp.Position) < self.def.catchRadius then
				self.catchCooldown = self.def.graceAfterCatch
				self.director:playerCaught(self, pl)
				self:_setState("SEARCH")
				self.searchTimer = 5
				-- disengage: wander to a distant waypoint (fairness valve)
				self:_pathTo(self.waypoints[(math.random(#self.waypoints))].Position)
			end
		end

	elseif self.state == "SEARCH" then
		self.searchTimer -= dt
		if not self.path then
			local a = math.random() * math.pi * 2
			local p = self.root.Position + Vector3.new(math.cos(a) * 10, 0, math.sin(a) * 10)
			self:_pathTo(p)
		elseif self:_followPath() then self.path = nil end
		-- locker checks
		if self.def.searchSkill > 0 then
			self.director.lockers:searchNear(self, self.def.searchSkill, dt)
		end
		if self.searchTimer <= 0 then self:_setState("PATROL"); self.path = nil end
	end

	self.humanoid.WalkSpeed = self:_speedFor(self.state)
end

return Clown
