--!strict
--============================================================================
-- ClownHouseClient.client.lua (StarterPlayerScripts · LocalScript)
-- HUD (mirrors the prototype CSS), input, flashlight/stamina prediction,
-- PA subtitles, CCTV screen, jumpscares, decoys, downed UI, ending screens.
--============================================================================

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local RS = game:GetService("ReplicatedStorage")
local Config = require(RS:WaitForChild("ClownHouseConfig"))
local Net = require(RS:WaitForChild("Net"))

local player = Players.LocalPlayer

------------------------------------------------------------------ theme
local THEME = {
	panel = Color3.fromRGB(10, 12, 16), paper = Color3.fromRGB(242, 237, 226),
	red = Color3.fromRGB(255, 45, 63), amber = Color3.fromRGB(255, 178, 56),
	cyan = Color3.fromRGB(89, 247, 255),
}
local FONT = Enum.Font.Code

------------------------------------------------------------------ gui build
local gui = Instance.new("ScreenGui")
gui.Name = "ClownHouse"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function label(props): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1; l.Font = FONT; l.TextColor3 = THEME.paper
	l.TextXAlignment = Enum.TextXAlignment.Left
	for k, v in pairs(props) do (l :: any)[k] = v end
	return l
end
local function frame(props): Frame
	local f = Instance.new("Frame")
	f.BackgroundColor3 = THEME.panel; f.BackgroundTransparency = 0.18; f.BorderSizePixel = 0
	for k, v in pairs(props) do (f :: any)[k] = v end
	return f
end

-- vignette + danger
local function vignetteLayer(color: Color3, transparency: number): ImageLabel
	local v = Instance.new("ImageLabel")
	v.AnchorPoint = Vector2.new(0.5, 0.5); v.Position = UDim2.fromScale(0.5, 0.5)
	v.Size = UDim2.fromScale(1, 1); v.BackgroundTransparency = 1
	v.Image = "rbxassetid://4576475446" -- radial gradient; swap for authored asset
	v.ImageColor3 = color; v.ImageTransparency = transparency; v.Parent = gui
	return v
end
local vign = vignetteLayer(Color3.new(0, 0, 0), 0.45)
local danger = vignetteLayer(THEME.red, 1)

-- objective panel
local objPanel = frame { Size = UDim2.fromOffset(300, 84), Position = UDim2.fromOffset(24, 20), Parent = gui }
local accent = frame { Size = UDim2.fromOffset(3, 84), BackgroundColor3 = THEME.red, BackgroundTransparency = 0, Parent = objPanel }
label { Text = "OBJECTIVE", TextSize = 11, TextTransparency = 0.45,
	Position = UDim2.fromOffset(12, 8), Size = UDim2.fromOffset(200, 14), Parent = objPanel }
local objTitle = label { Text = "", TextSize = 16, Position = UDim2.fromOffset(12, 26),
	Size = UDim2.fromOffset(280, 22), TextColor3 = Color3.new(1, 1, 1), Parent = objPanel }
local objSub = label { Text = "", TextSize = 12, TextTransparency = 0.25, TextWrapped = true,
	TextYAlignment = Enum.TextYAlignment.Top,
	Position = UDim2.fromOffset(12, 48), Size = UDim2.fromOffset(280, 34), Parent = objPanel }

-- party list
local partyList = frame { AnchorPoint = Vector2.new(1, 0), Size = UDim2.fromOffset(190, 24),
	Position = UDim2.new(1, -24, 0, 20), BackgroundTransparency = 1, Parent = gui }
local partyLayout = Instance.new("UIListLayout")
partyLayout.FillDirection = Enum.FillDirection.Vertical
partyLayout.HorizontalAlignment = Enum.HorizontalAlignment.Right
partyLayout.Padding = UDim.new(0, 4); partyLayout.Parent = partyList

-- battery / item / tickets
local batShell = frame { Size = UDim2.fromOffset(170, 14), Position = UDim2.new(0, 24, 1, -34), Parent = gui }
local batFill = frame { Size = UDim2.new(1, -4, 1, -4), Position = UDim2.fromOffset(2, 2),
	BackgroundColor3 = THEME.amber, BackgroundTransparency = 0, Parent = batShell }
label { Text = "FLASHLIGHT", TextSize = 10, TextTransparency = 0.45,
	Position = UDim2.new(0, 24, 1, -56), Size = UDim2.fromOffset(160, 12), Parent = gui }
local itemLabel = label { Text = "EMPTY", TextSize = 12, TextXAlignment = Enum.TextXAlignment.Right,
	AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -24, 1, -20),
	Size = UDim2.fromOffset(220, 20), Parent = gui }
