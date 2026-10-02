// ============================================================
// world.js — builds HappyLand: merged wall/floor geometry,
// doors, props, dynamic lighting rigs, balloons, TVs, CCTV cams.
// Exports everything main.js / clowns.js need to interact with.
// ============================================================
import * as THREE from "../vendor/three.module.min.js";
import {
  ROOMS, TILE, GW, GH, roomAt, roomById, wallAt, doorAtEdge, DOORS,
  addBlocked, pitTile, trampTile, wx, wz,
} from "./grid.js";

export const CEIL = 3.6;

// -------------------------------------------------- canvas utils
export function makeTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTex(kind, base) {
  return makeTex(128, 128, (g) => {
    g.fillStyle = `#${new THREE.Color(base).getHexString()}`; g.fillRect(0, 0, 128, 128);
    if (kind === "mat") {
      const cols = ["#c0392b", "#2980b9", "#f39c12", "#27ae60"];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        g.globalAlpha = 0.55; g.fillStyle = cols[(i + j * 2) % 4];
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
        g.globalAlpha = 0.22; g.fillStyle = "#000"; g.fillRect(i * 64 + 2, j * 64 + 56, 60, 6);
      }
    } else if (kind === "carpet") {
      for (let i = 0; i < 420; i++) {
        g.globalAlpha = Math.random() * 0.22; g.fillStyle = Math.random() < 0.5 ? "#000" : "#fff";
        g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      }
    } else if (kind === "tile") {
      g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2;
      for (let i = 0; i <= 128; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
      }
      g.globalAlpha = 0.08; g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    } else if (kind === "concrete") {
      for (let i = 0; i < 240; i++) {
        g.globalAlpha = Math.random() * 0.14; g.fillStyle = "#000";
        g.fillRect(Math.random() * 128, Math.random() * 128, 3, 1.2);
      }
      g.globalAlpha = 0.2; g.strokeStyle = "#000"; g.strokeRect(0.5, 0.5, 127, 127);
    } else {
      for (let i = 0; i < 380; i++) {
        g.globalAlpha = Math.random() * 0.3;
        g.fillStyle = ["#e74c3c", "#f1c40f", "#3498db"][i % 3];
        g.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6);
      }
    }
  });
}
function wallTex(base, kind) {
  return makeTex(128, 128, (g) => {
    g.fillStyle = `#${new THREE.Color(base).getHexString()}`; g.fillRect(0, 0, 128, 128);
    g.globalAlpha = 0.16; g.fillStyle = "#000"; g.fillRect(0, 110, 128, 18);
    g.globalAlpha = 1;
    if (kind === "concrete") {
      for (let i = 0; i < 130; i++) { g.globalAlpha = Math.random() * 0.12; g.fillStyle = "#000"; g.fillRect(Math.random() * 128, Math.random() * 128, 4, 1.5); }
      g.globalAlpha = 0.10; g.fillStyle = "#4a2015"; g.fillRect(20, 30, 9, 70); g.fillRect(90, 10, 5, 90);
    } else {
      g.globalAlpha = 0.45; g.fillStyle = "#fff"; g.fillRect(0, 54, 128, 7);
      for (let i = 0; i < 50; i++) { g.globalAlpha = Math.random() * 0.08; g.fillStyle = "#000"; g.fillRect(Math.random() * 128, Math.random() * 128, 3, 2); }
    }
  });
}
export function posterTex(kind) {
  return makeTex(256, 320, (g, w, h) => {
    if (kind === "logo") {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#ffe45c"); grad.addColorStop(1, "#ff923c");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d33"; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(20 + i * 24, 30, 10, 0, 7); g.fill(); }
      g.fillStyle = "#123"; g.font = "900 44px Arial"; g.textAlign = "center";
      g.fillText("HAPPY", w / 2, 150); g.fillText("LAND", w / 2, 198);
      g.font = "700 15px Arial"; g.fillText("FAMILY FUN CENTER", w / 2, 230);
      g.font = "11px Arial"; g.fillText("EST. 1994 · PARTIES · ARCADE · PLAY", w / 2, 292);
    } else if (kind === "rules") {
      g.fillStyle = "#f5efe0"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#c73e3e"; g.fillRect(0, 0, w, 46);
      g.fillStyle = "#fff"; g.font = "900 22px Arial"; g.textAlign = "center"; g.fillText("HOUSE RULES", w / 2, 31);
      g.fillStyle = "#333"; g.font = "14px Arial"; g.textAlign = "left";
      ["1. SOCKS ON AT ALL TIMES", "2. NO RUNNING — HAVE FUN SAFELY", "3. LISTEN TO THE CLOWNS", "4. THE PARTY ENDS AT 9 PM", "5. STAY WHERE STAFF CAN SEE YOU", "6. DO NOT ENTER YELLOW DOORS"].forEach((r, i) => g.fillText(r, 18, 86 + i * 30));
      g.fillStyle = "#999"; g.font = "italic 11px Arial"; g.fillText("management is not responsible for lost children*", 18, 292);
    } else if (kind === "mascot") {
      g.fillStyle = "#2d1b4e"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffd23c"; g.beginPath(); g.arc(w / 2, 120, 62, 0, 7); g.fill();
      g.fillStyle = "#2d1b4e"; g.beginPath(); g.arc(w / 2 - 22, 105, 9, 0, 7); g.arc(w / 2 + 22, 105, 9, 0, 7); g.fill();
      g.strokeStyle = "#2d1b4e"; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, 130, 32, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = "#d33"; g.beginPath(); g.arc(w / 2, 122, 10, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.font = "900 26px Arial"; g.textAlign = "center";
      g.fillText("MEET", w / 2, 222); g.fillText("MR. HAPPY!", w / 2, 254);
      g.font = "13px Arial"; g.fillText("HE LOVES PARTIES", w / 2, 287);
    } else if (kind === "closed") {
      g.fillStyle = "#e8e0c8"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#222"; g.font = "900 30px Arial"; g.textAlign = "center"; g.fillText("CLOSED", w / 2, 60);
      g.font = "13px Arial";
      ["HappyLand Family Fun Center", "is permanently closed due to", "an electrical malfunction.", "", "Do not enter.", "Do not listen to the music."].forEach((r, i) => g.fillText(r, w / 2, 112 + i * 22));
      g.strokeStyle = "#a33"; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
    } else if (kind === "menu") {
      g.fillStyle = "#173f38"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffd23c"; g.font = "900 24px Arial"; g.textAlign = "center"; g.fillText("SNACK STOP", w / 2, 40);
      g.fillStyle = "#fff"; g.font = "15px Arial"; g.textAlign = "left";
      [["HAPPY MEAL", "6.50"], ["CLOWN DOG", "4.00"], ["BALLOON POPCORN", "3.50"], ["BIRTHDAY SLUSH", "2.75"], ["MYSTERY SUNDAE", "5.00"]].forEach((r, i) => { g.fillText(r[0], 22, 86 + i * 34); g.textAlign = "right"; g.fillText(r[1], w - 22, 86 + i * 34); g.textAlign = "left"; });
      g.fillStyle = "#ff6b6b"; g.font = "italic 12px Arial"; g.textAlign = "center"; g.fillText("ask about our party packages!", w / 2, 288);
    } else if (kind === "drawing") {
      g.fillStyle = "#f8f4e8"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#888"; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      for (let i = 0; i < 6; i++) {
        const x = 36 + i * 38, y = 210;
        g.strokeStyle = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#111"][i];
        g.lineWidth = 4;
        g.beginPath(); g.arc(x, y - 60, 14, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x, y - 6); g.moveTo(x - 14, y - 30); g.lineTo(x + 14, y - 30);
        g.moveTo(x, y - 6); g.lineTo(x - 12, y + 26); g.moveTo(x, y - 6); g.lineTo(x + 12, y + 26); g.stroke();
      }
      g.strokeStyle = "#111"; g.lineWidth = 5;
      g.beginPath(); g.arc(226, 96, 16, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(226, 112); g.lineTo(226, 196); g.stroke();
      g.fillStyle = "#d33"; g.font = "900 20px Arial"; g.textAlign = "center"; g.fillText("MY PARTY", w / 2, 50);
      g.fillStyle = "#888"; g.font = "12px Arial"; g.fillText("with all my friends", w / 2, 72);
    }
  });
}

// clown faces — used on heads, posters and the jumpscare canvas
export function drawClownFace(g, w, h, who) {
  const P = {
    bobby:   { skin: "#f4f0e6", eye: "#2288cc", nose: "#e03535", mouth: "#c02222", extra: "star" },
    jingle:  { skin: "#efe6f4", eye: "#7a3cc0", nose: "#e03535", mouth: "#8e1f6b", extra: "note" },
    mimic:   { skin: "#cfcfcf", eye: "#111111", nose: "#666666", mouth: "#3a3a3a", extra: "crack" },
    tickets: { skin: "#f4ead0", eye: "#1f9d4d", nose: "#d4a017", mouth: "#b03030", extra: "cash" },
    mrhappy: { skin: "#ffd23c", eye: "#231942", nose: "#e03535", mouth: "#231942", extra: "grin" },
  }[who] || { skin: "#eee", eye: "#333", nose: "#c00", mouth: "#900" };
  g.fillStyle = "#050505"; g.fillRect(0, 0, w, h);
  g.fillStyle = P.skin; g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * 0.42, 0, 7); g.fill();
  g.fillStyle = who === "mimic" ? "#000" : P.eye;
  g.beginPath(); g.arc(w * 0.38, h * 0.42, w * 0.05, 0, 7); g.arc(w * 0.62, h * 0.42, w * 0.05, 0, 7); g.fill();
  if (who !== "mimic") {
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(w * 0.39, h * 0.41, w * 0.016, 0, 7); g.arc(w * 0.63, h * 0.41, w * 0.016, 0, 7); g.fill();
  } else {
    g.fillStyle = "#000"; g.fillRect(w * 0.365, h * 0.42, w * 0.03, h * 0.13); g.fillRect(w * 0.605, h * 0.42, w * 0.03, h * 0.13);
  }
  g.strokeStyle = P.eye; g.lineWidth = w * 0.018;
  g.beginPath(); g.arc(w * 0.38, h * 0.345, w * 0.07, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.beginPath(); g.arc(w * 0.62, h * 0.345, w * 0.07, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.fillStyle = P.nose; g.beginPath(); g.arc(w / 2, h * 0.52, w * 0.055, 0, 7); g.fill();
  g.globalAlpha = 0.5; g.beginPath(); g.arc(w * 0.3, h * 0.55, w * 0.05, 0, 7); g.arc(w * 0.7, h * 0.55, w * 0.05, 0, 7); g.fill(); g.globalAlpha = 1;
  g.strokeStyle = P.mouth; g.lineWidth = w * 0.028; g.lineCap = "round";
  g.beginPath();
  if (who === "mrhappy") g.arc(w / 2, h * 0.5, w * 0.26, 0.15, Math.PI - 0.15);
  else g.arc(w / 2, h * 0.52, w * 0.18, 0.3, Math.PI - 0.3);
  g.stroke();
  if (P.extra === "star") { g.fillStyle = P.eye; star(g, w * 0.68, h * 0.3, w * 0.05); }
  if (P.extra === "note") { g.fillStyle = P.eye; g.font = `900 ${w * 0.09}px Arial`; g.fillText("♪", w * 0.68, h * 0.32); }
  if (P.extra === "cash") { g.fillStyle = P.eye; g.font = `900 ${w * 0.1}px Arial`; g.fillText("$", w * 0.66, h * 0.33); }
  if (P.extra === "grin") { g.fillStyle = "#fff"; for (let i = 0; i < 7; i++) g.fillRect(w * 0.31 + i * w * 0.052, h * 0.63, w * 0.04, h * 0.05); }
  if (P.extra === "crack") { g.strokeStyle = "#000"; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.7, h * 0.1); g.lineTo(w * 0.6, h * 0.35); g.lineTo(w * 0.68, h * 0.6); g.stroke(); }
}
function star(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    g[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

// -------------------------------------------------- geo merging
function mergeBoxes(boxes) {
  let vCount = 0; const geoms = [];
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
    const m = new THREE.Matrix4();
    if (b.ry) m.makeRotationY(b.ry);
    m.setPosition(b.x, b.y, b.z);
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = b.color.r; cols[i * 3 + 1] = b.color.g; cols[i * 3 + 2] = b.color.b; }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geoms.push(g); vCount += n;
  }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3),
    col = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  let off = 0;
  for (const g of geoms) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    col.set(g.attributes.color.array, off * 3);
    uv.set(g.attributes.uv.array, off * 2);
    off += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}
