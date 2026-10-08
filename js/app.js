import { openPlayer, setupPlayer } from "./games/player.js";
// Safe localStorage: never throws (blocked storage, private mode, corrupt data)
const ls = {
  get(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } },
  set(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }
};
function readList(key){
  try{
    const v = JSON.parse(ls.get(key) || "[]");
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}

const state = {
  page: "home",
  games: [],
  source: "All",
  favorites: readList("noobonly1-favorites"),
  recent: readList("noobonly1-recent")
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function saveState(){
  ls.set("noobonly1-favorites", JSON.stringify(state.favorites));
  ls.set("noobonly1-recent", JSON.stringify(state.recent));
}

function showPage(page){
  state.page = page;
  $$(".page").forEach(el => el.classList.toggle("active", el.id === page));
  $$(".desktop-nav button").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $("#mobileMenu")?.classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}

function addRecent(game){
  state.recent = [game.id, ...state.recent.filter(id => id !== game.id)].slice(0,10);
  saveState();
  renderRecent();
}

function openGame(game){
  addRecent(game);
  if(game.embed === true && game.embedUrl){ openPlayer(game); return; }
  window.open(game.url, "_blank", "noopener,noreferrer");
}

function isFavorite(id){ return state.favorites.includes(id); }

function toggleFavorite(id){
  state.favorites = isFavorite(id)
    ? state.favorites.filter(x => x !== id)
    : [...state.favorites, id];
  saveState();
  renderGames();
  renderFeatured();
  renderRecent();
}

function makeCard(game){
  const card = document.createElement("article");
  card.className = "game-card";

  const fav = document.createElement("button");
  fav.className = "favorite-btn";
  fav.type = "button";
  fav.textContent = isFavorite(game.id) ? "★" : "☆";
  fav.title = "Favorite";
  fav.addEventListener("click", e => { e.stopPropagation(); toggleFavorite(game.id); });

  const icon = document.createElement("div");
  icon.className = "game-icon";
  icon.textContent = game.icon || "🎮";

  const title = document.createElement("h3");
  title.textContent = game.name;

  const source = document.createElement("div");
  source.className = "game-source";
  source.textContent = `Source: ${game.source}`;
  const badge = document.createElement("span");
  const inSite = game.embed === true && !!game.embedUrl;
  badge.className = "game-badge" + (inSite ? "" : " ext");
  badge.textContent = inSite ? "Plays here" : "External";
  source.append(badge);

  const category = document.createElement("p");
  category.textContent = game.category;

  const play = document.createElement("button");
  play.className = "play-btn";
  play.type = "button";
  play.textContent = "PLAY";
  play.addEventListener("click", () => openGame(game));

  card.append(fav, icon, title, source, category, play);
  return card;
}

function filteredGames(){
  const q = ($("#gameSearch")?.value || "").trim().toLowerCase();
  const cat = $("#categoryFilter")?.value || "All";
  return state.games.filter(g => {
    const text = `${g.name} ${g.category} ${g.source}`.toLowerCase();
    return (!q || text.includes(q))
      && (cat === "All" || g.category === cat)
      && (state.source === "All" || g.source === state.source)
      && (!$("#favoritesOnly")?.dataset.active || isFavorite(g.id));
  });
}

function renderGames(){
  const grid = $("#gameGrid");
  if(!grid) return;
  grid.replaceChildren();
  const list = filteredGames();
  if(!list.length){
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No games match your filters.";
    grid.append(p);
    return;
  }
  list.forEach(g => grid.append(makeCard(g)));
}

function renderFeatured(){
  const grid = $("#featuredGrid");
  if(!grid) return;
  grid.replaceChildren();
  state.games.filter(g => g.featured).slice(0,8).forEach(g => grid.append(makeCard(g)));
}

function renderRecent(){
  const grid = $("#recentGrid");
  if(!grid) return;
  grid.replaceChildren();
  const list = state.recent.map(id => state.games.find(g => g.id === id)).filter(Boolean);
  if(!list.length){
    grid.innerHTML = '<p class="empty-state">Play a game and it will appear here.</p>';
    return;
  }
  list.slice(0,8).forEach(g => grid.append(makeCard(g)));
}

function setupFilters(){
  const select = $("#categoryFilter");
  const cats = [...new Set(state.games.map(g => g.category))].sort();
  select.replaceChildren(new Option("All categories","All"));
  cats.forEach(c => select.append(new Option(c,c)));

  const sources = [...new Set(state.games.map(g => g.source))].sort();
  const bar = $("#sourceBar");
  bar.replaceChildren();
  ["All",...sources].forEach(src => {
    const b = document.createElement("button");
    b.className = "chip" + (src === "All" ? " active" : "");
    b.textContent = src;
    b.addEventListener("click", () => {
      state.source = src;
      $$(".chip").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderGames();
    });
    bar.append(b);
  });
}

async function loadGames(){
  const ctrl = new AbortController();
  const killer = setTimeout(() => ctrl.abort(), 10000);
  let response;
  try{
    response = await fetch("data/games.json", {cache:"no-store", signal: ctrl.signal});
  }catch(e){
    throw new Error(e.name === "AbortError" ? "games.json timed out after 10s" : `games.json fetch failed: ${e.message}`);
  }finally{
    clearTimeout(killer);
  }
  if(!response.ok) throw new Error(`games.json HTTP ${response.status}`);
  const data = await response.json();
  if(!Array.isArray(data) || data.length === 0) throw new Error("games.json has no games");
  for(const game of data){
    if(!game.id || !game.name || !game.category || !game.url) throw new Error(`Invalid game entry: ${game.name || "unknown"}`);
  }
  state.games = data;
  setupFilters();
  renderGames();
  renderFeatured();
  renderRecent();
  $("#gameCount").textContent = data.length;
  $("#categoryCount").textContent = new Set(data.map(g => g.category)).size;
}

function setupNavigation(){
  $$("[data-page]").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
  $("#menuBtn")?.addEventListener("click", () => $("#mobileMenu")?.classList.toggle("open"));
}

function setupGameControls(){
  $("#gameSearch")?.addEventListener("input", renderGames);
  $("#categoryFilter")?.addEventListener("change", renderGames);
  $("#randomGame")?.addEventListener("click", () => {
    if(!state.games.length) return;
    openGame(state.games[Math.floor(Math.random() * state.games.length)]);
  });
  $("#favoritesOnly")?.addEventListener("click", () => {
    const b = $("#favoritesOnly");
    b.dataset.active = b.dataset.active ? "" : "1";
    b.textContent = b.dataset.active ? "★ Favorites Only" : "☆ Favorites";
    renderGames();
  });
}

function setupStudio(){
  $$("[data-studio]").forEach(btn => btn.addEventListener("click", () => {
    $$("[data-studio]").forEach(x => x.classList.remove("active"));
    $$(".studio-panel").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    $(`#${btn.dataset.studio === "blocks" ? "blocksPanel" : "scenePanel"}`).classList.add("active");
  }));

  $$("[data-block]").forEach(btn => btn.addEventListener("click", () => {
    const block = document.createElement("div");
    block.className = "script-block";
    const names = {
      event:"🟨 WHEN GAME STARTS",
      move:"🟦 MOVE PLAYER",
      rotate:"🟪 ROTATE OBJECT",
      wait:"🟧 WAIT 1 SECOND",
      if:"🟥 IF / THEN",
      sound:"🟩 PLAY SOUND",
      score:"⭐ CHANGE SCORE",
      repeat:"🔁 REPEAT"
    };
    block.textContent = names[btn.dataset.block] || "BLOCK";
    $("#blockCanvas").querySelector(".empty-state")?.remove();
    $("#blockCanvas").append(block);
  }));

  $("#objectScale")?.addEventListener("input", e => {
    const n = Number(e.target.value);
    $("#sceneCube").style.width = `${100*n}px`;
    $("#sceneCube").style.height = `${100*n}px`;
  });

  $("#objectRotation")?.addEventListener("input", e => {
    $("#sceneCube").style.transform = `translate(-50%,-50%) rotateX(25deg) rotateY(${e.target.value}deg)`;
  });

  $("#objectName")?.addEventListener("input", e => {
    e.target.setAttribute("aria-label", `Object name: ${e.target.value}`);
  });

  $("#addCube")?.addEventListener("click", () => {
    const cube = $("#sceneCube").cloneNode(true);
    cube.style.left = `${35 + Math.random()*30}%`;
    cube.style.top = `${30 + Math.random()*35}%`;
    cube.style.transform = "translate(-50%,-50%) rotateX(25deg) rotateY(35deg) scale(.7)";
    $("#sceneView").append(cube);
  });

  $("#runScene")?.addEventListener("click", () => {
    const cube = $("#sceneCube");
    cube.animate([
      {transform:"translate(-50%,-50%) rotateX(25deg) rotateY(0deg) scale(1)"},
      {transform:"translate(-50%,-65%) rotateX(70deg) rotateY(360deg) scale(1.08)"},
      {transform:"translate(-50%,-50%) rotateX(25deg) rotateY(720deg) scale(1)"}
    ], {duration:900,easing:"ease-in-out"});
  });
}

function setupJS(){
  $("#runJS")?.addEventListener("click", () => {
    const output = $("#output");
    const code = $("#code")?.value ?? "";
    output.textContent = "Running in an isolated preview…";

    // Run user code in an opaque-origin sandbox instead of the portal's own page.
    // The iframe has no same-origin permission and receives code only by postMessage.
    const previous = document.getElementById("hyperblock-code-runner");
    previous?.remove();
    const runner = document.createElement("iframe");
    runner.id = "hyperblock-code-runner";
    runner.title = "Isolated code runner";
    runner.hidden = true;
    runner.setAttribute("sandbox", "allow-scripts");
    runner.srcdoc = `<!doctype html><meta charset="utf-8"><script>
      addEventListener('message', function(event) {
        if (event.source !== parent || !event.data || event.data.type !== 'hyperblock-run') return;
        const send = (type, values) => parent.postMessage({type:'hyperblock-result', kind:type, values:values.map(v => { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (_) { return String(v); } })}, '*');
        const safeConsole = {log:(...v)=>send('log',v), info:(...v)=>send('log',v), warn:(...v)=>send('warn',v), error:(...v)=>send('error',v)};
        try { new Function('console', event.data.code)(safeConsole); parent.postMessage({type:'hyperblock-result',kind:'done',values:[]}, '*'); }
        catch (e) { parent.postMessage({type:'hyperblock-result',kind:'error',values:[String(e && e.message || e)]}, '*'); }
      });
    <\/script>`;
    const onMessage = event => {
      if (event.source !== runner.contentWindow || event.data?.type !== "hyperblock-result") return;
      const {kind, values = []} = event.data;
      const line = values.join(" ");
      if (kind === "done") {
        if (output.textContent === "Running in an isolated preview…") output.textContent = "Code ran successfully.";
      } else if (kind === "error") {
        output.textContent = `Error: ${line}`;
      } else {
        const prefix = kind === "error" ? "ERROR: " : kind === "warn" ? "WARN: " : "";
        output.textContent = output.textContent === "Running in an isolated preview…" ? prefix + line : output.textContent + "\n" + prefix + line;
      }
    };
    window.addEventListener("message", onMessage);
    runner.addEventListener("load", () => {
      runner.contentWindow.postMessage({type:"hyperblock-run", code}, "*");
    }, {once:true});
    document.body.append(runner);
    setTimeout(() => {
      window.removeEventListener("message", onMessage);
      if (runner.isConnected) runner.remove();
      if (output.textContent === "Running in an isolated preview…") output.textContent = "The script did not finish or produced no output. Reset and try a shorter script.";
    }, 5000);
  });
}

function setupSettings(){
  const accent = $("#accentColor");
  const background = $("#backgroundColor");
  const glow = $("#glowToggle");
  const motion = $("#motionToggle");
  const savedA = ls.get("noobonly1-accent");
  const savedB = ls.get("noobonly1-background");
  if(savedA){ accent.value=savedA; document.documentElement.style.setProperty("--accent",savedA); }
  if(savedB){ background.value=savedB; document.documentElement.style.setProperty("--bg",savedB); }
  accent?.addEventListener("input",()=>{document.documentElement.style.setProperty("--accent",accent.value);ls.set("noobonly1-accent",accent.value)});
  background?.addEventListener("input",()=>{document.documentElement.style.setProperty("--bg",background.value);ls.set("noobonly1-background",background.value)});
  glow?.addEventListener("change",()=>document.body.classList.toggle("no-glow",!glow.checked));
  motion?.addEventListener("change",()=>document.body.classList.toggle("no-motion",!motion.checked));

  const input = $("#quickExitUrl");
  const saved = ls.get("noobonly1-quick-exit") || "";
  if(input) input.value = saved;
  $("#quickExit")?.addEventListener("click",()=>{
    let url = input.value.trim();
    if(!url) return;
    if(!/^https?:\/\//i.test(url)) url = "https://" + url;
    ls.set("noobonly1-quick-exit",url);
    window.location.href = url;
  });
}

async function diagnostics(){
  const box = $("#diagnostics");
  box.replaceChildren();
  const checks = [
    ["index.html","document structure",!!document.querySelector("main")],
    ["styles.css","stylesheet loaded",document.styleSheets.length > 0],
    ["app.js","JavaScript running",true],
    ["games.json","game data loaded",Array.isArray(state.games) && state.games.length > 0],
    ["navigation","navigation buttons",$$("[data-page]").length >= 5],
    ["mobile","responsive viewport",window.innerWidth > 0]
  ];
  checks.forEach(([name,desc,ok])=>{
    const d=document.createElement("div");
    d.className="diag " + (ok?"ok":"bad");
    d.textContent=`${ok?"✓":"✕"} ${name} — ${desc}`;
    box.append(d);
  });
}

function startLoader(){
  const bar=$("#loaderBar"), text=$("#loaderText");
  let progress=0;
  const timer=setInterval(()=>{
    progress=Math.min(progress+8,92);
    bar.style.width=progress+"%";
    if(progress<30) text.textContent="Loading interface…";
    else if(progress<60) text.textContent="Loading game library…";
    else text.textContent="Checking portal files…";
  },80);
  window.__loaderTimer = timer;
  return ()=>{clearInterval(timer);bar.style.width="100%";text.textContent="Ready!";setTimeout(()=>$("#loader")?.classList.add("hidden"),250)};
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const finish = startLoader();
  let failure = null;

  // One broken UI feature must not block the rest of the portal
  for(const step of [setupPlayer, setupNavigation, setupGameControls, setupStudio, setupJS, setupSettings]){
    try{ step(); }catch(e){ console.error(`${step.name} failed:`, e); }
  }

  try{
    await loadGames();
    await diagnostics();
  }catch(error){
    failure = error;
    console.error(error);
    const grid = $("#gameGrid");
    if(grid) grid.innerHTML = `<p class="empty-state">⚠️ ${String(error.message).replace(/</g,"&lt;")}<br>Check that <b>data/games.json</b> exists and the site is running through GitHub Pages.</p>`;
  }finally{
    if(failure){
      const t = $("#loaderText"), b = $("#loaderBar");
      if(t) t.textContent = `Portal error: ${failure.message}`;
      if(b) b.style.width = "100%";
      clearInterval(window.__loaderTimer);
      setTimeout(()=>$("#loader")?.classList.add("hidden"), 900);
    }else{
      finish();
    }
    window.__noobonly1Ready = true;
  }
});
