"use strict";
/* Aeon OS Berk — web demo. A little window manager + friendly fake apps. */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/* ================= the Berk hard drive =================
   The demo's "hard drive" lives in the visitor's own browser storage.
   Cookies are far too tiny to hold files, so the drive uses the
   browser's built-in storage box (localStorage) — same idea, bigger
   box. Everything stays on this machine; nothing is uploaded.
   Clearing the browser's site data wipes the drive. */
const Drive = {
  KEY: "berk-drive-v1",
  data: {},
  ok: true,
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.data = raw ? JSON.parse(raw) : {};
    } catch (e) { this.data = {}; this.ok = false; }
    if (!this.data || typeof this.data !== "object" || Array.isArray(this.data)) this.data = {};
    this.data.visits = (this.data.visits || 0) + 1;
    this.save();
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { this.ok = false; }
  },
  get(k, dflt) { return this.data[k] !== undefined ? this.data[k] : dflt; },
  set(k, v) { this.data[k] = v; this.save(); },
  bytes() {
    try { return (localStorage.getItem(this.KEY) || "").length; } catch (e) { return 0; }
  },
};
Drive.load();
let pendingWrite = null; // a file the Files app asked Write to open

/* ================= window manager ================= */
const windowsEl = $("#windows");
const taskEl = $("#taskbuttons");
const openWins = new Map();
let zTop = 10;
let cascade = 0;

function openApp(id) {
  const app = APPS[id];
  if (!app) return;
  if (openWins.has(id)) {
    const w = openWins.get(id);
    w.el.style.display = "flex";
    focusWin(id);
    return;
  }
  const win = document.createElement("div");
  win.className = "window";
  win.dataset.app = id;
  const small = window.innerWidth <= 760;
  const w = Math.min(app.w || 560, window.innerWidth - 8);
  const h = Math.min(app.h || 420, window.innerHeight - 60);
  win.style.width = w + "px";
  win.style.height = h + "px";
  const step = (cascade++ % 6) * 26;
  win.style.left = Math.max(4, 70 + step) + "px";
  win.style.top = Math.max(4, 26 + step) + "px";
  win.innerHTML =
    '<div class="titlebar">' +
      '<span class="ic" style="--c:' + app.color + '">' + app.glyph + "</span>" +
      '<span class="title-text">' + app.title + "</span>" +
      '<span class="winbtns">' +
        '<button class="winbtn min" title="Make small">–</button>' +
        '<button class="winbtn max" title="Make big">▢</button>' +
        '<button class="winbtn close" title="Close">✕</button>' +
      "</span>" +
    "</div>" +
    '<div class="winbody' + (app.beige ? " beige" : "") + '"></div>';
  windowsEl.appendChild(win);
  const body = $(".winbody", win);
  app.render(body, id);

  const rec = { el: win, body, maxed: false, prev: null };
  openWins.set(id, rec);

  const btn = document.createElement("button");
  btn.className = "taskbtn";
  btn.innerHTML = '<span class="ic" style="--c:' + app.color + '">' + app.glyph + "</span>" + app.title;
  btn.addEventListener("click", () => {
    if (win.style.display === "none") { win.style.display = "flex"; focusWin(id); }
    else if (win.classList.contains("active")) { win.style.display = "none"; markActive(); }
    else focusWin(id);
  });
  taskEl.appendChild(btn);
  rec.btn = btn;

  $(".close", win).addEventListener("click", () => closeWin(id));
  $(".min", win).addEventListener("click", () => { win.style.display = "none"; markActive(); });
  $(".max", win).addEventListener("click", () => toggleMax(id));
  win.addEventListener("pointerdown", () => focusWin(id));
  makeDraggable(win, $(".titlebar", win), id);
  if (small) toggleMax(id, true);
  focusWin(id);
}

