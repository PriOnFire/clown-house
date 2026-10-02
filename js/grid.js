// ============================================================
// grid.js — HappyLand floor plan: rooms, walls, doors,
// navigation (BFS), line-of-sight and collision queries.
// Units: tiles are 2m x 2m. World X = tileX*TILE, Z = tileY*TILE.
// ============================================================
export const TILE = 2;
export const GW = 46;   // grid width  (tiles x)
export const GH = 36;   // grid height (tiles y)

// ---------- room rects (x, y, w, h in tiles) ----------
export const ROOMS = [
  { id: 0,  name: "FOYER",        x: 16, y: 28, w: 10, h: 6,  floor: 0x8a8578, wall: 0xc4b48a, kind: "entry" },
  { id: 1,  name: "RECEPTION",    x: 26, y: 28, w: 10, h: 6,  floor: 0x7d786c, wall: 0xbe9f6f, kind: "entry" },
  { id: 2,  name: "TOILETS",      x: 10, y: 28, w: 6,  h: 6,  floor: 0x9fb4b8, wall: 0x7fa3ad, kind: "tile" },
  { id: 3,  name: "MAIN HALL",    x: 16, y: 10, w: 18, h: 18, floor: 0x54607e, wall: 0x3f6d8e, kind: "mat" },
  { id: 4,  name: "BALL PIT",     x: 2,  y: 13, w: 14, h: 15, floor: 0x6e5a8c, wall: 0x8e5aa0, kind: "mat" },
  { id: 5,  name: "ARCADE",       x: 34, y: 10, w: 12, h: 10, floor: 0x352d4e, wall: 0x4a3566, kind: "carpet" },
  { id: 6,  name: "PRIZE COUNTER",x: 34, y: 20, w: 12, h: 8,  floor: 0x5e5142, wall: 0x8a6d3f, kind: "carpet" },
  { id: 7,  name: "FOOD COURT",   x: 2,  y: 10, w: 14, h: 3,  floor: 0x8c6f52, wall: 0xb0793f, kind: "tile" },
  { id: 8,  name: "KITCHEN",      x: 2,  y: 1,  w: 8,  h: 7,  floor: 0x77807c, wall: 0x97a3a0, kind: "tile" },
  { id: 9,  name: "STORAGE",      x: 10, y: 1,  w: 6,  h: 7,  floor: 0x6b6f66, wall: 0x858b7e, kind: "concrete" },
  { id: 10, name: "STAFF ROOM",   x: 16, y: 1,  w: 5,  h: 7,  floor: 0x707a72, wall: 0x8b968d, kind: "concrete" },
  { id: 11, name: "SECURITY",     x: 21, y: 1,  w: 6,  h: 7,  floor: 0x5c6670, wall: 0x74808a, kind: "concrete" },
  { id: 12, name: "MAINTENANCE",  x: 27, y: 1,  w: 7,  h: 7,  floor: 0x565a5e, wall: 0x6f7478, kind: "concrete" },
  { id: 13, name: "CORRIDOR",     x: 2,  y: 8,  w: 32, h: 2,  floor: 0x6e6a5e, wall: 0xa39a78, kind: "concrete" },
  { id: 14, name: "PARTY HALL",   x: 34, y: 8,  w: 12, h: 2,  floor: 0x7d5f8e, wall: 0xb0536e, kind: "carpet" },
  { id: 15, name: "BIRTHDAY 1",   x: 34, y: 1,  w: 5,  h: 7,  floor: 0x9c5f5f, wall: 0xc26a55, kind: "carpet" },
  { id: 16, name: "BIRTHDAY 2",   x: 39, y: 1,  w: 3,  h: 7,  floor: 0x5f8c86, wall: 0x55a49c, kind: "carpet" },
  { id: 17, name: "BIRTHDAY ZERO",x: 42, y: 1,  w: 4,  h: 7,  floor: 0x8c8552, wall: 0xb39f3d, kind: "carpet" },
];
const roomById = {}; ROOMS.forEach(r => roomById[r.id] = r);
export { roomById };

