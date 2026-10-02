// ============================================================
// clowns.js — the five-clown roster as fair, readable AI.
// States: DORMANT → PATROL ⇄ INVESTIGATE → CHASE → SEARCH → PATROL
// Each clown has distinct senses, territory rules and scare hooks.
// ============================================================
import * as THREE from "../vendor/three.module.min.js";
import {
  TILE, wx, wz, tx, ty, findPath, losClear, walkable, roomIdAt, emitNoise,
} from "./grid.js";
import { buildClownMesh } from "./world.js";

const S = { DORMANT: 0, PATROL: 1, INVESTIGATE: 2, CHASE: 3, SEARCH: 4, STUN: 5 };

export const PATROLS = {
  bobby: [[24, 18], [18, 13], [28, 22], [21, 26], [9, 21], [5, 18], [12, 25], [24, 9], [20, 30], [21, 24]],
  tickets: [[36, 12], [44, 18], [39, 15], [35, 18], [39, 25], [43, 24], [36, 23], [40, 23]],
  mimic: [[24, 16], [39, 14], [18, 9], [9, 19]],
  jingle: [[36, 9], [24, 18], [8, 11], [30, 26]],
};

export class Clown {
  constructor(scene, who, opts = {}) {
    this.who = who;
    this.scene = scene;
    this.mesh = buildClownMesh(who);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.state = S.DORMANT;
    this.x = wx(opts.x ?? 24); this.z = wz(opts.y ?? 18);
    this.homeRoom = opts.territory || null;          // array of room ids Tickets won't leave (unless furious)
    this.patrolPts = (opts.patrol || PATROLS[who] || []).map(([a, b]) => [wx(a), wz(b)]);
    this.patrolIdx = 0;
    this.path = null; this.pathI = 0; this.repath = 0;
    this.speedPatrol = opts.speedPatrol ?? 2.4;
    this.speedChase = opts.speedChase ?? 4.6;
    this.fov = opts.fov ?? 110;                       // degrees
    this.viewRange = opts.viewRange ?? 13;
    this.hearMult = opts.hearMult ?? 1.0;
    this.searchSkill = opts.searchSkill ?? 0.5;       // 0..1 locker detection
    this.nameTone = opts.tone || "clown";
    this.walkPhase = Math.random() * 9;
    this.target = null;                               // {x,z} investigate point
    this.lastSeen = null;
    this.searchT = 0; this.stunT = 0; this.stuckT = 0; this.lastX = this.x; this.lastZ = this.z;
    this.facing = 0;
    this.balloonBoost = 0;                            // bobby pops anger
    this.aggro = 0;                                   // tickets: stolen tickets fury
    this.onCatch = opts.onCatch || (() => {});
    this.speakT = 2 + Math.random() * 5;
    this.stepT = 0;
    this.graceIgnore = 0;                             // after catch
    this.finale = false;
    this.enabled = false;
  }

  activate(x, z) {
    if (x !== undefined) { this.x = x; this.z = z; }
    this.enabled = true; this.mesh.visible = true; this.state = S.PATROL;
    this.mesh.position.set(this.x, 0, this.z);
  }
  deactivate() { this.enabled = false; this.mesh.visible = false; this.state = S.DORMANT; }

  hearNoise(x, z, radius, tag) {
    if (!this.enabled || this.state === S.DORMANT || this.state === S.STUN) return;
    const d = Math.hypot(x - this.x, z - this.z);
    const eff = radius * this.hearMult * (this.state === S.CHASE ? 0.6 : 1);
    if (d > eff) return;
    // territory clowns investigate only if inside/near territory (unless furious)
    if (this.homeRoom && this.aggro < 3) {
      const rHere = roomIdAt(tx(this.x), ty(this.z));
      const rThere = roomIdAt(tx(x), ty(z));
      if (!this.homeRoom.includes(rThere) && d > 10) return;
    }
    if (this.state !== S.CHASE) {
      this.state = S.INVESTIGATE;
      this.target = { x, z };
      this.repath = 0;
    }
  }

  // flashlight shone at clown: most hate it (tickets), some love it
  litByFlashlight() {
    if (this.who === "bobby") { /* balloons reflect — he notices */ }
    if (this.state === S.CHASE && this.who === "tickets") this.stunT = Math.max(this.stunT, 1.1);
  }

  canSee(px, pz, playerHidden, flashlightOn, crouching) {
    if (playerHidden || this.graceIgnore > 0) return false;
    const dx = px - this.x, dz = pz - this.z;
    const d = Math.hypot(dx, dz);
    let range = this.viewRange * (this.finale ? 1.25 : 1);
    if (!flashlightOn) range *= 0.62;
    if (crouching) range *= 0.7;
    if (d > range) return false;
    // fov check
    const ang = Math.atan2(dx, dz);                    // world yaw convention (mesh looks +Z at 0)
    let diff = Math.abs(norm(ang - this.facing - Math.PI));
    if (diff > (this.fov * Math.PI / 180) / 2 && d > 2.2) return false;
    // los
    return losClear(this.x, this.z, px, pz, this.finale);
  }