function focusWin(id) {
  const rec = openWins.get(id);
  if (!rec) return;
  rec.el.style.zIndex = ++zTop;
  markActive(id);
}
function markActive(activeId) {
  openWins.forEach((rec, id) => {
    const isA = id === activeId && rec.el.style.display !== "none";
    rec.el.classList.toggle("active", isA);
    rec.el.classList.toggle("inactive", !isA);
    rec.btn.classList.toggle("active", isA);
  });
}
function closeWin(id) {
  const rec = openWins.get(id);
  if (!rec) return;
  rec.el.remove();
  rec.btn.remove();
  openWins.delete(id);
  markActive();
}
function toggleMax(id, force) {
  const rec = openWins.get(id);
  if (!rec) return;
  const win = rec.el;
  if (!rec.maxed || force === true) {
    if (!rec.maxed) {
      rec.prev = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
      win.style.left = "0px"; win.style.top = "0px";
      win.style.width = "100%"; win.style.height = "100%";
      rec.maxed = true;
    }
  } else {
    Object.assign(win.style, { left: rec.prev.l, top: rec.prev.t, width: rec.prev.w, height: rec.prev.h });
    rec.maxed = false;
  }
}
function makeDraggable(win, handle, id) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".winbtn")) return;
    const rec = openWins.get(id);
    if (rec && rec.maxed) return;
    const r = win.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const desk = $("#desktop").getBoundingClientRect();
    function move(ev) {
      let x = ev.clientX - desk.left - dx;
      let y = ev.clientY - desk.top - dy;
      x = Math.min(Math.max(x, -r.width + 90), desk.width - 70);
      y = Math.min(Math.max(y, 0), desk.height - 34);
      win.style.left = x + "px";
      win.style.top = y + "px";
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
}

/* ================= shell bits ================= */
function balloon(title, text, ms) {
  const b = $("#balloon");
  b.innerHTML = "<b>" + title + "</b>" + text;
  b.hidden = false;
  clearTimeout(b._t);
  b._t = setTimeout(() => { b.hidden = true; }, ms || 6000);
  b.onclick = () => { b.hidden = true; };
}

const startMenu = $("#startmenu");
const startBtn = $("#startbtn");
function toggleMenu(show) {
  const willShow = show !== undefined ? show : startMenu.hidden;
  startMenu.hidden = !willShow;
  startBtn.classList.toggle("open", willShow);
}
startBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
document.addEventListener("pointerdown", (e) => {
  if (!startMenu.hidden && !e.target.closest("#startmenu") && !e.target.closest("#startbtn")) toggleMenu(false);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMenu(false); });

$$("[data-app]").forEach((node) => {
  node.addEventListener("click", () => {
    if (node.classList.contains("dicon")) return; // icons have their own logic
    openApp(node.dataset.app);
    toggleMenu(false);
  });
});
$$(".dicon").forEach((icon) => {
  icon.addEventListener("click", () => {
    if (icon.classList.contains("selected")) { openApp(icon.dataset.app); icon.classList.remove("selected"); }
    else { $$(".dicon").forEach((d) => d.classList.remove("selected")); icon.classList.add("selected"); }
  });
  icon.addEventListener("dblclick", () => openApp(icon.dataset.app));
});
$("#desktop").addEventListener("pointerdown", (e) => {
  if (e.target === $("#desktop")) $$(".dicon").forEach((d) => d.classList.remove("selected"));
});

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const c = $("#clock");
  c.textContent = h + ":" + m + " " + ampm;
  c.title = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
tickClock();
setInterval(tickClock, 5000);

$("#shutdownbtn").addEventListener("click", () => { toggleMenu(false); $("#shutdown").hidden = false; });
$("#powerbtn").addEventListener("click", () => { $("#shutdown").hidden = true; balloon("Welcome back!", "You turned Berk back on. Everything is right where you left it."); });

const boot = $("#boot");
function endBoot() {
  if (boot.classList.contains("gone")) return;
  boot.classList.add("gone");
  setTimeout(() => {
    if (Drive.get("visits", 1) > 1) {
      balloon("Welcome back!", "Your Berk drive remembered everything — your saved writing, your apps, and your block world are right where you left them.");
    } else {
      balloon("Welcome to Aeon OS Berk!", "Tap <b>start</b> to see your apps, or double-tap a picture on the desktop. This demo has a little hard drive in your browser — what you save, stays saved.");
    }
  }, 500);
}
boot.addEventListener("click", endBoot);
setTimeout(endBoot, 1400);

