--!strict
--============================================================================
-- ObjectiveService.lua (ModuleScript, ServerScriptService)
-- Chapter/objective state machine. The ONLY place story progresses.
-- RoundData = the live match table created by RoundManager.
--============================================================================

local RS = game:GetService("ReplicatedStorage")
local Config = require(RS:WaitForChild("ClownHouseConfig"))
local Net    = require(RS:WaitForChild("Net"))

local ObjectiveService = {}
ObjectiveService.__index = ObjectiveService

type Step = { id: string, chapter: number, title: string, sub: string,
	cond: (any) -> boolean, onStart: ((any) -> ())? }

function ObjectiveService.new(round: any)
	local self = setmetatable({}, ObjectiveService)
	self.round = round
	self.stepIndex = 0
	self.steps = self:_buildSteps()
	return self
end

function ObjectiveService:_buildSteps(): {Step}
	local ch = Config.Chapters
	local function step(id, chapter, title, sub, cond, onStart)
		return { id = id, chapter = chapter, title = title, sub = sub, cond = cond, onStart = onStart }
	end
	return {
		step("flashlight", 1, "EXPLORE HAPPYLAND",
			"Find a flashlight.\nThe reception kept one.",
			function(r) return r.flags.hasFlashlight end),

		step("fuses", 1, "RESTORE EMERGENCY POWER",
			"Find 2 fuses.\nTry storage and the kitchen.",
			function(r) return r.flags.fuses >= 2 end),

		step("breaker", 1, "RESTORE EMERGENCY POWER",
			"Breaker panel: west corridor, north wall.",
			function(r) return r.flags.powerOn end),

		step("tickets", 2, "COLLECT TICKETS",
			"PARTY MODE wants tickets.\nPlay arcade machines. (0/5)",
			function(r) return r.flags.tickets >= 5 end),

		step("prize", 2, "CLAIM YOUR PRIZE",
			"Prize counter — back wall.",
			function(r) return r.flags.hasBadge end),

		step("buttons", 3, "PRESS THE PARTY BUTTONS",
			"3 buttons, 30 seconds, far apart.\nArcade · Ball pit · Party hall.",
			function(r) return r.flags.buttonsDone end,
			function(r)
				r.flags.buttons = { A = false, B = false, C = false }
				r.flags.buttonWindow = 0
			end),

		step("maintenance", 4, "ENTER MAINTENANCE",
			"Badge door — west corridor.",
			function(r) return r.flags.inMaintenance end),

		step("partykeeper", 4, "ACCESS PARTYKEEPER",
			"Ask it why the music never stopped.",
			function(r) return r.flags.pkRead end),

		step("code", 4, "FIND THE SHUTDOWN CODE",
			"Two fragments.\nStaff room memo · kitchen board.",
			function(r) return r.flags.codeA and r.flags.codeB end),

		step("shutdown_q", 4, "RETURN TO PARTYKEEPER",
			"Decide what HappyLand deserves.",
			function(r) return r.flags.shutdownArmed or r.flags.inZero end),

		step("yellow_door", 5, "ENTER THE YELLOW DOOR",
			"Party Room 0.",
			function(r) return r.flags.inZero end),

		step("finish_party", 5, "FINISH THE PARTY",
			"Six candles. Six guests. You make seven.",
			function(r) return r.flags.partyDone end),

		step("escape", 5, "ESCAPE",
			"EMERGENCY EXIT — storage room. RUN.",
			function(r) return r.flags.roundOver end),
	}
end

function ObjectiveService:currentStep(): Step?
	return self.steps[self.stepIndex]
end

function ObjectiveService:start()
	self.stepIndex = 1
	local s = self.steps[1]
	Net.ChapterCard:FireAllClients("CHAPTER 1", "AFTER HOURS", "NO CAMERAS SINCE 21:17")
	Net.ObjectiveChanged:FireAllClients(s.title, s.sub, true)
	s.onStart and s.onStart(self.round)
end

-- called whenever flags change (RoundManager fires after every mutation)
function ObjectiveService:tick()
	local s = self.steps[self.stepIndex]
	if not s then return end
	if s.cond(self.round) then
		self.stepIndex += 1
		local next = self.steps[self.stepIndex]
		if not next then return end
		if next.chapter ~= (self.round.flags.chapter or 1) then
			self.round.flags.chapter = next.chapter
			local chDef = Config.Chapters[next.chapter]
			Net.ChapterCard:FireAllClients(
				("CHAPTER %d"):format(next.chapter), chDef.title, chDef.sub)
			self.round.events:notifyChapter(next.chapter)
		end
		Net.ObjectiveChanged:FireAllClients(next.title, next.sub, true)
		if next.onStart then next.onStart(self.round) end
	end
end

-- Party buttons simultaneity (chapter 3). Called by interact handler.
function ObjectiveService:pressPartyButton(player: Player, which: string)
	local r = self.round
	if (r.flags.chapter or 1) ~= 3 or r.flags.buttonsDone then return end
	if r.flags.buttons[which] then return end
	r.flags.buttons[which] = true
	r.events:noise(which)
	if r.flags.buttonWindow <= 0 then
		r.flags.buttonWindow = 30
		Net.Announcement:FireAllClients("MR. HAPPY",
			"THIRTY SECONDS, GUESTS. ALL THREE. TOGETHER. LIKE A PARTY.", true)
	end
	local n = 0
	for _, v in pairs(r.flags.buttons) do if v then n += 1 end end
	if n >= 3 then
		r.flags.buttonsDone = true
		r.flags.buttonWindow = 0
		Net.Announcement:FireAllClients("MR. HAPPY",
			"SUCH GOOD TEAMWORK. THE PARTY SALUTES YOU.", true)
	else
		Net.ObjectiveChanged:FireAllClients(
			"PRESS THE PARTY BUTTONS",
			("%d/3 pressed"):format(n), false)
	end
	self:tick()
end

-- Runs every second from RoundManager while buttons window is hot.
function ObjectiveService:tickButtonWindow(dt: number)
	local r = self.round
	if (r.flags.buttonWindow or 0) <= 0 or r.flags.buttonsDone then return end
	r.flags.buttonWindow -= dt
	if r.flags.buttonWindow <= 0 then
		r.flags.buttons = { A = false, B = false, C = false }
		-- failure → relocate + taunt + aggro nudge
		Net.Announcement:FireAllClients("MR. HAPPY", "TOO SLOW. THE GAME RESETS. SO DO MY FRIENDS.", true)
		r.threatDirector:agitateAll(0.25)
		r.events:rerollButtonRooms()
	end
end

return ObjectiveService