  repathTo(x, z) {
    const p = findPath(tx(this.x), ty(this.z), tx(x), ty(z), this.finale);
    if (p && p.length) { this.path = p; this.pathI = 0; }
    else this.path = null;
  }

  update(dt, game) {
    if (!this.enabled) return;
    const P = game.player;
    this.graceIgnore = Math.max(0, this.graceIgnore - dt);
    this.speakT -= dt;

    // ---------- senses ----------
    const seen = this.state !== S.STUN && this.canSee(P.x, P.z, P.hidden, P.flashOn && P.battery > 0, P.inPit);
    if (seen) {
      this.lastSeen = { x: P.x, z: P.z, t: 0 };
      if (this.state !== S.CHASE) {
        this.state = S.CHASE;
        game.onChaseStart(this);
      }
      this.repath -= dt;
    } else if (this.state === S.CHASE) {
      if (this.lastSeen) this.lastSeen.t += dt;
      if (!this.lastSeen || this.lastSeen.t > 3.2) {
        this.state = S.SEARCH; this.searchT = 6 + this.searchSkill * 5;
        this.target = this.lastSeen ? { x: this.lastSeen.x, z: this.lastSeen.z } : null;
        game.onChaseLost(this);
        this.repath = 0;
      }
    }

    // ---------- state behavior ----------
    let speed = this.speedPatrol;
    if (this.state === S.PATROL) {
      if (!this.path || this.pathI >= this.path.length) {
        this.repath -= dt;
        if (this.repath <= 0) {
          this.repath = 1.2;
          const pt = this.patrolPts[this.patrolIdx % this.patrolPts.length];
          if (Math.hypot(pt[0] - this.x, pt[1] - this.z) < 1.4) this.patrolIdx++;
          this.repathTo(pt[0], pt[1]);
        }
      }
    } else if (this.state === S.INVESTIGATE) {
      speed = (this.speedPatrol + this.speedChase) / 2;
      if (this.target) {
        this.repath -= dt;
        if (this.repath <= 0) { this.repath = 1.0; this.repathTo(this.target.x, this.target.z); }
        if (Math.hypot(this.target.x - this.x, this.target.z - this.z) < 1.3) {
          this.state = S.SEARCH; this.searchT = 3.5 + this.searchSkill * 3; this.path = null;
          game.onClownArrive(this);
        }
      } else this.state = S.PATROL;
    } else if (this.state === S.CHASE) {
      speed = this.speedChase * (this.finale ? 1.06 : 1) * (1 + this.balloonBoost * 0.06 + Math.min(0.35, this.aggro * 0.07));
      if (seen) {
        this.repath -= dt;
        if (this.repath <= 0) { this.repath = 0.55; this.repathTo(P.x, P.z); }
      } else if (this.lastSeen && (!this.path || this.pathI >= this.path.length)) {
        this.repathTo(this.lastSeen.x, this.lastSeen.z);
      }
      // catch?
      const d = Math.hypot(P.x - this.x, P.z - this.z);
      if (d < 1.05 && !P.hidden && this.graceIgnore <= 0) {
        game.onCaught(this);
        this.state = S.SEARCH; this.searchT = 5; this.graceIgnore = 9; this.path = null;
        // walk away after catch
        this.target = this.patrolPts[(Math.random() * this.patrolPts.length) | 0];
        this.target = { x: this.target[0], z: this.target[1] };
        this.repath = 0;
      }
    } else if (this.state === S.SEARCH) {
      speed = this.speedPatrol * 0.8;
      this.searchT -= dt;
      if (this.target && Math.hypot(this.target.x - this.x, this.target.z - this.z) > 1.2) {
        this.repath -= dt;
        if (this.repath <= 0) { this.repath = 1.0; this.repathTo(this.target.x, this.target.z); }
      } else {
        // wander-search: random nearby tiles
        this.repath -= dt;
        if (this.repath <= 0) {
          this.repath = 0.6;
          const a = Math.random() * 6.28, r = 2 + Math.random() * 3;
          const nx2 = this.x + Math.cos(a) * r, nz2 = this.z + Math.sin(a) * r;
          if (walkable(tx(nx2), ty(nz2))) this.repathTo(nx2, nz2);
        }
        // locker checks
        if (P.hiddenSpot && Math.hypot(P.x - this.x, P.z - this.z) < 3.4) {
          if (Math.random() < dt * this.searchSkill * (this.who === "mimic" ? 3.5 : 1.4)) {
            game.onLockerFound(this);
            this.state = S.PATROL; this.graceIgnore = 6; this.path = null;
          }
        }
      }
      if (this.searchT <= 0) { this.state = S.PATROL; this.target = null; this.path = null; }
    } else if (this.state === S.STUN) {
      this.stunT -= dt;
      if (this.stunT <= 0) this.state = S.SEARCH;
    }
    if (this.stunT > 0 && this.state !== S.STUN) { /* brief flinch handled visually */ }
    if (this.who === "tickets" && this.homeRoom && this.aggro < 3) {
      // clamp movement to territory: if next waypoint outside, skip
    }

    // flashlight reaction (tickets hates the beam)
    if (P.flashOn && this.state === S.CHASE) {
      const toMe = Math.atan2(this.x - P.x, this.z - P.z);
      let dA = Math.abs(norm(toMe - P.yaw));
      const dM = Math.hypot(P.x - this.x, P.z - this.z);
      if (dA < 0.35 && dM < 9 && this.who === "tickets" && losClear(P.x, P.z, this.x, this.z, this.finale)) {
        this.stunT = Math.max(this.stunT, 1.0); this.state = S.STUN;
        game.onClownStunned(this);
      }
    }

    // ---------- move along path ----------
    let moving = false;
    if (this.path && this.pathI < this.path.length && this.state !== S.STUN) {
      const [gtx2, gty2] = this.path[this.pathI];
      const gx = wx(gtx2), gz = wz(gty2);
      const dx = gx - this.x, dz = gz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) this.pathI++;
      else {
        const step = Math.min(d, speed * dt);
        this.x += dx / d * step; this.z += dz / d * step;
        this.facing = lerpAngle(this.facing, Math.atan2(dx, dz), Math.min(1, dt * 8));
        moving = true;
      }
      // stuck detection
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        this.stuckT = 0;
        if (Math.hypot(this.x - this.lastX, this.z - this.lastZ) < 0.2) { this.path = null; this.repath = 0; }
        this.lastX = this.x; this.lastZ = this.z;
      }
    }

    // ---------- visuals ----------
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.facing + Math.PI;
    const u = this.mesh.userData;
    if (moving) {
      this.walkPhase += dt * speed * 2.4;
      const sw = Math.sin(this.walkPhase) * 0.45;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
      u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7;
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 2.1 / Math.max(1, speed);
        const dP = Math.hypot(P.x - this.x, P.z - this.z);
        if (dP < 26) game.onClownStep(this, dP);
      }
    } else {
      u.legL.rotation.x *= 0.85; u.legR.rotation.x *= 0.85;
      // idle: head slowly scans… or locks onto player (worse)
      if (this.state === S.CHASE || this.state === S.SEARCH) {
        u.head.lookAt(P.x, 1.5, P.z);
      } else {
        u.head.rotation.y = Math.sin(performance.now() * 0.0004) * 0.5;
      }
    }
    if (this.state === S.CHASE) {
      u.armL.rotation.x = -2.4; u.armR.rotation.x = -2.4; // arms out — party hug
    }
    // occasional clown voice
    if (this.speakT <= 0) {
      this.speakT = 6 + Math.random() * 9;
      const dP = Math.hypot(P.x - this.x, P.z - this.z);
      if (dP < 24) game.onClownVoice(this, dP);
    }
  }
}

