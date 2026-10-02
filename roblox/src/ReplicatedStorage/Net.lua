--!strict
--============================================================================
-- Net.lua (ReplicatedStorage) — RemoteEvent/RemoteFunction registry.
-- Create nothing ad-hoc: every channel is declared here so both sides agree.
--============================================================================

local RS = game:GetService("ReplicatedStorage")

local Net = {}
local folderName = "ClownHouseNet"

local function getRemote(className: string, name: string): Instance
	local folder = RS:FindFirstChild(folderName)
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = folderName
		folder.Parent = RS
	end
	local r = folder:FindFirstChild(name)
	if not r then
		r = Instance.new(className)
		r.Name = name
		r.Parent = folder
	end
	return r
end

-- Server → Client ------------------------------------------------------------
Net.ObjectiveChanged   = getRemote("RemoteEvent", "ObjectiveChanged")    -- (title, sub, toast)
Net.ChapterCard        = getRemote("RemoteEvent", "ChapterCard")         -- (num, title, sub)
Net.Announcement       = getRemote("RemoteEvent", "Announcement")        -- (speaker, text, isPA, dark)
Net.PlayCueAt          = getRemote("RemoteEvent", "PlayCueAt")           -- (cueId, position, intensity)
Net.PlayCueLocal       = getRemote("RemoteEvent", "PlayCueLocal")        -- (cueId, opts)
Net.HudState           = getRemote("RemoteEvent", "HudState")            -- (deltaTable: tickets, battery, item…)
Net.Downed             = getRemote("RemoteEvent", "Downed")              -- (bool, mode:"mash"|"revive")
Net.Jumpscare          = getRemote("RemoteEvent", "Jumpscare")           -- (clownId, strength)
Net.Danger             = getRemote("RemoteEvent", "Danger")              -- (scalar 0..1, cueId?)
Net.PartyMode          = getRemote("RemoteEvent", "PartyMode")           -- (on:boolean)
Net.FinaleMode         = getRemote("RemoteEvent", "FinaleMode")          -- ({redLights, arcadeMessage})
Net.DecoySpawn         = getRemote("RemoteEvent", "DecoySpawn")          -- (desc:HumanoidDescription?, position, nametag)
Net.NametagSuppressed  = getRemote("RemoteEvent", "NametagSuppressed")   -- (bool) - identity paranoia
Net.CctvFeed           = getRemote("RemoteEvent", "CctvFeed")            -- (camId, effect?:"dead"|"skew"|"party_replay")
Net.Ending             = getRemote("RemoteEvent", "Ending")              -- (endingId, payload)
Net.Achievement        = getRemote("RemoteEvent", "Achievement")         -- (name, desc)

-- Client → Server ------------------------------------------------------------
Net.Interact           = getRemote("RemoteEvent", "Interact")            -- (targetId)  validated server-side ONLY
Net.InteractHold       = getRemote("RemoteEvent", "InteractHold")        -- (targetId, dtHold)
Net.Noise              = getRemote("RemoteEvent", "Noise")               -- client predicts; server re-derives (anti-cheat: ignored for AI, used for FX)
Net.MashDowned         = getRemote("RemoteEvent", "MashDowned")          -- ()
Net.ReviveChannel      = getRemote("RemoteEvent", "ReviveChannel")       -- (targetPlayer, holding:boolean)
Net.PopBalloon         = getRemote("RemoteEvent", "PopBalloon")          -- (balloonId)
Net.CctvWatchStart     = getRemote("RemoteEvent", "CctvWatchStart")      -- (camId)
Net.CctvWatchStop      = getRemote("RemoteEvent", "CctvWatchStop")       -- ()
Net.LobbyReady         = getRemote("RemoteEvent", "LobbyReady")          -- (ready:boolean)
Net.LobbyVote          = getRemote("RemoteEvent", "LobbyVote")           -- (difficultyId)

-- Requests -------------------------------------------------------------------
Net.GetMatchState      = getRemote("RemoteFunction", "GetMatchState")    -- -> snapshot table
Net.GetLeaderstats     = getRemote("RemoteFunction", "GetLeaderstats")

return Net