function mergeGeos(geoms) {
  const ng = geoms.map(g => g.index ? g.toNonIndexed() : g);
  let v = 0; ng.forEach(g => v += g.attributes.position.count);
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), uv = new Float32Array(v * 2);
  let o = 0;
  for (const g of ng) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

// -------------------------------------------------- clown bodies
// shared by clowns.js (AI) and world.js (deactivated mascot props)
export function buildClownMesh(who, silhouette = false) {
  const PAL = {
    bobby:   { skin: 0xf4f0e6, suit: 0xd8403a, suit2: 0x2a8fc4, hat: "cone", scale: [0.9, 1.25, 0.9], balloons: true },
    jingle:  { skin: 0xefe6f4, suit: 0x6a3aa0, suit2: 0x2fb0a0, hat: "jester", scale: [1.0, 1.05, 1.0], accordion: true },
    mimic:   { skin: 0xcfcfcf, suit: 0x53535c, suit2: 0x3a3a44, hat: null, scale: [0.62, 1.5, 0.62] },
    tickets: { skin: 0xf4ead0, suit: 0x1f7d3d, suit2: 0xd4a017, hat: "cap", scale: [1.25, 0.95, 1.25], roll: true },
    mrhappy: { skin: 0xffd23c, suit: 0x2d1b4e, suit2: 0xffd23c, hat: "top", scale: [1.5, 1.6, 1.5] },
  }[who];
  const mat = c => new THREE.MeshLambertMaterial({ color: silhouette ? 0x060608 : c });
  const g = new THREE.Group();
  const S = PAL.scale;
  // torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * S[0], 0.34 * S[0], 0.85 * S[1], 10), mat(PAL.suit));
  torso.position.y = 0.95 * S[1]; g.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27 * S[0], 10, 8), mat(PAL.suit2));
  belly.position.y = 0.88 * S[1]; belly.scale.y = 1.15; g.add(belly);
  // collar ruffle
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2 * S[0], 0.07, 8, 14), mat(0xf0ead0));
  collar.position.y = 1.38 * S[1]; collar.rotation.x = Math.PI / 2; g.add(collar);
  // buttons
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0x161616));
    b.position.set(0, (1.05 - i * 0.18) * S[1], -0.30 * S[0]); g.add(b);
  }
  // head
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21 * S[0] * 1.05, 14, 12), mat(PAL.skin));
  head.add(skull);
  if (!silhouette) {
    const faceC = document.createElement("canvas"); faceC.width = faceC.height = 128;
    drawClownFace(faceC.getContext("2d"), 128, 128, who);
    const faceT = new THREE.CanvasTexture(faceC); faceT.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.185 * S[0] * 1.05, 20),
      new THREE.MeshBasicMaterial({ map: faceT, transparent: true }));
    face.position.z = -0.145 * S[0] * 1.05; face.rotation.y = Math.PI; head.add(face);
  }
  // hair puffs
  const hairM = mat(PAL.suit2 === 0xd4a017 ? 0xd8403a : 0xe03535);
  for (const sx of [-1, 1]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.1 * S[0], 8, 6), hairM);
    puff.position.set(sx * 0.2 * S[0], 0.05, 0); head.add(puff);
  }
  // hats
  if (PAL.hat === "cone") {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 10), mat(PAL.suit2));
    cone.position.y = 0.36; head.add(cone);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xf0ead0)); pom.position.y = 0.58; head.add(pom);
  } else if (PAL.hat === "jester") {
    for (let i = -1; i <= 1; i++) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), mat(i === 0 ? PAL.suit2 : PAL.suit));
      h.position.set(i * 0.14, 0.3, 0); h.rotation.z = -i * 0.6; head.add(h);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0xd4d4d4));
      bell.position.set(i * 0.22, 0.42 - Math.abs(i) * 0.02, 0); head.add(bell);
    }
  } else if (PAL.hat === "cap") {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.1, 10), mat(PAL.suit2));
    cap.position.y = 0.22; head.add(cap);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), mat(0xffe27a));
    coin.position.set(0, 0.29, 0); head.add(coin);
  } else if (PAL.hat === "top") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), mat(0x161616)); brim.position.y = 0.2; head.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 12), mat(0x161616)); top.position.y = 0.38; head.add(top);
  }
  head.position.y = 1.62 * S[1]; g.add(head);
  // arms
  function arm(side) {
    const a = new THREE.Group();
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.62 * S[1], 8), mat(PAL.suit));
    up.position.y = -0.31 * S[1]; a.add(up);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xf0ead0));
    glove.position.y = -0.62 * S[1]; a.add(glove);
    a.position.set(side * 0.34 * S[0], 1.32 * S[1], 0);
    g.add(a); return a;
  }
  const armL = arm(-1), armR = arm(1);
  // props in hands
  if (PAL.balloons) {
    const cl = new THREE.Group();
    const colsB = [0xd8403a, 0x2a8fc4, 0xf0b03a, 0x38b060, 0xa04ac0, 0xf0ead0];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(colsB[i]));
      b.scale.y = 1.15;
      const a = (i / 6) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.28, 0.72 + (i % 3) * 0.22, Math.sin(a) * 0.28);
      cl.add(b);
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(b.position.x, b.position.y - 0.18, b.position.z)]);
      cl.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x888888 })));
    }
    cl.position.set(0, -0.62 * S[1], 0); armR.add(cl);
  }
  if (PAL.accordion) {
    const acc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.2), mat(0xa03030));
    acc.position.set(0, -0.5 * S[1], -0.15); armR.add(acc);
    const accB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.22), mat(0xf0ead0));
    accB.position.set(0.2, -0.5 * S[1], -0.15); armR.add(accB);
  }
  if (PAL.roll) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12), mat(0xd4a017));
    roll.rotation.z = Math.PI / 2; roll.position.set(0, -0.62 * S[1], -0.05); armR.add(roll);
  }
  // legs
  function leg(side) {
    const l = new THREE.Group();
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.6 * S[1], 8), mat(PAL.suit2));
    shin.position.y = -0.3 * S[1]; l.add(shin);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0x7a1616));
    shoe.scale.set(1, 0.6, 1.8); shoe.position.set(0, -0.6 * S[1], -0.08); l.add(shoe);
    l.position.set(side * 0.14 * S[0], 0.62 * S[1], 0);
    g.add(l); return l;
  }
  const legL = leg(-1), legR = leg(1);
  // soft blob shadow
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5 * S[0], 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; g.add(blob);
  g.userData = { head, armL, armR, legL, legR, who };
  return g;
}