function norm(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function lerpAngle(a, b, t) { return a + norm(b - a) * t; }
export const CLOWN_STATES = S;

// ============================================================
// FakePlayer — Mimic's scripted "is that actually you?" events
// ============================================================
export class FakePlayer {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.85, 4, 8), new THREE.MeshLambertMaterial({ color: 0x2c3540 }));
    body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8b896 }));
    head.position.y = 1.72; g.add(head);
    // hoodie stripes = generic teen explorer
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x8a2be2 }));
    stripe.position.y = 1.25; g.add(stripe);
    this.group = g; this.head = head;
    // nametag sprite
    this.tagCanvas = document.createElement("canvas"); this.tagCanvas.width = 256; this.tagCanvas.height = 64;
    this.tagTex = new THREE.CanvasTexture(this.tagCanvas);
    const sm = new THREE.SpriteMaterial({ map: this.tagTex, transparent: true });
    this.tag = new THREE.Sprite(sm); this.tag.scale.set(1.6, 0.4, 1); this.tag.position.y = 2.15; g.add(this.tag);
    g.visible = false;
    scene.add(g);
    this.active = false;
  }
  setName(name) {
    const g = this.tagCanvas.getContext("2d");
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(0, 0, 256, 64);
    g.fillStyle = "#f2ede2"; g.font = "900 30px Arial"; g.textAlign = "center";
    g.fillText(name, 128, 42);
    this.tagTex.needsUpdate = true;
  }
  appear(x, z, name) {
    this.setName(name);
    this.group.position.set(x, 0, z);
    this.group.visible = true; this.active = true;
  }
  vanish() { this.group.visible = false; this.active = false; }
  faceInstant(px, pz) { this.group.rotation.y = Math.atan2(px - this.group.position.x, pz - this.group.position.z); }
}
