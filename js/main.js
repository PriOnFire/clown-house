// ============================================================
// main.js — CLOWN HOUSE: AFTER HOURS prototype core
// States: MENU → INTRO → PLAY ⇄ PAUSE/CCTV → ENDING
// ============================================================
import * as THREE from "../vendor/three.module.min.js";
import {
  TILE, wx, wz, tx, ty, collide, emitNoise, roomIdAt, pitTile, trampTile,
  doorById, findPath, walkable,
} from "./grid.js";
import { buildWorld, drawClownFace, CEIL } from "./world.js";
import * as AU from "./audio.js";
import { UI } from "./ui.js";
import { Clown, FakePlayer, PATROLS, CLOWN_STATES as CS } from "./clowns.js";

window.addEventListener("error", (e) => {
  const el = document.getElementById("boot-error");
  el.classList.remove("hidden");
  el.textContent = "RUNTIME: " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno;
});

// ------------------------------------------------------------ renderer
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
let pixelScale = Math.min(devicePixelRatio || 1, 1.6);
renderer.setPixelRatio(pixelScale);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.026);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 140);
camera.rotation.order = "YXZ";
scene.add(camera);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------ world & actors
const world = buildWorld(scene);

const FLASH = {
  torch: new THREE.SpotLight(0xfff0d0, 0, 17, 0.46, 0.5, 1.2),
  fill: new THREE.PointLight(0xffe0b0, 0, 4, 2),
};
FLASH.torch.position.set(0.14, -0.12, 0.05);
FLASH.torch.target.position.set(0, -0.22, -10);
camera.add(FLASH.torch); camera.add(FLASH.torch.target); camera.add(FLASH.fill);

const game = {
  state: "menu", paused: false, chapter: 0, step: 0,
  player: null, clowns: {}, fake: null, mimicStage: 0,
  flags: {
    flashlight: false, fuses: 0, power: false, tickets: 0, badge: false,
    buttons: {}, buttonTimer: -1, pkRead: false, codeA: false, codeB: false,
    partyKey: false, shutdownArmed: false, candlesLit: false, partyDone: false,
    downs: 0, vhs: [], chased: 0, escapedChases: 0, arcadePlays: 0, cctvT: 0,
    jingleNear: false, grace: 0, downed: false, downedT: 0, mash: 0,
    flags: {},
  },
  ach: {}, menuT: 0,
};
window.GAME = game;

game.player = {
  x: wx(21), z: wz(31.5), y: 0, vy: 0, yaw: Math.PI, pitch: 0,
  battery: 100, flashOn: false, stamina: 100, hidden: false, hiddenSpot: null,
  inPit: false, dead: false, speedWalk: 4.2, speedRun: 6.6, stepT: 0, bobT: 0,
};

game.clowns.bobby = new Clown(scene, "bobby", { patrol: PATROLS.bobby, speedPatrol: 2.5, speedChase: 4.7, hearMult: 1.5, searchSkill: 0.4 });
game.clowns.tickets = new Clown(scene, "tickets", { patrol: PATROLS.tickets, territory: [5, 6, 14], speedPatrol: 2.2, speedChase: 4.4, hearMult: 1.15, searchSkill: 0.3, fov: 120 });
game.clowns.mimic = new Clown(scene, "mimic", { patrol: PATROLS.mimic, speedPatrol: 3.1, speedChase: 5.1, hearMult: 0.9, searchSkill: 0.95, fov: 160, viewRange: 15 });
game.fake = new FakePlayer(scene);

game.onChaseStart = (c) => {
  AU.stinger(0.8); AU.droneLevel(0.75); AU.scream();
  UI.flash("rgba(255,40,50,.35)", 260, 0.5);
  if (!game.flags.chased) { game.flags.chased = 1; }
  if (c.who === "mimic") unlockAch("WHO_IS_THAT", "SURVIVE THE COPYCAT — wait, survive it first");
};
game.onChaseLost = (c) => {
  game.flags.escapedChases++;
  AU.droneLevel(0.25);
  if (game.flags.escapedChases === 1) unlockAch("DON'T LOOK BACK", "Escape your first chase.");
};
game.onCaught = (c) => onCaught(c);
game.onClownStep = (c, d) => AU.clownStep(Math.max(0, 0.5 - d * 0.022), c.who === "mrhappy");
game.onClownVoice = (c, d) => {
  const pan = Math.max(-1, Math.min(1, (c.x - game.player.x) / 12));
  if (c.who === "bobby") AU.clownGiggle(Math.max(0, 0.3 - d * 0.013), pan);
  else if (c.who === "tickets") AU.carnivalCar();
  else AU.whisper();
};
game.onClownStunned = () => { AU.staticBurst(0.15, 0.1); UI.say("TICKETS", "(the light hurts him — keep it on him!)", { dur: 2.2 }); };
game.onClownArrive = () => {};
game.onLockerFound = (c) => {
  // dragged out of hiding
  leaveHide(true);
  AU.scream(); UI.jumpscare(c.who, 900);
  onCaught(c, true);
};

function forEachClown(fn) { ["bobby", "tickets", "mimic"].forEach(k => fn(game.clowns[k])); }

// ------------------------------------------------------------ input
const keys = {};
const mouse = { dx: 0, dy: 0, locked: false, drag: false, lx: 0, ly: 0 };
let sensitivity = 1.0, camBob = true;

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (game.state === "play") onKey(e.code);
  else if (game.state === "intro" && (e.code === "KeyE" || e.code === "Space" || e.code === "Enter")) advanceIntro();
  else if (game.state === "ending" && e.code === "Enter") toMenu();
});
document.addEventListener("keyup", (e) => keys[e.code] = false);
canvas.addEventListener("click", () => {
  if (game.state === "intro") { advanceIntro(); return; }
  if (game.state === "play" && !game.paused && !mouse.locked) {
    canvas.requestPointerLock?.().catch?.(() => {});
  }
});
document.addEventListener("pointerlockchange", () => {
  mouse.locked = document.pointerLockElement === canvas;
  if (!mouse.locked && game.state === "play" && !game.player.dead && !UI.loreOpen() && !UI.cctvOpen) pauseGame(true);
});
document.addEventListener("mousemove", (e) => {
  if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  else if (mouse.drag) {
    mouse.dx += (e.clientX - mouse.lx) * 1.5; mouse.dy += (e.clientY - mouse.ly) * 1.5;
    mouse.lx = e.clientX; mouse.ly = e.clientY;
  }
});
canvas.addEventListener("mousedown", (e) => { if (!mouse.locked) { mouse.drag = true; mouse.lx = e.clientX; mouse.ly = e.clientY; } });
addEventListener("mouseup", () => mouse.drag = false);
document.addEventListener("contextmenu", e => e.preventDefault());

function onKey(code) {
  if (game.player.dead) return;
  const F = game.flags;
  if (F.downed && code === "KeyE") {
    F.mash++;
    AU.footstep(true, false);
    UI.downed(Math.min(1, F.mash / 8));
    if (F.mash >= 8) {
      F.downed = false; F.downedT = 0; F.grace = 8;
      UI.downed(null); UI.danger(0);
      document.body.classList.remove("jolt");
      canvas.requestPointerLock?.().catch?.(() => {});
    }
    return;
  }
  if (code === "KeyF") toggleFlash();
  if (code === "KeyE") { if (UI.loreOpen()) { UI.hideLore(); return; } useInteract(); }
  if (code === "Tab") { UI.loreListOpen() ? UI.hideLoreList() : UI.showLoreList(vhsEntries(), game.flags.vhs.length); }
  if (code === "KeyC") { UI.cctvOpen ? closeCCTV() : tryOpenCCTV(); }
  if (code === "Escape") {
    if (UI.cctvOpen) closeCCTV();
    else if (UI.loreOpen()) UI.hideLore();
    else if (UI.loreListOpen()) UI.hideLoreList();
  }
}
function pauseGame(on) {
  if (game.state !== "play") return;
  game.paused = on;
  document.getElementById("pause").classList.toggle("hidden", !on);
}

document.getElementById("btn-resume").onclick = () => {
  pauseGame(false);
  canvas.requestPointerLock?.().catch?.(() => {});
};
document.getElementById("btn-quit").onclick = () => toMenu();