/* ================= apps ================= */
const APPS = {

store: {
  title: "Aeon Store", glyph: "▣", color: "#ff783c", w: 640, h: 470,
  render(body) {
    const catalog = [
      { id: "music", name: "Music", blurb: "Listen to radio stations from all over.", color: "#ba55d3", glyph: "♪", state: "open" },
      { id: "pictures", name: "Picture Maker", blurb: "Make and look at pictures.", color: "#ffb428", glyph: "▦", state: "open" },
      { id: "dos", name: "D0S", blurb: "Type commands, like the old days.", color: "#141414", glyph: ">_", state: "open" },
      { id: "games", name: "AeonCraft", blurb: "Build a little world, block by block.", color: "#50c85a", glyph: "▶", state: "get" },
      { id: "tv", name: "TV", blurb: "Watch channels, live and simple.", color: "#e05252", glyph: "▤", state: "get" },
      { id: "updates", name: "Updates", blurb: "Keeps Berk safe and up to date, all by itself.", color: "#2b9bf6", glyph: "↻", state: "open" },
    ];
    body.innerHTML =
      '<div class="pad" style="padding-bottom:0"><div class="big">Aeon Store</div>' +
      '<div class="muted">The one and only app store on Berk. Every app is checked before it installs.</div></div>' +
      '<div class="store-grid"></div>';
    const grid = $(".store-grid", body);
    catalog.forEach((item) => {
      const card = document.createElement("div");
      card.className = "store-card";
      card.innerHTML =
        '<span class="ic" style="--c:' + item.color + '">' + item.glyph + "</span>" +
        '<div class="store-name">' + item.name + "</div>" +
        '<div class="store-blurb">' + item.blurb + "</div>" +
        '<div class="store-bar"><i></i></div>' +
        '<button class="btn primary"></button>';
      const btn = $("button", card);
      const bar = $(".store-bar", card);
      const fill = $("i", bar);
      let state = item.state;
      if (state === "get" && Drive.get("installed", []).includes(item.id)) state = "open";
      function paint() { btn.textContent = state === "open" ? "Open" : "Get"; }
      paint();
      btn.addEventListener("click", () => {
        if (state === "open") { openApp(item.id); return; }
        state = "busy"; btn.disabled = true; btn.textContent = "Getting…";
        bar.style.display = "block";
        let p = 0;
        const iv = setInterval(() => {
          p += 14 + Math.random() * 16;
          if (p >= 100) {
            p = 100; clearInterval(iv); state = "open"; btn.disabled = false; paint();
            const got = Drive.get("installed", []);
            if (!got.includes(item.id)) { got.push(item.id); Drive.set("installed", got); }
            balloon("All done!", "<b>" + item.name + "</b> is ready to use — and saved on your drive.");
          }
          fill.style.width = p + "%";
        }, 130);
      });
      grid.appendChild(card);
    });
  }
},

dos: {
  title: "D0S", glyph: ">_", color: "#141414", w: 600, h: 400,
  render(body) {
    body.innerHTML =
      '<div class="dos-screen">' +
        '<div class="dos-out"></div>' +
        '<div class="dos-line"><span class="dos-prompt">C:\\BERK&gt;</span>' +
        '<input class="dos-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="D0S command line"></div>' +
        '<div class="dos-hint">Type HELP and press Enter.</div>' +
      "</div>";
    const out = $(".dos-out", body);
    const input = $(".dos-input", body);
    const screen = $(".dos-screen", body);
    function print(t) {
      const d = document.createElement("div");
      d.textContent = t;
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
    }
    print("Aeon OS Berk D0S — version 1.0.1");
    print("A friendly DOS-style terminal. Type HELP and press Enter.");
    print("");
    function run(raw) {
      const cmd = raw.trim();
      print("C:\\BERK>" + cmd);
      if (!cmd) return;
      const parts = cmd.split(/\s+/);
      const c = parts[0].toLowerCase();
      if (c === "help") {
        print("Commands you can use:");
        print("  DIR     Show what is in this folder");
        print("  CLS     Clear the screen");
        print("  VER     Show the D0S version");
        print("  TIME    Show the time");
        print("  DATE    Show the date");
        print("  ECHO    Say something back (ECHO hello)");
        print("  ABOUT   What is Berk?");
        print("  EXIT    Close D0S");
      } else if (c === "dir") {
        print(" Directory of C:\\BERK");
        print("  MUSIC      <DIR>     Radio stations");
        print("  PICTURES   <DIR>     Your pictures");
        print("  GAMES      <DIR>     Fun stuff");
        print("  WELCOME    TXT       Say hello");
        print("        4 file(s)      Lots of free space");
      } else if (c === "cls") { out.innerHTML = ""; }
      else if (c === "ver") { print("Aeon OS Berk D0S, version 1.0.1"); }
      else if (c === "time") { print("The time is " + new Date().toLocaleTimeString()); }
      else if (c === "date") { print("The date is " + new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })); }
      else if (c === "echo") { print(parts.slice(1).join(" ")); }
      else if (c === "about") { print("Berk is a simple, safe computer system. Big buttons, plain words, no funny business."); }
      else if (c === "exit") { closeWin("dos"); }
      else { print("Bad command or file name. Type HELP to see what works."); }
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { run(input.value); input.value = ""; }
    });
    screen.addEventListener("click", () => input.focus());
    setTimeout(() => input.focus(), 60);
  }
},

