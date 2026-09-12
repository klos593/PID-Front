# PID — Frontend (PID-Front)

Shared context for Claude Code across the team. This file lives at the root of **PID-Front**. Sibling files exist in **PID-Back** and **PID-Infra** — see "Related repos" at the bottom.

## Project context
- University group web app project (React frontend + Fastify backend + Postgres), fully Dockerized.
- Professor's constraint: no managed/PaaS platforms — the app must run via Docker and be continuously deployed so it can be reviewed at any time.
- Three repos, cloned side by side inside a parent `Proyecto/` folder: `PID-Front` (this one), `PID-Back`, `PID-Infra`.
- Team works across Apple Silicon Macs (M1/M2) and at least one Windows desktop — keep cross-platform tooling in mind (line endings, shell scripts, etc.).

## App concept
A web app (responsive — must work well on phone too) that connects students and teachers.
- **Single account type**: role is chosen at signup, not separate signup flows. On the wire the role is Spanish: **`"docente"` or `"alumno"`** (that's what the register form sends and what the frontend switches on — don't send `teacher`/`student`).
- **Teachers**: pick which subjects they teach from a fixed list of available subjects, and set their availability. Availability ended up being a **weekly template per subject** ("Mondays 13:00–15:30"), not a list of specific dates — it's what a teacher actually has to fill in once instead of every week. The dates come out of it, see "weekly template → dated availability" below. Classes are always **1 hour long**, and can only start on the hour or half-hour (`:00` or `:30`).
- **Students**: search/browse teachers, view their profile and subjects, see which teachers are available and their open class slots.
- **Booking**: a student picking a slot **reserves it** — it disappears from availability for other students once booked.
- **Payments/pricing**: out of scope for this version.

### Frontend implications
- Mobile-first, responsive layout — test at phone widths, not just desktop.
- Teacher-side views: subject picker (from the fixed subject list), an availability calendar/scheduler (slots snapped to `:00`/`:30`, 1-hour blocks only).
- Student-side views: teacher search/browse, teacher profile page (subjects + bio), a slot picker showing only *available* (unbooked) slots, and a booking confirmation flow.
- Once a slot is booked, the UI for other students needs to reflect it's no longer available (don't rely on stale client state — refetch or use optimistic UI carefully to avoid double-booking races). After a successful booking the board **refetches the whole month** instead of patching state: that hour also disappears from the teacher's *other* subjects and can start clashing with other cards, and recomputing that in the browser would be reimplementing the backend.

