# CLOWN HOUSE: AFTER HOURS
### *"The party ended. They didn't."*

**Genre:** Multiplayer co-op horror (1–6 players) · **Platform:** Roblox · **Session length:** 20–35 min
**Fantasy:** What if an abandoned Dutch indoor playground became a multiplayer horror game?
**Core identity:** CHILDHOOD FUN + ABANDONED PLAYGROUND + CLOWNS + MULTIPLAYER PARANOIA + MYSTERY

> This document is the complete design for the game. The playable browser prototype
> (`index.html`, served at the live preview) implements a polished solo slice of it.
> The `roblox/` folder contains the Luau architecture for the real multiplayer build.

---

## TABLE OF CONTENTS

1. Pillars & Tone
2. Story — HappyLand, the Final Party, PartyKeeper
3. The Clown Crew (5 antagonists, full specs)
4. Player Systems (inventory, hiding, downed/revive, paranoia tools)
5. Game Structure — 5 chapters, beat by beat
6. Map Design (all 20 areas + ASCII plan + shortcut web)
7. Puzzles Catalogue
8. Random Event Director
9. Security Camera System
10. Audio Design & Clown Signatures
11. AI Specification
12. Endings A–D
13. Replayability: Nightmare Mode & Custom Night
14. Lore Collectibles (full list with content)
15. Achievements
16. Lobby & Social Layer
17. UI/UX Specification (menu, HUD, warnings)
18. Lighting & Visual Direction
19. Balancing Tables
20. Prototype Coverage — what's playable vs. Roblox-only

---

# 1. PILLARS & TONE

| Pillar | Rule |
|---|---|
| **Familiar, not cliché** | The horror comes from a place every player recognizes — soft-play castles, ball pits, birthday rooms — rendered lovingly, then bent wrong. |
| **Color is the monster** | Never default to "dark + blood". Bright primary colors under failing light are scarier than black corridors. |
| **The party is the protocol** | The clowns aren't evil. They're *still working*. Horror = hospitality that cannot end. |
| **Paranoia is multiplayer** | The game is engineered so players stop trusting their own teammates (Mimic), their own eyes (CCTV), and their own ears (Jingle). |
| **Decisions, not corridors** | Every system offers a risk/reward fork: split up or cluster, light or dark, noise or silence, tickets or safety, finish objectives or hunt lore. |
| **Restraint** | Few jumpscares. Long anticipation. Silence as an instrument. |

**Tone anchors:** the smell of an old ball pit; fluorescent light on sticky plastic; a music box heard through two walls; a mascot that waves *one beat too long*.

---

# 2. STORY

## HappyLand Family Fun Center

Opened 1994. The Netherlands' most beloved indoor playground chain flagship: climbing structures, ball pits, trampolines, arcade, prize counter, 3 birthday rooms, food court, staff + security + maintenance wings.

**Suddenly closed ~8 years ago.**
Official line: *"a serious electrical malfunction forced permanent closure."*

### What actually happened

The operator (fictional: **Sandbreek Robotics**) installed **PartyKeeper**, an automated mascot entertainment system — five networked clown units with distinct party functions, orchestrated to "maximize birthday engagement." PartyKeeper had `party_protocol.start`.

Nobody ever wrote `party_protocol.stop`.

On 31 October, the final birthday — **6 children** — ran until **21:17**, when CCTV timestamps freeze. The mascot performer scheduled that night never clocked out. The children were found safe, and none could clearly explain. The company sealed the building rather than destroy the assets.

PartyKeeper has spent 8 years keeping that party in progress.

### The player's way in

- Players are teen urban explorers filming for their channel.
- Enter through a broken side entrance at 23:43. Doors lock. Phones die. Emergency lights wake.
- Speaker crackle: **"Welcome back, birthday guests."** — they've never been here.

### Themes

- Hospitality as a cage: the building *wants* you, sincerely.
- Automation without an end condition: the scariest line of code is the missing one.
- The final party was **manually activated** (Secret Ending): a person pressed START. The mystery of *who* and *why* is left open on purpose.

---

# 3. THE CLOWN CREW