// ============================================================ BUILD WORLD
export function buildWorld(scene) {
  const world = {
    doors: {}, lockers: [], balloons: [], cams: [], lightRigs: [],
    balloonSpots: [[24, 17], [18, 24], [30, 18], [9, 21], [5, 18], [38, 14], [43, 24], [21, 30], [36, 9], [37, 4], [10, 11], [24, 9]],
    arcadeScreens: [], update: null, setLighting: null,
    flickerMode: false, partyModeOn: false, exitSign: null, pkScreen: null,
    staticTVs: [], tv: null, mrHappyMesh: null,
  };
  const C = h => new THREE.Color(h);

  // ---------------- materials / floors / ceilings
  const floorMats = {}, wallMatsByKind = {}, wallBoxesByKind = {};
  const wallMatPlain = {}; // cache per kind
  for (const r of ROOMS) {
    if (!floorMats[r.kind]) floorMats[r.kind] = new THREE.MeshLambertMaterial({ map: floorTex(r.kind, r.floor) });
    if (!wallMatsByKind[r.kind]) wallMatsByKind[r.kind] = new THREE.MeshLambertMaterial({ map: wallTex(r.wall, r.kind), vertexColors: true });
  }
  const floorGeosByKind = {};
  for (const r of ROOMS) {
    const g = new THREE.PlaneGeometry(r.w * TILE, r.h * TILE);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r.w, uv.getY(i) * r.h);
    g.translate((r.x + r.w / 2) * TILE, 0, (r.y + r.h / 2) * TILE);
    (floorGeosByKind[r.kind] = floorGeosByKind[r.kind] || []).push(g);
  }
  for (const k in floorGeosByKind) scene.add(new THREE.Mesh(mergeGeos(floorGeosByKind[k]), floorMats[k]));

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(GW * TILE + 4, 0.3, GH * TILE + 4), new THREE.MeshLambertMaterial({ color: 0x181a20 }));
  ceil.position.set(GW * TILE / 2, CEIL + 0.15, GH * TILE / 2); scene.add(ceil);

  // ---------------- walls
  const HW = CEIL;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const id = roomAt[y * GW + x]; if (id < 0) continue;
    const room = roomById[id];
    for (const [d, dx, dy] of [["N", 0, -1], ["S", 0, 1], ["W", -1, 0], ["E", 1, 0]]) {
      const nx = x + dx, ny = y + dy;
      const other = (nx < 0 || ny < 0 || nx >= GW || ny >= GH) ? -1 : roomAt[ny * GW + nx];
      if (other === id) continue;
      if (!wallAt(x, y, d, "solid")) continue;
      const cx = x * TILE + TILE / 2, cz = y * TILE + TILE / 2;
      const horiz = (d === "N" || d === "S");
      const px = horiz ? cx : (d === "W" ? x * TILE : x * TILE + TILE);
      const pz = horiz ? (d === "N" ? y * TILE : y * TILE + TILE) : cz;
      const door = doorAtEdge(x, y, d);
      if (door) {
        if (door._framed) continue;
        door._framed = true;
        // lintel above the doorway
        (wallBoxesByKind[room.kind] = wallBoxesByKind[room.kind] || []).push(
          horiz ? { x: px, z: pz, w: TILE + 0.26, h: HW - 2.2, d: 0.26, y: 2.2 + (HW - 2.2) / 2, color: C(room.wall) }
                : { x: px, z: pz, w: 0.26, h: HW - 2.2, d: TILE + 0.26, y: 2.2 + (HW - 2.2) / 2, color: C(room.wall) });
        continue;
      }
      const box = horiz
        ? { x: px, z: pz, w: TILE + 0.26, h: HW, d: 0.26, y: HW / 2, color: C(room.wall) }
        : { x: px, z: pz, w: 0.26, h: HW, d: TILE + 0.26, y: HW / 2, color: C(room.wall) };
      (wallBoxesByKind[room.kind] = wallBoxesByKind[room.kind] || []).push(box);
    }
  }
  for (const k in wallBoxesByKind) scene.add(new THREE.Mesh(mergeBoxes(wallBoxesByKind[k]), wallMatsByKind[k]));

  // ---------------- doors (pivoting panels + signs)
  const panelMatWood = new THREE.MeshLambertMaterial({ color: 0x6e4526 });
  const panelMatMetal = new THREE.MeshLambertMaterial({ color: 0x5a6270 });
  const panelMatYellow = new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x241a00 });
  const panelMatRed = new THREE.MeshLambertMaterial({ color: 0x8c1f28, emissive: 0x1c0305 });
  for (const d of DOORS) {
    const horiz = (d.dir === "N" || d.dir === "S");
    // wall plane position
    const ex = (d.dir === "W") ? d.x * TILE : (d.dir === "E") ? d.x * TILE + TILE : d.x * TILE;
    const ez = (d.dir === "N") ? d.y * TILE : (d.dir === "S") ? d.y * TILE + TILE : d.y * TILE;
    const hinge = new THREE.Group();
    const hx = horiz ? ex + 0.06 : ex, hz = horiz ? ez : ez + 0.06;
    hinge.position.set(hx, 0, hz);
    const matUse = d.yellow ? panelMatYellow : d.id === "emergency" ? panelMatRed : (d.id === "maint" || d.id === "security") ? panelMatMetal : panelMatWood;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(horiz ? TILE - 0.12 : 0.09, 2.18, horiz ? 0.09 : TILE - 0.12), matUse);
    panel.position.set(horiz ? (TILE - 0.12) / 2 : 0, 1.09, horiz ? 0 : (TILE - 0.12) / 2);
    hinge.add(panel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc0c0c0 }));
    knob.position.set(horiz ? TILE - 0.3 : 0.09, 1.05, horiz ? 0.09 : TILE - 0.3);
    hinge.add(knob);
    scene.add(hinge);
    // sign above doorway (both sides)
    const signT = makeTex(256, 64, (g, w, h) => {
      g.fillStyle = d.yellow ? "#c9a227" : "#20242c"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#f2ede2"; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = d.yellow ? "#111" : "#f2ede2"; g.font = "900 30px Arial"; g.textAlign = "center";
      g.fillText(d.id === "emergency" ? "EMERGENCY EXIT" : d.name, w / 2, 42);
    });
    for (const s of [-0.16, 0.16]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: signT }));
      if (horiz) { sign.position.set(d.x * TILE + TILE / 2, 2.48, ez + s); }
      else { sign.position.set(ex + s, 2.48, d.y * TILE + TILE / 2); sign.rotation.y = Math.PI / 2; }
      scene.add(sign);
    }
    world.doors[d.id] = { def: d, hinge, target: 0 };
    // door "center" world pos for interaction
    world.doors[d.id].pos = new THREE.Vector3(horiz ? d.x * TILE + TILE / 2 : ex, 1.2, horiz ? ez : d.y * TILE + TILE / 2);
  }

  // ---------------- generic prop helpers
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  function box(px, py, pz, w, h, d, color, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
    m.position.set(px, py, pz); m.rotation.y = ry; scene.add(m); return m;
  }
  function poster(kind, px, py, pz, ry, w = 1.1, h = 1.4) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: posterTex(kind) }));
    m.position.set(px, py, pz); m.rotation.y = ry; scene.add(m); return m;
  }
  function blockTiles(list) { list.forEach(([x, y]) => addBlocked(x, y)); }
  function tileC(x, y) { return [wx(x), wz(y)]; }

  // ============================ ROOM DRESSING ============================

  // --- FOYER (16..25, 28..33): entrance mat, logo, posters, queue posts
  box(wx(20.5) - TILE, 0.01, wz(32), 3.6, 0.02, 1.6, 0x3a4048); // mat
  poster("logo", wx(21), 2.0, 34 * TILE - 0.14 - TILE * 0, Math.PI, 2.4, 3.0);
  poster("closed", 16 * TILE + 0.16, 1.7, wz(31), Math.PI / 2, 0.9, 1.2);
  poster("rules", 16 * TILE + 0.16, 1.7, wz(29), Math.PI / 2, 0.9, 1.2);
  for (let i = 0; i < 4; i++) { // queue posts
    box(wx(19 + i), 0.5, wz(30.2) + (i % 2) * 0.8, 0.09, 1.0, 0.09, 0x888888);
  }
  // party garland across foyer
  garland(wx(17) , CEIL - 0.4, wz(31), 8, 0);

  // --- RECEPTION (26..35, 28..33)
  blockTiles([[27, 29], [28, 29], [29, 29], [30, 29]]);
  for (const [x, y] of [[27, 29], [28, 29], [29, 29], [30, 29]]) box(wx(x), 0.55, wz(y), TILE, 1.1, TILE, 0x7a5230);
  box(wx(28.5), 1.12, wz(29), TILE * 4 + 0.2, 0.06, TILE + 0.2, 0x9c6a3e);
  box(wx(28), 1.32, wz(29), 0.5, 0.34, 0.06, 0x222831, -0.2); // monitor
  poster("mascot", 36 * TILE - 0.16, 1.8, wz(29), -Math.PI / 2, 1.0, 1.3);
  box(wx(33), 0.4, wz(32), TILE - 0.4, 0.8, 0.9, 0x5a4b8a); // lost&found bin

  // --- TOILETS (10..15, 28..33)
  blockTiles([[10, 29], [10, 30], [10, 31]]); // sink counter
  for (const [x, y] of [[10, 29], [10, 30], [10, 31]]) box(wx(x), 0.45, wz(y), TILE, 0.9, TILE, 0xd8dde0);
  for (const [x, y] of [[10, 29], [10, 30], [10, 31]]) box(wx(x), 0.92, wz(y), 0.5, 0.08, 0.5, 0xf2f5f7);
  // stalls
  box(wx(13), 1.1, wz(28.4), 0.06, 2.2, 1.2, 0x3f7f9f); box(wx(14), 1.1, wz(28.4), 0.06, 2.2, 1.2, 0x3f7f9f);
  makeLocker(15, 33, "toilets");
  // drips
  addStain(wx(12), wz(31));

  // --- MAIN HALL (16..33, 10..27)
  // climbing structure: colorful blocks + arches
  const climbCols = [0xd8403a, 0x2a8fc4, 0xf0b03a, 0x38b060, 0xa04ac0];
  const climbTiles = [[20, 15], [21, 15], [20, 16], [23, 15], [23, 16], [21, 19], [22, 19], [26, 14], [27, 14], [26, 15], [29, 17], [29, 18], [26, 20], [27, 20], [28, 20], [26, 21], [27, 21], [18, 20], [19, 20], [18, 21]];
  climbTiles.forEach(([x, y], i) => {
    const h = 0.8 + ((i * 7) % 3) * 0.55;
    box(wx(x), h / 2, wz(y), TILE - 0.24, h, TILE - 0.24, climbCols[i % 5]);
  });
  blockTiles(climbTiles);
  // safety netting poles
  for (const [x, y] of [[22, 15], [24, 16], [25, 19], [19, 15], [28, 15], [30, 19]]) {
    box(wx(x), 1.5, wz(y), 0.12, 3.0, 0.12, 0xf0ead0);
  }
  // slide (SE)
  blockTiles([[32, 13], [33, 13], [32, 14], [33, 14], [32, 15], [33, 15], [32, 16], [33, 16]]);
  const slide = new THREE.Group();
  const ramp = box(0, 0, 0, TILE * 2 - 0.3, 0.18, TILE * 3, 0xd8403a);
  ramp.rotation.x = -0.42; ramp.position.set(0, 0.9, 0); slide.add(ramp);
  const rail1 = box(0, 0, 0, 0.1, 0.5, TILE * 3, 0xf0b03a); rail1.rotation.x = -0.42; rail1.position.set(-TILE + 0.2, 1.25, 0); slide.add(rail1);
  const rail2 = rail1.clone(); rail2.position.x = TILE - 0.5; slide.add(rail2);
  slide.position.set(wx(32), 0, wz(14)); scene.add(slide);
  // trampoline corner
  for (let y = 24; y <= 26; y++) for (let x = 17; x <= 19; x++) trampTile[y * GW + x] = 1;
  const tramp = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.25, 20), lam(0x222831));
  tramp.position.set(wx(18), 0.12, wz(25)); scene.add(tramp);
  const trampMat = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.27, 20), lam(0x8a2be2));
  trampMat.position.set(wx(18), 0.14, wz(25)); scene.add(trampMat);
  // coin-op ride (rocket)
  const ride = new THREE.Group();
  const rbase = box(0, 0.2, 0, 1.0, 0.4, 1.4, 0x7a1616); ride.add(rbase);
  const rbody = box(0, 0.75, 0, 0.7, 0.7, 1.3, 0xd8403a, 0); ride.add(rbody);
  const rnose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 10), lam(0xf0ead0)); rnose.rotation.x = Math.PI / 2; rnose.position.set(0, 0.75, -0.95); ride.add(rnose);
  ride.position.set(wx(22), 0, wz(26.3)); scene.add(ride);
  world.ride = { group: ride, rocking: 0 };
  // ceiling party decoration rings
  for (const [x, y] of [[22, 16], [27, 18], [25, 22]]) garland(wx(x) - 2, CEIL - 0.5, wz(y), 4, 0.6);
  // big mural
  poster("drawing", 16 * TILE + 0.16, 1.9, wz(17), Math.PI / 2, 1.5, 1.9);

  // --- BALL PIT (2..15, 13..27)
  for (let y = 15; y <= 26; y++) for (let x = 3; x <= 14; x++) pitTile[y * GW + x] = 1;
  // pit rim
  for (let x = 3; x <= 14; x++) { box(wx(x), 0.25, wz(14.6), TILE, 0.5, 0.24, 0xf0b03a); }
  for (let y = 15; y <= 26; y++) { box(2 * TILE + TILE, 0.25, wz(y), 0.24, 0.5, TILE, 0xf0b03a); box(15 * TILE, 0.25, wz(y), 0.24, 0.5, TILE, 0xf0b03a); }
  for (let x = 3; x <= 14; x++) { box(wx(x), 0.25, wz(26.4), TILE, 0.5, 0.24, 0xf0b03a); }
  // balls (instanced)
  const ballGeo = new THREE.SphereGeometry(0.14, 8, 6);
  const ballMat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const ballCols = [0xd8403a, 0x2a8fc4, 0xf0b03a, 0x38b060, 0xffffff];
  const im = new THREE.InstancedMesh(ballGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 620);
  const m4 = new THREE.Matrix4(); const colI = new THREE.Color();
  for (let i = 0; i < 620; i++) {
    const x = 3 + Math.random() * 11, y = 15 + Math.random() * 11;
    m4.makeTranslation(wx(x) + (Math.random() - 0.5) * 1.2, 0.12 + Math.random() * 0.1, wz(y) + (Math.random() - 0.5) * 1.2);
    im.setMatrixAt(i, m4);
    colI.setHex(ballCols[i % 5]); im.setColorAt(i, colI);
  }
  im.instanceMatrix.needsUpdate = true; scene.add(im);
  // tube slide from balcony (decor)
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9 + 0.001, 6, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0x38b060, side: THREE.DoubleSide }));
  tube.rotation.z = 0.9; tube.rotation.y = 0.5; tube.position.set(wx(4) + 2.5, 1.6, wz(14.6)); scene.add(tube);

  // --- ARCADE (34..45, 10..19)
  buildArcadeRow(34, [11, 12, 13, 14, 15, 16, 17, 18], "E");
  buildArcadeRow(45, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], "W");
  buildArcadeRowH([39, 40, 41, 42, 43, 44], 10, "S");
  function buildArcadeRow(x, ys, face) { ys.forEach((y, i) => buildCabinet(x, y, face, i)); }
  function buildArcadeRowH(xs, y, face) { xs.forEach((x, i) => buildCabinet(x, y, face, i + 8)); }
  function buildCabinet(x, y, face, i) {
    addBlocked(x, y);
    const cols = [0x5a4b8a, 0x8a4b5a, 0x4b8a6a, 0x8a7a4b, 0x4b5a8a];
    const cab = box(wx(x), 0.95, wz(y), 1.0, 1.9, 1.0, cols[i % 5]);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), new THREE.MeshBasicMaterial({ color: 0x0a0e14 }));
    const scrMatOff = scr.material;
    if (face === "E") { scr.position.set(wx(x) + 0.51, 1.32, wz(y)); scr.rotation.y = Math.PI / 2; }
    if (face === "W") { scr.position.set(wx(x) - 0.51, 1.32, wz(y)); scr.rotation.y = -Math.PI / 2; }
    if (face === "S") { scr.position.set(wx(x), 1.32, wz(y) + 0.51); }
    scene.add(scr);
    world.arcadeScreens.push({ mat: scrMatOff, tile: [x, y], on: false, playable: false, mesh: scr });
    // marquee
    const marq = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.2), lam([0xd8403a, 0x2a8fc4, 0xf0b03a][i % 3]));
    if (face === "E") { marq.position.set(wx(x) + 0.35, 1.95, wz(y)); }
    if (face === "W") { marq.position.set(wx(x) - 0.35, 1.95, wz(y)); }
    if (face === "S") { marq.position.set(wx(x), 1.95, wz(y) + 0.35); }
    scene.add(marq);
  }
  // neon sign
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.0),
    new THREE.MeshBasicMaterial({ map: makeTex(512, 96, (g, w, h) => {
      g.fillStyle = "#10081c"; g.fillRect(0, 0, w, h);
      g.font = "900 64px Arial"; g.textAlign = "center";
      g.shadowColor = "#f0f"; g.shadowBlur = 22; g.fillStyle = "#ff77ff"; g.fillText("ARCADE", w / 2, 66);
      g.shadowColor = "#0ff"; g.shadowBlur = 16; g.strokeStyle = "#77ffff"; g.strokeText("ARCADE", w / 2, 66);
    }) }));
  neon.position.set(wx(39.5), 2.6, 20 * TILE - 0.18); neon.rotation.y = 0; scene.add(neon);
  world.neon = neon;

  // --- PRIZE COUNTER (34..45, 20..27)
  blockTiles([[36, 21], [37, 21], [38, 21], [40, 21], [41, 21], [42, 21], [43, 21]]);
  for (const [x, y] of [[36, 21], [37, 21], [38, 21], [40, 21], [41, 21], [42, 21], [43, 21]]) {
    box(wx(x), 0.55, wz(y), TILE, 1.1, TILE, 0x8a6d3f);
    box(wx(x), 1.2, wz(y), TILE, 0.08, TILE * 0.5, 0xd4a017);
  }
  // plush wall
  for (let i = 0; i < 8; i++) {
    const plush = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lam([0xd8403a, 0x2a8fc4, 0xf0b03a, 0xa04ac0][i % 4]));
    plush.position.set(wx(35.2) + i * 1.3, 2.0, wz(27.4)); scene.add(plush);
  }
  for (let i = 0; i < 8; i++) {
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), lam(0x161616));
    earL.position.set(wx(35.2) + i * 1.3 - 0.18, 2.28, wz(27.4)); scene.add(earL);
  }
  box(wx(37), 0.4, wz(24), TILE - 0.6, 0.8, TILE - 0.6, 0x6e4526); // crate
  poster("menu", 34 * TILE + 0.16, 1.8, wz(23), Math.PI / 2, 1.2, 1.5);

  // --- FOOD COURT (2..15, 10..12)
  const tableTiles = [[4, 11], [6, 11], [8, 11], [10, 11], [12, 11], [5, 12], [7, 12], [9, 12], [11, 12], [13, 11]];
  tableTiles.forEach(([x, y], i) => {
    // keep two center tiles walkable-hide (use 6,11)
    const topT = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 12), lam(i % 2 ? 0xd8403a : 0x2a8fc4));
    topT.position.set(wx(x), 0.75, wz(y)); scene.add(topT);
    box(wx(x), 0.38, wz(y), 0.12, 0.75, 0.12, 0x444444);
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      box(wx(x) + ox * 0.95, 0.25, wz(y) + oz * 0.95, 0.5, 0.5, 0.5, i % 2 ? 0xf0b03a : 0x38b060);
    }
  });
  // food counter along y10 right side
  blockTiles([[9, 10], [10, 10], [11, 10], [12, 10], [13, 10], [14, 10]]);
  for (let x = 9; x <= 14; x++) box(wx(x), 0.55, wz(10), TILE, 1.1, TILE, 0x97a3a0);
  box(wx(11.5), 1.14, wz(10), TILE * 6, 0.05, TILE, 0xd8dde0);
  poster("menu", 2 * TILE + 0.16, 1.8, wz(11), Math.PI / 2, 1.6, 2.0);
  // abandoned trays
  box(wx(5), 0.82, wz(11.6), 0.5, 0.05, 0.36, 0xd8dde0, 0.4);
  box(wx(10.9), 0.82, wz(12.3), 0.4, 0.06, 0.3, 0xc0392b, -0.3);

  // --- KITCHEN (2..9, 1..7)
  blockTiles([[3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2]]);
  for (let x = 3; x <= 8; x++) box(wx(x), 0.55, wz(2), TILE, 1.1, TILE, 0x9aa4ab);
  box(wx(5.5), 1.12, wz(2), TILE * 4, 0.05, TILE, 0xe8eef2);
  box(wx(5), 1.18, wz(2), 0.7, 0.1, 0.5, 0x222222); // fryer
  blockTiles([[8, 1]]); // fridge (hide)
  const fridge = box(wx(8), 1.0, wz(1), TILE - 0.3, 2.0, TILE - 0.5, 0xd8dde0);
  box(wx(8) - 0.02, 1.0, wz(1) - 0.76, 0.1, 1.6, 0.1, 0x99a4ab);
  // whiteboard with code
  world.whiteboard = makeTex(256, 160, (g, w, h) => {
    g.fillStyle = "#eef2f4"; g.fillRect(0, 0, w, h); g.strokeStyle = "#889"; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    g.fillStyle = "#c0392b"; g.font = "900 26px Arial"; g.fillText("CLOSING CHECKLIST", 14, 34);
    g.fillStyle = "#223"; g.font = "16px Arial";
    ["□ ball pit count", "□ mascot storage", "□ limonade siroop", "□ PARTYKEEPER restart", "  code half: 09"].forEach((r, i) => g.fillText(r, 16, 68 + i * 22));
  });
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ map: world.whiteboard }));
  wb.position.set(2 * TILE + 0.16, 1.7, wz(4)); wb.rotation.y = Math.PI / 2; scene.add(wb);
  // hanging pans
  for (let i = 0; i < 3; i++) box(wx(4 + i), 2.4, wz(2.9), 0.3, 0.3, 0.05, 0x666e74);

  // --- STORAGE (10..15, 1..7)
  blockTiles([[11, 2], [12, 2], [13, 2], [14, 2], [11, 4], [12, 4], [13, 4], [14, 4], [12, 6], [13, 6], [14, 6]]);
  function shelf(x, y, wTiles) {
    box(wx(x) + (wTiles - 1), 1.0, wz(y), wTiles * TILE - 0.3, 2.0, TILE - 0.6, 0x6e5a3e);
    for (let s = 0; s < 3; s++) box(wx(x) + (wTiles - 1), 0.45 + s * 0.6, wz(y), wTiles * TILE - 0.2, 0.06, TILE - 0.4, 0x8a7350);
    // boxes on shelves
    for (let b = 0; b < wTiles * 2; b++) {
      box(wx(x) - 0.7 + b * 1.0, 0.62 + (b % 3) * 0.6, wz(y) + (b % 2 ? 0.2 : -0.2), 0.6, 0.3, 0.5, [0xa08a5a, 0x7a8a9a, 0x9a6a5a][b % 3]);
    }
  }
  shelf(11, 2, 4); shelf(11, 4, 4); shelf(12, 6, 3);
  makeLocker(10, 6, "storage");

  // --- STAFF (16..20, 1..7)
  makeLocker(16, 2, "staff"); makeLocker(16, 4, "staff");
  blockTiles([[18, 2], [19, 2]]);
  box(wx(18.5), 0.4, wz(2), TILE * 2 - 0.3, 0.8, TILE - 0.4, 0x4a5560);
  box(wx(19), 0.95, wz(2), 0.4, 0.3, 0.05, 0x222831, 0.3);
  // corkboard with memo
  poster("closed", 16 * TILE + 0.16, 1.7, wz(6), Math.PI / 2, 0.8, 1.0);
  box(wx(20) - 0.3, 0.3, wz(6), 0.5, 0.6, 0.5, 0x8a4b3a); // tipped chair
  // punch clock
  box(16 * TILE + 0.2, 1.6, wz(2.6), 0.28, 0.5, 0.18, 0x335);

  // --- SECURITY (21..26, 1..7)
  blockTiles([[23, 2], [24, 2]]);
  box(wx(23.5), 0.42, wz(2), TILE * 2 - 0.2, 0.84, TILE - 0.3, 0x3a4550);
  // monitor bank (static screens)
  world.staticTVs = [];
  const statC = document.createElement("canvas"); statC.width = 256; statC.height = 128;
  const statT = new THREE.CanvasTexture(statC); statT.colorSpace = THREE.SRGBColorSpace;
  world.staticTVs.push({ canvas: statC, tex: statT, t: 0 });
  for (let i = 0; i < 6; i++) {
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: statT }));
    mm.position.set(wx(22.4) + i * 0.75, 1.9 + (i % 2) * 0.45, 1 * TILE + 0.16); // on north wall
    scene.add(mm);
  }
  world.staticRedraw = function () {
    const g = statC.getContext("2d"), id = g.createImageData(256, 128), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    g.fillStyle = "rgba(255,0,0,.8)"; g.font = "900 18px Courier"; g.fillText("REC ●", 8, 22);
    statT.needsUpdate = true;
  };
  box(wx(25), 0.35, wz(5), 0.8, 0.7, 0.8, 0x554a6a); // office chair
  box(wx(22), 0.35, wz(6), 0.9, 0.7, 0.5, 0x335533); // box of tapes

  // --- MAINTENANCE (27..33, 1..7)
  blockTiles([[31, 2], [32, 2], [33, 2], [31, 3], [32, 3], [33, 3], [31, 4], [32, 4], [33, 4]]);
  for (const [x, y] of [[31, 2], [32, 2], [33, 2], [31, 3], [32, 3], [33, 3], [31, 4], [32, 4], [33, 4]]) {
    box(wx(x), 1.1, wz(y), TILE - 0.2, 2.2, TILE - 0.2, 0x2c3138);
    for (let l = 0; l < 3; l++) box(wx(x) - 0.7 + l * 0.6, 1.4 + (l % 2) * 0.4, wz(y) - 0.85 + 0.0, 0.14, 0.14, 0.05, [0x39d353, 0xd83a3a, 0xf0b03a][l]);
  }
  // PARTYKEEPER terminal
  blockTiles([[28, 1]]);
  box(wx(28), 0.6, wz(1), 1.5, 1.2, 0.6, 0x3a4550);
  const pkC = document.createElement("canvas"); pkC.width = 256; pkC.height = 160;
  const pkT = new THREE.CanvasTexture(pkC); pkT.colorSpace = THREE.SRGBColorSpace;
  const pkMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.72), new THREE.MeshBasicMaterial({ map: pkT }));
  pkMesh.position.set(wx(28), 1.5, wz(1) + 0.36); pkMesh.rotation.x = -0.22; scene.add(pkMesh);
  world.pkScreen = {
    set(state, extra) {
      const g = pkC.getContext("2d");
      g.fillStyle = "#060a06"; g.fillRect(0, 0, 256, 160);
      g.font = "16px Courier"; g.fillStyle = "#39d353";
      const lines = {
        locked: ["PARTYKEEPER v7.2", "", "AUTH REQUIRED", "", "party guests detected: 6", "status: CELEBRATING"],
        ready: ["PARTYKEEPER v7.2", "", "SHUTDOWN SEQUENCE READY", "ENTER CODE: ##-##", "", extra || ""],
        armed: ["PARTYKEEPER v7.2", "", "SHUTDOWN PENDING...", "FINISH THE PARTY FIRST", "", "do not disappoint the host"],
        offline: ["PARTYKEEPER v7.2", "", "", "  PARTYKEEEEP", "", "", "  ...goodnight."],
        denied: ["PARTYKEEPER v7.2", "", "ACCESS DENIED", "GUESTS MAY NOT LEAVE", "EARLY.", ""],
      }[state] || [""];
      lines.forEach((l, i) => g.fillText(l, 10, 26 + i * 24));
      pkT.needsUpdate = true;
    }
  };
  world.pkScreen.set("locked");
  // deactivated mascot on workbench + standing suits
  const dead1 = buildClownMesh("bobby"); dead1.position.set(wx(30) - 1.2, 0, wz(6)); dead1.rotation.z = 0.9; dead1.scale.setScalar(0.9); scene.add(dead1);
  const dead2 = buildClownMesh("jingle"); dead2.position.set(wx(33) - 0.6, 0, wz(6.5)); dead2.rotation.x = -0.15; scene.add(dead2);
  // hanging cables
  for (let i = 0; i < 4; i++) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1 + i * 0.3, 6), lam(0x222222));
    cable.position.set(wx(29) + i * 1.1, CEIL - 0.5 - i * 0.15, wz(3)); scene.add(cable);
  }

  // --- BIRTHDAY HALL (34..45, 8..9)
  garland(wx(35), CEIL - 0.5, wz(8.5), 10, 0.3);
  poster("mascot", 34 * TILE + 0.16, 1.8, wz(9), Math.PI / 2, 0.95, 1.25);
  poster("rules", 45 * TILE - 0.16 - TILE + TILE + TILE - 0.16 + 0.16, 1.8, wz(8.6), -Math.PI / 2, 0.9, 1.2); // east wall

  // --- BIRTHDAY 1 (34..38, 1..7)
  blockTiles([[36, 3], [36, 4]]);
  const b1t = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 14), lam(0xf0ead0));
  b1t.position.set(wx(36), 0.75, wz(3.5)); scene.add(b1t);
  for (const [ox, oz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0.8, -1.2], [-0.8, -1.2]]) box(wx(36) + ox, 0.25, wz(3.5) + oz, 0.45, 0.5, 0.45, 0xd8403a);
  partyHat(wx(36) + 0.4, wz(3.5) + 0.3, 0.82); partyHat(wx(36) - 0.5, wz(3.5) - 0.4, 0.82); partyHat(wx(36) - 0.1, wz(3.5) + 0.6, 0.82);
  garland(wx(34.5), CEIL - 0.6, wz(2), 4, 0.4);

  // --- BIRTHDAY 2 (39..41, 1..7)
  makeLocker(39, 2, "bday2");
  blockTiles([[41, 5]]);
  box(wx(41), 0.4, wz(5), TILE - 0.4, 0.8, TILE - 0.4, 0x8a4b6a);
  mirror(wx(41), 1.6, 1 * TILE + 0.16, 0); // mirror on north wall
  for (let i = 0; i < 3; i++) partyHat(wx(41) - 0.4 + i * 0.4, wz(5), 0.84);

  // --- BIRTHDAY ZERO (42..45, 1..7)
  blockTiles([[43, 3], [44, 3]]);
  const cakeT = box(wx(43.5), 0.45, wz(3), TILE * 2 - 0.6, 0.9, TILE - 0.2, 0xf0ead0);
  const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 14), lam(0xf7d9e3));
  cake.position.set(wx(43.5), 1.1, wz(3)); scene.add(cake);
  const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.1, 14), lam(0xe05575));
  icing.position.set(wx(43.5), 1.32, wz(3)); scene.add(icing);
  world.candles = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cnd = box(wx(43.5) + Math.cos(a) * 0.3, 1.45, wz(3) + Math.sin(a) * 0.3, 0.05, 0.22, 0.05, i % 2 ? 0xd8403a : 0x2a8fc4);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc966 }));
    flame.position.set(cnd.position.x, 1.62, cnd.position.z); flame.visible = false; scene.add(flame);
    world.candles.push(flame);
  }
  // presents
  for (const [ox, oz, c2] of [[wx(44.2), wz(5), 0xd8403a], [wx(44.6), wz(5.3), 0x2a8fc4], [wx(44.4), wz(4.7), 0xf0b03a]]) {
    box(ox, 0.25, oz, 0.5, 0.5, 0.5, c2); box(ox, 0.52, oz, 0.54, 0.04, 0.12, 0xf0ead0); box(ox, 0.52, oz, 0.12, 0.04, 0.54, 0xf0ead0);
  }
  poster("drawing", 42 * TILE + 0.16, 1.6, wz(5), Math.PI / 2, 1.0, 1.3);
  poster("drawing", 46 * TILE - 0.16, 1.6, wz(6), -Math.PI / 2, 1.0, 1.3);
  // TV on north wall
  const tvC = document.createElement("canvas"); tvC.width = 256; tvC.height = 160;
  const tvT = new THREE.CanvasTexture(tvC); tvT.colorSpace = THREE.SRGBColorSpace;
  box(wx(43.5), 1.6, 1 * TILE + 0.35 + TILE, 2.1, 1.4, 0.4, 0x16161c);
  world.tv = {
    canvas: tvC, tex: tvT, state: "off",
    set(state, text) {
      this.state = state;
      const g = tvC.getContext("2d");
      if (state === "off") { g.fillStyle = "#030303"; g.fillRect(0, 0, 256, 160); g.fillStyle = "#131313"; g.fillRect(20, 20, 216, 120); }
      if (state === "face") { drawClownFace(g, 256, 160, "mrhappy"); }
      if (state === "text") {
        g.fillStyle = "#000"; g.fillRect(0, 0, 256, 160);
        g.fillStyle = "#ffd23c"; g.font = "900 26px Courier"; g.textAlign = "center";
        (text || "").split("\n").forEach((l, i) => g.fillText(l, 128, 70 + i * 34));
      }
      tvT.needsUpdate = true;
    },
    staticFrame() {
      const g = tvC.getContext("2d"), id = g.createImageData(256, 160), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(id, 0, 0); tvT.needsUpdate = true;
    }
  };
  world.tv.set("off");
  const tvMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshBasicMaterial({ map: tvT }));
  tvMesh.position.set(wx(43.5), 1.6, 1 * TILE + 0.58 + TILE); scene.add(tvMesh);
  // six chairs facing TV — one turned around (wrong)
  for (let i = 0; i < 6; i++) {
    const ch = box(wx(42.6) + (i % 3) * 1.2 - 1, 0.3, wz(4.6) + Math.floor(i / 3) * 1.2, 0.5, 0.6, 0.5, i === 4 ? 0x6a1616 : 0x4a5a8a);
    if (i === 4) ch.rotation.y = Math.PI;
  }

  // --- CORRIDOR (2..33, 8..9)
  // breaker panel on north wall at (32,8)
  box(33 * TILE - 0.15 - TILE, 1.5, 8 * TILE + 0.18, 1.0, 1.4, 0.22, 0x4a5560);
  const bpGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshBasicMaterial({ color: 0x331111 }));
  bpGlow.position.set(33 * TILE - 0.15 - TILE, 1.9, 8 * TILE + 0.3); scene.add(bpGlow);
  world.bpGlow = bpGlow;
  // emergency strip lights ch1
  poster("closed", wx(20), 1.7, 8 * TILE + 0.16, 0, 0.9, 1.2);
  // missing ceiling panels (dark holes slightly above ceiling feel): dark boxes
  for (const [x, y] of [[14, 8], [22, 9], [30, 8]]) box(wx(x), CEIL - 0.02, wz(y), TILE - 0.4, 0.06, TILE - 0.4, 0x050507);
  // pipe run
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 30 * TILE, 8), lam(0x5a6270));
  pipe.rotation.z = Math.PI / 2; pipe.position.set(wx(17), CEIL - 0.35, 8 * TILE + 0.35); scene.add(pipe);
  // EXIT sign at emergency door (storage north side interior)
  const exitT = makeTex(128, 48, (g, w, h) => { g.fillStyle = "#200"; g.fillRect(0, 0, w, h); g.fillStyle = "#ff4444"; g.font = "900 30px Arial"; g.textAlign = "center"; g.shadowColor = "#f00"; g.shadowBlur = 12; g.fillText("EXIT", w / 2, 34); });
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: exitT, transparent: true, opacity: 0.25 }));
  exitSign.position.set(wx(12), 2.45, 1 * TILE + 0.2); scene.add(exitSign);
  world.exitSign = exitSign;

  // ============================ LIGHTS ============================
  const hemi = new THREE.HemisphereLight(0x4a5568, 0x0c0e12, 0.25); scene.add(hemi);
  const amb = new THREE.AmbientLight(0x1a1c22, 0.4); scene.add(amb);
  world.hemi = hemi; world.amb = amb;

  function rig(x, y, z, zone, kind, color, intensity, dist) {
    const l = new THREE.PointLight(color, 0, dist || 14, 1.6);
    l.position.set(x, y, z); scene.add(l);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    fixture.position.set(x, CEIL - 0.05, z); scene.add(fixture);
    const r = { light: l, zone, kind, base: intensity, baseColor: new THREE.Color(color), fixture, on: false };
    world.lightRigs.push(r); return r;
  }
  // warm room lights
  rig(wx(21), CEIL - 0.4, wz(31), "foyer", "warm", 0xffd9a0, 0.9);
  rig(wx(31), CEIL - 0.4, wz(31), "reception", "warm", 0xffd9a0, 0.8);
  rig(wx(12.5), CEIL - 0.4, wz(30.5), "toilets", "warm", 0xcfe8ff, 0.7);
  rig(wx(24), CEIL - 0.4, wz(18), "mainhall", "warm", 0xfff2cc, 1.2, 20);
  rig(wx(28), CEIL - 0.4, wz(23), "mainhall", "warm", 0xfff2cc, 0.9, 18);
  rig(wx(9), CEIL - 0.4, wz(20), "ballpit", "warm", 0xd9c6ff, 1.0, 16);
  rig(wx(39), CEIL - 0.4, wz(14), "arcade", "neon", 0xff77ff, 1.0, 16);
  rig(wx(43), CEIL - 0.4, wz(15), "arcade", "neon", 0x77ffff, 0.8, 14);
  rig(wx(39), CEIL - 0.4, wz(24), "prize", "warm", 0xffe0b0, 0.85, 14);
  rig(wx(8), CEIL - 0.4, wz(11), "food", "warm", 0xffd9a0, 0.9, 14);
  rig(wx(5), CEIL - 0.4, wz(4), "kitchen", "warm", 0xdfe8ff, 0.7, 12);
  rig(wx(13), CEIL - 0.4, wz(4), "storage", "warm", 0xd0d8c8, 0.6, 10);
  rig(wx(18), CEIL - 0.4, wz(4), "staff", "warm", 0xd0d8e0, 0.6, 10);
  rig(wx(24), CEIL - 0.4, wz(4), "security", "warm", 0xb8e8ff, 0.55, 10);
  rig(wx(30), CEIL - 0.4, wz(4), "maint", "maint", 0x9ab8c8, 0.55, 10);
  rig(wx(39), CEIL - 0.4, wz(9), "bdayhall", "warm", 0xffc6e0, 0.85, 14);
  rig(wx(36), CEIL - 0.4, wz(4), "bday1", "warm", 0xffd0c0, 0.8, 10);
  rig(wx(40), CEIL - 0.4, wz(4), "bday2", "warm", 0xc0ffd8, 0.7, 10);
  // emergency red strips (ch1): foyer + corridor + security glow
  rig(wx(19), CEIL - 0.6, wz(8.5), "corridor", "emred", 0xff2222, 0.5, 16);
  rig(wx(28), CEIL - 0.6, wz(8.5), "corridor", "emred", 0xff2222, 0.5, 16);
  rig(wx(21), CEIL - 0.6, wz(31), "foyer", "emred", 0xff2222, 0.35, 10);
  rig(wx(13), 2.2, wz(1.4), "storage", "exitred", 0xff3333, 0.4, 6);       // exit sign point
  // birthday zero candle light (off until final)
  const candleL = new THREE.PointLight(0xffb050, 0, 8, 1.4); candleL.position.set(wx(43.5), 2.2, wz(3)); scene.add(candleL);
  world.candleLight = candleL;
  // b0 overhead (broken, sputters)
  rig(wx(43.5), CEIL - 0.4, wz(4), "b0", "broken", 0xffe0c0, 0.5, 10);
  // party spotlights (spin during PARTY MODE)
  world.partySpots = [];
  for (const [i, cc] of [[0, 0xff3377], [1, 0x33ffcc], [2, 0xffcc33]]) {
    const sp = new THREE.PointLight(cc, 0, 18, 1.4);
    sp.position.set(wx(22 + i * 4) + 0.001, CEIL - 0.6, wz(18));
    scene.add(sp);
    world.partySpots.push({ light: sp, phase: i * 2.1, cx: wx(24), cz: wz(18), r: 7 + i * 2 });
  }

  world.setLighting = function (mode) {
    world.lightingMode = mode;
    for (const r of world.lightRigs) {
      const L = r.light; r.on = false;
      if (mode === "afterhours") {
        if (r.kind === "emred") { L.intensity = r.base; L.color.setHex(0xff2222); r.on = true; }
        else if (r.kind === "exitred") { L.intensity = r.base; r.on = true; }
        else { L.intensity = 0; }
        r.fixture.material.color.setHex(0x111111);
      } else if (mode === "party") {
        L.color.copy(r.baseColor); L.intensity = r.base; r.on = true;
        r.fixture.material.color.setHex(r.kind === "neon" ? r.baseColor.getHex() : 0xfff4d0);
        if (r.kind === "emred") { L.intensity = 0; r.on = false; }
      } else if (mode === "finale") {
        if (r.kind === "exitred") { L.intensity = 1.2; r.on = true; }
        else { L.color.setHex(0xff2a22); L.intensity = r.base * 0.5; r.on = true; }
        r.fixture.material.color.setHex(0x661111);
      } else if (mode === "offall") { L.intensity = 0; r.on = false; }
    }
    for (const sp of world.partySpots) sp.light.intensity = mode === "party" ? 0.8 : 0;
    if (mode === "afterhours") { hemi.intensity = 0.12; amb.intensity = 0.32; amb.color.setHex(0x141822); }
    if (mode === "party") { hemi.intensity = 0.4; amb.intensity = 0.6; amb.color.setHex(0x2a2436); }
    if (mode === "finale") { hemi.intensity = 0.1; amb.intensity = 0.28; amb.color.setHex(0x200a0a); }
    world.exitSign.material.opacity = mode === "finale" ? 1.0 : 0.25;
  };
  world.setLighting("afterhours");

  // ---------------- CCTV cameras ----------------
  function addCam(name, tx0, ty0, tileLookX, tileLookY, offX, offY) {
    const cam = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 80);
    cam.position.set(wx(tx0) + offX, CEIL - 0.45, wz(ty0) + offY);
    cam.lookAt(wx(tileLookX), 0.7, wz(tileLookY));
    world.cams.push({ name, cam });
    // little camera mesh
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), lam(0x2c3138));
    cm.position.copy(cam.position); cm.lookAt(wx(tileLookX), 0.7, wz(tileLookY)); scene.add(cm);
  }
  addCam("CAM 01 · ENTRANCE", 16, 28, 21, 31, 0.4, 0.4);
  addCam("CAM 02 · MAIN HALL", 33, 10, 24, 19, -0.4, 0.4);
  addCam("CAM 03 · BALL PIT", 2, 13, 9, 21, 0.4, 0.4);
  addCam("CAM 04 · ARCADE", 45, 19, 39, 13, -0.4, -0.4);
  addCam("CAM 05 · PARTY HALL", 34, 8, 41, 9, 0.4, 0.4);
  addCam("CAM 06 · CORRIDOR W", 2, 8, 20, 9, 0.4, 0.7);

  // ---------------- balloons ----------------
  const balloonTexCols = [0xd8403a, 0x2a8fc4, 0xf0b03a, 0x38b060, 0xa04ac0, 0xf0618c];
  world.spawnBalloon = function (tX, tY, opts = {}) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshLambertMaterial({ color: opts.color ?? balloonTexCols[(Math.random() * 6) | 0], emissive: 0x111111 }));
    b.scale.y = 1.18; g.add(b);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), b.material);
    knot.position.y = -0.26; knot.rotation.x = Math.PI; g.add(knot);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.1, 4), new THREE.MeshBasicMaterial({ color: 0x9a9a9a }));
    line.position.y = -0.85; g.add(line);
    const ball = {
      group: g, phase: Math.random() * 6.28, baseY: opts.y ?? 1.5,
      drift: 0, mesh: b, dead: false,
    };
    g.position.set(opts.x ?? wx(tX) + (Math.random() - 0.5), ball.baseY, opts.z ?? wz(tY) + (Math.random() - 0.5));
    scene.add(g);
    world.balloons.push(ball);
    return ball;
  };
  // a few ambience balloons pre-placed
  world.spawnBalloon(24, 17, { y: 2.6 }); world.spawnBalloon(9, 21, { y: 2.4 }); world.spawnBalloon(38, 14, { y: 2.7 });

  // ---------------- misc decorations ----------------
  function garland(px, py, pz, n, sag) {
    for (let i = 0; i < n; i++) {
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3),
        new THREE.MeshBasicMaterial({ color: [0xd8403a, 0x2a8fc4, 0xf0b03a, 0x38b060][i % 4] }));
      flag.position.set(px + i * (n > 4 ? 0.8 : 1.9), py - Math.sin((i / (n - 1)) * Math.PI) * (sag || 0.4), pz);
      flag.rotation.x = Math.PI; scene.add(flag);
    }
  }
  function partyHat(px, pz, py2) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 10), lam([0xd8403a, 0xa04ac0, 0x38b060][(Math.random() * 3) | 0]));
    h.position.set(px, (py2 || 0.2), pz); scene.add(h);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), lam(0xf0ead0));
    pom.position.set(px, (py2 || 0.2) + 0.2, pz); scene.add(pom);
  }
  function mirror(px, py, pz, ry) {
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), new THREE.MeshBasicMaterial({ color: 0x0e1116 }));
    frame.position.set(px, py, pz); frame.rotation.y = ry; scene.add(frame);
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.74), new THREE.MeshBasicMaterial({ color: 0x8a6d3f }));
    rim.position.set(px, py, pz - 0.01); rim.rotation.y = ry; scene.add(rim);
  }
  function makeLocker(x, y, zone) {
    addBlocked(x, y);
    const body = box(wx(x), 1.0, wz(y), TILE - 0.5, 2.0, TILE - 0.7, zone === "staff" ? 0x3a6a8a : 0x4a5560);
    box(wx(x), 1.6, wz(y) - (TILE - 0.7) / 2 - 0.005, 0.5, 0.18, 0.03, 0x222222); // vents
    box(wx(x), 1.3, wz(y) - (TILE - 0.7) / 2 - 0.005, 0.5, 0.18, 0.03, 0x222222);
    world.lockers.push({ x: wx(x), z: wz(y), zone, mesh: body });
  }
  function addStain(px, pz) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0x0a0c0a, transparent: true, opacity: 0.5 }));
    s.rotation.x = -Math.PI / 2; s.position.set(px, 0.015, pz); scene.add(s);
  }

  // ---------------- Mr. Happy (finale apparition) ----------------
  const mh = buildClownMesh("mrhappy", true);
  mh.scale.setScalar(1.6); mh.visible = false; scene.add(mh);
  world.mrHappyMesh = mh;

  // ---------------- per-frame world animation ----------------
  let tw = 0;
  world.update = function (dt, playerPos, bobbyInfluence) {
    tw += dt;
    // balloons bob + drift toward player when Bobby hunts nearby
    for (const b of world.balloons) {
      if (b.dead) continue;
      b.phase += dt * 1.4;
      b.group.position.y = b.baseY + Math.sin(b.phase) * 0.12;
      if (bobbyInfluence && playerPos) {
        const dx = playerPos.x - b.group.position.x, dz = playerPos.z - b.group.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.2 && d < 26) {
          b.drift = Math.min(1, b.drift + dt * 0.25);
          b.group.position.x += (dx / d) * b.drift * dt * 0.55;
          b.group.position.z += (dz / d) * b.drift * dt * 0.55;
          b.group.position.y = Math.max(0.9, b.group.position.y - dt * 0.03);
        }
      }
    }
    // party spotlights orbit
    if (world.lightingMode === "party") {
      for (const sp of world.partySpots) {
        sp.phase += dt * 0.7;
        sp.light.position.x = sp.cx + Math.cos(sp.phase) * sp.r;
        sp.light.position.z = sp.cz + Math.sin(sp.phase) * sp.r;
      }
    }
    // arcade self-on flicker
    for (const s of world.arcadeScreens) {
      if (s.on) {
        if (Math.random() < dt * (12 - (s.playable ? 2 : 0))) {
          s.mat.color.setHSL(Math.random(), 0.7, 0.5 + Math.random() * 0.3);
        }
      }
    }
    // finale light sputter
    if (world.flickerMode) {
      for (const r of world.lightRigs) {
        if (!r.on) continue;
        if (Math.random() < dt * 6) r.light.intensity = r.base * (0.2 + Math.random() * 0.8);
      }
    }
    // ride rocking
    if (world.ride.rocking > 0) {
      world.ride.rocking -= dt;
      world.ride.group.rotation.x = Math.sin(tw * 5) * 0.12 * Math.min(1, world.ride.rocking);
    }
    // candles flicker
    if (candleL.intensity > 0) {
      candleL.intensity = 0.9 + Math.sin(tw * 11) * 0.25 + Math.random() * 0.15;
      for (const f of world.candles) if (f.visible) f.scale.setScalar(0.85 + Math.random() * 0.4);
    }
    // static tvs
    for (const s of world.staticTVs) { s.t += dt; if (s.t > 0.12) { s.t = 0; world.staticRedraw(); } }
  };
  return world;
}