// ---------- open edges (no wall; plain archways) ----------
// edge key: between (x,y) and neighbor; "x,y,N|E|S|W" = edge on that side of (x,y)
const OPEN = [];
function openEdge(x, y, dir) { OPEN.push(`${x},${y},${dir}`); }
function openRange(x0, y0, dir, n, stepX, stepY) {
  for (let i = 0; i < n; i++) openEdge(x0 + stepX * i, y0 + stepY * i, dir);
}
// foyer <-> main hall (wide)
openRange(20, 28, "N", 4, 1, 0);
// reception <-> main hall handled by door
// main hall <-> corridor arches
openRange(19, 10, "N", 4, 1, 0);
openRange(27, 10, "N", 4, 1, 0);
// main hall <-> ball pit
openRange(16, 15, "W", 4, 0, 1);
openRange(16, 24, "W", 2, 0, 1);
// main hall <-> arcade
openRange(34, 12, "W", 4, 0, 1);
// main hall <-> prize counter
openRange(34, 23, "W", 2, 0, 1);
// food court <-> corridor (wide)
openRange(3, 10, "N", 4, 1, 0);
// food court <-> ball pit (wide)
openRange(3, 13, "N", 4, 1, 0);
// food court <-> main hall
openEdge(16, 11, "W");
// bday hall <-> arcade (wide)
openRange(36, 10, "N", 3, 1, 0);
// arcade <-> prize counter
openRange(38, 20, "N", 2, 1, 0);

// ---------- doors (physical, lockable) ----------
// dir = wall sits on that side of tile (x,y)
export const DOORS = [
  { id: "entrance",  x: 20, y: 33, dir: "S", name: "MAIN ENTRANCE",  lockedBy: "story",   locked: true },
  { id: "recfoyer",  x: 26, y: 30, dir: "W", name: "RECEPTION",      locked: false },
  { id: "toilets",   x: 16, y: 30, dir: "W", name: "TOILETS",        locked: false },
  { id: "recmh",     x: 29, y: 28, dir: "N", name: "RECEPTION",      locked: false },
  { id: "kitchen",   x: 5,  y: 7,  dir: "S", name: "KITCHEN",        locked: false },
  { id: "storage",   x: 12, y: 7,  dir: "S", name: "STORAGE",        locked: false },
  { id: "staff",     x: 18, y: 7,  dir: "S", name: "STAFF ONLY",     locked: false },
  { id: "security",  x: 23, y: 7,  dir: "S", name: "SECURITY",       locked: false },
  { id: "maint",     x: 29, y: 7,  dir: "S", name: "MAINTENANCE",    lockedBy: "badge",   locked: true },
  { id: "emergency", x: 12, y: 1,  dir: "N", name: "EMERGENCY EXIT", lockedBy: "emergency", locked: true },
  { id: "bdayhall",  x: 33, y: 8,  dir: "E", name: "PARTY ROOMS",    locked: false },
  { id: "bday1",     x: 36, y: 7,  dir: "S", name: "PARTY ROOM 1",   locked: false },
  { id: "bday2",     x: 40, y: 7,  dir: "S", name: "PARTY ROOM 2",   locked: false },
  { id: "bday0",     x: 43, y: 7,  dir: "S", name: "PARTY ROOM 0",   lockedBy: "partykey", locked: true, yellow: true },
];
export const doorById = {}; DOORS.forEach(d => { d.open = false; doorById[d.id] = d; });

// ---------- derived structures ----------
export const roomAt = new Int16Array(GW * GH).fill(-1);
export const blocked = new Uint8Array(GW * GH);   // solid prop tiles
export const pitTile = new Uint8Array(GW * GH);   // ball pit (slow + noisy)
export const trampTile = new Uint8Array(GW * GH); // trampoline bounce

for (const r of ROOMS)
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++)
      roomAt[y * GW + x] = r.id;

