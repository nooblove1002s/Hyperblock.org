import { openPlayer, setupPlayer } from "./games/player.js";

// Safe localStorage: never throws if storage is blocked or corrupt.
const ls = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
};

function readList(key) {
  try {
    const value = JSON.parse(ls.get(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const state = {
  page: "home",
  games: [],
  source: "All",
  favorites: readList("noobonly1-favorites"),
  recent: readList("noobonly1-recent")
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function saveState() {
  ls.set("noobonly1-favorites", JSON.stringify(state.favorites));
  ls.set("noobonly1-recent", JSON.stringify(state.recent));
}

function showPage(page) {
  state.page = page;
  $$(".page").forEach(el =>
    el.classList.toggle("active", el.id === page)
  );
  $$(".desktop-nav button").forEach(el =>
    el.classList.toggle("active", el.dataset.page === page)
  );
  $("#mobileMenu")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addRecent(game) {
  state.recent = [
    game.id,
    ...state.recent.filter(id => id !== game.id)
  ].slice(0, 10);

  saveState();
  renderRecent();
}

function openGame(game) {
  addRecent(game);

  if (game.embed === true && game.embedUrl) {
    openPlayer(game);
  } else {
    window.open(game.url, "_blank", "noopener,noreferrer");
  }
}

function isFavorite(id) {
  return state.favorites.includes(id);
}

function toggleFavorite(id) {
  state.favorites = isFavorite(id)
    ? state.favorites.filter(item => item !== id)
    : [...state.favorites, id];

  saveState();
  renderGames();
  renderFeatured();
  renderRecent();
}

function makeCard(game) {
  const card = document.createElement("article");
  card.className = "game-card";

  const favorite = document.createElement("button");
  favorite.className = "favorite-btn";
  favorite.type = "button";
  favorite.textContent = isFavorite(game.id) ? "★" : "☆";
  favorite.title = "Favorite";
  favorite.addEventListener("click", event => {
    event.stopPropagation();
    toggleFavorite(game.id);
  });

  const icon = document.createElement("div");
  icon.className = "game-icon";
  icon.textContent = game.icon || "🎮";

  const title = document.createElement("h3");
  title.textContent = game.name;

  const source = document.createElement("div");
  source.className = "game-source";
  source.textContent = `Source: ${game.source}`;

  const badge = document.createElement("span");
  const embedded = game.embed === true && !!game.embedUrl;
  badge.className = "game-badge" + (embedded ? "" : " ext");
  badge.textContent = embedded ? "Plays here" : "External";
  source.append(badge);

  const category = document.createElement("p");
  category.textContent = game.category;

  const play = document.createElement("button");
  play.className = "play-btn";
  play.type = "button";
  play.textContent = "PLAY";
  play.addEventListener("click", () => openGame(game));

  card.append(favorite, icon, title, source, category, play);
  return card;
}

function filteredGames() {
  const query = ($("#gameSearch")?.value || "").trim().toLowerCase();
  const category = $("#categoryFilter")?.value || "All";

  return state.games.filter(game => {
    const text =
      `${game.name} ${game.category} ${game.source}`.toLowerCase();

    return (
      (!query || text.includes(query)) &&
      (category === "All" || game.category === category) &&
      (state.source === "All" || game.source === state.source) &&
      (!$("#favoritesOnly")?.dataset.active || isFavorite(game.id))
    );
  });
}

function renderGames() {
  const grid = $("#gameGrid");
  if (!grid) return;

  grid.replaceChildren();
  const games = filteredGames();

  if (!games.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "No games match your filters.";
    grid.append(message);
    return;
  }

  games.forEach(game => grid.append(makeCard(game)));
}

function renderFeatured() {
  const grid = $("#featuredGrid");
  if (!grid) return;

  grid.replaceChildren();
  state.games
    .filter(game => game.featured)
    .slice(0, 8)
    .forEach(game => grid.append(makeCard(game)));
}

function renderRecent() {
  const grid = $("#recentGrid");
  if (!grid) return;

  grid.replaceChildren();

  const games = state.recent
    .map(id => state.games.find(game => game.id === id))
    .filter(Boolean);

  if (!games.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Play a game and it will appear here.";
    grid.append(message);
    return;
  }

  games.slice(0, 8).forEach(game => grid.append(makeCard(game)));
}

function setupFilters() {
  const select = $("#categoryFilter");
  if (!select) return;

  const categories = [
    ...new Set(state.games.map(game => game.category))
  ].sort();

  select.replaceChildren(new Option("All categories", "All"));

  categories.forEach(category => {
    select.append(new Option(category, category));
  });

  const sources = [
    ...new Set(state.games.map(game => game.source))
  ].sort();

  const bar = $("#sourceBar");
  if (!bar) return;

  bar.replaceChildren();

  ["All", ...sources].forEach(source => {
    const button = document.createElement("button");
    button.className = "chip" + (source === "All" ? " active" : "");
    button.textContent = source;

    button.addEventListener("click", () => {
      state.source = source;
      $$(".chip").forEach(chip => chip.classList.remove("active"));
      button.classList.add("active");
      renderGames();
    });

    bar.append(button);
  });
}

async function loadGames() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;

  try {
    response = await fetch("data/games.json", {
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    throw new Error(
      error.name === "AbortError"
        ? "games.json timed out after 10 seconds"
        : `games.json fetch failed: ${error.message}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`games.json HTTP ${response.status}`);
  }

  const games = await response.json();

  if (!Array.isArray(games) || games.length === 0) {
    throw new Error("games.json has no games");
  }

  for (const game of games) {
    if (!game.id || !game.name || !game.category || !game.url) {
      throw new Error(`Invalid game entry: ${game.name || "unknown"}`);
    }
  }

  state.games = games;
  setupFilters();
  renderGames();
  renderFeatured();
  renderRecent();

  $("#gameCount").textContent = games.length;
  $("#categoryCount").textContent =
    new Set(games.map(game => game.category)).size;
}

function setupNavigation() {
  $$("[data-page]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  $("#menuBtn")?.addEventListener("click", () => {
    $("#mobileMenu")?.classList.toggle("open");
  });
}

function setupGameControls() {
  $("#gameSearch")?.addEventListener("input", renderGames);
  $("#categoryFilter")?.addEventListener("change", renderGames);

  $("#randomGame")?.addEventListener("click", () => {
    if (!state.games.length) return;

    const game = state.games[
      Math.floor(Math.random() * state.games.length)
    ];
    openGame(game);
  });

  $("#favoritesOnly")?.addEventListener("click", () => {
    const button = $("#favoritesOnly");
    button.dataset.active = button.dataset.active ? "" : "1";
    button.textContent = button.dataset.active
      ? "★ Favorites Only"
      : "☆ Favorites";

    renderGames();
  });
}

function setupStudio() {
  $$("[data-studio]").forEach(button => {
    button.addEventListener("click", () => {
      $$("[data-studio]").forEach(item => item.classList.remove("active"));
      $$(".studio-panel").forEach(panel => panel.classList.remove("active"));

      button.classList.add("active");

      const panelId =
        button.dataset.studio === "blocks" ? "blocksPanel" : "scenePanel";

      $(`#${panelId}`)?.classList.add("active");
    });
  });

  $$("[data-block]").forEach(button => {
    button.addEventListener("click", () => {
      const names = {
        event: "🟨 WHEN GAME STARTS",
        move: "🟦 MOVE PLAYER",
        rotate: "🟪 ROTATE OBJECT",
        wait: "🟧 WAIT 1 SECOND",
        if: "🟥 IF / THEN",
        sound: "🟩 PLAY SOUND",
        score: "⭐ CHANGE SCORE",
        repeat: "🔁 REPEAT"
      };

      const block = document.createElement("div");
      block.className = "script-block";
      block.textContent = names[button.dataset.block] || "BLOCK";

      $("#blockCanvas")?.querySelector(".empty-state")?.remove();
      $("#blockCanvas")?.append(block);
    });
  });

  $("#objectScale")?.addEventListener("input", event => {
    const cube = $("#sceneCube");
    if (!cube) return;

    const scale = Number(event.target.value);
    cube.style.width = `${100 * scale}px`;
    cube.style.height = `${100 * scale}px`;
  });

  $("#objectRotation")?.addEventListener("input", event => {
    const cube = $("#sceneCube");
    if (!cube) return;

    cube.style.transform =
      `translate(-50%,-50%) rotateX(25deg) rotateY(${event.target.value}deg)`;
  });

  $("#objectName")?.addEventListener("input", event => {
    event.target.setAttribute("aria-label", `Object name: ${event.target.value}`);
  });

  $("#addCube")?.addEventListener("click", () => {
    const original = $("#sceneCube");
    const scene = $("#sceneView");
    if (!original || !scene) return;

    const cube = original.cloneNode(true);
    cube.style.left = `${35 + Math.random() * 30}%`;
    cube.style.top = `${30 + Math.random() * 35}%`;
    cube.style.transform =
      "translate(-50%,-50%) rotateX(25deg) rotateY(35deg) scale(.7)";

    scene.append(cube);
  });

  $("#runScene")?.addEventListener("click", () => {
    const cube = $("#sceneCube");
    if (!cube) return;

    cube.animate([
      {
        transform:
          "translate(-50%,-50%) rotateX(25deg) rotateY(0deg) scale(1)"
      },
      {
        transform:
          "translate(-50%,-65%) rotateX(70deg) rotateY(360deg) scale(1.08)"
      },
      {
        transform:
          "translate(-50%,-50%) rotateX(25deg) rotateY(720deg) scale(1)"
      }
    ], { duration: 900, easing: "ease-in-out" });
  });
}

function setupJS() {
  $("#runJS")?.addEventListener("click", () => {
    const output = $("#output");
    const code = $("#code")?.value ?? "";

    if (!output) return;
    output.textContent = "Running in an isolated preview…";

    const previous = document.getElementById("hyperblock-code-runner");
    previous?.remove();

    const runner = document.createElement("iframe");
    runner.id = "hyperblock-code-runner";
    runner.title = "Isolated code runner";
    runner.hidden = true;
    runner.setAttribute("sandbox", "allow-scripts");

    runner.srcdoc = `<!doctype html>
<meta charset="utf-8">
<script>
addEventListener("message", function(event) {
  if (event.source !== parent || !event.data ||
      event.data.type !== "hyperblock-run") return;

  const send = (kind, values) => parent.postMessage({
    type: "hyperblock-result",
    kind,
    values: values.map(value => {
      try {
        return typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
  }, "*");

  const safeConsole = {
    log: (...values) => send("log", values),
    info: (...values) => send("log", values),
    warn: (...values) => send("warn", values),
    error: (...values) => send("error", values)
  };

  try {
    new Function("console", event.data.code)(safeConsole);
    parent.postMessage({
      type: "hyperblock-result", kind: "done", values: []
    }, "*");
  } catch (error) {
    parent.postMessage({
      type: "hyperblock-result",
      kind: "error",
      values: [String(error && error.message || error)]
    }, "*");
  }
});
<\/script>`;

    const onMessage = event => {
      if (
        event.source !== runner.contentWindow ||
        event.data?.type !== "hyperblock-result"
      ) return;

      const { kind, values = [] } = event.data;
      const line = values.join(" ");

      if (kind === "done") {
        if (output.textContent === "Running in an isolated preview…") {
          output.textContent = "Code ran successfully.";
        }
      } else if (kind === "error") {
        output.textContent = `Error: ${line}`;
      } else {
        const prefix = kind === "warn" ? "WARN: " : "";
        output.textContent =
          output.textContent === "Running in an isolated preview…"
            ? prefix + line
            : output.textContent + "\n" + prefix + line;
      }
    };

    window.addEventListener("message", onMessage);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      runner.remove();
    };

    runner.addEventListener("load", () => {
      runner.contentWindow.postMessage({
        type: "hyperblock-run",
        code
      }, "*");
    }, { once: true });

    document.body.append(runner);

    setTimeout(() => {
      if (runner.isConnected) {
        cleanup();
        if (output.textContent === "Running in an isolated preview…") {
          output.textContent =
            "The script did not finish or produced no output. Try a shorter script.";
        }
      }
    }, 5000);
  });
}

function setupSettings() {
  const accent = $("#accentColor");
  const background = $("#backgroundColor");
  const glow = $("#glowToggle");
  const motion = $("#motionToggle");

  const savedAccent = ls.get("noobonly1-accent");
  const savedBackground = ls.get("noobonly1-background");

  if (savedAccent && accent) {
    accent.value = savedAccent;
    document.documentElement.style.setProperty("--accent", savedAccent);
  }

  if (savedBackground && background) {
    background.value = savedBackground;
    document.documentElement.style.setProperty("--bg", savedBackground);
  }

  accent?.addEventListener("input", () => {
    document.documentElement.style.setProperty("--accent", accent.value);
    ls.set("noobonly1-accent", accent.value);
  });

  background?.addEventListener("input", () => {
    document.documentElement.style.setProperty("--bg", background.value);
    ls.set("noobonly1-background", background.value);
  });

  glow?.addEventListener("change", () => {
    document.body.classList.toggle("no-glow", !glow.checked);
  });

  motion?.addEventListener("change", () => {
    document.body.classList.toggle("no-motion", !motion.checked);
  });

  const input = $("#quickExitUrl");
  if (input) {
    input.value = ls.get("noobonly1-quick-exit") || "";
  }

  $("#quickExit")?.addEventListener("click", () => {
    let url = input?.value.trim() || "";
    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return;

      ls.set("noobonly1-quick-exit", parsed.href);
      window.location.href = parsed.href;
    } catch {
      // Ignore malformed URLs.
    }
  });
}

async function diagnostics() {
  const box = $("#diagnostics");
  if (!box) return;

  box.replaceChildren();

  const checks = [
    ["index.html", "document structure", !!document.querySelector("main")],
    ["styles.css", "stylesheet loaded", document.styleSheets.length > 0],
    ["app.js", "JavaScript running", true],
    ["games.json", "game data loaded", state.games.length > 0],
    ["navigation", "navigation buttons", $$("[data-page]").length >= 5],
    ["mobile", "responsive viewport", window.innerWidth > 0]
  ];

  checks.forEach(([name, description, ok]) => {
    const item = document.createElement("div");
    item.className = "diag " + (ok ? "ok" : "bad");
    item.textContent = `${ok ? "✓" : "✕"} ${name} — ${description}`;
    box.append(item);
  });
}

function startLoader() {
  const bar = $("#loaderBar");
  const text = $("#loaderText");

  if (!bar || !text) {
    return () => {};
  }

  let progress = 0;

  const timer = setInterval(() => {
    progress = Math.min(progress + 8, 92);
    bar.style.width = progress + "%";

    if (progress < 30) text.textContent = "Loading interface…";
    else if (progress < 60) text.textContent = "Loading game library…";
    else text.textContent = "Checking portal files…";
  }, 80);

  window.__loaderTimer = timer;

  return () => {
    clearInterval(timer);
    bar.style.width = "100%";
    text.textContent = "Ready!";
    setTimeout(() => $("#loader")?.classList.add("hidden"), 250);
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const finishLoader = startLoader();
  let failure = null;

  // One broken feature should not block the rest of the portal.
  for (const setup of [
    setupPlayer,
    setupNavigation,
    setupGameControls,
    setupStudio,
    setupJS,
    setupSettings
  ]) {
    try {
      setup();
    } catch (error) {
      console.error(`${setup.name} failed:`, error);
    }
  }

  try {
    await loadGames();
    await diagnostics();
  } catch (error) {
    failure = error;
    console.error(error);

    const grid = $("#gameGrid");
    if (grid) {
      const message = document.createElement("p");
      message.className = "empty-state";
      message.textContent =
        `⚠️ ${error.message} Check that data/games.json exists and the site is running through GitHub Pages.`;
      grid.replaceChildren(message);
    }
  } finally {
    if (failure) {
      const text = $("#loaderText");
      const bar = $("#loaderBar");

      if (text) text.textContent = `Portal error: ${failure.message}`;
      if (bar) bar.style.width = "100%";

      clearInterval(window.__loaderTimer);
      setTimeout(() => $("#loader")?.classList.add("hidden"), 900);
    } else {
      finishLoader();
    }

    window.__noobonly1Ready = true;
  }
});
Important: Th
