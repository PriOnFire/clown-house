--!strict
--============================================================================
-- CLOWN HOUSE: AFTER HOURS — ClownHouseConfig (ReplicatedStorage)
-- Single source of truth for chapters, clowns, items, events, endings.
-- Client and server both read from here; only the server mutates state.
--============================================================================

local Config = {}

-- ────────────────────────────── round flow ──────────────────────────────
Config.MAX_PLAYERS        = 6
Config.MIN_PLAYERS        = 1
Config.INTERMISSION_TIME  = 20        -- voting/lobby countdown
Config.DOWNED_BLEEDOUT    = 9         -- seconds until eliminated
Config.DOWNED_REVIVE_TIME = 4         -- teammate channel time
Config.DOWNED_SOLO_MASH   = 8         -- solo struggle taps
Config.FLASHDRAIN_PER_SEC = 1.35
Config.FLASH_BATTERY_MAX  = 100
Config.BATTERY_PICKUP     = 45
Config.STAMINA_MAX        = 100
Config.SPRINT_DRAIN       = 22
Config.STAMINA_REGEN      = 14

-- ────────────────────────────── chapters ────────────────────────────────
Config.Chapters = {
	{ id = 1, key = "AFTER_HOURS",    title = "AFTER HOURS",
	  sub = "NO CAMERAS SINCE 21:17",
	  objectives = { "Explore HappyLand", "Restore emergency power", "Find the breaker panel" } },
	{ id = 2, key = "THE_PARTY",      title = "THE PARTY",
	  sub = "PARTY MODE: ACTIVATED", clownWake = { "Bobby" },
	  objectives = { "Collect tickets (5)", "Claim your prize" } },
	{ id = 3, key = "DONT_SPLIT_UP",  title = "DON'T SPLIT UP",
	  sub = "THE BUTTONS WANT YOU SEPARATED",
	  objectives = { "Press the party buttons (3, within 30s)" } },
	{ id = 4, key = "MAINTENANCE",    title = "MAINTENANCE",
	  sub = "WHERE THE MAGIC IS MADE",
	  objectives = { "Enter maintenance", "Access PartyKeeper", "Find the shutdown code (2)", "Return to PartyKeeper" } },
	{ id = 5, key = "LAST_BIRTHDAY",  title = "THE LAST BIRTHDAY",
	  sub = "EVERYTHING IS STILL SET",
	  objectives = { "Enter the yellow door", "Finish the party", "ESCAPE" } },
}

-- ────────────────────────────── clown roster ────────────────────────────
-- These mirror the prototype's tuning; Roblox uses PathfindingService waypoints.
export type ClownDef = {
	patrolSpeed: number, chaseSpeed: number, finaleMult: number,
	hearingMult: number, fovDeg: number, viewRange: number,
	searchSkill: number, catchRadius: number, graceAfterCatch: number,
}
Config.Clowns = {
	Bobby = {
		role = "THE BALLOON CLOWN",
		patrolSpeed = 9, chaseSpeed = 17, finaleMult = 1.06,   -- studs/sec (≈2.5/4.7 m/s)
		hearingMult = 1.5, fovDeg = 110, viewRange = 50,
		searchSkill = 0.40, catchRadius = 4, graceAfterCatch = 9,
		territory = nil, -- roams main hall, ball pit, birthday rooms
		mechanics = {
			balloonSensors = true,          -- balloons drift toward noise sources
			popAggroPerPop = 0.06,          -- +6% speed per popped balloon
			popRevealCount = 3,             -- pops needed for exact-position ping
		},
		warningCue = "BALLOON_DRIFT",
	},
	Tickets = {
		role = "THE PRIZE CLOWN",
		patrolSpeed = 8, chaseSpeed = 16, finaleMult = 1.06,
		hearingMult = 1.15, fovDeg = 120, viewRange = 50,
		searchSkill = 0.25, catchRadius = 4, graceAfterCatch = 9,
		territory = { "Arcade", "PrizeCounter", "PartyHall" }, -- leaves only when furious
		mechanics = {
			aggroPerStolenTicket = 1, furiousAt = 6, -- fury lets him leave territory
			flashlightStunSec = 1.1,
			ticketRattleRadiusPer = 2,     -- studs of extra noise radius per carried ticket
		},
		warningCue = "SLOT_CHIMES",
	},
	Mimic = {
		role = "THE COPYCAT CLOWN",
		patrolSpeed = 11, chaseSpeed = 18.5, finaleMult = 1.06,
		hearingMult = 0.9, fovDeg = 160, viewRange = 60,
		searchSkill = 0.95, catchRadius = 4, graceAfterCatch = 6,
		territory = nil,
		mechanics = {
			decoyLifetime = { 12, 26 },     -- decoy seconds before vanish
			decoyMinSeparation = 18,        -- studs from real player to spawn
			despawnWhenWatchedBy = 3,       -- simultaneous lookers
			physicalHuntsFromChapter = 4,
		},
		warningCue = "DOUBLE_FOOTSTEPS",
	},
	Jingle = {
		role = "THE MUSIC CLOWN",
		patrolSpeed = 7.5, chaseSpeed = 15.5, finaleMult = 1.06,
		hearingMult = 1.0, fovDeg = 100, viewRange = 42,
		searchSkill = 0.30, catchRadius = 4, graceAfterCatch = 9,
		territory = nil,
		mechanics = {
			musicHearingMult = 2.2,         -- hears ACTIVE MUSIC at 2.2x radius
			silenceBlinds = true,           -- cannot track normal steps while his music plays
			musicStopRadius = 26,           -- he is inside this when world music cuts
		},
		warningCue = "MUSIC_STOPS",
	},
	MrHappy = {
		role = "THE HOST",
		note = "Distributed controller, not a field agent. Drives PartyKeeper directives: " ..
		       "lights, locks, PA, CCTV lies, and one scripted finale apparition.",
		patrolSpeed = 0, chaseSpeed = 0, finaleMult = 1,
		hearingMult = 0, fovDeg = 0, viewRange = 0,
		searchSkill = 0, catchRadius = 0, graceAfterCatch = 0,
		warningCue = "STATIC_BLOOM",
	},
}
export type ClownId = keyof<typeof(Config.Clowns)>