const openSet = new Set(OPEN);
const doorSet = new Map();            // edgekey -> door
for (const d of DOORS) doorSet.set(`${d.x},${d.y},${d.dir}`, d);

const DX = { N: 0, S: 0, E: 1, W: -1 };
const DY = { N: -1, S: 1, E: 0, W: 0 };
const OPP = { N: "S", S: "N", E: "W", W: "E" };

export function inGrid(x, y) { return x >= 0 && y >= 0 && x < GW && y < GH; }

// is there a (currently impassable) wall on `dir` edge of tile (x,y) ?
// mode: "solid" = for rendering/collision; "ai" = for pathfinding
export function wallAt(x, y, dir, mode = "solid", openAll = false) {
  const nx = x + DX[dir], ny = y + DY[dir];
  const a = inGrid(x, y) ? roomAt[y * GW + x] : -1;
  const b = inGrid(nx, ny) ? roomAt[ny * GW + nx] : -1;
  if (a === b) return false;                       // same room: no wall
  const k = `${x},${y},${dir}`;
  if (openSet.has(k) || openSet.has(`${nx},${ny},${OPP[dir]}`)) return false;
  const d = doorSet.get(k) || doorSet.get(`${nx},${ny},${OPP[dir]}`);
  if (d) {
    if (openAll || d.open) return false;
    if (mode === "ai") return true;                // closed doors block AI too
    return true;                                   // closed door = solid
  }
  return true;
}
export function doorAtEdge(x, y, dir) {
  const nx = x + DX[dir], ny = y + DY[dir];
  return doorSet.get(`${x},${y},${dir}`) || doorSet.get(`${nx},${ny},${OPP[dir]}`) || null;
}

export function addBlocked(x, y) { if (inGrid(x, y)) blocked[y * GW + x] = 1; }
export function isBlocked(x, y) { return !inGrid(x, y) || blocked[y * GW + x] === 1; }
export function inRoomTile(x, y) { return inGrid(x, y) && roomAt[y * GW + x] >= 0; }
export function roomIdAt(x, y) { return inGrid(x, y) ? roomAt[y * GW + x] : -1; }

// world helpers
export const wx = tx => tx * TILE + TILE / 2;
export const wz = ty => ty * TILE + TILE / 2;
export const tx = wxv => Math.floor(wxv / TILE);
export const ty = wzv => Math.floor(wzv / TILE);

// walkable for AI
export function walkable(x, y) { return inRoomTile(x, y) && !isBlocked(x, y); }

// ---------- BFS pathfinding (4-dir, tile granularity) ----------
const prevMap = new Int32Array(GW * GH);
export function findPath(sx, sy, txx, tyy, openAll = false) {
  if (!walkable(sx, sy) || !walkable(txx, tyy)) return null;
  prevMap.fill(-1);
  const q = [sy * GW + sx]; prevMap[q[0]] = q[0];
  const target = tyy * GW + txx;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === target) break;
    const cx = cur % GW, cy = (cur / GW) | 0;
    for (const dir of ["N", "S", "E", "W"]) {
      const nx = cx + DX[dir], ny = cy + DY[dir];
      if (!walkable(nx, ny)) continue;
      if (wallAt(cx, cy, dir, "ai", openAll)) continue;
      const nk = ny * GW + nx;
      if (prevMap[nk] !== -1) continue;
      prevMap[nk] = cur;
      q.push(nk);
    }
  }
  if (prevMap[target] === -1) return null;
  const path = [];
  let cur = target;
  while (cur !== sy * GW + sx) { path.push([cur % GW, (cur / GW) | 0]); cur = prevMap[cur]; }
  path.reverse();
  return path;
}