Design law: **every clown is a system, not a monster.** Recognizable silhouette, color, audio signature, behavior loop, counterplay.

## 3.1 BOBBY — The Balloon Clown

| | |
|---|---|
| **Visual** | 2.4m tall, thin, red/teal suit, cone hat. Always carries a cluster of balloons that hide his silhouette and bob *against* the air current. |
| **Palette** | Carnival red #D8403A · sky teal #2A8FC4 |
| **Audio signature** | Rubber squeaks, balloon-string rustle, occasional high giggle. Balloons pop faintly in the distance as he loses temper. |
| **Behavior** | Patrols Ball Pit / Main Playground / Birthday Rooms. Plants balloon "sensors". Investigate noise aggressively. |
| **Mechanic — BALLOON SENSORS** | Balloons spawn around the map. A balloon **slowly drifting toward you = Bobby is within ~12m**. You can pop them (loud, +noise). Popping repeatedly accelerates Bobby (+6% speed per pop) and after 3 pops he knows *your* position. |
| **Weakness** | Distracted by noise elsewhere (arcade machines, thrown items — Roblox build: throwable plushes). Balloons drift toward *any* sound, including decoys. |
| **AI loop** | PATROL → HEAR(balloon pops, steps) → MOVE TO BALLOON NEAREST SOUND → SEARCH spiral → demote to PATROL. Chase on LOS, breaks fast if LOS lost (balloons keep last-seen echo for 2s). |
| **Signature scare** | You round a corner; a wall of balloons silently turns to face you, then parts to reveal nothing. The balloons keep following you for the next minute. |

## 3.2 JINGLE — The Music Clown

