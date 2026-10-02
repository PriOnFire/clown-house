import { walkable, findPath, roomIdAt, DOORS, wx, wz } from './js/grid.js';

// register blocked tiles exactly as world.js does
import { addBlocked } from './js/grid.js';
const blocks = [
  [27,29],[28,29],[29,29],[30,29],                       // reception desk
  [10,29],[10,30],[10,31],[15,33],                       // toilets counters + locker
  [20,15],[21,15],[20,16],[23,15],[23,16],[21,19],[22,19],[26,14],[27,14],[26,15],[29,17],[29,18],[26,20],[27,20],[28,20],[26,21],[27,21],[18,20],[19,20],[18,21], // climbing
  [32,13],[33,13],[32,14],[33,14],[32,15],[33,15],[32,16],[33,16], // slide
  [3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[8,1],            // kitchen
  [11,2],[12,2],[13,2],[14,2],[11,4],[12,4],[13,4],[14,4],[12,6],[13,6],[14,6],[10,6], // storage
  [16,2],[16,4],[18,2],[19,2],                          // staff
  [23,2],[24,2],                                        // security
  [31,2],[32,2],[33,2],[31,3],[32,3],[33,3],[31,4],[32,4],[33,4],[27,5],[27,6],[28,1],[33,6], // maint (racks, costumes, PK terminal tile, workbench)
  [36,21],[37,21],[38,21],[40,21],[41,21],[42,21],[43,21], // prize counter
  [9,10],[10,10],[11,10],[12,10],[13,10],[14,10],        // food counter
  [34,11],[34,12],[34,13],[34,14],[34,15],[34,16],[34,17],[34,18], // arcade west row
  [45,10],[45,11],[45,12],[45,13],[45,14],[45,15],[45,16],[45,17],[45,18],[45,19], // arcade east row
  [39,10],[40,10],[41,10],[42,10],[43,10],[44,10],       // arcade north row
  [36,3],[36,4],[41,5],[39,2],                           // bday1/2 tables + rack
  [43,3],[44,3],                                        // cake table
  [45,5],[44,5],                                        // presents? (visual only — NOT blocked in world, skip)
];
for (const [x,y] of blocks) {
  // skip the last two (presents not actually blocked)
  if ((x===45&&y===5)||(x===44&&y===5)) continue;
  addBlocked(x,y);
}

const spawn = [21,31];
const targets = {
  flashlight_adj: [28,30], fuseA_adj: [15,2], fuseB_adj: [5,3],
  breaker: [31,8], machine1:[35,13], machine2:[44,12], machine5:[41,11],
  prize: [42,24], btnA:[35,11], btnB:[2,25], btnC:[45,8],
  staffnote:[19,3], whiteboard:[3,4], pk:[28,2], cctv:[23,3],
  vhs1:[37,5], vhs2:[22,5], vhs3:[15,6], vhs4:[30,6],
  cake_adj:[43,4], exitdoor_adj:[12,1], arcade:[39,15], ballpit:[9,21],
  foyer:[21,31], mainhall:[24,18], corridor:[20,9], maint:[30,5], security:[24,4],
};
// which doors must be considered OPEN for each target (locked progression)
const openDoors = {
  whiteboard:['kitchen'], fuseB_adj:['kitchen'], fuseA_adj:['storage'], vhs3:['storage'],
  maint:['maint'], security:['security'], vhs2:['security'],
  flashlight_adj:['recfoyer'],
  exitdoor_adj:['storage','emergency'],
  staffnote:['staff'], cctv:['security'], pk:['maint'], vhs4:['maint'],
  cake_adj:['bdayhall','bday0'], vhs1:['bdayhall','bday1'],
};
let pass=0, fail=0;
for (const name in targets) {
  for (const d of DOORS) { d.open=false; }
  for (const id of (openDoors[name]||[])) { const d=DOORS.find(d=>d.id===id); if(d) d.open=true; }
  const t = targets[name];
  if (!walkable(t[0],t[1])) { console.log(`BLOCKED TARGET  ${name} @${t} room=${roomIdAt(t[0],t[1])}`); fail++; continue; }
  const p = findPath(spawn[0],spawn[1],t[0],t[1]);
  if (!p) { console.log(`NO PATH       ${name} @${t}`); fail++; }
  else { pass++; }
}
// patrol points walkable
const patrols = { bobby:[[24,18],[18,13],[28,22],[21,26],[9,21],[5,18],[12,25],[24,9],[20,30],[21,24]],
  tickets:[[36,12],[44,18],[39,15],[35,18],[39,25],[43,24],[36,23],[40,23]],
  mimic:[[24,16],[39,14],[18,9],[9,19]] };
for (const k in patrols) for (const pt of patrols[k]) {
  if (!walkable(pt[0],pt[1])) { console.log(`PATROL BLOCKED ${k} @${pt}`); fail++; }
}
// tickets patrol connectivity within its rooms
for (const d of DOORS) d.open=false;
const tp = findPath(36,12,39,25);
if (!tp) { console.log('TICKETS: arcade->prize NO PATH'); fail++; } else pass++;
result: {
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail?1:0);
}