music: {
  title: "Music", glyph: "♪", color: "#ba55d3", w: 520, h: 440,
  render(body) {
    const stations = [
      { name: "Berk FM", genre: "Island favorites, all day" },
      { name: "Dragon Radio", genre: "Big songs for big wings" },
      { name: "Quiet Cove", genre: "Soft music to rest to" },
      { name: "Rockcrusher Rock", genre: "Loud guitars, happy ears" },
      { name: "Story Time Radio", genre: "Tales and adventures" },
      { name: "Night Sky Jazz", genre: "Smooth sounds after dark" },
    ];
    let playing = null;
    body.innerHTML = '<div class="nowbar"><span class="eq"><i></i><i></i><i></i><i></i></span><span class="nowtext"></span></div><div class="stationlist"></div>';
    const list = $(".stationlist", body);
    const bar = $(".nowbar", body);
    stations.forEach((s) => {
      const row = document.createElement("div");
      row.className = "station";
      row.innerHTML =
        '<span class="ic" style="--c:#ba55d3">♪</span>' +
        '<div class="grow"><div class="station-name">' + s.name + '</div><div class="muted">' + s.genre + "</div></div>" +
        '<button class="playbtn">▶</button>';
      const b = $(".playbtn", row);
      b.addEventListener("click", () => {
        if (playing === s) {
          playing = null; bar.classList.remove("on"); b.textContent = "▶";
        } else {
          playing = s;
          $$(".playbtn", list).forEach((x) => { x.textContent = "▶"; });
          b.textContent = "❚❚";
          $(".nowtext", bar).textContent = "Now playing: " + s.name + " — " + s.genre;
          bar.classList.add("on");
        }
      });
      list.appendChild(row);
    });
    const note = document.createElement("div");
    note.className = "pad muted";
    note.textContent = "Demo player — on the real Berk, Music plays live radio from the internet.";
    body.appendChild(note);
  }
},

pictures: {
  title: "Pictures", glyph: "▦", color: "#ffb428", w: 560, h: 430,
  render(body) {
    const photos = [
      { name: "The Green Hill", bg: 'url("assets/berk-bliss.jpg") center / cover' },
      { name: "Sunset", bg: "linear-gradient(200deg,#ff9a56,#c93a12 55%,#5b2a86)" },
      { name: "Ocean", bg: "linear-gradient(180deg,#7ec8f7,#1c6fb8 60%,#0d4d8a)" },
      { name: "Forest", bg: "linear-gradient(160deg,#9ccc65,#33691e 70%)" },
      { name: "Mountains", bg: "linear-gradient(180deg,#cfd8dc,#607d8b 65%,#37474f)" },
      { name: "Night Sky", bg: "linear-gradient(200deg,#1a237e,#000 75%)" },
    ];
    function grid() {
      body.innerHTML = '<div class="pic-grid"></div>';
      const g = $(".pic-grid", body);
      photos.forEach((p) => {
        const d = document.createElement("div");
        d.className = "pic";
        d.style.background = p.bg;
        d.title = p.name;
        d.addEventListener("click", () => view(p));
        g.appendChild(d);
      });
      const cap = document.createElement("div");
      cap.className = "pad muted";
      cap.textContent = "Tap a picture to see it big.";
      body.appendChild(cap);
    }
    function view(p) {
      body.innerHTML =
        '<div class="pic-view"><div class="bigpic"></div>' +
        '<div class="big" style="margin:12px 0">' + p.name + "</div>" +
        '<button class="btn">← Back to all pictures</button></div>';
      $(".bigpic", body).style.background = p.bg;
      $("button", body).addEventListener("click", grid);
    }
    grid();
  }
},