local ticketsChip = label { Text = "", TextSize = 13, TextColor3 = THEME.amber,
	TextXAlignment = Enum.TextXAlignment.Right, AnchorPoint = Vector2.new(1, 1),
	Position = UDim2.new(1, -24, 1, -60), Size = UDim2.fromOffset(220, 20), Visible = false, Parent = gui }

-- prompt / subtitles / stamps / downed
local prompt = label { Text = "", TextSize = 14, AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.new(0.5, 0, 0.58, 0), Size = UDim2.fromOffset(460, 26),
	TextXAlignment = Enum.TextXAlignment.Center, Visible = false, Parent = gui }
local subPanel = frame { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 1, -120),
	Size = UDim2.fromOffset(640, 44), BackgroundTransparency = 0.28, Visible = false, Parent = gui }
local subSpeaker = label { Text = "", TextSize = 13, TextColor3 = THEME.red,
	Position = UDim2.fromOffset(16, 5), Size = UDim2.fromOffset(240, 16), Parent = subPanel }
local subText = label { Text = "", TextSize = 15, TextWrapped = true,
	Position = UDim2.fromOffset(16, 20), Size = UDim2.fromOffset(608, 22), Parent = subPanel }
local stamp = label { Text = "", TextSize = 40, AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.42), Size = UDim2.fromOffset(900, 60),
	TextXAlignment = Enum.TextXAlignment.Center, Visible = false, Parent = gui }
local stampSub = label { Text = "", TextSize = 13, AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.48), Size = UDim2.fromOffset(900, 20),
	TextXAlignment = Enum.TextXAlignment.Center, TextTransparency = 0.3, Visible = false, Parent = gui }
local downedLabel = label { Text = "", TextSize = 34, AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.45), Size = UDim2.fromOffset(900, 130),
	TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = THEME.red, Visible = false, Parent = gui }

------------------------------------------------------------------ client state
local toggleCCTV -- forward declaration (defined below)

local state = {
	battery = 100, hasFlashlight = false, flashOn = false,
	stamina = 100, downed = false, mashMode = false,
	subQueue = {}, subBusy = false, currentInteract = nil,
}

------------------------------------------------------------------ flashlight & stamina (predicted; server authoritative)
local torch = Instance.new("SpotLight")
torch.Angle = 55; torch.Range = 60; torch.Brightness = 2.2
torch.Color = Color3.fromRGB(255, 240, 208); torch.Enabled = false

local function charHead(): BasePart?
	local c = player.Character; return c and c:FindFirstChild("Head") :: BasePart?
end

UserInputService.InputBegan:Connect(function(io, gp)
	if gp then return end
	if io.KeyCode == Enum.KeyCode.F and state.hasFlashlight and not state.downed then
		state.flashOn = not state.flashOn and state.battery > 0
		torch.Enabled = state.flashOn
		if state.flashOn then Net.Interact:FireServer("flash_on") end
	elseif io.KeyCode == Enum.KeyCode.E and state.downed and state.mashMode then
		Net.MashDowned:FireServer()
	elseif io.KeyCode == Enum.KeyCode.E and state.currentInteract and not state.downed then
		Net.Interact:FireServer(state.currentInteract)
	elseif io.KeyCode == Enum.KeyCode.C then
		toggleCCTV()
	end
end)

RunService.Heartbeat:Connect(function(dt)
	-- torch follows camera-side head
	local h = charHead()
	if h and torch.Parent ~= h then torch.Parent = h end
	-- battery drain
	if state.flashOn then
		state.battery = math.max(0, state.battery - dt * Config.FLASHDRAIN_PER_SEC)
		if state.battery <= 0 then state.flashOn = false; torch.Enabled = false end
	end
	batFill.Size = UDim2.new(state.battery / 100, -4, 1, -4)
	batFill.BackgroundColor3 = state.battery < 25 and THEME.red or THEME.amber
end)

------------------------------------------------------------------ objective / chapter / PA
Net.ObjectiveChanged.OnClientEvent:Connect(function(title, sub, toast)
	objTitle.Text = title; objSub.Text = sub or ""
	if toast then
		stamp.Text = "NEW OBJECTIVE"; stamp.TextSize = 14; stamp.TextColor3 = THEME.red
		stampSub.Text = title
		stamp.Visible = true; stampSub.Visible = true
		task.delay(3, function() stamp.Visible = false; stampSub.Visible = false
			stamp.TextSize = 40; stamp.TextColor3 = Color3.new(1, 1, 1) end)
	end
end)