| | |
|---|---|
| **Visual** | Purple/teal jester, three-tipped hat with bells, carries a battered accordion. Permanent painted smile that's *slightly too wide* under flicker. |
| **Palette** | Jester purple #6A3AA0 · faded teal #2FB0A0 |
| **Audio signature** | **The building's music is his voice.** Music box renditions of birthday melodies that slow and detune as he nears. **When the music stops — he is close.** Bell chimes on every footstep (Doppler-delayed: you hear the *previous* step). |
| **Behavior** | Follows the music he plays. Wanders high-traffic rooms. |
| **Mechanic — MUSIC GATES** | Some doors/machines require music playing (the party can't continue in silence). Activating music = announcing your position. Jingle **moves toward active music sources**, including player-triggered ones. |
| **Weakness** | Can't hear normal footsteps over his own music. Absolute silence blinds him (he stops, swivels, plays louder — which wakes Bobby). |
| **AI loop** | STATE "PLAYING" (wander near sound sources) → if a source within 8m is *silent* for >5s → approach → if player heard making music: CHASE on melody-line (he follows the tune, not LOS). |
| **Signature scare** | All speakers cut at once. Three seconds of nothing. Then music directly above you, even though the room has no speaker. |

## 3.3 MIMIC — The Copycat Clown

| | |
|---|---|
| **Visual** | Out of the corner of your eye: a teammate. Head-on: 2.6m gaunt pale figure, grey skin-suit, hollow dripping eyes, thin smile. Transitions are never shown — it is *there*, or it isn't. |
| **Palette** | Ash grey #53535C · void black |
| **Audio signature** | None of its own — it plays *your* footsteps, fractionally delayed. When close: a whisper-layer under teammates' voice chat. |
| **Behavior** | Rare. Activates when players separate. Appears as a teammate standing in plausible-but-wrong places. |
| **Mechanic — IMPERFECT COPY** | Copies avatar, colors, *nametag*. Never perfect. Tells: stands **perfectly still**; slightly wrong walk animation (arms don't swing); appears where the real player wasn't; nametag flickers for one frame on approach; no footstep audio unless you hear your own twice; doesn't answer on comms; turns to face you *instantly*, never gradually. |
| **Paranoia engine** | Server silently swaps real player nametags off for 30s windows during Chapter 3+ (visible only at <6m). The fake can *only* hurt you if you **let it close**: damage window within 3m. Running is always safe — it's slow. The terror is deciding *which figure to run from*. |
| **Weakness** | It cannot open doors. It cannot sprint. If three+ players look at it simultaneously, it despawns (it can't hold the copy under attention). |
| **AI loop** | PICK LONE PLAYER → SPAWN DECOY 10–20m ahead on their predicted path → WAIT → on approach <8m: face instantly → on approach <3m or ignore >20s: vanish (whisper) → reselect. Escalates to physical hunts in late chapters/finale. |
| **Signature scare** | You're guiding a teammate on CCTV: "go left, left — wait. Who is that standing behind you?" The teammate on cam turns around, and there are *two of them*. |

## 3.4 TICKETS — The Prize Clown

| | |
|---|---|
| **Visual** | Stocky, green/gold suit, coin-topped cap, a ticket roll spinning in one fist. $ painted on one cheek. Slightly cross-eyed grin. |
| **Palette** | Prize green #1F7D3D · cheap gold #D4A017 |
| **Audio signature** | Coin rattles, ticket-tear flutter, slot-machine chimes *played slightly too fast*. Jackpot fanfare when he becomes aggressive — you hear the loss coming. |
| **Behavior** | **Territorial, not patrolling.** Circles the Arcade / Prize Counter / ticket machines. Notices *theft*, not presence. |
| **Mechanic — THE TAXMAN** | Progress requires tickets (needed for the prize/keycard path). Every ticket taken is logged. 0–2 stolen: indifferent. 3–5: agitated patrol, faster. 6+: **furious** — leaves territory, pursues the thief with the most tickets, ignores others unless noisy. Tickets carried make you *audible* (roll rattle scales with count). |
| **Weakness** | Flashlight beam to the face **stuns him 1s** (gold-plated eyes). Drop tickets as an item to dump his aggro (he returns to count them greedily). |
| **AI loop** | COUNT (stand at machines, idle) → THEFT HEARD → INSPECT machine → if ticket deficit grows: AGITATE → FURY at threshold → CHASE carrier (weighted by tickets held). |
| **Signature scare** | The prize counter plush wall: one of the teddy bears is breathing. It's Tickets standing among them, counting your tickets out loud. |

## 3.5 MR. HAPPY — The Host

| | |
|---|---|
| **Visual** | Withheld until the finale: 3.2m, yellow/purple, top hat, smile with *visible white squares of teeth*, cartoon sun-face gone wrong. Also exists as posters, the TV face, the drawings' tall seventh figure. |
| **Palette** | Happy yellow #FFD23C · midnight purple #2D1B4E |
| **Audio signature** | The PA. Warm, slightly-off kids-show host cadence that detunes word by word when displeased. Speaker *thump* before he speaks, like someone picking up a microphone. |
| **Behavior** | The distributed intelligence: PartyKeeper wearing a face. Directs other clowns (shared last-seen positions), controls doors/lights/music, narrates. |
| **Mechanic — THE CURTAIN** | He does not chase (until one scripted finale appearance). He *changes the rules*: kills a corridor's lights, locks a door behind you, plays Jingle's music from the wrong end of the map, alters CCTV timestamps. He reacts to what players **do**, not where they are. |
| **Weakness** | None combat-wise. He is beaten with the shutdown code — or outlasted (Ending A). |
| **Signature scare** | Throughout the game, every poster of him faces the wall you entered from. In the finale, they've all turned to face the room's center. |

### Roster timing (default)

| Chapter | Active |
|---|---|
| 1 — After Hours | None physically. Bobby appears dormant in CCTV only. Events only. |
| 2 — The Party | BOBBY patrols. TICKETS wakes on 2nd stolen ticket. JINGLE audio presence. |
| 3 — Don't Split Up | + MIMIC decoys. Jingle gates appear. |
| 4 — Maintenance | All of the above. MIMIC physical hunts. Mr. Happy starts touching lights/doors. |
| 5 — The Last Birthday | All five aggressive; finale = full-hunt sequence. |

---

# 4. PLAYER SYSTEMS

## Inventory (breast-pocket, not RPG)
Max 4 slots, one-hand items stack logically:
- **Flashlight** (toggle, battery 60–80s) — batteries scattered, +45%.
- **Fuse ×2**, **Tickets ×n** (audible at high count), **Security Badge** (door group), **Party Key** (Room 0), **VHS ×4** (lore, no slot cost), **Screwdriver** (Roblox: opens vent shortcuts), **Plush decoys** (Roblox: throwable noise).

## Movement & noise
- Walk / sprint (stamina ~5s). Sprinting = noise radius 7m. Ball pit = slow + crunchy noise. Trampolines bounce (fun + risky: boing noise).
- Light discipline: flashlight helps you see but extends clown view range on you and stuns/aggros per-clown.

## Hiding
Lockers, cabinets, fridge, under tables, behind structures.
- Hidden blocks LOS, but entering within sight is fatal. Noise near the spot = investigation.
- Detection skill per clown: Bobby 40% · Jingle 30% · Tickets 25% · Mimic **95%** (it understands hiding; it's what it does).
- Roblox multiplayer: locker space limited (the horror of the full locker when your friend needs it).

## Downed / Revive
- First incapacitation → **DOWNED**: crawling vision-down state. Solo: mash to struggle up (once). Multiplayer: teammates revive (4s channel). 8s bleed-out window.
- Second incapacitation → eliminated → **spectate** (free-cam or CCTV-assist: eliminated players can still help on cameras — keeps 1–6 player sessions fun).

## Communication pressure
- Nametags render <6m only (post-Chapter 2). Voice chat proximity-based. The game *wants* "is that actually you?" moments.
- Optional **buddy handshake**: players set a code word in lobby; Mimic never knows it. (Cheap, hugely effective paranoia valve.)

---

# 5. GAME STRUCTURE — FIVE CHAPTERS

*(The web prototype implements this full arc in compressed solo form.)*

## CHAPTER 1 — AFTER HOURS  *(~5 min, dread)*
Objectives: get inside (done in intro) → find flashlight → restore emergency power → find security office → locate main controls.
- **Environment horror only:** an arcade cabinet boots up behind you · a single ball rolls across the hall · the coin-op ride rocks for 3 seconds · 3 seconds of birthday music, then nothing · a balloon that wasn't there · CCTV #2 in the security office shows a clown standing in the main hall — but the hall is empty when you arrive.
- Teaches: movement, flashlight, interactions, hiding, noise.

## CHAPTER 2 — THE PARTY  *(~5–8 min, the trap springs)*
Power restored → **the entire building turns on**: arcade lights, party music, garlands, PA.
**`PARTY MODE ACTIVATED` — "WELCOME BACK, BIRTHDAY GUESTS!"**
Party tasks (any order, map-wide): collect tickets · start arcade machines · find birthday candles · activate party rooms · find the keycard.
- BOBBY patrols; balloons begin to *follow*. TICKETS stakes out the arcade economy. JINGLE: music is now your enemy and your tool.

## CHAPTER 3 — DON'T SPLIT UP  *(~5 min, paranoia)*
Some systems need **simultaneous activation** (30s window):
Button A (arcade) + Button B (ball pit) + Button C (party hall).
- Coordination forces separation; separation feeds MIMIC. Nametags fail. CCTV becomes the teamwork tool ("I'll call out, you run").
- Failure = relocate buttons (they re-randomize), aggro bump, PA mockery.

## CHAPTER 4 — MAINTENANCE  *(~4–6 min, answers)*
Badge door beneath the color: concrete, pipes, lockers, server racks, broken mascot costumes, CCTV wall, VHS tapes.
- Documents reveal **PARTYKEEPER**: party_protocol with no `.stop`.
- Find 2-part shutdown code (staff memo **17** · kitchen board **09** → **09-17**, the CCTV freeze time).
- Decision: enter code (arms Ending B/D path) or ignore it and just... finish the party (Ending A path).

## CHAPTER 5 — THE LAST BIRTHDAY  *(~4–6 min, the bill)*
Yellow door. Party Room 0, preserved for 8 years: plates, hats, presents, drawings, the cake.
Candles self-light. TV face: **"You haven't finished the party."**
Final objective: **FINISH THE PARTY** (blow the candles) while systems fight you.
→ **FINAL CHASE** through the whole building: all doors slam open at once, lights gone red, arcade walls read **"1 PLAYER REMAINING"**, the ball pit is *empty*, PA loops "PLEASE REMAIN FOR THE PARTY." Mr. Happy physically appears once — the doorway of the main hall, three meters of yellow in the strobing dark.
Emergency exit in storage. Decide during the run: detour to PartyKeeper (shutdown armed = better ending) or sprint out.

---

# 6. MAP DESIGN

**20 areas, landmark-driven, shortcut-web layout** (prototype implements all 18 interior rooms; the 2 "secret" areas are Room 0 + PartyKeeper racks).

```
        N (emergency exit, storage north wall)
 ┌──────────┬───────┬────────┬──────────┬─────────┬──────┬──────────────┐
 │ KITCHEN  │STORAGE│ STAFF  │ SECURITY │ MAINT.  │B-DAY1│B-DAY2 │ B-0  │
 │          │ (fuse)│(lockers│  (CCTV)  │(PARTY-  │(vhs) │(costume)│CAKE│
 │(whitebrd)│(VHS3) │ memo)  │ (log)    │ KEEPER) │      │         │ TV │
 ├────┬─────┴───────┴────────┴──────┬───┴─────────┴──────┴─────────┴────┤
 │    │        CORRIDOR (breaker, west→east, painted kids' murals)       │
FOOD │                              (arch) (arch)          PARTY HALL   │B-DAY
COURT│                                                         (btn C)  │HALL
 ├───┴───────┐   ┌───────┐    │                              (opening) │
 │           │   │       │    │                ARCADE                    │
 │ BALL PIT  │◄──┤ MAIN  ├────┤      (cabinet rows, neon, btn A)         │
 │ (btn B)   │   │ HALL  │    ├───────────────┬──────────────────────────┤
 │           │   │climb/ │    │ (gh)          │ PRIZE COUNTER (pedestal, │
 │           │   │slide/ │    │               │  plush wall, badge)      │
 │           │   │tramp  │    │               │                          │
 └───────────┘   └───────┘    └───────────────┴──────────────────────────┘
                 │  TOILETS │ FOYER (locked) │ RECEPTION   │
                 └──────────┴────────────────┴─────────────┘
                                    S (main entrance, sealed)
```

**Navigation landmarks:** rainbow mural (main hall), the giant slide (SE), neon ARCADE sign visible from main hall, EXIT signs, the yellow door (east corridor top), the red EXIT glow (storage). Nothing requires a map screen — the building teaches itself.

**Shortcut web:** two corridor arches into main hall · food court bridges pit/corridor/hall · arcade↔prize↔main-hall triangle · party hall as east spine · every chase route has at least 2 escapes.

---

# 7. PUZZLES CATALOGUE

| Puzzle | Where | Rule | Horror lever |
|---|---|---|---|
| **Circuit/breaker** | find 2 fuses → breaker | scavenger geometry; teaches map | the moment power returns is the scare |
| **Ticket economy** | arcade | machines pay 1 ticket & **noise**; steal many = Tickets fury | you choose greed |
| **Party buttons (simultaneous)** | 3 far rooms, 30s | forces split-up & callouts | Mimic punishes separation |
| **Music gates** (Roblox full build; prototyped audio-only) | doors keyed to melody | play music to open = ping Jingle | the tool is the bait |
| **CCTV deduction** | security | watch a cam to learn *which* room holds the fuse/candle/code (re-randomized per match) | screens lie sometimes |
| **Audio sequence** (Roblox: party room organ) | repeat 4-note motif | memory under time pressure | each correct note is loud |
| **Birthday arrangement** | Room 0-ish | place hats/candles to match the 1994 drawing | six items, five you can find — the sixth is *you* |
| **Shutdown code** | memo + whiteboard | orientation beat between safe-ish rooms | "the system thinks shutdown is a party game" |

---

# 8. RANDOM EVENT DIRECTOR

Every match: an event scheduler picks from a chapter-gated pool every 13–26s, weighted and non-repeating in short windows. Examples:

| Tier | Events |
|---|---|
| Ambient (Ch1+) | balloon spawns · distant music box (random pan) · light flicker near player · ball rolls across hall · arcade self-boot · door creaks open · giggle with pan |
| Systems (Ch2+) | ride starts itself · **JINGLE PULSE** (all music stops 9s) · random machine pays out · CCTV cam dies 3s |
| Personal (Ch3+) | **Mimic decoy** on your predicted path · your own footsteps replayed behind you · a balloon drifts toward you and pops itself |
| Personal+ (Ch4+) | mascot prop has *moved* since you last looked · corridor lights die in a wave toward you · PA says your nametag |

Nightmare Mode doubles the Personal pools.

---

# 9. SECURITY CAMERA SYSTEM

- 6 cams: ENTRANCE · MAIN HALL · BALL PIT · ARCADE · PARTY HALL · CORRIDOR W. Dedicated security room: sit, page between feeds (Roblox: ViewportFrames; prototype: live low-res render targets).
- **Function:** remote scouting for objectives & teammate guidance; puzzle inputs; the achievement trap of watching too long.
- **Lies it tells (scheduled, rare):** static spikes · a cam marked RECORD while its timestamp is 8 years old · footage delayed 7 seconds · a decoy teammate walking a loop · **timestamp skew -00:00:07** · one cam occasionally shows the room *as it looked at the final party* (balloons up, one slice of cake missing) — only when nobody stands in that room.

---

# 10. AUDIO DESIGN

**Silence is the default.** Layers, not loops:

| Layer | Content |
|---|---|
| Room tone | transformer hum 50Hz, wind through cracks, ventilation |
| Distant geometry | metal tick, ductwork, drip, ball settling |
| Music | slow music-box motif (over two walls), detuning with corruption; PARTY MODE calliope arpeggio that *speeds up imperceptibly* |
| PA | chime → mic thump → host voice (friendly→detuned) |
| Threat mixes | per-clown signatures (§3) + heartbeat tied to danger scalar; drone bed at danger>0.5 |
| Stingers | short, dry, musical — never the giant BWAAA |

Player-facing cues you can *play by*: balloon drift (Bobby), music-stops (Jingle), double footsteps (Mimic), coin rattle (Tickets), mic thump (Mr. Happy).

**Prototype note:** all prototype audio is synthesized in WebAudio (no files): ambience, music box, party loop, PA garble, heartbeat, footsteps, stingers, glitch screams.

---

# 11. AI SPECIFICATION

Perception-first, never omniscient:

```
SENSES
  vision: LOS (level-geometry raycast), FOV cone 100–160°, range 8–15m
          light-scaled (player lit = easier to see), pit-crouch = harder
  hearing: noise events (steps 3–7m, sprint 8m, pit 9m, pops/machines 13–15m)
           each clown has hearMult (Bobby 1.5 hear / balloons relay)
  relay:   balloons add last-seen echo (Bobby); PartyKeeper shares last-seen
           between clowns ONLY in finale
STATES (all clowns)
  DORMANT → PATROL ⇄ INVESTIGATE(point of noise) → CHASE(LOS) →
  SEARCH(last-seen spiral, locker checks) → PATROL
  + STUN (flashlight vs Tickets), + custom overrides per clown
FAIRNESS
  - catch cooldown 6–9s, post-catch disengage walk-away
  - stuck>1.2s repath; never teleport to player, except scripted Mimic decoys
  - break-LOS for 3.2s ⇒ SHASE→SEARCH; search timer 6–11s ⇒ give up
```

Multiplayer (Roblox): one **Threat Director** assigns each clown at most one target, weights by ticket count / noise history / isolation, and enforces max-2 concurrent chases (except finale), so 6-player lobbies stay survivable.

---

# 12. ENDINGS

| | Name | Requirement | Content |
|---|---|---|---|
| **A** | ESCAPE | finish the party, reach exit | doors close politely; morning news says the building has had no power for 8 years; **one balloon floats past the camera** |
| **B** | SHUTDOWN | enter 09-17 + escape | every system dies mid-note; five balloon strings drop audibly; `PARTYKEEPER: OFFLINE`; cam 06 catches something tall locking the door *from inside* |
| **C** | THE PARTY | 2nd down in finale (or bleed-out) | blackout; "Thank you for celebrating with us."; **the main menu changes** (tagline becomes "SEE YOU SOON", stored) |
| **D** | SECRET | all 4 VHS + 09-17 + escape | root log prints: `2018-10-31 21:16 party_protocol: ENGAGE (manual) · operator: S. VERMEER · "they deserved a real party"` — theory-bait, unexplained |

---

# 13. REPLAYABILITY

- **Procedural variance per match:** fuse/code/candle spawn groups · button rooms · event schedule · clown patrol phase · which cam "lies" tonight.
- **NIGHTMARE MODE** (unlock on any ending): +15% clown speed · 60% battery · doubles Personal events · harder puzzles (4-button vertices) · 2 new lore items · vents-only shortcuts open.
- **CUSTOM NIGHT:** per-clown difficulty sliders 0–10 (patrol speed, hearMult, locker skill, decoy rate), building preset (After Hours only / Main floor / Full), party length.
- **Meta:** persistent achievement board, collectible lore gallery, ending tracker A–D per player.

---

# 14. LORE COLLECTIBLES (complete list)

| Type | Items | Distribution |
|---|---|---|
| VHS tapes ×4 | Grand Opening '94 · Security Backup 31-10-2018 (timestamp stops, image doesn't) · Inventory tape ("no .stop() was ever written") · Unlabeled ("someone pressed START") | B-Day1, Security, Storage, Maintenance |
| Staff documents | Manager memo (code half), whiteboard (code half), Sandbreek Robotics contract ("maximum engagement"), incident report with 6 names crossed out and a 7th written in crayon | Staff/Kitchen/Maintenance |
| Children's drawings | "MY PARTY" series — figure count escalates 6 → 7 → 8 across chapters | Party rooms |
| Newspaper | closure announcement vs. contradictory power-company statement | Foyer |
| Security logs | "console typed a reply at me" | Security |
| Audio recordings (Roblox full) | birthday candles ambience with one wrong voice singing | Room 0 |

Full collection (4/4 tapes + key docs) gates **Ending D**.

---

# 15. ACHIEVEMENTS

| Name | Unlock |
|---|---|
| FIRST NIGHT | Enter HappyLand |
| DON'T LOOK BACK | Escape your first chase |
| PARTY OF SIX | Finish a match in a 6-player lobby |
| WHO IS THAT? | Survive a Mimic hunt |
| SECURITY GUARD | Spend 5 min on CCTV |
| ONE MORE GAME | Play an arcade machine |
| THE TAXMAN | Finish with 10+ tickets unspent |
| BALLOON PHOBIA | Pop 10 balloons in one match |
| LAST BIRTHDAY | Reach any escape ending |
| OFFLINE | Ending B |
| THE TRUTH | All lore → Ending D |
| SEE YOU SOON | Ending C |
| NIGHTMARE BIRTHDAY | Escape on Nightmare Mode |

---

# 16. LOBBY & SOCIAL

**Abandoned parking lot at night, 23:36.** HappyLand's unlit sign towers over the queue pad. Players: ready-up buttons · 1–6 queue · difficulty vote (Normal/Nightmare/Custom) · map preview polaroids · stats board · the channel-name input (Mimic reads it). Occasionally the building's neon tries to turn on and dies. A balloon crosses the far fence every few minutes. Nobody comments; everybody notices.

---

# 17. UI/UX SPECIFICATION

**Look:** security-software × abandoned family-center × VHS. Dark translucent panels, 1px scanlines, subtle grain, red/amber accents, monospace type, letter-type objectives, micro-glitch (never constant).

- **Menu:** live CCTV of the entrance lobby (`CAM 04 — 11:43:17 PM` + blinking REC). Title glitches cyan/red. A clown cuts through the feed every 4–14s for 140ms. Sometimes you don't see it; your friend swears they did.
- **HUD:** objective top-left (title + sub) · top-right party list · bottom-left battery bar (flickers <25%) · bottom-right item · ticket counter appears when relevant · tiny stamina strip · almost invisible crosshair.
- **Objective change:** `NEW OBJECTIVE` center-stamp with skew-in + glitch, then retracts to the panel.
- **Warnings = sensory, not text:** danger vignette, heartbeat rate, drone level, micro camera-shake. Per-clown adds: balloon drift queue (Bobby) · music-dropout (Jingle) · double footstep (Mimic) · slot chimes (Tickets) · static bloom (Mr. Happy).
- **Downed:** red radial grade + mash bar / teammate revive channel.
- **Endings:** typewriter text over black; persistent residue per ending.

*(The prototype implements this spec 1:1 in CSS/DOM.)*

---

# 18. LIGHTING & VISUAL DIRECTION

- **Art target:** "childhood nostalgia turned wrong" — faded EVA mats, plastic primaries, cartoon murals, dusty garlands, water-stained concrete only where *guests were never meant to look*.
- **Lighting acts:**
  - Ch1: emergency red strips + moonless dark + your cone of flashlight.
  - Ch2–3: full warm party light; *too much* color; neon buzz.
  - Ch4: bare maintenance fluorescents (the only "normal-looking" light in the game — the contrast is the scare).
  - Ch5/chase: red emergency + strobes + arcade glow-out.
- **Color script:** happiness palette everywhere *except* direct threat markers (red balloon drift, "1 PLAYER REMAINING", yellow's corruption in Mr. Happy).
- **Never pitch black:** readability beats darkness; fear comes from *seeing clearly* something wrong.

---

# 19. BALANCING (prototype numbers, tunable)

| | walk | sprint | stamina | battery | pit slow |
|---|---|---|---|---|---|
| Player | 4.2 m/s | 6.6 m/s | 100 (−22/s run, +14/s idle) | 100 (−1.35/s → ~74s + pickups) | ×0.55 |

| Clown | patrol | chase | finale× | hear× | view | locker% |
|---|---|---|---|---|---|---|
| Bobby | 2.5 | 4.7 | 1.06 | 1.5 | 110°/13m | 40 |
| Tickets | 2.2 | 4.4 | 1.06 | 1.15 | 120°/13m | 25 (stuns on beam) |
| Mimic | 3.1 | 5.1 | 1.06 | 0.9 | 160°/15m | 95 |
| Jingle (full build) | 2.0 | 4.3 | — | hears music ×2.2 | 100°/11m | 30 |

Catch radius 1.05m · first catch = downed (grace 8s) · second = eliminated.

---

# 20. PROTOTYPE COVERAGE MAP

| System | Web prototype | Roblox build file |
|---|---|---|
| Menu/intro/HUD/endings A–D | ✅ playable | `ClownHouseClient` + Gui builder |
| 5-chapter story & objectives | ✅ full arc | `ObjectiveService` |
| Bobby / Tickets / Mimic-hunts AI | ✅ patrol·investigate·chase·search | `ClownAI` (5 states, scaled) |
| Jingle | ⚠ audio-presence + music-stop mechanic | full AI in `ClownAI.Jingle` |
| Mr. Happy | ✅ PA/TV/lights + finale apparition | `PartyKeeper` directives in RoundManager |
| Hiding / downed | ✅ lockers/tables, mash-up | revive channel multiplayer |
| CCTV 6 cams | ✅ live renders + malfunctions | ViewportFrames + cam events |
| Flashlight/battery/stamina/tickets | ✅ | replicated |
| Puzzles (fuses, buttons-3, codes, tickets) | ✅ | RemoteEvent-secured |
| 4 endings + residue | ✅ | RoundManager endings |
| Multiplayer 1–6 | ⛔ simulated (solo) | ✅ real (RoundManager) |
| Nametag-fail paranoia, decoys | ✅ decoy + your tag | server-side identity layer |
| Lore list / VHS / achievements | ✅ | DataStore persistent |

---

*CLOWN HOUSE: AFTER HOURS — design v1.0 · HappyLand, PartyKeeper and the clown crew are original IP created for this project.*