files: {
  title: "Files", glyph: "▤", color: "#f2b90d", w: 560, h: 420,
  render(body) {
    const tree = {
      Home: [
        { n: "Documents", folder: true }, { n: "Pictures", folder: true },
        { n: "Music", folder: true }, { n: "Welcome.txt", folder: false },
      ],
      Documents: [
        { n: "My Story.txt", folder: false }, { n: "Shopping List.txt", folder: false },
        { n: "Letter to Grandma.txt", folder: false },
      ],
      Pictures: [
        { n: "The Green Hill.jpg", folder: false }, { n: "Sunset.jpg", folder: false },
        { n: "My Dragon.png", folder: false },
      ],
      Music: [
        { n: "Favorite Songs", folder: false }, { n: "Dance Party", folder: false },
      ],
    };
    let here = "Home";
    body.innerHTML =
      '<div class="files-wrap"><div class="files-side"></div>' +
      '<div class="files-main"><div class="crumbs"></div><div class="flist"></div></div></div>';
    const side = $(".files-side", body);
    const list = $(".flist", body);
    const crumbs = $(".crumbs", body);
    ["Home", "Documents", "Pictures", "Music"].forEach((place) => {
      const b = document.createElement("button");
      b.textContent = place;
      b.addEventListener("click", () => { here = place; draw(); });
      b.dataset.place = place;
      side.appendChild(b);
    });
    function draw() {
      $$("button", side).forEach((b) => b.classList.toggle("here", b.dataset.place === here));
      crumbs.textContent = "You are here: " + here;
      list.innerHTML = "";
      const saved = Drive.get("userFiles", {});
      const mine = Object.keys(saved)
        .filter((k) => k.startsWith(here + "/"))
        .map((k) => ({ n: k.slice(here.length + 1), folder: false, user: true }));
      (tree[here] || []).concat(mine).forEach((f) => {
        const row = document.createElement("button");
        row.className = "frow";
        row.innerHTML = '<span class="ic" style="--c:' + (f.folder ? "#f2b90d" : f.user ? "#5c6bc0" : "#90a4ae") + '">' + (f.folder ? "▤" : "▢") + "</span>" +
          '<span style="flex:1">' + f.n + "</span>" + (f.user ? '<span class="fdel" title="Delete this file">✕</span>' : "");
        row.addEventListener("click", (e) => {
          if (e.target.classList.contains("fdel")) {
            const all = Drive.get("userFiles", {});
            delete all[here + "/" + f.n];
            Drive.set("userFiles", all);
            balloon("Deleted", "<b>" + f.n + "</b> is gone from your drive.");
            draw();
            return;
          }
          if (f.folder) { here = f.n; draw(); }
          else if (f.user) {
            pendingWrite = { name: f.n, folder: here, content: Drive.get("userFiles", {})[here + "/" + f.n] || "" };
            if (openWins.has("write")) closeWin("write");
            openApp("write");
          }
          else balloon(f.n, "On the real Berk, this opens in the right app. In the demo, just imagine it's wonderful.");
        });
        list.appendChild(row);
      });
    }
    draw();
  }
},

