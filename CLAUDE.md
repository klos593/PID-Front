# PID — Frontend (PID-Front)

Shared context for Claude Code across the team. This file lives at the root of **PID-Front**. Sibling files exist in **PID-Back** and **PID-Infra** — see "Related repos" at the bottom.

## Project context
- University group web app project (React frontend + Fastify backend + Postgres), fully Dockerized.
- Professor's constraint: no managed/PaaS platforms — the app must run via Docker and be continuously deployed so it can be reviewed at any time.
- Three repos, cloned side by side inside a parent `Proyecto/` folder: `PID-Front` (this one), `PID-Back`, `PID-Infra`.
- Team works across Apple Silicon Macs (M1/M2) and at least one Windows desktop — keep cross-platform tooling in mind (line endings, shell scripts, etc.).

## Tech stack (this repo)
- React scaffolded with **Vite** (`react` template + ESLint) — NOT Create React App.
- Local dev: `npm run dev` (Vite doesn't use `npm start` — that trips people up coming from CRA).
- Dev URL: `http://127.0.0.1:5173` — use `127.0.0.1`, not `localhost` (avoids an IPv4/IPv6 resolution issue seen on Mac + Chrome).
- Inside Docker, the Vite dev server must run with the `--host` flag or it won't be reachable from outside the container.
- Production build is served by **nginx**, configured with a `try_files` fallback so React Router routes work on refresh/direct URL, not just client-side navigation.
- Client-side routing via React Router.

## Color palette — light/dark, blue-based
CSS variables. Both modes use the *same blue hue* at different lightness/saturation steps, so toggling themes doesn't feel like a different app.

**Light mode**
```
--color-bg:            #EFF6FF
--color-surface:       #DBEAFE
--color-primary:       #2563EB
--color-primary-hover: #1D4ED8
--color-text:          #0F172A
--color-text-muted:    #64748B
```

**Dark mode**
```
--color-bg:            #0B1220
--color-surface:       #131C2E
--color-primary:       #3B82F6
--color-primary-hover: #60A5FA
--color-text:          #F1F5F9
--color-text-muted:    #94A3B8
```

Notes:
- Dark surfaces are deep navy (`#0B1220`), not pure black — pure black behind a saturated blue looks harsh.
- Hover states move *away* from the background in both modes (darker in light mode, lighter in dark mode).
- Semantic colors (success/danger/warning) haven't been picked yet. When they're added, match the saturation/lightness of this blue ramp so they read as part of the same system.

## Lessons learned / gotchas
- We switched from Create React App to Vite partway through — if you see CRA leftovers (`react-scripts`, old `public/index.html` conventions), they're stale and should be removed.
- `docker-compose.dev.yml` had a stale port mapping (`3000`) left over from before the Vite switch — Vite's default is `5173`. Check compose port mappings first if the dev server "isn't loading."
- Watch out for `package-lock.json` getting accidentally committed to the wrong repo — this happened when `npm install` was run from the wrong directory. Check `pwd` before installing.
- `.gitattributes` is in place in all three repos to normalize line endings across Mac/Windows contributors — don't remove it.

## Related repos
- **PID-Back** — Fastify API, dev port `4000`. See its `CLAUDE.md`.
- **PID-Infra** — Docker Compose, CI/CD, reverse proxy, VPS provisioning. See its `CLAUDE.md`.