// ------------------------------------------------------------ flashlight
function toggleFlash() {
  const P = game.player;
  if (!game.flags.flashlight) return;
  P.flashOn = !P.flashOn;
  AU.switchClick();
  if (P.flashOn && P.battery <= 0) { P.flashOn = false; }
  emitNoise(P.x, P.z, 2, "click");
}
function updateFlashlight(dt) {
  const P = game.player;
  let target = 0;
  if (P.flashOn && P.battery > 0) {
    P.battery = Math.max(0, P.battery - dt * 1.35);
    target = 1.9;
    if (P.battery < 25) target *= (0.6 + Math.sin(performance.now() * 0.02) * 0.4 * Math.random());
  }
  if (P.battery <= 0 && P.flashOn) { P.flashOn = false; AU.switchClick(); }
  FLASH.torch.intensity += (target - FLASH.torch.intensity) * Math.min(1, dt * 14);
  FLASH.fill.intensity = FLASH.torch.intensity * 0.13;
  UI.battery(P.battery, P.battery < 25);
}

// ------------------------------------------------------------ interactables
const I = [];   // {id,pos,r,cond,label,hold,action,once}
function addInt(o) { o.r = o.r || 2.5; I.push(o); return o; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function buildInteractables() {
  const F = game.flags;
  // --- story items
  addInt({ id: "flash", pos: V(wx(28), 1.2, wz(29)), cond: () => !F.flashlight,
    label: () => "TAKE FLASHLIGHT", action: () => {
      F.flashlight = true; AU.pickup();
      UI.item("▸", "FLASHLIGHT"); UI.say("YOU", "A flashlight. Still works. Lucky.", { dur: 2.6 });
      advanceStep();
      scareCue(() => { AU.carnivalCar(); world.ride.rocking = 3; }, 4000);
    } });
  addInt({ id: "fuseA", pos: V(wx(14), 1.4, wz(2)), cond: () => !F.fuseA,
    label: () => "TAKE FUSE", action: () => {
      F.fuseA = true; F.fuses++; AU.pickup(); bumpFuse(); AU.doorCreak();
      eventBalloonNearPlayer();
    } });
  addInt({ id: "fuseB", pos: V(wx(5), 1.25, wz(2)), cond: () => !F.fuseB,
    label: () => "TAKE FUSE", action: () => {
      F.fuseB = true; F.fuses++; AU.pickup(); bumpFuse();
      AU.musicBox(0.1, -20, 1.2, -0.5); UI.say("???", "♪ ...happy... ♪", { dur: 2.5 });
    } });
  function bumpFuse() {
    UI.say("YOU", `A fuse. (${game.flags.fuses}/2)`, { dur: 2 });
    if (F.fuses >= 2) UI.setObjective("RESTORE EMERGENCY POWER", "Both fuses found.\nBreaker panel: west corridor, north wall.");
    else UI.setObjective("RESTORE EMERGENCY POWER", `Find ${2 - F.fuses} more fuse. Try the kitchen and storage.`);
  }
  addInt({ id: "breaker", pos: V(33 * TILE - 0.15 - TILE, 1.4, 16.9), hold: 1.0,
    label: () => F.power ? "POWER: ON" : (F.fuses >= 2 ? "INSERT FUSES — RESTORE POWER" : `BREAKER PANEL — ${F.fuses}/2 FUSES`),
    cond: () => !F.power, action: () => {
      if (F.fuses < 2) { AU.doorLocked(); UI.say("YOU", "Dead without fuses.", { dur: 2 }); return; }
      F.power = true; AU.powerUp();
      world.bpGlow.material.color.setHex(0x39d353);
      startPartyMode();
    } });
  // --- arcade machines (ticket sources)
  const machineSpots = [[35, 13], [35, 16], [44, 12], [44, 17], [41, 11]];
  machineSpots.forEach(([Mx, My], i) => {
    addInt({ id: "machine" + i, pos: V(wx(Mx), 1.2, wz(My)), cond: () => game.chapter >= 2 && !game.player.dead,
      label: () => game.flags["m" + i] ? "PLAY AGAIN (+1 TICKET)" : "PLAY (+1 TICKET)",
      action: () => {
        const scr = nearestMachineScreen(Mx, My);
        if (scr) { scr.on = true; scr.playable = true; }
        AU.musicBox(0.12, 0, 1.6, 0.2); AU.carnivalCar();
        setTimeout(() => { AU.pickup(); }, 700);
        F.tickets++; F["m" + i] = true; F.arcadePlays++;
        UI.tickets(F.tickets, true);
        emitNoise(wx(Mx), wz(My), 13, "arcade");
        game.clowns.tickets.aggro += 1;
        if (F.arcadePlays === 1) unlockAch("ONE MORE GAME", "Play an arcade machine.");
        if (F.tickets === 2) activateTickets();
        if (F.tickets >= 5) { UI.setObjective("CLAIM YOUR PRIZE", "Prize counter, back wall. Tickets get you in."); AU.paChime(); sayHappy("A WINNER! GRAND PRIZES FOR GRAND GUESTS!"); }
        if (F.arcadePlays > 6 && game.clowns.tickets.aggro >= 6) sayHappy("GREEDY LITTLE GUEST.", true);
      } });
  });
  addInt({ id: "prize", pos: V(wx(42), 1.2, wz(24)),
    label: () => F.tickets >= 5 ? "CLAIM GRAND PRIZE (5 TICKETS)" : `GRAND PRIZE — NEEDS 5 TICKETS (${F.tickets}/5)`,
    cond: () => game.chapter >= 2 && !F.badge, action: () => {
      if (F.tickets < 5) { AU.doorLocked(); return; }
      F.badge = true; AU.pickup(); AU.paChime();
      UI.item("▮", "SECURITY BADGE");
      unlockDoor("maint");
      UI.setObjective("", ""); // step advances below
      sayHappy("ENJOY YOUR PRIZE. THE PARTY IS JUST BEGINNING.");
      advanceStep();
    } });
  // --- party buttons (chapter 3)
  const BTN = { A: [35, 11, "ARCADE"], B: [2, 25, "BALL PIT"], C: [45, 8, "PARTY HALL"] };
  for (const k of ["A", "B", "C"]) {
    const [bx, by, bname] = BTN[k];
    addInt({ id: "btn" + k, pos: V(wx(bx), 1.3, wz(by)),
      cond: () => game.chapter === 3 && !F.buttons[k],
      label: () => `PARTY BUTTON — ${bname}`,
      action: () => {
        F.buttons[k] = true; AU.switchClick(); AU.pickup();
        emitNoise(wx(bx), wz(by), 10, "button");
        if (F.buttonTimer < 0) {
          F.buttonTimer = 30;
          UI.say("MR. HAPPY", "THIRTY SECONDS, GUESTS. ALL THREE. TOGETHER. LIKE A PARTY.", { pa: true, dur: 4 });
        }
        const n = Object.keys(F.buttons).length;
        UI.setObjective("PRESS THE PARTY BUTTONS", `${n}/3 pressed — ${F.buttonTimer.toFixed(0)}s\n${btnStatus()}`);
        if (n >= 3) {
          F.buttonTimer = -1;
          AU.paChime(); AU.partyLoopStop(); AU.musicBox(0.16, 10, 0.8);
          sayHappy("SUCH GOOD TEAMWORK. THE PARTY SALUTES YOU.");
          advanceStep();
        }
      } });
  }
  // --- doors
  for (const id in world.doors) {
    const d = world.doors[id];
    addInt({ id: "door_" + id, pos: d.pos, r: 2.2, door: d,
      cond: () => !game.player.dead,
      label: () => {
        if (d.def.locked) {
          return d.def.lockedBy === "badge" ? "LOCKED — STAFF BADGE REQUIRED"
            : d.def.lockedBy === "partykey" ? "LOCKED — SOMETHING WAITS BEHIND THIS DOOR"
            : d.def.lockedBy === "emergency" ? "EMERGENCY EXIT — SEALED"
            : "LOCKED FROM OUTSIDE";
        }
        return (d.def.open ? "CLOSE " : "OPEN ") + d.def.name;
      },
      action: () => {
        if (d.def.id === "emergency" && F.partyDone && !F.done) { doEnding(); return; }
        if (d.def.locked) {
          AU.doorLocked();
          if (d.def.lockedBy === "partykey" && F.partyKey) { unlockDoor("bday0"); openDoor(d); return; }
          if (d.def.lockedBy === "emergency" && game.chapter === 5 && F.partyDone) { unlockDoor("emergency"); openDoor(d); doEnding(); return; }
          if (d.def.lockedBy === "emergency") UI.say("YOU", "The emergency release is dead. Something electrical is keeping it shut.", { dur: 3 });
          return;
        }
        openDoor(d);
      } });
  }
  // --- maintenance / partykeeper
  addInt({ id: "pk", pos: V(wx(28), 1.3, wz(1) + 0.9),
    cond: () => game.chapter >= 4,
    hold: () => (F.codeA && F.codeB && !F.shutdownArmed && F.pkRead) ? 3.0 : 0,
    label: () => {
      if (!F.pkRead) return "ACCESS PARTYKEEPER TERMINAL";
      if (!(F.codeA && F.codeB)) return "PARTYKEEPER — SHUTDOWN NEEDS CODE (2 FRAGMENTS)";
      if (!F.shutdownArmed) return "HOLD — ENTER SHUTDOWN CODE 09-17";
      return "PARTYKEEPER — SHUTDOWN PENDING";
    },
    action: () => {
      if (!F.pkRead) {
        F.pkRead = true; F.partyKey = true;
        world.pkScreen.set("ready", "code format: ##-##");
        AU.paChime();
        UI.showLore("PARTYKEEPER v7.2 — OPERATOR CONSOLE",
`HAPPYLAND AUTOMATED MASCOT SYSTEM
root@partykeeper:~$ cat final_log.txt

2018-10-31 21:02  party_protocol: 6 guests registered
2018-10-31 21:17  cctv uplink lost
2018-10-31 21:18  shutdown requested: DENIED
                 reason: "party in progress"

the system never stopped celebrating.
a PARTY KEY slid out of the terminal slot.
it smells like气球... like birthday candles.`);
        UI.setObjective("FIND THE SHUTDOWN CODE", "Two fragments. Staff room. Kitchen.");
        advanceStep(6.5);
        return;
      }
      if (F.codeA && F.codeB && !F.shutdownArmed) {
        F.shutdownArmed = true;
        world.pkScreen.set("armed");
        AU.stinger(1); AU.droneLevel(0.6);
        sayHappy("YOU HAVEN'T FINISHED THE PARTY.", true);
        sayHappy("GUESTS MAY NOT LEAVE EARLY.", true);
        advanceStep();
      }
    } });
  addInt({ id: "memo", pos: V(wx(19), 0.9, wz(2)), cond: () => !F.codeA,
    label: () => "READ STAFF MEMO", action: () => {
      F.codeA = true; AU.pickup();
      UI.showLore("STAFF MEMO — C. VERMEER (MANAGER)",
`To whoever closes tonight,

PartyKeeper glitched again during the 4PM slot.
Bobby counted 7 children. There were 6.

If it happens again: kill it with the console.
The code is split — my half stays with ME: 17.
The other half is on the kitchen board where
the night crew can see it.

Do NOT let the system hear you say "shutdown".
It thinks that word is a party game.`);
      checkBothCodes();
    } });
  addInt({ id: "whiteboard", pos: V(4.6, 1.5, wz(4)), r: 3.0, cond: () => !F.codeB,
    label: () => "READ WHITEBOARD", action: () => {
      F.codeB = true; AU.pickup();
      UI.showLore("KITCHEN WHITEBOARD",
`CLOSING CHECKLIST
□ ball pit count
□ mascot storage
□ limonade siroop
□ PARTYKEEPER restart
  code half: 09

(someone added, in different handwriting:)
"it starts counting when the cameras stop at 21:17"`);
      checkBothCodes();
    } });
  function checkBothCodes() {
    if (F.codeA && F.codeB) {
      UI.setObjective("RETURN TO PARTYKEEPER", "Shutdown code complete: 09-17.");
      AU.paChime();
    } else {
      UI.setObjective("FIND THE SHUTDOWN CODE", `${(F.codeA ? 1 : 0) + (F.codeB ? 1 : 0)}/2 fragments.`);
    }
  }
  // --- VHS tapes
  const TAPES = [
    ["vhs1", wx(37), wz(5), "VHS 01 — 'GRAND OPENING PARTY 1994'",
`Tracking error. A crowded birthday room. Children
laughing. A man in a cheap Mr. Happy suit doing
balloon animals. The timestamp fights: 1994... 2018...

Someone off-camera: "The new automated ones arrive
next month. No more performers. Isn't that great?"

The clown in the video stops moving.
It looks directly at the camera for 11 seconds.`],
    ["vhs2", wx(22), wz(5), "VHS 02 — SECURITY BACKUP 31-10-2018",
`Camera 02, main hall. 21:16:44. Six children around
a cake. The clowns stand still at the walls — all of
them at once, like something pressed pause.

21:17:00. The feed doesn't cut. The TIMESTAMP stops.
The image keeps moving for 4 more minutes.

You are not going to watch them.`],
    ["vhs3", wx(15), wz(6), "VHS 03 — STOCKROOM INVENTORY TAPE",
`Mostly boxes. Point of interest at 31:12:
a technician explaining to no one that PartyKeeper
was never given a definition of "party ends".

"It only has party_protocol.start," he says.
"There is no .stop. Nobody wrote one."

Behind him, on a shelf: five costume heads.
One of them is not in the inventory list.`],
    ["vhs4", wx(30), wz(6), "VHS 04 — UNLABELED, RECORDED OVER SOMETHING",
`An office. The manager is arguing with someone
wearing a visitor badge: SANDBREEK ROBOTICS.

"...told you it needed an end condition..."
"...the board wanted maximum engagement..."
"Then your board can come switch it off themselves."

Under the argument, very faintly, a music box.
The last frame shows the party room door.
It was yellow already in 2018. It was ALWAYS yellow.`],
  ];
  TAPES.forEach(([id, px, pz, title, body]) => {
    addInt({ id, pos: V(px, 0.55, pz), cond: () => !F[id],
      label: () => "TAKE " + title.split("—")[0].trim(), action: () => {
        F[id] = true; F.vhs.push(id); AU.pickup(); AU.staticBurst(0.3, 0.12);
        UI.showLore(title, body);
        if (F.vhs.length >= 4) unlockAch("THE TRUTH", "Collect every lore tape.");
      } });
  });
  // --- batteries
  [[31, 32], [19, 12], [14, 26], [3, 12], [44, 19], [26, 8], [28, 6], [42, 9]].forEach(([bx, by], i) => {
    addInt({ id: "bat" + i, pos: V(wx(bx), 0.35, wz(by)), cond: () => !F["bat" + i],
      label: () => "TAKE BATTERY", action: () => {
        F["bat" + i] = true; game.player.battery = Math.min(100, game.player.battery + 45);
        AU.pickup(); UI.say("YOU", "Battery. " + Math.round(game.player.battery) + "%.", { dur: 1.6 });
      } });
  });
  // --- hiding spots
  for (const lk of world.lockers) {
    addInt({ id: "hide" + lk.x, pos: V(lk.x, 1.1, lk.z), r: 2.0,
      cond: () => !game.player.hidden && !game.player.dead,
      label: () => "HIDE", hideSpot: lk,
      action: (o) => enterHide(o.hideSpot) });
  }
  for (const [hx, hy] of [[6, 11], [36, 3.5]]) {
    addInt({ id: "hidet" + hx, pos: V(wx(hx), 0.6, wz(hy)), r: 2.0,
      cond: () => !game.player.hidden && !game.player.dead,
      label: () => "CRAWL UNDER", hideSpot: { x: wx(hx), z: wz(hy), zone: "table" },
      action: (o) => enterHide(o.hideSpot) });
  }
  // --- security cctv terminal
  addInt({ id: "cctvterm", pos: V(wx(23.5), 1.2, wz(2)), r: 2.4,
    cond: () => game.chapter >= 1,
    label: () => "USE SECURITY MONITOR [C]", action: () => openCCTV() });
  addInt({ id: "seclog", pos: V(wx(24), 0.95, wz(2)), cond: () => !F.seclog,
    label: () => "READ SECURITY LOG", action: () => {
      F.seclog = true; AU.pickup();
      UI.showLore("SECURITY LOG — FINAL ENTRY (J. PRINS)",
`Oct 31, 21:14 — kids at table 3 singing. fine.
Oct 31, 21:16 — mascot #3 (BOBBY) entered cam 2
  WITHOUT being scheduled. flagged.
Oct 31, 21:17 — ALL UNITS ENTERED PARTY ROOM.
  I did not dispatch them.
Oct 31, 21:17 — console typed a reply at me.
  I did not touch the console.
It said: "the party requires six."

I'm going home. Whatever is still celebrating
in there can do it without me watching.`);
    } });
  // --- cake (finale trigger)
  addInt({ id: "cake", pos: V(wx(43.5), 1.2, wz(3)), r: 2.6, hold: 2.0,
    cond: () => game.chapter === 5 && F.candlesLit && !F.partyDone,
    label: () => "BLOW OUT THE CANDLES", action: () => finishParty() });
}

function openDoor(d, instant) {
  d.def.open = !d.def.open;
  d.target = d.def.open ? -1.92 : 0;
  AU.doorCreak();
  emitNoise(d.pos.x, d.pos.z, 6, "door");
}
function unlockDoor(id) {
  const d = doorById[id];
  if (d) d.locked = false;
  AU.switchClick();
}

// nearest machine screen helper (world.arcadeScreens by tile distance)
function nearestMachineScreen(x, y) {
  let best = null, bd = 9;
  for (const s of world.arcadeScreens) {
    if (s.playable) { best = s; break; }
    const d = Math.abs(s.tile[0] - x) + Math.abs(s.tile[1] - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// --------- hide ----------
function enterHide(spot) {
  const P = game.player;
  P.hidden = true; P.hiddenSpot = spot;
  P.x = spot.x; P.z = spot.z;
  UI.fadeDark(true, 180); setTimeout(() => UI.fadeDark(false, 180), 220);
  AU.switchClick();
  UI.prompt("E", "STEP OUT");
}
function leaveHide(violent) {
  const P = game.player;
  P.hidden = false;
  const sp = P.hiddenSpot; P.hiddenSpot = null;
  if (sp) { P.x = sp.x + 0.9; P.z = sp.z + 0.9; }
  if (!violent) AU.doorCreak();
}
addEventListener("keydown", (e) => {
  if (e.code === "KeyE" && game.player?.hidden && !e.repeat && game.state === "play" && !game.flags.downed) leaveHide();
});

// ------------------------------------------------------------ player update
const fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
function updatePlayer(dt) {
  const P = game.player, F = game.flags;
  if (P.dead || F.downed) return;

  // look
  P.yaw -= mouse.dx * 0.0021 * sensitivity;
  P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - mouse.dy * 0.0021 * sensitivity));
  mouse.dx = mouse.dy = 0;

  if (P.hidden) {
    camera.position.set(P.x, 1.35, P.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
    return;
  }

  // move
  const run = keys.ShiftLeft && P.stamina > 2 && !P.inPit;
  const sp = (run ? P.speedRun : P.speedWalk) * (P.inPit ? 0.55 : 1);
  fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  rgt.set(-fwd.z, 0, fwd.x);
  let mx = 0, mz = 0;
  if (keys.KeyW) { mx += fwd.x; mz += fwd.z; }
  if (keys.KeyS) { mx -= fwd.x; mz -= fwd.z; }
  if (keys.KeyA) { mx -= rgt.x; mz -= rgt.z; }
  if (keys.KeyD) { mx += rgt.x; mz += rgt.z; }
  const ml = Math.hypot(mx, mz);
  const moving = ml > 0.01;
  if (moving) {
    mx /= ml; mz /= ml;
    let nx = P.x + mx * sp * dt, nz = P.z + mz * sp * dt;
    [nx, nz] = collide(nx, nz);
    P.x = nx; P.z = nz;
    // noise + steps
    P.stepT -= dt * (run ? 1.6 : 1);
    if (P.stepT <= 0) {
      P.stepT = 0.42;
      AU.footstep(run, P.inPit);
      emitNoise(P.x, P.z, P.inPit ? 9 : run ? 7.5 : 3, "step");
    }
  }
  // stamina
  if (run && moving) P.stamina = Math.max(0, P.stamina - dt * 22);
  else P.stamina = Math.min(100, P.stamina + dt * 14);
  UI.stamina(P.stamina, run || P.stamina < 99);

  // terrain flags
  const tX = tx(P.x), tY = ty(P.z);
  P.inPit = pitTile[tY * 46 + tX] === 1;
  P.y = Math.max(0, P.y + P.vy * dt); P.vy -= 14 * dt; if (P.y < 0) { P.y = 0; P.vy = 0; }
  if (trampTile[tY * 46 + tX] === 1 && P.y === 0) {
    P.vy = 4.2; AU.boing(); emitNoise(P.x, P.z, 6, "boing");
  }

  // camera
  P.bobT += dt * (moving ? (run ? 11 : 7.5) : 2);
  const bob = camBob ? Math.sin(P.bobT) * (moving ? 0.035 : 0.012) : 0;
  const sway = camBob ? Math.cos(P.bobT * 0.5) * 0.008 : 0;
  camera.position.set(P.x + sway * Math.cos(P.yaw), 1.62 + bob + P.y, P.z + sway * -Math.sin(P.yaw));
  camera.rotation.set(P.pitch, P.yaw, sway * 0.6);
}

// ------------------------------------------------------------ interactions (proximity)
let currentInt = null, holdT = 0;
function updateInteract(dt) {
  const P = game.player;
  if (P.hidden) { UI.prompt("E", "STEP OUT"); currentInt = null; UI.holdProgress(0); return; }
  let best = null, bd = 1e9;
  for (const o of I) {
    if (o.cond && !o.cond()) continue;
    const d = o.pos.distanceTo(camera.position);
    if (d < (o.r || 2.5) && d < bd) {
      // require rough facing for doors? proximity is fine
      bd = d; best = o;
    }
  }
  // balloons pop
  if (!best) {
    for (const b of world.balloons) {
      if (b.dead) continue;
      if (b.group.position.distanceTo(camera.position) < 1.9) { best = { balloon: b, label: () => "POP BALLOON" }; break; }
    }
  }
  currentInt = best;
  if (!best) { UI.prompt(null); UI.holdProgress(0); holdT = 0; return; }
  const holdNeed = typeof best.hold === "function" ? best.hold() : best.hold;
  UI.prompt("E", best.label(), !!holdNeed);
  // holding
  if (holdNeed) {
    if (keys.KeyE) {
      holdT += dt;
      UI.holdProgress(holdT / holdNeed);
      if (holdT >= holdNeed) { holdT = 0; UI.holdProgress(0); best.action(best); keys.KeyE = false; }
    } else { holdT = 0; UI.holdProgress(0); }
  }
}
function useInteract() {
  if (currentInt && !currentInt.balloon) {
    const holdNeed = typeof currentInt.hold === "function" ? currentInt.hold() : currentInt.hold;
    if (!holdNeed) currentInt.action(currentInt);
    return;
  }
  if (currentInt?.balloon) popBalloon(currentInt.balloon);
}
function popBalloon(b) {
  if (b.dead) return;
  b.dead = true; scene.remove(b.group);
  AU.balloonPop();
  emitNoise(b.group.position.x, b.group.position.z, 15, "pop");
  const bb = game.clowns.bobby;
  if (bb.enabled) {
    bb.balloonBoost++;
    bb.hearNoise(b.group.position.x, b.group.position.z, 30, "pop");
    if (bb.balloonBoost === 3) UI.say("???", "(somewhere, a hundred balloons turn toward you at once)", { dur: 3.2 });
    if (bb.balloonBoost >= 3) sayHappy("BOBBY MADE THOSE. BOBBY LOVED THOSE.", true);
  }
}

// ------------------------------------------------------------ achievements
function unlockAch(name, desc) {
  if (game.ach[name]) return;
  game.ach[name] = true;
  UI.achToast(name, desc);
  try {
    const a = JSON.parse(localStorage.getItem("ch_ach") || "{}"); a[name] = true;
    localStorage.setItem("ch_ach", JSON.stringify(a));
  } catch (e) {}
}

// ------------------------------------------------------------ story engine
const story = [];
function step(num, obj, sub, cond, onStart) { story.push({ num, obj, sub, cond, onStart }); }
function defineStory() {
  const F = game.flags;
  step(1, "EXPLORE HAPPYLAND", "Find a flashlight.\nThe reception kept one.", () => F.flashlight);
  step(1, "RESTORE EMERGENCY POWER", "Find 2 fuses.\nTry storage and the kitchen.", () => F.fuses >= 2);
  step(1, "RESTORE EMERGENCY POWER", "Breaker panel: west corridor,\nnorth wall, past the food court.", () => F.power);
  step(2, "COLLECT TICKETS", "PARTY MODE wants tickets.\nPlay arcade machines. 0/5", () => F.tickets >= 5);
  step(2, "CLAIM YOUR PRIZE", "Prize counter — back wall.\nSomething valuable is on display.", () => F.badge);
  step(3, "PRESS THE PARTY BUTTONS", "3 buttons, 30 seconds, far apart.\nArcade · Ball pit · Party hall.", () => game.chapter > 3);
  step(4, "ENTER MAINTENANCE", "Badge door — west corridor.\nWhere guests can't see the wires.", () => F.inMaintenance);
  step(4, "ACCESS PARTYKEEPER", "The terminal deep in the racks.\nAsk it why the music never stopped.", () => F.pkRead);
  step(4, "FIND THE SHUTDOWN CODE", "Two fragments.\nStaff room memo · kitchen board.", () => F.codeA && F.codeB);
  step(4, "RETURN TO PARTYKEEPER", "Hold the terminal. Enter 09-17.\nDecide what HappyLand deserves.", () => F.shutdownArmed || F.skipShutdown);
  step(5, "ENTER THE YELLOW DOOR", "Party Room 0.\nFinish the party that never ended.", () => F.inZero);
  step(5, "FINISH THE PARTY", "Blow out the candles.\nSix candles. Six guests. You make seven.", () => F.partyDone);
  step(5, "ESCAPE", "EMERGENCY EXIT — storage room, north wall.\nRUN.", () => F.done);
}
function setStep(n) {
  const s = story[n];
  if (!s) return;
  game.stepIndex = n;
  UI.setObjective(s.obj, s.sub, true);
  s.onStart?.();
}
function advanceStep(special) {
  if (special === 6.5) { return; } // pkRead handled inline
  // chapter transitions by target step index
  game.stepIndex++;
  const s = story[game.stepIndex];
  if (!s) return;
  const chOf = [1, 1, 1, 2, 2, 3, 4, 4, 4, 4, 5, 5, 5];
  const targetCh = chOf[game.stepIndex] || 1;
  if (targetCh !== game.chapter) enterChapter(targetCh);
  else UI.setObjective(s.obj, s.sub, true);
}

function enterChapter(ch) {
  game.chapter = ch;
  const s = story[game.stepIndex];
  const F = game.flags;
  if (ch === 2) {
    // PARTY MODE
    world.setLighting("party");
    AU.partyLoopStart(); AU.droneStart(0.15);
    UI.chapterCard("CHAPTER 2", "THE PARTY", "PARTY MODE: ACTIVATED");
    document.body.classList.add("chrom");
    activateBobby();
    setTimeout(() => { UI.setObjective(s.obj, s.sub, true); }, 2600);
  }
  if (ch === 3) {
    UI.chapterCard("CHAPTER 3", "DON'T SPLIT UP", "THE BUTTONS WANT YOU SEPARATED");
    mimicEvent1();
    UI.setObjective("PRESS THE PARTY BUTTONS", "3 buttons, 30 seconds, far apart.\nArcade · Ball pit · Party hall.", true);
    UI.say("MR. HAPPY", "PARTY GAMES! MY FAVORITE. PRESS ALL THREE BUTTONS. FAST.", { pa: true, dur: 5 });
  }
  if (ch === 4) {
    UI.chapterCard("CHAPTER 4", "MAINTENANCE", "WHERE THE MAGIC IS MADE");
    UI.setObjective(s.obj, s.sub, true);
    AU.droneLevel(0.45);
  }
  if (ch === 5) {
    UI.chapterCard("CHAPTER 5", "THE LAST BIRTHDAY", "EVERYTHING IS STILL SET");
    UI.setObjective("ENTER THE YELLOW DOOR", "Party Room 0, east wing.\nYou have the key. Of course you do.", true);
    unlockDoor("bday0");
    game.clowns.mimic.activate(wx(30), wz(26));
    AU.droneLevel(0.65);
  }
}

function startPartyMode() {
  enterChapter(2);
  AU.paChime();
  sayHappy("WELCOME BACK, BIRTHDAY GUESTS!");
  sayHappy("THE PARTY CAN FINALLY CONTINUE.");
  // all arcade screens wake up
  for (const sc of world.arcadeScreens) if (Math.random() < 0.7) sc.on = true;
  world.neon.material.color?.setHex?.(0xffffff);
  setTimeout(() => { if (!game.flags.power) return; AU.staticBurst(0.5, 0.2); }, 2500);
}

function activateBobby() {
  const b = game.clowns.bobby;
  b.activate(wx(28), wz(15));
  for (let i = 0; i < 4; i++) {
    const s = world.balloonSpots[(Math.random() * world.balloonSpots.length) | 0];
    world.spawnBalloon(s[0], s[1], { y: 1.3 + Math.random() });
  }
}
function activateTickets() {
  const t = game.clowns.tickets;
  t.activate(wx(43), wz(16));
  AU.clownGiggle(0.2, 0.6);
  UI.say("???", "(coin-drop laughter from the prize corner)", { dur: 3 });
}

// ---------- Mr Happy voice ----------
function sayHappy(text, dark) {
  AU.paChime(dark ? 1 : 0);
  if (dark) AU.garbleVoice(text.length * 0.05, 0.8); else AU.garbleVoice(text.length * 0.045, 0.2);
  UI.say("MR. HAPPY", text, { pa: true, dur: Math.max(2.8, text.length * 0.07) });
}

// ---------- mimic events ----------
function mimicEvent1() {
  game.mimicStage = 1;
  // fake player in main hall, faces away; vanishes when approached
  const fx = wx(24), fz = wz(17);
  game.fake.appear(fx, fz, playerTag());
  game.fake.group.rotation.y = Math.PI * 0.2;
  game._fakeT = 0;
}

// ---------- scare helpers ----------
function scareCue(fn, ms) { setTimeout(() => { if (game.state === "play") fn(); }, ms); }

function eventBalloonNearPlayer() {
  const P = game.player;
  world.spawnBalloon(0, 0, { x: P.x + 2.5, z: P.z - 2.5, y: 1.2 });
  AU.whisper();
}

// ------------------------------------------------------------ random events
let eventT = 10;
function updateEvents(dt) {
  eventT -= dt;
  if (eventT > 0) return;
  const F = game.flags, P = game.player;
  eventT = 13 + Math.random() * 14 - game.chapter * 1.2;
  const pool = [];
  const tX = tx(P.x), tY = ty(P.z);
  pool.push(() => { // random balloon appears somewhere you aren't looking... probably
    const s = world.balloonSpots[(Math.random() * world.balloonSpots.length) | 0];
    world.spawnBalloon(s[0], s[1], { y: 1.1 + Math.random() * 1.6 });
  });
  pool.push(() => { // distant music box
    const pan = Math.random() * 2 - 1;
    AU.musicBox(0.06 + Math.random() * 0.05, game.chapter * -6, 0.9 + Math.random() * 0.4, pan);
  });
  pool.push(() => { // light flicker nearby
    let br = null, bd = 1e9;
    for (const r of world.lightRigs) {
      if (!r.on) continue;
      const d = Math.hypot(r.light.position.x - P.x, r.light.position.z - P.z);
      if (d < bd) { bd = d; br = r; }
    }
    if (br) {
      const base = br.light.intensity;
      let n = 0;
      const iv = setInterval(() => { br.light.intensity = (n++ % 2) ? base * 0.1 : base; if (n > 5) { clearInterval(iv); br.light.intensity = base; } }, 70);
    }
  });
  pool.push(() => { // ball rolls across somewhere
    spawnRollingBall(P);
  });
  pool.push(() => { // arcade machine self-on
    const off = world.arcadeScreens.filter(s => !s.on && !s.playable);
    if (off.length) {
      const s = off[(Math.random() * off.length) | 0];
      s.on = true; AU.carnivalCar();
      setTimeout(() => { if (!s.playable) s.on = false; }, 5000 + Math.random() * 5000);
    }
  });
  pool.push(() => { AU.clownGiggle(0.08, Math.random() * 2 - 1); });
  if (game.chapter >= 2) {
    pool.push(() => { world.ride.rocking = 3.5; AU.carnivalCar(); });
    pool.push(() => { // JINGLE PULSE: the music stops. don't move.
      game.flags.jingleNear = true;
      AU.partyLoopStop();
      AU.musicBox(0.18, -18, 0.75, Math.random() * 2 - 1);
      UI.say("YOU", "(the music stopped)", { dur: 2.2 });
      setTimeout(() => {
        if (game.state !== "play") return;
        game.flags.jingleNear = false;
        if (game.chapter >= 2 && game.chapter < 5) AU.partyLoopStart();
      }, 9000);
    });
  }
  if (game.chapter >= 3 && game.mimicStage < 3 && Math.random() < 0.5) {
    pool.push(() => mimicPeekEvent());
  }
  pool[(Math.random() * pool.length) | 0]();
}
function mimicPeekEvent() {
  game.mimicStage++;
  const spots = [[39, 15], [24, 21], [9, 20], [30, 9]];
  const s = spots[(Math.random() * spots.length) | 0];
  game.fake.appear(wx(s[0]) , wz(s[1]), playerTag());
  game.fake.group.rotation.y = Math.random() * 6.28;
  AU.whisper();
}
function spawnRollingBall(P) {
  // small red ball crosses main hall / corridor
  const horiz = Math.random() < 0.5;
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  const sx = P.x + (Math.random() < 0.5 ? -8 : 8), sz = P.z + (Math.random() * 8 - 4);
  const ex = P.x + (Math.random() < 0.5 ? 8 : -8), ez = sz + (Math.random() * 2 - 1);
  g.position.set(sx, 0.13, sz);
  scene.add(g);
  const t0 = performance.now();
  const roll = setInterval(() => {
    const t = (performance.now() - t0) / 1000 / 2.4;
    if (t >= 1) { clearInterval(roll); scene.remove(g); return; }
    g.position.x = sx + (ex - sx) * t;
    g.position.z = sz + (ez - sz) * t;
    g.rotation.z -= 0.2;
  }, 33);
}

// ------------------------------------------------------------ CCTV
let cctvTick = 0, camIdx = 0;
const cctvRT = new THREE.WebGLRenderTarget(320, 180);
const pixBuf = new Uint8Array(320 * 180 * 4);
function tryOpenCCTV() {
  const P = game.player;
  if (Math.hypot(P.x - wx(23.5), P.z - wz(2)) > 5) {
    UI.say("YOU", "(the security monitors are in the office, west wing)", { dur: 2.2 });
    return;
  }
  openCCTV();
}
function openCCTV() {
  if (UI.cctvOpen) return;
  UI.openCCTV(world.cams);
  AU.staticBurst(0.4, 0.15);
  AU.uiClick();
}
function closeCCTV() {
  if (!UI.cctvOpen) return;
  UI.closeCCTV(); AU.uiClick();
  canvas.requestPointerLock?.().catch?.(() => {});
}
function updateCCTV(dt) {
  if (!UI.cctvOpen) return;
  game.flags.cctvT += dt;
  if (game.flags.cctvT > 45) unlockAch("SECURITY GUARD", "Watch CCTV for a long, long time.");
  cctvTick -= dt;
  if (cctvTick > 0) return;
  cctvTick = 0.35;
  const cells = UI.camCells; if (!cells || !cells.length) return;
  const i = camIdx % cells.length; camIdx++;
  // random malfunction
  if (Math.random() < 0.04 + game.chapter * 0.01) {
    UI.setCamDead(i, true);
    AU.staticBurst(0.2, 0.1);
    setTimeout(() => UI.setCamDead(i, false), 1200 + Math.random() * 2500);
    return;
  }
  UI.setCamDead(i, false);
  renderer.setRenderTarget(cctvRT);
  renderer.render(scene, world.cams[i].cam);
  renderer.setRenderTarget(null);
  renderer.readRenderTargetPixels(cctvRT, 0, 0, 320, 180, pixBuf);
  const cv = cells[i].cv, g2 = cv.getContext("2d");
  const img = g2.createImageData(320, 180);
  for (let y = 0; y < 180; y++) {
    const src = (179 - y) * 320 * 4;
    img.data.set(pixBuf.subarray(src, src + 320 * 4), y * 320 * 4);
  }
  g2.putImageData(img, 0, 0);
  if (Math.random() < 0.1) { // interference streak
    g2.fillStyle = "rgba(255,255,255,.12)";
    g2.fillRect(0, Math.random() * 180, 320, 3 + Math.random() * 10);
  }
  cells[i].tm.textContent = UI.menuTime();
  // CCTV clue: mimic walks through CAM 02 sometimes in ch3+
  if (game.chapter >= 3 && i === 1 && Math.random() < 0.08 && !game.fake.active) {
    game.fake.appear(wx(24), wz(19), playerTag());
    setTimeout(() => { if (game.fake.active && game.mimicStage < 4) game.fake.vanish(); }, 2600);
  }
}

// ------------------------------------------------------------ caught / downed
function onCaught(clown, fromLocker) {
  const F = game.flags, P = game.player;
  if (F.grace > 0 || P.dead || F.downed) return;
  UI.jumpscare(clown.who, 900);
  AU.scream(); AU.stinger(1.2);
  if (F.downs >= 1) {
    // second catch: the party keeps you
    P.dead = true;
    doEndingC();
    return;
  }
  // downed
  F.downed = true; F.mash = 0; F.downedT = 0; F.downs++;
  document.exitPointerLock?.();
  UI.downed(0);
  AU.dangerChord?.();
  UI.danger(0.8);
}
function updateDowned(dt) {
  const F = game.flags;
  if (!F.downed) return;
  F.downedT += dt;
  if (F.downedT > 9) { // bled out
    F.downed = false; game.player.dead = true;
    doEndingC(); return;
  }
}

// ------------------------------------------------------------ finale
function startZeroCinematic() {
  const F = game.flags;
  F.inZero = true;
  while (game.stepIndex < 10) advanceStep();
  AU.staticBurst(1, 0.2);
  const tvI = setInterval(() => world.tv.staticFrame(), 90);
  setTimeout(() => clearInterval(tvI), 1500);
  setTimeout(() => {
    for (const f of world.candles) f.visible = true;
    world.candleLight.intensity = 1;
    AU.candleWhoosh();
    F.candlesLit = true;
  }, 1600);
  setTimeout(() => {
    world.tv.set("face");
    AU.scream(); AU.stinger(0.9);
    sayHappy("SIX CANDLES. SIX GUESTS. ONE CAKE.", true);
    setTimeout(() => sayHappy("BLOW THEM OUT. MAKE A WISH.", true), 4200);
  }, 3600);
}
function finishParty() {
  const F = game.flags;
  F.partyDone = true;
  for (const f of world.candles) f.visible = false;
  world.candleLight.intensity = 0.15;
  world.tv.set("text", "1 PLAYER\nREMAINING");
  AU.candleWhoosh(); AU.droneLevel(1);
  // FINAL CHASE
  world.setLighting("finale");
  world.flickerMode = true;
  document.body.classList.add("finale");
  document.body.classList.remove("chrom");
  // arcade screens conspire
  for (const s of world.arcadeScreens) { s.on = true; s.playable = false; s.mat.color.setHex(0xff2222); }
  unlockDoor("emergency");
  sayHappy("THANK YOU FOR CELEBRATING WITH US.", true);
  sayHappy("PLEASE REMAIN FOR THE PARTY.", true);
  sayHappy("REMAIN.", true);
  // all clowns converge
  forEachClown(c => {
    if (!c.enabled) c.activate(wx(24), wz(18));
    c.finale = true;
    c.speedChase *= 1.08;
    c.state = CS.CHASE;
    c.lastSeen = { x: game.player.x, z: game.player.z, t: 0 };
    c.repath = 0;
  });
  unlockAch("LAST BIRTHDAY", "Finish the party. Survive it.");
  advanceStepFinale();
}
function advanceStepFinale() {
  for (const id in world.doors) { const d = world.doors[id]; if (id !== "entrance") { d.def.locked = false; d.def.open = true; d.target = -1.92; } }
  game.stepIndex = story.length - 1;
  UI.setObjective("ESCAPE", "EMERGENCY EXIT — storage room, north wall.\nRUN.", true);
  // PA loop
  game._paT = 0;
  // mark bobby + mimic spawn doubles
  world.spawnBalloon(game.player.x / TILE, game.player.z / TILE, { x: game.player.x, z: game.player.z - 3, y: 1.1 });
}
function updateFinale(dt) {
  const F = game.flags, P = game.player;
  if (game.chapter !== 5 || !F.partyDone || F.done) return;
  game._paT -= dt;
  if (game._paT <= 0) {
    game._paT = 8 + Math.random() * 6;
    sayHappy(["PLEASE REMAIN FOR THE PARTY.", "REMAIN.", "GUESTS MAY NOT LEAVE EARLY.", "THE CAKE WAS FOR YOU.", "SIX CANDLES. ONE WISH. OURS."][(Math.random() * 5) | 0], true);
  }
  game._huntT = (game._huntT || 0) - dt;
  if (game._huntT <= 0) {
    game._huntT = 2.6;
    forEachClown(c => {
      if (c.enabled && c.state !== CS.STUN) { c.state = CS.CHASE; c.lastSeen = { x: P.x, z: P.z, t: 0 }; }
    });
  }
  // Mr. Happy apparition once in main hall
  if (!F.mrHappySeen) {
    if (Math.abs(P.x - wx(24)) < 10 && Math.abs(P.z - wz(18)) < 9) {
      F.mrHappySeen = true;
      const mh = world.mrHappyMesh;
      mh.position.set(P.x + Math.sin(P.yaw + Math.PI) * -9, 0, P.z + Math.cos(P.yaw + Math.PI) * -9);
      mh.position.set(wx(24), 0, wz(14));
      mh.visible = true;
      mh.lookAt(P.x, 0, P.z);
      AU.scream(); UI.flash("rgba(255,255,255,.0)", 1, 0); UI.flash("#fff", 60, 0.4);
      setTimeout(() => { mh.visible = false; }, 1100);
    }
  }
}

// ------------------------------------------------------------ endings
function doEnding() {
  const F = game.flags;
  F.done = true;
  game.player.dead = true;
  forEachClown(c => c.deactivate());
  AU.droneStop(); AU.partyLoopStop(); AU.heartbeatSet(0);
  document.exitPointerLock?.();
  UI.clearSubs();
  let tag, title, body, extra = null, red = false;
  if (F.shutdownArmed && F.vhs.length >= 4) {
    tag = "SECRET ENDING"; title = "THE INVITATION"; red = true;
    body = "You type 09-17.\n\nEvery light in HappyLand goes out at once. The music dies mid-note.\nIn the silence you hear five balloon strings drop to the floor.\n\nOn the terminal, one last line prints itself:\nPARTYKEEPER: OFFLINE";
    extra = "/// PARTYKEEPER ROOT LOG — RECOVERED ///\n2018-10-31 21:16 party_protocol: ENGAGE (manual)\n2018-10-31 21:16 operator: S. VERMEER\n2018-10-31 21:17 note attached: \"they deserved a real party\"\n\nThe last birthday was not an accident.\nSomeone pressed START.";
  } else if (F.shutdownArmed) {
    tag = "ENDING B"; title = "SHUTDOWN";
    body = "You type 09-17.\n\nEvery light in HappyLand goes out at once. The music dies mid-note.\nIn the silence you hear five balloon strings drop to the floor.\n\nOn the terminal, one last line prints itself:\n\nPARTYKEEPER: OFFLINE";
    extra = "CAM 06 — 23:59:58\nSomething tall crosses the corridor after you leave.\nIt locks the door from the inside.";
  } else {
    tag = "ENDING A"; title = "ESCAPE";
    body = "You slam the emergency exit and the night air hits like water.\nBehind you: locks engaging, one after another, politely.\n\nThe doors close. The neon flickers off.\n\nYou made it out. That is what matters. That is the whole story.";
    extra = "6:12 AM — the security guard on the morning news says the building has no power.\nHasn't had any for eight years.\n\nThen who played the music?\n\n...somewhere behind the fence, a balloon floats past the camera.";
  }
  UI.danger(0);
  UI.showEnding(tag, title, body, extra, red);
  game.state = "ending";
  unlockAch("FIRST NIGHT SURVIVOR", "Reach an ending.");
}
function doEndingC() {
  const F = game.flags;
  F.done = true;
  forEachClown(c => c.deactivate());
  AU.droneStop(); AU.partyLoopStop(); AU.heartbeatSet(0);
  document.exitPointerLock?.();
  UI.clearSubs(); UI.danger(0); UI.downed(null);
  try { localStorage.setItem("ch_partied", "1"); } catch (e) {}
  sayHappySilent();
  function sayHappySilent() {
    UI.showEnding("ENDING C", "THE PARTY",
      "The music gets closer until it is everywhere.\n\nA glove, softly, on your shoulder.\n\n\"Thank you for celebrating with us.\"",
      "restarting...", true);
  }
  game.state = "ending";
  document.body.classList.remove("finale", "chrom", "jolt");
  world.flickerMode = false;
}

function toMenu() { location.reload(); }
document.getElementById("btn-again").onclick = () => location.reload();
document.getElementById("btn-menu").onclick = () => { location.reload(); };

// ------------------------------------------------------------ VHS list UI
function vhsEntries() {
  const F = game.flags;
  return [
    F.vhs1 ? { title: "VHS 01 — GRAND OPENING", hint: "the clown looked at the camera" } : null,
    F.vhs2 ? { title: "VHS 02 — SECURITY BACKUP", hint: "the timestamp stopped at 21:17" } : null,
    F.vhs3 ? { title: "VHS 03 — INVENTORY TAPE", hint: "no .stop() was ever written" } : null,
    F.vhs4 ? { title: "VHS 04 — UNLABELED", hint: "someone pressed START on purpose" } : null,
  ];
}

// ------------------------------------------------------------ intro
const INTRO = [
  { t: "11:43 PM\n\nHAPPYLAND FAMILY FUN CENTER\nCLOSED SINCE 2018", d: 4.4 },
  { t: "\"Bro, this place is actually huge.\"\n\nYour channel needed one more video.\nThe side entrance was already open.", d: 5 },
  { t: "You step inside.", d: 2.6 },
  { t: "The doors lock behind you.\nYour phone loses signal.\nEmergency lights hum to life.", d: 4.6 },
  { t: "A dusty speaker crackles.\n\n\"Welcome back, birthday guests.\"\n\nYou have never been here before.", d: 6 },
  { t: "CLOWN HOUSE\n\nAFTER HOURS", d: 3.4, red: true },
];
let introIdx = -1, introTimer = null;
function startIntro() {
  game.state = "intro";
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("intro").classList.remove("hidden");
  advanceIntro();
}
function advanceIntro() {
  introIdx++;
  if (introIdx >= INTRO.length) { beginPlay(); return; }
  const c = INTRO[introIdx];
  const el = UI.els["intro-text"];
  el.innerHTML = "";
  let i = 0;
  const txt = c.t;
  clearInterval(UI._introType);
  UI._introType = setInterval(() => {
    i += 2;
    el.innerHTML = txt.slice(0, i).replace(/\n/g, "<br>");
    if (c.red) el.classList.add("red");
    if (i >= txt.length) clearInterval(UI._introType);
  }, 26);
  AU.paSquelch();
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { if (game.state === "intro") advanceIntro(); }, c.d * 1000 + txt.length * 13);
}
function beginPlay() {
  clearTimeout(introTimer); clearInterval(UI._introType);
  document.getElementById("intro").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  game.state = "play";
  game.chapter = 1;
  UI.fadeDark(false, 2000);
  setStep(0);
  UI.chapterCard("CHAPTER 1", "AFTER HOURS", "NO CAMERAS SINCE 21:17");
  AU.paChime();
  unlockAch("FIRST NIGHT", "Enter HappyLand.");
  UI.buildPlayers([playerTag(), "MAX · OFFLINE", "SOPHIE · OFFLINE"]);
  canvas.requestPointerLock?.().catch?.(() => {});
}
function playerTag() {
  return (document.getElementById("menu-tagname").value || "EXPLORER_7").toUpperCase();
}

// ------------------------------------------------------------ menu
function initMenu() {
  document.getElementById("btn-play").onclick = () => {
    AU.initAudio(); AU.resumeAudio(); AU.uiClick();
    startIntro();
  };
  for (const b of document.querySelectorAll(".mbtn")) {
    b.addEventListener("mouseenter", () => AU.uiHover());
  }
  document.getElementById("btn-howto").onclick = () => { AU.uiClick(); showPanel("howto"); };
  document.getElementById("btn-settings").onclick = () => { AU.uiClick(); showPanel("settings"); };
  document.getElementById("btn-credits").onclick = () => { AU.uiClick(); showPanel("credits"); };
  for (const b of document.querySelectorAll("[data-back]")) {
    b.onclick = () => { AU.uiClick(); b.closest(".panel").classList.add("hidden"); };
  }
  // ending C residue
  try {
    if (localStorage.getItem("ch_partied") === "1") {
      document.getElementById("menu-tag").innerHTML = "SEE YOU SOON &mdash; THE PARTY CONTINUES";
      document.getElementById("menu-tag").style.color = "#ff2d3f";
    }
    game.ach = JSON.parse(localStorage.getItem("ch_ach") || "{}");
  } catch (e) {}
  // settings wiring
  const vol = document.getElementById("set-vol");
  vol.oninput = () => AU.setVolume(vol.value / 100);
  const sens = document.getElementById("set-sens");
  sens.oninput = () => sensitivity = sens.value / 100;
  document.getElementById("set-bob").onchange = (e) => camBob = e.target.checked;
  document.getElementById("set-grain").onchange = (e) => document.getElementById("fx-grain").style.display = e.target.checked ? "" : "none";
  document.getElementById("set-quality").onchange = (e) => {
    pixelScale = e.target.value === "high" ? Math.min(devicePixelRatio || 1, 1.6) : 0.8;
    renderer.setPixelRatio(pixelScale);
  };
}
function showPanel(id) { document.getElementById(id).classList.remove("hidden"); }

// menu background camera + clown flashes
const menuCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 100);
let menuClownFlash = 3 + Math.random() * 8;
addEventListener("resize", () => { menuCam.aspect = innerWidth / innerHeight; menuCam.updateProjectionMatrix(); });
function updateMenu(dt) {
  game.menuT += dt;
  const t = game.menuT * 0.06;
  menuCam.position.set(wx(23) - Math.sin(t) * 5, 1.75 + Math.sin(t * 2.3) * 0.1, wz(33.4));
  menuCam.lookAt(wx(20.5), 1.7, wz(28.5));
  renderer.render(scene, menuCam);
  menuClownFlash -= dt;
  if (menuClownFlash < 0) {
    menuClownFlash = 4 + Math.random() * 10;
    const b = game.clowns.bobby;
    b.mesh.visible = true;
    b.mesh.position.set(wx(19) + Math.random() * 6, 0, wz(29));
    b.mesh.rotation.y = Math.PI;
    AU.staticBurst(0.18, 0.06);
    setTimeout(() => { if (!b.enabled) b.mesh.visible = false; }, 140);
  }
  UI.els["menu-clock"].textContent = UI.menuTime();
}

// ------------------------------------------------------------ main loop
const clock = new THREE.Clock();
let dangerLevel = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (game.state === "menu") { updateMenu(dt); return; }
  if (game.state !== "play" || game.paused || UI.loreOpen()) { return; }

  const F = game.flags, P = game.player;
  F.grace = Math.max(0, F.grace - dt);

  updatePlayer(dt);
  updateFlashlight(dt);
  updateInteract(dt);
  updateDowned(dt);

  // doors animate
  for (const id in world.doors) {
    const d = world.doors[id];
    d.hinge.rotation.y += (d.target - d.hinge.rotation.y) * Math.min(1, dt * 7);
  }

  // fake player behavior
  if (game.fake.active) {
    const d = Math.hypot(P.x - game.fake.group.position.x, P.z - game.fake.group.position.z);
    game._fakeT = (game._fakeT || 0) + dt;
    if (d < 7 || game._fakeT > 25) {
      // it turns to face you, instantly, then is gone
      game.fake.faceInstant(P.x, P.z);
      AU.whisper(); AU.staticBurst(0.15, 0.14);
      setTimeout(() => game.fake.vanish(), 120);
      game._fakeT = 0;
      if (game.mimicStage >= 2 && Math.random() < 0.6) {
        setTimeout(() => {
          if (game.state === "play" && !F.partyDone) {
            // second appearance, closer
            const a = P.yaw + Math.PI + (Math.random() - 0.5);
            game.fake.appear(P.x - Math.sin(a) * 9, P.z - Math.cos(a) * 9, playerTag());
            game.fake.faceInstant(P.x, P.z);
          }
        }, 2400);
      }
    }
  }

  // clowns
  let nearest = 1e9, chasing = false;
  forEachClown(c => {
    c.update(dt, game);
    if (!c.enabled) return;
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    nearest = Math.min(nearest, d);
    if (c.state === CS.CHASE) chasing = true;
  });
  // balloon proximity fear cue
  const bobbyInf = game.clowns.bobby.enabled && (game.clowns.bobby.state === CS.CHASE || game.clowns.bobby.state === CS.INVESTIGATE);
  world.update(dt, new THREE.Vector3(P.x, 0, P.z), bobbyInf);

  // danger feedback
  dangerLevel += ((chasing ? 1 : nearest < 8 ? 0.5 : 0) - dangerLevel) * Math.min(1, dt * 3);
  UI.danger(dangerLevel * 0.9);
  AU.heartbeatSet(F.downed ? 1 : dangerLevel > 0.15 ? dangerLevel : 0);
  AU.droneLevel(Math.max(F.jingleNear ? 0.5 : 0, dangerLevel * 0.7, game.chapter >= 4 ? 0.3 : 0));

  // story progression
  const s = story[game.stepIndex];
  if (s && s.cond && s.cond()) {
    if (s.num === 5 && s.obj === "ESCAPE") { /* wait for exit */ } else advanceStep();
  }

  // room-based story flags
  const room = roomIdAt(tx(P.x), ty(P.z));
  if (room === 12 && !F.inMaintenance) { F.inMaintenance = true; }
  if (room === 17 && !F.inZero) startZeroCinematic();

  // CCTV
  updateCCTV(dt);

  // events
  updateEvents(dt);
  updateFinale(dt);

  // finale arcade message
  if (F.partyDone && !F.arcadeMessageDone) {
    F.arcadeMessageDone = true;
    // world already set red screens
  }

  renderer.render(scene, camera);
}

// ------------------------------------------------------------ boot
UI.init();
UI.makeGrain();
initMenu();
buildInteractables();
defineStory();
UI.fadeDark(true, 0);
setTimeout(() => UI.fadeDark(false, 1600), 300);
// footsteps bus: clowns hear noises
import("./grid.js").then(m => {
  m.noiseListeners.push((x, z, r, tag) => {
    forEachClown(c => c.hearNoise(x, z, r, tag));
  });
});
loop();