games: {
  title: "Games", glyph: "▶", color: "#50c85a", w: 600, h: 520,
  render(body) {
    body.innerHTML =
      '<div class="game-card"><div class="big">AeonCraft — tiny demo</div>' +
      '<div class="muted">Pick a block, then tap the sky to build. On real Berk, AeonCraft is a whole world.</div>' +
      '<div style="height:10px"></div><canvas id="craft" width="448" height="288"></canvas>' +
      '<div class="palette"></div>' +
      '<div style="margin-top:10px"><button class="btn" id="clearcraft">Clear</button></div></div>' +
      '<div class="game-card"><div class="big">Minecraft</div>' +
      '<div class="muted">The Enigma Launcher on Berk opens Minecraft with modpacks — even in a browser, with the Berk Engine.</div></div>';
    const cv = $("#craft", body);
    const ctx = cv.getContext("2d");
    const CELL = 16, COLS = 28, ROWS = 18;
    const blocks = new Map();
    (Drive.get("craft", []) || []).forEach(([k, c]) => blocks.set(k, c));
    function saveCraft() { Drive.set("craft", Array.from(blocks.entries())); }
    const colors = [
      ["Grass", "#58a83c"], ["Dirt", "#8a5a2b"], ["Stone", "#8d8d8d"], ["Wood", "#b5651d"],
      ["Leaves", "#3f7d2c"], ["Sand", "#e0cf9e"], ["Water", "#3f76e4"], ["Brick", "#a94438"],
    ];
    let current = colors[0][1];
    const pal = $(".palette", body);
    colors.forEach(([name, c], i) => {
      const s = document.createElement("button");
      s.className = "swatch" + (i === 0 ? " sel" : "");
      s.style.background = c;
      s.title = name;
      s.addEventListener("click", () => {
        current = c;
        $$(".swatch", pal).forEach((x) => x.classList.remove("sel"));
        s.classList.add("sel");
      });
      pal.appendChild(s);
    });
    function ground() {
      for (let x = 0; x < COLS; x++) {
        blocks.set(x + "," + (ROWS - 1), "#58a83c");
        blocks.set(x + "," + (ROWS - 2), "#8a5a2b");
      }
    }
    function draw() {
      ctx.fillStyle = "#87ceeb";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#fff8";
      ctx.fillRect(30, 26, 70, 16); ctx.fillRect(300, 44, 84, 18);
      blocks.forEach((c, k) => {
        const [x, y] = k.split(",").map(Number);
        ctx.fillStyle = c;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        ctx.strokeStyle = "rgba(0,0,0,.18)";
        ctx.strokeRect(x * CELL + .5, y * CELL + .5, CELL - 1, CELL - 1);
      });
    }
    let painting = false;
    function paint(e) {
      const r = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * COLS);
      const y = Math.floor((e.clientY - r.top) / r.height * ROWS);
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      blocks.set(x + "," + y, current);
      saveCraft();
      draw();
    }
    cv.addEventListener("pointerdown", (e) => { painting = true; paint(e); });
    cv.addEventListener("pointermove", (e) => { if (painting) paint(e); });
    document.addEventListener("pointerup", () => { painting = false; });
    $("#clearcraft", body).addEventListener("click", () => { blocks.clear(); ground(); saveCraft(); draw(); });
    if (blocks.size === 0) ground();
    draw();
  }
},

tv: {
  title: "TV", glyph: "▤", color: "#e05252", w: 540, h: 450,
  render(body) {
    const chans = [
      { n: "1", name: "Berk News", show: "The Morning Catch-Up" },
      { n: "2", name: "Dragon TV", show: "How to Train Your Human" },
      { n: "3", name: "Movie Cove", show: "The Big Picture Show" },
      { n: "4", name: "Toon Lagoon", show: "Saturday Cartoons (every day)" },
      { n: "5", name: "Cooking Cove", show: "Fish Three Ways" },
      { n: "6", name: "Sports Sky", show: "Dragon Racing Live" },
    ];
    body.innerHTML = '<div class="tv-screen"></div><div class="chanlist"></div>';
    const screen = $(".tv-screen", body);
    const list = $(".chanlist", body);
    chans.forEach((c) => {
      const row = document.createElement("div");
      row.className = "chan";
      row.innerHTML = '<span class="chan-num">' + c.n + '</span><div><div class="station-name">' + c.name + '</div><div class="muted">' + c.show + "</div></div>";
      row.addEventListener("click", () => {
        screen.innerHTML = "📺 <b>" + c.name + "</b><br>Now showing: " + c.show + '<br><span class="muted" style="color:#8fa3d9">Demo screen — real Berk streams live TV.</span>';
        screen.classList.add("on");
      });
      list.appendChild(row);
    });
  }
},

internet: {
  title: "Internet", glyph: "W", color: "#2b9bf6", w: 580, h: 430,
  render(body) {
    body.innerHTML =
      '<div class="web-bar"><button class="btn">←</button><button class="btn">→</button>' +
      '<input class="web-addr" value="berk://home" readonly></div>' +
      '<div class="web-page"><h2>Welcome to the Internet</h2>' +
      "<p>This is a friendly demo browser. On the real Berk, this window<br>opens the whole web — with the scary stuff blocked for you.</p>" +
      '<p style="margin-top:16px"><button class="btn primary" id="webgo">Visit the Aeon OS page</button></p></div>';
    $("#webgo", body).addEventListener("click", () => {
      window.open("https://archive.org/details/aeon-os-berk-1.0.1", "_blank", "noopener");
    });
  }
},