-- ────────────────────────────── noise model ─────────────────────────────
Config.Noise = {
	footstepWalk  = 12,   -- studs
	footstepRun   = 28,
	ballpitSteps  = 34,
	balloonPop    = 55,
	arcadeMachine = 48,
	doorCreak     = 20,
	partyButton   = 38,
	boing         = 24,
	musicGate     = 65,   -- deliberately loud: the mechanic
}

-- ────────────────────────────── items ───────────────────────────────────
Config.Items = {
	Flashlight  = { slot = "hand",  consumable = false },
	Battery     = { slot = "auto",  consumable = true  },
	Fuse        = { slot = "pocket",consumable = true  },
	Ticket      = { slot = "stack", consumable = true  },
	SecurityBadge = { slot = "badge", consumable = false },
	PartyKey    = { slot = "pocket",consumable = false },
	VHSTape     = { slot = "lore",  consumable = true  },
	Screwdriver = { slot = "pocket",consumable = false }, -- opens vent shortcuts
	PlushDecoy  = { slot = "hand",  consumable = true  }, -- throwable noise decoy
}

-- ────────────────────────────── endings ─────────────────────────────────
Config.Endings = {
	A = { id = "A", title = "ESCAPE",   requirement = "finishParty + reachExit" },
	B = { id = "B", title = "SHUTDOWN", requirement = "+ codeEntered0917" },
	C = { id = "C", title = "THE PARTY",requirement = "secondDown" },
	D = { id = "D", title = "SECRET",   requirement = "B + all 4 VHS" },
}

-- ────────────────────────────── random events ───────────────────────────
Config.Events = {
	-- weight, minChapter, id (server RandomEventDirector picks every 13–26s)
	{ id = "BalloonSpawn",     w = 10, minCh = 1 },
	{ id = "DistantMusicBox",  w = 10, minCh = 1 },
	{ id = "LightFlicker",     w =  9, minCh = 1 },
	{ id = "BallRoll",         w =  8, minCh = 1 },
	{ id = "ArcadeSelfBoot",   w =  7, minCh = 1 },
	{ id = "DoorCreak",        w =  6, minCh = 1 },
	{ id = "RideStarts",       w =  8, minCh = 2 },
	{ id = "JinglePulse",      w = 12, minCh = 2 },  -- ALL music stops ~9s
	{ id = "CameraDies",       w =  5, minCh = 2 },
	{ id = "MimicDecoy",       w = 12, minCh = 3 },
	{ id = "FootstepReplay",   w =  6, minCh = 3 },
	{ id = "MascotMoved",      w =  8, minCh = 4 },
	{ id = "LightWaveKills",   w =  7, minCh = 4 },
	{ id = "PA_Nametag",       w =  4, minCh = 4 },
}

-- ────────────────────────────── cctv ────────────────────────────────────
Config.Cameras = {
	{ id = "CAM01", label = "CAM 01 · ENTRANCE" },
	{ id = "CAM02", label = "CAM 02 · MAIN HALL" },
	{ id = "CAM03", label = "CAM 03 · BALL PIT" },
	{ id = "CAM04", label = "CAM 04 · ARCADE" },
	{ id = "CAM05", label = "CAM 05 · PARTY HALL" },
	{ id = "CAM06", label = "CAM 06 · CORRIDOR W" },
}

-- ────────────────────────────── nightmare modifiers ─────────────────────
Config.Nightmare = {
	clownSpeedMult = 1.15, batteryMult = 0.6, eventRateMult = 2.0,
	puzzleHardMode = true, extraLore = true, ventShortcuts = true,
}

return Config
