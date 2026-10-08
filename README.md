# HYPERBLOCK — Rebuild

## Exact GitHub Pages structure

```text
Noobsblocked/
├── index.html
├── styles.css
├── js/
│   └── app.js
├── data/
│   └── games.json
└── assets/
    ├── images/
    └── icons/
```

## Important
Run this through GitHub Pages. Do not expect `fetch("data/games.json")` to work correctly when opening `index.html` directly as a local file.

## Included
- Mobile + desktop responsive portal
- Animated loading screen with error handling
- 60 game/game-hub entries
- Poki and CrazyGames source hubs
- Search, categories, source filters, favorites, recent games, random game
- Game Studio block system
- Starter 3D scene editor
- JavaScript Lab
- Theme settings
- Quick Exit
- Built-in diagnostics panel

## Game rights
The catalog defaults to `embed: false`. That means the portal opens the listed destination rather than attempting to copy or embed third-party games. Only embed content when the owner/license permits it.

## If the loader gets stuck
Open Settings → Portal Diagnostics after the page loads. If it cannot load at all, verify that the four required files are in the exact paths above.