write: {
  title: "Write", glyph: "✎", color: "#5c6bc0", w: 540, h: 420,
  render(body) {
    const file = pendingWrite || {
      name: "My Letter.txt", folder: "Documents",
      content: Drive.get("userFiles", {})["Documents/My Letter.txt"] ||
        "Dear friend,\n\nToday I tried Aeon OS Berk in my browser. It was easy!\n\n",
    };
    pendingWrite = null;
    body.innerHTML =
      '<div class="web-bar"><b style="align-self:center">' + file.name.replace(/\.txt$/i, "") + '</b><span style="flex:1"></span><button class="btn" id="savewrite">Save to My Drive</button></div>' +
      '<textarea class="write-area" placeholder="Start writing here…"></textarea>' +
      '<div class="pad tiny" style="padding-top:8px">Saved writing lives on your Berk drive, in <b>Files → ' + file.folder + '</b> — close this page, come back later, and it is still here.</div>';
    const ta = $(".write-area", body);
    ta.value = file.content;
    $("#savewrite", body).addEventListener("click", () => {
      const all = Drive.get("userFiles", {});
      all[file.folder + "/" + file.name] = ta.value;
      Drive.set("userFiles", all);
      balloon("Saved to your drive!", "<b>" + file.name + "</b> is on your Berk drive now. It will still be here next visit.");
    });
  }
},

updates: {
  title: "Updates", glyph: "↻", color: "#2b9bf6", w: 520, h: 400, beige: true,
  render(body) {
    body.innerHTML =
      '<div class="pad"><div class="big">Keep Berk up to date</div>' +
      '<p class="muted" style="margin:6px 0 14px">Updates keep your computer safe. Berk checks all by itself — but you can check right now, too.</p>' +
      '<button class="btn primary" id="checkbtn" style="font-size:16px;padding:12px 26px">Check for updates</button>' +
      '<div id="updaterslt" style="margin-top:16px;font-size:15px"></div></div>';
    const btn = $("#checkbtn", body);
    const out = $("#updaterslt", body);
    btn.addEventListener("click", () => {
      btn.disabled = true;
      out.textContent = "Checking…";
      let dots = 0;
      const iv = setInterval(() => { out.textContent = "Checking" + ".".repeat(1 + (dots++ % 3)); }, 240);
      setTimeout(() => {
        clearInterval(iv);
        btn.disabled = false;
        out.innerHTML = "<b style='color:#2e7a2c'>You're up to date!</b><br>Aeon OS Berk <b>1.0.1</b> — the newest version.<br><br>What's in it:<br>• The Windows XP-style desktop<br>• The Aeon Store<br>• D0S, the friendly terminal<br>• A fix so every app opens properly";
      }, 1500);
    });
  }
},

about: {
  title: "This PC", glyph: "B", color: "#2b9bf6", w: 540, h: 430, beige: true,
  render(body) {
    body.innerHTML =
      '<div class="pad"><div class="about-head"><div class="about-logo">B</div>' +
      '<div><div class="big" style="font-size:23px">Aeon OS Berk</div><div class="muted">Version 1.0.1 — the simple, safe computer</div></div></div>' +
      '<div class="spec">' +
      "<b>Based on:</b> Linux Mint 22.3<br>" +
      "<b>Desktop:</b> Windows XP style — big buttons, plain words<br>" +
      "<b>App store:</b> the Aeon Store, and only the Aeon Store<br>" +
      "<b>Terminal:</b> D0S, friendly since forever<br>" +
      "<b>Safety:</b> firewall on, updates automatic, downloads checked<br>" +
      "<b>Hard drive:</b> " + (Drive.ok
        ? Math.max(1, Math.round(Drive.bytes() / 102.4)) / 10 + " KB used of 5,000 KB — it lives in this web browser, on this machine only. Nothing is uploaded anywhere. (Cookies were too tiny, so Berk keeps its drive in the browser's bigger storage box.)"
        : "Off — this browser would not let Berk keep a drive here (a private window, maybe?). Everything still works; it just won't remember.") + "<br>" +
      "</div>" +
      '<p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<a class="btn primary" href="https://archive.org/details/aeon-os-berk-1.0.1" target="_blank" rel="noopener">Download the real Berk (free)</a>' +
      '<a class="btn" href="https://github.com/aeon01100101/project-berk" target="_blank" rel="noopener">See how it\'s made</a></p>' +
      '<p class="muted" style="margin-top:14px">You are using the web demo — a toy copy that runs in your browser. The real Berk is a full system you put on a computer.</p></div>';
  }
},
};
