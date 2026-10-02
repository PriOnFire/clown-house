// ============================================================
// ui.js — DOM/HUD layer: subtitles, objectives, chapter cards,
// CCTV overlay, lore modals, endings, jumpscare canvas, toasts.
// ============================================================
import { drawClownFace } from "./world.js";

const $ = id => document.getElementById(id);

export const UI = {
  els: {},
  subQueue: [], subBusy: false,
  cctvOpen: false,

  init() {
    [
      "menu", "menu-title", "menu-sub", "menu-clock", "menu-note", "menu-tagname",
      "hud", "obj-title", "obj-sub", "players-list", "battery", "battery-fill",
      "item-icon", "item-name", "tickets", "ticket-count", "prompt", "prompt-label",
      "hold-radial", "hold-fill", "subtitle", "sub-speaker", "sub-text",
      "chapter-card", "chap-num", "chap-title", "chap-sub",
      "obj-toast", "ot-main", "ot-sub", "stamina", "stamina-fill",
      "cctv", "cctv-grid", "cctv-clock", "lore-modal", "lore-title", "lore-body",
      "lore-list", "lore-entries", "lore-count",
      "downed", "downed-fill", "scare", "ending", "ending-kicker", "ending-tag",
      "ending-title", "ending-body", "ending-extra", "pause",
      "ach-toast", "ach-name", "ach-desc", "fx-danger", "fx-flash", "fx-dark", "fx-grain",
      "intro", "intro-text",
    ].forEach(id => this.els[id] = $(id));
    this.buildPlayers(["YOU"]);
  },

  // ---------- film grain ----------
  makeGrain() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), id = g.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random() * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const el = this.els["fx-grain"];
    el.style.backgroundImage = `url(${c.toDataURL()})`;
    setInterval(() => {
      el.style.backgroundPosition = `${(Math.random() * 128) | 0}px ${(Math.random() * 128) | 0}px`;
    }, 90);
  },

  // ---------- menu clock ----------
  startMenuClock() {
    let s = 43 * 60 + 43 * 1 + 17;
    setInterval(() => {
      s = (s + 1) % 720;
      const mm = String(43 + ((s / 60) | 0) - 43 + (((s / 60) | 0) > 59 ? 1 : 0)); // 11:43:xx PM drift
      const secs = String(s % 60).padStart(2, "0");
      const mins = String(43 + ((s / 60) | 0)).padStart(2, "0");
      this.els["menu-clock"].textContent = `11:${mins}:${secs} PM`;
    }, 1000);
  },
  menuTime() {
    const d = new Date(2018, 9, 31, 23, 43, 17 + Math.floor(performance.now() / 1000) % 43);
    return d.toTimeString().slice(0, 8);
  },

  // ---------- players panel ----------
  buildPlayers(names) {
    const el = this.els["players-list"];
    el.innerHTML = "";
    names.forEach((n, i) => {
      const row = document.createElement("div");
      row.className = "ply-row" + (i === 0 ? "" : " offline");
      row.innerHTML = `<span>${n}</span><span class="dot"></span>`;
      el.appendChild(row);
    });
  },
  setPlayerState(i, state) {
    const rows = this.els["players-list"].children;
    if (rows[i]) rows[i].className = "ply-row" + (state === "dead" ? " dead" : state === "offline" ? " offline" : "");
  },

  // ---------- objective ----------
  setObjective(title, sub, toast = true) {
    this.els["obj-title"].textContent = title;
    this.els["obj-sub"].textContent = sub || "";
    if (toast) {
      const t = this.els["obj-toast"];
      this.els["ot-main"].textContent = "NEW OBJECTIVE";
      this.els["ot-sub"].textContent = title;
      t.classList.remove("hidden");
      t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
      clearTimeout(this._objT);
      this._objT = setTimeout(() => t.classList.add("hidden"), 3400);
    }
  },

  chapterCard(num, title, sub) {
    const c = this.els["chapter-card"];
    this.els["chap-num"].textContent = num;
    this.els["chap-title"].textContent = title;
    this.els["chap-sub"].textContent = sub || "";
    c.classList.remove("hidden");
    c.style.animation = "none"; void c.offsetWidth; c.style.animation = "";
    clearTimeout(this._chT);
    this._chT = setTimeout(() => c.classList.add("hidden"), 4600);
  },

  // ---------- subtitles / PA ----------
  say(speaker, text, opts = {}) {
    this.subQueue.push({ speaker, text, dur: opts.dur || Math.max(2.2, text.length * 0.055), pa: !!opts.pa });
    if (!this.subBusy) this.nextSub();
  },
  nextSub() {
    const s = this.subQueue.shift();
    if (!s) { this.subBusy = false; this.els["subtitle"].classList.add("hidden"); return; }
    this.subBusy = true;
    const el = this.els["subtitle"];
    el.classList.remove("hidden");
    el.classList.toggle("pa", s.pa);
    this.els["sub-speaker"].textContent = s.speaker;
    const target = s.text;
    let i = 0;
    clearInterval(this._typeT);
    this._typeT = setInterval(() => {
      i += 2;
      this.els["sub-text"].textContent = target.slice(0, i);
      if (i >= target.length) clearInterval(this._typeT);
    }, 18);
    clearTimeout(this._subT);
    this._subT = setTimeout(() => this.nextSub(), s.dur * 1000);
  },
  clearSubs() { this.subQueue.length = 0; clearTimeout(this._subT); this.subBusy = false; this.els["subtitle"].classList.add("hidden"); },

  // ---------- HUD widgets ----------
  battery(v, low) {
    this.els["battery-fill"].style.width = `${Math.max(0, Math.min(100, v))}%`;
    this.els["battery"].classList.toggle("low", low);
  },
  stamina(v, show) {
    this.els["stamina-fill"].style.width = `${v}%`;
    this.els["stamina"].classList.toggle("show", show);
  },
  item(icon, name) { this.els["item-icon"].innerHTML = icon; this.els["item-name"].textContent = name; },
  tickets(n, show) {
    this.els["ticket-count"].textContent = n;
    this.els["tickets"].classList.toggle("hidden", !show);
  },
  prompt(key, label, hold = false) {
    const p = this.els["prompt"];
    if (!label) { p.classList.add("hidden"); return; }
    p.classList.remove("hidden");
    p.classList.toggle("hold", hold);
    p.firstElementChild.textContent = key;
    this.els["prompt-label"].textContent = label;
  },
  holdProgress(f) {
    const el = this.els["hold-fill"];
    this.els["hold-radial"].classList.toggle("hidden", f <= 0);
    const deg = Math.floor(f * 360);
    el.style.clipPath = `polygon(50% 50%, 50% 0%, ${cone(deg)})`;
    function cone(d) {
      const pts = [];
      for (const [x, y] of [[50, 0], [100, 0], [100, 100], [0, 100], [0, 0]]) {
        if (d <= 0) break;
        pts.push(`${x}% ${y}%`);
        d -= 90;
      }
      return ["50% 50%", "50% 0%", ...pts.slice(1)].join(",");
    }
  },
  danger(f) { this.els["fx-danger"].style.opacity = String(Math.min(1, f)); },
  flash(color = "#fff", dur = 90, op = 0.85) {
    const f = this.els["fx-flash"];
    f.style.background = color; f.style.transition = "none"; f.style.opacity = String(op);
    setTimeout(() => { f.style.transition = `opacity ${dur}ms`; f.style.opacity = "0"; }, 16);
  },
  fadeDark(on, ms = 800) {
    const d = this.els["fx-dark"];
    d.style.transition = `opacity ${ms}ms`;
    d.classList.toggle("clear", !on);
  },

  // ---------- achievements ----------
  achToast(name, desc) {
    this.els["ach-name"].textContent = name;
    this.els["ach-desc"].textContent = desc;
    const t = this.els["ach-toast"];
    t.classList.remove("hidden");
    t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    clearTimeout(this._achT);
    this._achT = setTimeout(() => t.classList.add("hidden"), 4500);
  },

  // ---------- lore ----------
  showLore(title, body) {
    this.els["lore-title"].textContent = title;
    this.els["lore-body"].textContent = body;
    this.els["lore-modal"].classList.remove("hidden");
  },
  hideLore() { this.els["lore-modal"].classList.add("hidden"); },
  loreOpen() { return !this.els["lore-modal"].classList.contains("hidden"); },
  showLoreList(entries, found) {
    this.els["lore-count"].textContent = found;
    const box = this.els["lore-entries"];
    box.innerHTML = "";
    entries.forEach(e => {
      const d = document.createElement("div");
      d.className = "le" + (e ? "" : " empty");
      d.innerHTML = e ? `<b>${e.title}</b><br>${e.hint}` : "<b>???</b><br>not recovered";
      box.appendChild(d);
    });
    this.els["lore-list"].classList.remove("hidden");
  },
  hideLoreList() { this.els["lore-list"].classList.add("hidden"); },
  loreListOpen() { return !this.els["lore-list"].classList.contains("hidden"); },

  // ---------- downed ----------
  downed(p) {
    this.els["downed"].classList.toggle("hidden", p === null);
    if (p !== null) this.els["downed-fill"].style.width = `${p * 100}%`;
  },

  // ---------- jumpscare ----------
  jumpscare(who, dur = 900) {
    const cv = this.els["scare"];
    cv.width = innerWidth; cv.height = innerHeight;
    const g = cv.getContext("2d");
    drawClownFace(g, cv.width, cv.height, who);
    // harsh frame
    g.strokeStyle = "#000"; g.lineWidth = 60; g.strokeRect(0, 0, cv.width, cv.height);
    g.fillStyle = "rgba(255,0,20,.12)"; g.fillRect(0, 0, cv.width, cv.height);
    cv.classList.remove("hidden");
    document.body.classList.add("jolt");
    clearTimeout(this._scareT);
    this._scareT = setTimeout(() => {
      cv.classList.add("hidden");
      document.body.classList.remove("jolt");
    }, dur);
  },

  // ---------- CCTV ----------
  openCCTV(cams) {
    this.cctvOpen = true;
    this.els["cctv"].classList.remove("hidden");
    const grid = this.els["cctv-grid"];
    grid.innerHTML = "";
    this.camCells = cams.map((c, i) => {
      const cell = document.createElement("div");
      cell.className = "cam-cell";
      const cv = document.createElement("canvas");
      cv.width = 320; cv.height = 180;
      cell.appendChild(cv);
      const lab = document.createElement("div"); lab.className = "cam-label"; lab.textContent = c.name;
      const tm = document.createElement("div"); tm.className = "cam-time"; tm.textContent = this.menuTime();
      cell.appendChild(lab); cell.appendChild(tm);
      grid.appendChild(cell);
      return { cell, cv, tm };
    });
  },
  closeCCTV() {
    this.cctvOpen = false;
    this.els["cctv"].classList.add("hidden");
  },
  setCamDead(i, dead) { if (this.camCells?.[i]) this.camCells[i].cell.classList.toggle("dead", dead); },

  // ---------- endings ----------
  showEnding(tag, title, body, extra, red) {
    this.els["ending"].classList.remove("hidden");
    this.els["ending"].classList.toggle("red", !!red);
    this.els["ending-tag"].textContent = tag;
    this.els["ending-title"].textContent = title;
    this.els["ending-body"].textContent = "";
    this.els["ending-extra"].textContent = "";
    let i = 0, j = 0;
    const t1 = setInterval(() => {
      i += 3;
      this.els["ending-body"].textContent = body.slice(0, i);
      if (i >= body.length) {
        clearInterval(t1);
        if (extra) {
          const t2 = setInterval(() => {
            j += 2;
            this.els["ending-extra"].textContent = extra.slice(0, j);
            if (j >= extra.length) clearInterval(t2);
          }, 30);
        }
      }
    }, 24);
  },
  hideEnding() { this.els["ending"].classList.add("hidden"); },
};