Net.ChapterCard.OnClientEvent:Connect(function(num, title, sub)
	stamp.Text = string.format("%s — %s", tostring(num), tostring(title))
	stampSub.Text = tostring(sub)
	stamp.Visible = true; stampSub.Visible = true
	task.delay(4.2, function() stamp.Visible = false; stampSub.Visible = false end)
end)

local function nextSub()
	local s = table.remove(state.subQueue, 1)
	if not s then state.subBusy = false; subPanel.Visible = false; return end
	state.subBusy = true; subPanel.Visible = true
	subSpeaker.Text = s.speaker
	subSpeaker.TextColor3 = s.pa and THEME.amber or THEME.red
	task.spawn(function()
		subText.Text = ""
		for i = 1, #s.text, 2 do subText.Text = string.sub(s.text, 1, i); task.wait(0.016) end
		task.wait(math.max(2.2, #s.text * 0.05))
		nextSub()
	end)
end
Net.Announcement.OnClientEvent:Connect(function(speaker, text, isPA)
	table.insert(state.subQueue, { speaker = speaker, text = text, pa = isPA })
	if not state.subBusy then nextSub() end
end)

Net.Danger.OnClientEvent:Connect(function(level)
	TweenService:Create(danger, TweenInfo.new(0.8),
		{ ImageTransparency = 1 - math.clamp(level or 0, 0, 1) * 0.55 }):Play()
end)

Net.HudState.OnClientEvent:Connect(function(delta)
	if delta.tickets ~= nil then
		ticketsChip.Visible = true
		ticketsChip.Text = tostring(delta.tickets) .. " TICKETS"
	end
	if delta.item then itemLabel.Text = delta.item end
	if delta.flashlight ~= nil then state.hasFlashlight = delta.flashlight end
	if delta.battery then state.battery = math.min(100, state.battery + delta.battery) end
end)

------------------------------------------------------------------ jumpscare (client)
Net.Jumpscare.OnClientEvent:Connect(function(clownId, strength)
	-- AUTHORED ASSET HOOK: swap in per-clown frame images/sound ids
	local sc = Instance.new("ImageLabel")
	sc.AnchorPoint = Vector2.new(0.5, 0.5); sc.Position = UDim2.fromScale(0.5, 0.5)
	sc.Size = UDim2.fromScale(1.2, 1.2); sc.BackgroundColor3 = Color3.new(0, 0, 0)
	sc.BorderSizePixel = 0; sc.Parent = gui; sc.ZIndex = 50
	local snd = Instance.new("Sound")
	snd.SoundId = "rbxassetid://0" -- TODO: jumpscare sting per clownId
	snd.Volume = 0.9; snd.Parent = sc; snd:Play()
	-- jolt
	local ui = script; local t0 = os.clock()
	local conn; conn = RunService.RenderStepped:Connect(function()
		sc.Position = UDim2.fromScale(0.5 + (math.random() - 0.5) * 0.05, 0.5 + (math.random() - 0.5) * 0.05)
		if os.clock() - t0 > 0.9 then conn:Disconnect(); sc:Destroy() end
	end)
end)

------------------------------------------------------------------ downed
Net.Downed.OnClientEvent:Connect(function(isDowned, mode)
	state.downed = isDowned
	state.mashMode = (mode == "mash")
	if isDowned then
		downedLabel.Visible = true
		downedLabel.Text = mode == "revive" and
			"YOU ARE DOWN\n\nA teammate can save you." or
			"YOU ARE DOWN\n\nMASH [E] TO GET UP"
	else
		downedLabel.Visible = false
	end
end)

------------------------------------------------------------------ decoys (Mimic)
Net.DecoySpawn.OnClientEvent:Connect(function(desc: HumanoidDescription?, pos: Vector3, tag: string)
	-- materialize a decoy NPC that mimics the described player
	local ok, model = pcall(function()
		local m = Players:CreateHumanoidModelFromDescription(
			desc or Instance.new("HumanoidDescription"), Enum.HumanoidRigType.R15)
		m.Name = tag
		m:PivotTo(CFrame.new(pos))
		m.Parent = workspace
		return m
	end)
	if not ok or not model then return end
	-- subtle wrongness: despawn on close approach or after a beat
	task.spawn(function()
		local t0 = os.clock()
		while model.Parent and os.clock() - t0 < 24 do
			local myC = player.Character
			if myC and (myC:GetPivot().Position - pos).Magnitude < 8 then
				-- instantly face the real player, then vanish
				model:PivotTo(CFrame.lookAt(pos, myC:GetPivot().Position))
				task.wait(0.15)
				model:Destroy()
				return
			end
			task.wait(0.25)
		end
		if model.Parent then model:Destroy() end
	end)
end)

------------------------------------------------------------------ nametag suppression (paranoia layer)
Net.NametagSuppressed.OnClientEvent:Connect(function(on: boolean)
	for _, pl in ipairs(Players:GetPlayers()) do
		if pl ~= player and pl.Character then
			local h = pl.Character:FindFirstChild("Humanoid")
			if h then
				h.DisplayDistanceType = on and Enum.HumanoidDisplayDistanceType.None
					or Enum.HumanoidDisplayDistanceType.Viewer
				if not on then h.NameDisplayDistance = 18 end
			end
		end
	end
end)

------------------------------------------------------------------ CCTV (ViewportFrame screen)
local cctv = nil
toggleCCTV = function()
	if cctv then cctv:Destroy(); cctv = nil; Net.CctvWatchStop:FireServer(); return end
	local rootPart = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	local term = workspace.Map and workspace.Map:FindFirstChild("SecurityTerminal")
	if not rootPart or not term or (rootPart.Position - term.Position).Magnitude > 18 then return end
	cctv = Instance.new("Frame")
	cctv.Size = UDim2.fromScale(0.86, 0.8); cctv.AnchorPoint = Vector2.new(0.5, 0.5)
	cctv.Position = UDim2.fromScale(0.5, 0.5); cctv.BackgroundColor3 = Color3.fromRGB(3, 5, 7)
	cctv.BorderSizePixel = 0; cctv.Parent = gui
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.new(1/3, -8, 0.5, -8); grid.CellPadding = UDim2.fromOffset(6, 6)
	grid.Parent = cctv
	for _, camDef in ipairs(Config.Cameras) do
		local cell = Instance.new("ViewportFrame")
		cell.BackgroundColor3 = Color3.new(0, 0, 0); cell.Parent = cctv
		local lab = label { Text = camDef.label, TextSize = 10, ZIndex = 3, Parent = cell }
		local camPart = workspace.Map.Cameras:FindFirstChild(camDef.id)
		if camPart then
			local world_ = Instance.new("WorldModel"); world_.Parent = cell
			-- STREAMLIT APPROACH: clone a static shell of the map per cell, or (cheaper)
			-- use one ViewportWorld + state clips. FULL BUILD OPTION: pre-authored
			-- "cctv rooms" uitzend miniatures. Choose per performance budget.
			local vc = Instance.new("Camera"); vc.Parent = cell
			vc.CFrame = camPart.CFrame; cell.CurrentCamera = vc
		end
	end
	Net.CctvWatchStart:FireServer("ALL")
end

------------------------------------------------------------------ finale / party mode environment swaps
Net.PartyMode.OnClientEvent:Connect(function(on)
	-- lighting tween to warm party config; swap skybox/atmosphere
	game.Lighting.Brightness = on and 2 or 0
end)
Net.FinaleMode.OnClientEvent:Connect(function(payload)
	game.Lighting.Ambient = Color3.fromRGB(40, 8, 8)
	danger.ImageTransparency = 0.55
end)

------------------------------------------------------------------ endings
Net.Ending.OnClientEvent:Connect(function(endingId, payload)
	gui.Enabled = false
	task.wait(1)
	gui.Enabled = true
	for _, ch in ipairs(gui:GetChildren()) do ch.Visible = false end
	local screen = label {
		Text = "", TextSize = 16, TextWrapped = true,
		AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(680, 300), TextXAlignment = Enum.TextXAlignment.Center,
		Parent = gui,
	}
	local bodies = {
		A = "ENDING A — ESCAPE\n\nThe doors close behind you, politely.\nThen one balloon floats past the camera.",
		B = "ENDING B — SHUTDOWN\n\nPARTYKEEPER: OFFLINE",
		C = "ENDING C — THE PARTY\n\n\"Thank you for celebrating with us.\"",
		D = "SECRET ENDING\n\n2018-10-31 21:16 party_protocol: ENGAGE (manual)\noperator: S. VERMEER",
	}
	local full = bodies[endingId] or endingId
	task.spawn(function()
		for i = 1, #full, 3 do screen.Text = string.sub(full, 1, i); task.wait(0.03) end
	end)
end)

Net.Achievement.OnClientEvent:Connect(function(name, desc)
	stamp.Text = "ACHIEVEMENT — " .. tostring(name):gsub("_", " ")
	stamp.TextSize = 16; stamp.TextColor3 = THEME.amber
	stamp.Visible = true
	task.delay(3, function() stamp.Visible = false; stamp.TextSize = 40; stamp.TextColor3 = Color3.new(1, 1, 1) end)
end)

print("[CLOWN HOUSE] client HUD armed.")
