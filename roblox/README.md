# CLOWN HOUSE: AFTER HOURS — Roblox Studio Implementation

This folder contains the **multiplayer architecture** for the real Roblox build.
The browser prototype in the repo root proves the design; these files are the
Luau skeleton that turns it into a 1–6 player co-op game.

## Contents

```
roblox/
└── src/
    ├── ReplicatedStorage/
    │   ├── ClownHouseConfig.lua     -- chapters, clown stats, noise model, events, endings
    │   └── Net.lua                  -- every RemoteEvent/RemoteFunction, predeclared
    ├── ServerScriptService/
    │   ├── RoundManager.server.lua  -- lobby → chapters → endings; ThreatDirector;
    │   │                            -- PartyKeeper (Mr. Happy) directives; decoys; catch/revive
    │   ├── ObjectiveService.lua     -- chapter/objective state machine (single source of truth)
    │   └── ClownAI.lua              -- shared agent: senses → states → PathfindingService
    └── StarterPlayerScripts/
        └── ClownHouseClient.client.lua  -- HUD (mirrors prototype CSS), input, PA,
                                         -- CCTV ViewportFrames, decoys, jumpscares, endings
```

## Design mapping (prototype → Roblox)

| Prototype system | Where it lives in the Roblox build |
|---|---|
| Clown state machine (patrol/investigate/chase/search/stun) | `ClownAI.lua` |
| Noise bus (`emitNoise`) | `ThreatDirector:emitNoise` in RoundManager |
| Balloon sensors, Tickets aggro/table, decoys, music gates | `Config.Clowns.<id>.mechanics` + director hooks |
| Objectives/story steps | `ObjectiveService.lua` |
| CCTV | `Net.CctvFeed` + client ViewportFrame grid (see notes) |
| Downed / revive | `RoundManager` (`MashDowned`, `ReviveChannel`) |
| Endings A–D + menu residue | `Net.Ending`, DataStore flag `ch_partied` |
| HUD/menu spec | `ClownHouseClient.client.lua` (theme twins `css/style.css`) |

## Setup in Roblox Studio

1. **Rojo (recommended):** map `src/` to the obvious services, or drag the files
   into the services with matching names from the tree above.
2. **Map kit to build** (scripts expect these instances):
   ```
   workspace/
   ├─ Map/
   │  ├─ Architecture      (walls/floors; its own collision group for LOS raycasts)
   │  ├─ Rooms             (Box volumes per room, .Name = room id)
   │  ├─ Waypoints/
   │  │  ├─ Bobby/ Tickets/ Mimic/ Jingle/   (small invisible BaseParts)
   │  ├─ Interactables     (Parts with .Id attr: fuse_a, machine_3, cake, …)
   │  ├─ Lockers           (Models with .Occupant attr)
   │  ├─ Doors             (Models with .LockedBy attr)
   │  ├─ Cameras           (Parts named CAM01..CAM06, oriented)
   │  └─ SecurityTerminal
   └─ Clowns/              (spawned rigs live here at runtime)
   ServerStorage/
   └─ ClownRigs/           (Bobby, Tickets, Mimic, Jingle, MrHappy Models w/ Humanoid+Animator)
   ```
3. **Assets to author:** clown meshes/animations (walk, chase, idle-turn head),
   sounds (per-clown signatures per the design doc §10), jumpscare frames.
   Fill `rbxassetid://0` placeholders in client + `ReplicatedStorage.ClownHouseAssets`.
4. **Anti-cheat note:** interactions are validated server-side (distance, chapter,
   flags) — do not trust client-sent "picked up" events; the client only sends keys.

## Work items still engine-bound (intentionally placeholders)

- Real 3D map geometry, rigs, animations, sound ids (marked `TODO`/`ASSET HOOK`).
- CCTV full-fidelity streaming: recommended approach is **one ViewportFrame per cam
  with static map miniatures**; live full-map clones per frame are too heavy for
  low-end. The client file has the grid + wiring; choose per performance budget.
- DataStore persistence (achievements, lore gallery, Nightmare unlock) — wire
  `grantAchievement` to a ProfileService-style store.
- Lobby as a separate Place with teleport: RoundManager has the seams
  (`returnToLobby`, ready/vote remotes already declared in `Net.lua`).

Everything else — AI, threat direction, objectives, downed/revive, tickets,
decoys, endings — is working Luau that only needs the map kit to run.