## Tech stack (this repo)
- React scaffolded with **Vite** (`react` template + ESLint) — NOT Create React App.
- Local dev: `npm run dev` (Vite doesn't use `npm start` — that trips people up coming from CRA).
- Dev URL: `http://127.0.0.1:5173` — use `127.0.0.1`, not `localhost`. The reason: on macOS `localhost` resolves to `::1` first, and a process bound specifically to `[::1]:5173` beats Docker's wildcard `*:5173` bind. If any other project's `vite` dev server is left running on 5173, `localhost` silently serves *that* app while `127.0.0.1` serves ours. Check with `lsof -nP -iTCP:5173 -sTCP:LISTEN`.
- Inside Docker, the Vite dev server must run with the `--host` flag or it won't be reachable from outside the container.
- Production build is served by **nginx**, configured with a `try_files` fallback so React Router routes work on refresh/direct URL, not just client-side navigation.
- Client-side routing via React Router.
- `npm test` (vitest + jsdom + Testing Library) and `npm run lint` must both pass before pushing. Tests live next to the file they test (`Thing.jsx` → `Thing.test.jsx`).
- Everything the frontend asks the API goes through **relative `/api/...` paths**. `vite.config.js` proxies `/api` to `http://backend:4000` (the compose service name); running `npm run dev` outside Docker, point it at `http://127.0.0.1:4000`.

## Screens that exist today

| Route | Who | What it does |
|---|---|---|
| `/ingresar`, `/registro` | anyone | Login and 3-step signup (account → role → subjects). |
| `/` | both | Month calendar + the selected day's agenda. Shows **booked** lessons only. |
| `/perfil` | both | Email/name read-only, phone editable, logout. A teacher also edits which subjects they teach and jumps to each subject's availability. |
| `/disponibilidad` | teacher | Weekly availability scheduler: drag over a half-hour grid to paint hours, copy a day to others. Hours already taken by the teacher's *other* subjects show as blocked. |
| `/disponibilidad` | student | Booking board: filters (day / subject / hour range / search box), month calendar with a green count per day, cards per teacher+subject+day, and a modal with a one-line Gantt hour picker to book. |
| `/disponibilidad/:materiaId` | both | Same screens, with that subject preselected. |

## The API the frontend is waiting for

**Where to plug in.** Every call lives in `src/api/client.js`. Each function that isn't wired yet returns fake data and has the real call **commented right underneath**:

```js
export function fetchSubjects() {
  return mockResponse(MOCK_SUBJECTS)   // ← delete this line
  // return request('/api/subjects')   // ← uncomment this one
}
```

So connecting an endpoint is a two-line change, one function at a time — the screens don't change at all. When every function is wired, `src/api/mocks.js` gets deleted whole. Nothing else in the app imports it.

**Formats used everywhere** (the whole frontend already speaks these, so please match them):

- Dates: `"YYYY-MM-DD"`, local time, no timezone, no `T00:00:00Z`. Sending UTC timestamps will shift days for our users.
- Times: `"HH:MM"`, 24 h, always `:00` or `:30`.
- A range is `{ "start": "13:00", "end": "15:30" }` and **`end` is exclusive**. A range that ends at midnight is written `"24:00"`, never `"00:00"` — otherwise `start < end` breaks for anything that sorts or validates, including the DB.
- Weekday keys are ASCII, lowercase, **no accents**: `lunes martes miercoles jueves viernes sabado domingo`. The week starts on **Monday**. These are JSON keys and DB values, not display text.
- IDs of subjects and users are numbers.

**Errors.** `request()` in `client.js` reads a failed response as JSON and expects:

```json
{ "message": "El email ya está registrado.", "error": "EMAIL_TAKEN", "fields": { "email": "Ya existe una cuenta con ese email." } }
```

`message` is shown to the user as-is (write it in Spanish, rioplatense), `fields` maps a form field name to its own message. Anything non-2xx without a body shows a generic message.

### Endpoints, in the order that unblocks the most

**1. `POST /api/auth/login`** → the whole app is behind it.
```jsonc
// request
{ "email": "a@b.com", "password": "..." }
// response
{ "user": { "id": 1, "nombre": "Agustín", "apellido": "Klos", "email": "a@b.com",
            "role": "docente", "telefono": "+54 11 5555-5555", "subjectIds": [1, 3, 5] } }
```
The frontend keeps `user` in memory only (it's lost on refresh — there's no session yet). When you add cookies/JWT, say so and we'll add the header or `credentials: 'include'` in `request()`.

**2. `GET /api/subjects`** → `[{ "id": 1, "name": "Matemática" }, ...]`. Fixed catalogue. Signup step 3 and every subject filter depend on it.

**3. `GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD`** → the student booking board. **This is the one with real work in it**, see the section below.
```jsonc
[
  { "id": "2026-09-14|2|1",            // `${date}|${teacherId}|${subjectId}`, unique in the response
    "date": "2026-09-14",
    "dayKey": "lunes",
    "teacherId": 2, "teacherName": "Laura Gómez",
    "subjectId": 1, "subjectName": "Matemática",
    "ranges": [ { "start": "13:00", "end": "15:30" }, { "start": "16:00", "end": "17:00" } ] }
]
```
One row per (teacher, subject, **date**) with all of that day's ranges together. `from`/`to` cover the whole visible month grid, so up to ~42 days and three calendar months.

**4. `GET /api/classes?from&to&status=reservada&student=me`** → the student's own booked lessons, used to grey out clashes.
```jsonc
[ { "id": "sl-1", "date": "2026-09-14", "startTime": "14:00", "endTime": "15:00",
    "subjectId": 1, "subjectName": "Matemática",
    "teacherId": 2, "teacherName": "Laura Gómez",
    "studentName": "Sofía Ramírez", "status": "reservada" } ]
```

**5. `POST /api/classes`** → booking. Body is exactly:
```jsonc
{ "date": "2026-09-14", "teacherId": 2, "teacherName": "Laura Gómez",
  "subjectId": 1, "subjectName": "Matemática",
  "startTime": "14:00", "endTime": "15:00", "status": "reservada" }
```
Response `{ "lesson": { ...the saved lesson with its id... } }`. The student comes from the session, not the body. **Validate server-side** — the frontend only offers valid slots, but two students can click at the same time: reject if the hour isn't inside the teacher's availability, if the teacher already has a class there (any subject), or if that student already has one. A 409 with a Spanish `message` shows up in the modal exactly as written.

**6. `GET /api/classes?from&to&status=reservada`** → the main calendar. Same row shape as #4. `status` is optional (`reservada` / `disponible`).

**7. `PUT /api/subjects/:subjectId/availability`** → the teacher's scheduler saves here.
```jsonc
// request — the whole week for that subject, replacing whatever was there
{ "schedule": { "lunes": [ { "start": "09:00", "end": "11:00" } ],
                "miercoles": [ { "start": "18:00", "end": "20:00" } ] } }
```
Days with no hours are simply absent. The teacher comes from the session. Reject any range shorter than 1 hour — the UI already blocks it, since a class wouldn't fit.

**8. `GET /api/teachers/:teacherId/availability`** → `{ "1": { "lunes": [...] }, "3": { "martes": [...] } }`, keyed by subject id: **all** the subjects of that teacher in one request. The scheduler needs the other subjects to paint the blocked hours, and one request per subject would be an N+1 with a race every time the teacher switches subject.

**9. `PATCH /api/users/me`** → `{ "telefono": "...", "subjectIds": [1, 3] }`, responds `{ "user": { ...updated... } }`.

**10. Already wired, not mocked:** `POST /api/auth/register` (body `{ email, password, nombre, apellido, telefono, role, subjectIds }`) and `GET /api/auth/check-email?email=` (expected `{ "available": true }` — exported but no screen uses it yet).

`GET /api/teachers` also exists in `client.js` for a future search screen.

### The one design decision to understand: weekly template → dated availability

A teacher saves a **weekly template** (`{ lunes: [13:00–15:30] }`). A student books a **date** (`2026-09-14`). Something has to bridge the two, and **that something is the backend**: `GET /api/availability` returns rows that already have a `date` and are **already net of what's booked**.

Two different meanings of "booked", and only one of them is subtracted:

- Booked **with that teacher** → that hour no longer exists for anyone. **Subtract it** from the ranges, matching by (teacher, date) and **ignoring the subject** — nobody teaches two subjects at once. A row left with no ranges is dropped from the response.
- Booked by **this student with someone else** → the teacher's hour still exists, this student just can't take it. **Do not subtract it**; the frontend gets it from `/api/classes?student=me` and greys it out.

The frontend never sees a weekly template on that screen, on purpose — that's what `src/utils/booking.js` does today against the mocks, and it's the piece that disappears into the backend. Reading `expandAvailability` and `subtractBookedLessons` in that file gives you the algorithm; `src/utils/booking.test.js` is a spec you can steal, including the edge case that **ranges touching at the edges don't overlap** (14:00–15:00 and 15:00–16:00 coexist fine).

### Rules the backend must enforce (the UI already does, but the UI can be bypassed)

1. A class lasts **exactly 1 hour** and starts at `:00` or `:30`.
2. A booked hour **disappears** from that teacher's availability for everybody.
3. A teacher can't have two classes at the same time, whatever the subject.
4. A student can't have two classes that overlap **even by a minute**.
5. An availability block shorter than 1 hour is invalid — a class wouldn't fit in it.

### Known gaps on the frontend side (not your problem, but they explain what you'll see)

- **There's no `studentId` anywhere yet.** `studentName` is display text. Once classes have a real owner, `/api/classes?student=me` replaces the `mockStudentLessons` list and the `TODO(alumno)` in `mocks.js` goes away.
- The logged-in teacher currently appears as a bookable teacher **to himself** — deliberate scaffolding so the flow can be demoed end to end with no backend. The real API should exclude self.
- Hours already past on today's date are still offered.

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
- The semantic colors are picked and live in `src/index.css` alongside the ones above: `--color-success`, `--color-danger`, `--color-warning` (each with a `-bg` companion), plus `--color-border`, `--color-surface-solid` (an opaque surface for cards and grids) and `--shadow-card` / `--shadow-soft`. Both themes define every token, so **use the token, never a hex** — a raw color only looks right in one of the two themes.
- The theme follows the OS by default and the toggle in the navbar only stamps `data-theme` once the user actually chooses, so a first visit never overrides the system preference.

## Frontend conventions (for whoever touches this repo)
- **Class components everywhere.** No hooks: the only file allowed to use them is `src/routes/withRouter.jsx`, the bridge that injects React Router's data as a `router` prop. Function components are only used for the SVGs in `components/icons.jsx`. State goes in class properties, handlers are arrow properties, per-item handlers are curried (`handleX = (id) => () => {}`), defaults go in `X.defaultProps`.
- **Style**: no semicolons, single quotes, 2-space indent, ~100 columns. UI copy in rioplatense Spanish (voseo: "Elegí", "tenés"). Comments in Spanish, and they explain **why**, not what. Don't run a formatter over a file — there's no prettier config in the repo and it will fight the house style.
- **Layout**: `pages/<Screen>/` for screens (component + its CSS + its tests colocated), `components/` for anything shared, `utils/` for pure logic with no React (`calendar.js` dates, `availability.js` the weekly grid, `booking.js` the bridge between the two), `api/` for the client and the mocks.
- **CSS**: plain global files, design tokens only (never a raw hex), state classes named `is-*`, and both themes covered. Breakpoints are desktop-first `max-width` at 900 / 600 / 480px.
- **Stale responses** are handled with a monotonic counter (`fetchToken`) compared in the `.then()`, not AbortController — changing month quickly must not let an older response land last.

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
