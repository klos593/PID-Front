# PID — Frontend (PID-Front)

Shared context for Claude Code across the team. This file lives at the root of **PID-Front**. Sibling files exist in **PID-Back** and **PID-Infra** — see "Related repos" at the bottom.

## Project context
- University group web app project (React frontend + Fastify backend + Postgres), fully Dockerized.
- Professor's constraint: no managed/PaaS platforms — the app must run via Docker and be continuously deployed so it can be reviewed at any time.
- Three repos, cloned side by side inside a parent `Proyecto/` folder: `PID-Front` (this one), `PID-Back`, `PID-Infra`.
- Team works across Apple Silicon Macs (M1/M2) and at least one Windows desktop — keep cross-platform tooling in mind (line endings, shell scripts, etc.).

## App concept
A web app (responsive — must work well on phone too) that connects students and teachers.
- **Single account type**: role (`teacher` or `student`) is chosen at signup, not separate signup flows.
- **Teachers**: pick which subjects they teach from a fixed list of available subjects, and set their availability — specific dates and start times. Classes are always **1 hour long**, and can only start on the hour or half-hour (`:00` or `:30`).
- **Students**: search/browse teachers, view their profile and subjects, see which teachers are available and their open class slots.
- **Booking**: a student picking a slot **reserves it** — it disappears from availability for other students once booked.
- **Payments/pricing**: out of scope for this version.

### Frontend implications
- Mobile-first, responsive layout — test at phone widths, not just desktop.
- Teacher-side views: subject picker (from the fixed subject list), an availability calendar/scheduler (slots snapped to `:00`/`:30`, 1-hour blocks only).
- Student-side views: teacher search/browse, teacher profile page (subjects + bio), a slot picker showing only *available* (unbooked) slots, and a booking confirmation flow.
- Once a slot is booked, the UI for other students needs to reflect it's no longer available (don't rely on stale client state — refetch or use optimistic UI carefully to avoid double-booking races).

## Tech stack (this repo)
- React scaffolded with **Vite** (`react` template + ESLint) — NOT Create React App.
- Local dev: `npm run dev` (Vite doesn't use `npm start` — that trips people up coming from CRA).
- Dev URL: `http://127.0.0.1:5173` — use `127.0.0.1`, not `localhost`. The reason: on macOS `localhost` resolves to `::1` first, and a process bound specifically to `[::1]:5173` beats Docker's wildcard `*:5173` bind. If any other project's `vite` dev server is left running on 5173, `localhost` silently serves *that* app while `127.0.0.1` serves ours. Check with `lsof -nP -iTCP:5173 -sTCP:LISTEN`.
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
- **Bumping a version in `package.json` means running `npm install` in the same commit.** The Docker build uses `npm ci`, which refuses to install when `package.json` and `package-lock.json` disagree. Under the npm 10.8.2 that ships in `node:20-alpine` it doesn't say so — it crashes with `npm error Cannot read properties of null (reading 'edgesOut')`, which looks like a Docker or registry problem but isn't. This already happened once when the dev deps (vitest, jsdom, `@testing-library/*`) were bumped by hand and the lockfile was left behind.
- **A new dependency can be missing at runtime even after a successful `--build`.** Symptom: `Failed to resolve import "framer-motion"` (or any freshly added package) in the browser, with the file path shown as `/app/...`, while `npm ls` on the host looks fine. Cause is the anonymous `/app/node_modules` volume in `docker-compose.dev.yml`, which persists across rebuilds and shadows the image's newer install. Fix is to rebuild with `-V`: `docker compose -f docker-compose.dev.yml up --build -V`. Full explanation in **PID-Infra**'s `CLAUDE.md` — and never `down -v`, which wipes the Postgres volume.
- Watch out for `package-lock.json` getting accidentally committed to the wrong repo — this happened when `npm install` was run from the wrong directory. Check `pwd` before installing.
- `.gitattributes` is in place in all three repos to normalize line endings across Mac/Windows contributors — don't remove it.

## Related repos
- **PID-Back** — Fastify API, dev port `4000`. See its `CLAUDE.md`.
- **PID-Infra** — Docker Compose, CI/CD, reverse proxy, VPS provisioning. See its `CLAUDE.md`.