// ---------- line of sight (grid DDA via dense sampling) ----------
export function losClear(x0, z0, x1, z1, openAll = false) {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(2, Math.ceil(dist / 0.25));
  let px = tx(x0), py = ty(z0);
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps;
    const z = z0 + (z1 - z0) * i / steps;
    const cx = tx(x), cy = ty(z);
    if (!inRoomTile(cx, cy) || isBlocked(cx, cy)) return false;
    if (cx !== px || cy !== py) {
      // crossed an edge — check wall
      if (cx === px + 1 && wallAt(px, py, "E", "ai", openAll)) return false;
      if (cx === px - 1 && wallAt(px, py, "W", "ai", openAll)) return false;
      if (cy === py + 1 && wallAt(px, py, "S", "ai", openAll)) return false;
      if (cy === py - 1 && wallAt(px, py, "N", "ai", openAll)) return false;
      if (cx !== px && cy !== py) {
        // diagonal: require at least one orthogonal path clear
        const o1 = !wallAt(px, py, cx > px ? "E" : "W", "ai", openAll) && !wallAt(cx, py, cy > py ? "S" : "N", "ai", openAll);
        const o2 = !wallAt(px, py, cy > py ? "S" : "N", "ai", openAll) && !wallAt(px, cy, cx > px ? "E" : "W", "ai", openAll);
        if (!o1 && !o2) return false;
      }
    }
    px = cx; py = cy;
  }
  return true;
}

// ---------- player collision ----------
// circle vs wall edges and blocked tiles around (px,pz); radius r
// returns corrected [x,z]
const COL_R = 0.34;
export function collide(px, pz, r = COL_R) {
  for (let pass = 0; pass < 2; pass++) {
    const cx = tx(px), cy = ty(pz);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        // blocked tile AABB
        if (isBlocked(gx, gy)) { [px, pz] = pushOut(px, pz, gx * TILE, gy * TILE, TILE, TILE, r); continue; }
        if (!inRoomTile(gx, gy)) { [px, pz] = pushOut(px, pz, gx * TILE, gy * TILE, TILE, TILE, r); continue; }
        // walls on each edge of this tile
        if (wallAt(gx, gy, "W")) [px, pz] = pushOutV(px, pz, gx * TILE, gy * TILE, TILE, r);
        if (wallAt(gx, gy, "E")) [px, pz] = pushOutV(px, pz, gx * TILE + TILE, gy * TILE, TILE, r);
        if (wallAt(gx, gy, "N")) [px, pz] = pushOutH(px, pz, gx * TILE, gy * TILE, TILE, r);
        if (wallAt(gx, gy, "S")) [px, pz] = pushOutH(px, pz, gx * TILE, gy * TILE + TILE, TILE, r);
      }
    }
  }
  return [px, pz];
}
function pushOut(px, pz, bx, bz, bw, bd, r) {
  const nx = Math.max(bx, Math.min(px, bx + bw));
  const nz = Math.max(bz, Math.min(pz, bz + bd));
  const dx = px - nx, dz = pz - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [px, pz];
  if (d2 < 1e-8) { // inside: push along smallest axis
    const left = px - bx, right = bx + bw - px, top = pz - bz, bot = bz + bd - pz;
    const m = Math.min(left, right, top, bot);
    if (m === left) px = bx - r; else if (m === right) px = bx + bw + r;
    else if (m === top) pz = bz - r; else pz = bz + bd + r;
    return [px, pz];
  }
  const d = Math.sqrt(d2), push = (r - d) / d;
  return [px + dx * push, pz + dz * push];
}
function pushOutV(px, pz, wallX, segZ, len, r) {
  if (pz < segZ - r || pz > segZ + len + r) return [px, pz];
  const d = px - wallX;
  if (Math.abs(d) >= r) return [px, pz];
  return [wallX + (d >= 0 ? r : -r), pz];
}
function pushOutH(px, pz, segX, wallZ, len, r) {
  if (px < segX - r || px > segX + len + r) return [px, pz];
  const d = pz - wallZ;
  if (Math.abs(d) >= r) return [px, pz];
  return [px, wallZ + (d >= 0 ? r : -r)];
}

// noise: entities listen via this simple event bus
export const noiseListeners = [];
export function emitNoise(x, z, radius, tag = "generic") {
  for (const fn of noiseListeners) fn(x, z, radius, tag);
}
