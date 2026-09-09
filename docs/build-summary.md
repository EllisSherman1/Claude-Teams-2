# NeuralFlow — Build Summary

**Date:** 2026-09-08
**Built by:** a 3-agent team (`neuralflow`) — Frontend Dev, Backend Dev, QA — coordinated by a team lead.

---

## What was built

A marketing site and backing JSON API for a fictional AI startup, NeuralFlow, running as a
single Express process that serves both the static page and the API it consumes.

| Piece | File | Lines |
|---|---|---|
| Landing page | `src/index.html` | 556 |
| Dark-theme stylesheet | `src/styles.css` | 682 |
| Express server + API | `src/server.js` | 227 |
| Executable smoke suite | `tests/smoke.js` | 329 |
| QA test plan | `tests/test-plan.md` | 168 |
| QA test report | `tests/report.md` | 137 |
| Run/API documentation | `README.md` | 226 |

The page has a hero with an animated canvas, a three-card features grid, a three-tier
pricing table, and a contact form. Each of the three data-driven sections renders from
static markup first, then replaces itself with live data fetched from the API.

### API surface

| Method | Route | Returns |
|---|---|---|
| GET | `/api/features` | 3 feature objects — `{id, title, description, icon}` |
| GET | `/api/pricing` | 3 tier objects — `{id, name, price, period, features, cta, highlighted}` |
| GET | `/api/health` | `{status: "ok"}` |
| POST | `/api/contact` | Validates `{name, email, message}`, logs it, returns `{ok, message, submittedAt}` |
| GET | `/`, `/styles.css` | The landing page and its stylesheet |

---

## Key decisions, and why

### One process serves both the page and the API
The alternative was a separate static host plus an API server. A single Express process
means the page can call `/api/features` with a **relative path** — no CORS configuration,
no hardcoded `host:port` in the frontend, and no second thing to start. It also means the
whole project runs with one command, which matters for something meant to be opened and
looked at.

### Static-first rendering, then hydrate
Both the features grid and the pricing table ship real content in the HTML (`data-state="fallback"`)
and swap it for API data once the fetch resolves. A visitor with JavaScript disabled, or one
hitting a failed request, still sees a complete page instead of three empty boxes.

The cost of this decision is that the same content now lives in two places and can drift.
It did drift — badly — and QA caught it (see *What QA caught* below). The fix was to
reconcile the static markup against the live payloads rather than to abandon the pattern,
because the resilience is worth more than the duplication costs.

### An extension allowlist in front of `express.static`
`express.static(__dirname)` on `src/` served the backend's own source: `GET /server.js`
returned 200 with the full file. Rather than move `index.html` and `styles.css` into a
`public/` subfolder — which would have broken the requested `src/index.html` layout — a
small middleware allowlists `.html`, `.css`, and `/` before handing off to `express.static`.
Anything else falls through to the normal 404. QA probed this with uppercase, trailing
slashes, `HEAD`, and encoded path traversal; no bypass was found.

### Error responses match their actual cause
A malformed JSON body originally returned `400 {"error": "Internal server error"}` — the
right status with a misleading message. The error middleware now special-cases
`err.type === 'entity.parse.failed'` and says `"Malformed JSON in request body."` The
middleware also logs full error objects only for 5xx; client-side 4xx get a single concise
line, so real server faults are not buried in stack traces from bad input.

### Startup failures explain themselves
`app.listen` had no error handler, so a taken port killed the process with a raw Node stack
trace. This happened in practice during the build. `EADDRINUSE` and `EACCES` now print what
went wrong and how to override the port, then exit 1.

The first version of that handler was subtly wrong, and it is worth recording why. It still
printed `NeuralFlow API listening at http://localhost:3001` immediately *before* reporting the
failure — so a log reader would conclude the server started and then died, rather than that it
never bound. The cause is in Express itself
(`node_modules/express/lib/application.js:598`):

```js
app.listen = function listen() {
  var server = http.createServer(this)
  var args = slice.call(arguments)
  if (typeof args[args.length - 1] === 'function') {
    var done = args[args.length - 1] = once(args[args.length - 1])
    server.once('error', done)   // the same callback is wired to 'error' too
  }
```

Passing a callback to `app.listen(PORT, cb)` registers that callback as an `'error'` listener
*in addition to* Node's normal `'listening'` wiring. On a failed bind only `'error'` fires — but
it now has two listeners, with the success message first. Plain
`net.createServer().listen(port, cb)` does not behave this way; it is specific to Express.

The fix is to pass no callback and attach `'listening'` and `'error'` as separate listeners.
`tests/smoke.js` now guards this: it boots a holder process, starts the server on the same
port, and asserts the output never contains "listening at" before the port-in-use error.

### Tests are executable, not just prose
`tests/` originally held only markdown. `tests/smoke.js` is dependency-free plain Node — it
boots the server as a child process on port 3500, runs 22 assertions against the real routes
plus the startup-failure path, kills the child, and exits non-zero on failure. Wired to
`npm test`.

### Accessibility treated as correctness, not polish
Small meta text used a token at 4.11:1 and 3.61:1 contrast, below the WCAG AA 4.5:1 minimum.
It was changed to `#8890a8` — 6.11:1 and 5.37:1. The mobile breakpoint originally hid the
nav with a bare `display: none` and no replacement; it now has a real hamburger with
`aria-expanded`, `aria-controls`, Escape-to-close, and focus management. The contact form
announces its pending state through a live region and marks invalid fields with
`aria-invalid`, moving focus to the first one.

---

## What QA caught

QA reviewed both devs' work rather than trusting their self-reports, and independently
recomputed the contrast ratios from raw hex instead of accepting the claimed numbers.
Findings worth recording:

1. **Fallback/API content drift.** The static features markup described three entirely
   different features than the API returned. Pricing was worse: Starter's fallback quoted
   "10,000 requests/month" against the API's "Up to 1,000 API calls/month" — off by 10× —
   and every CTA label differed. All reconciled against the API.
2. **Keyboard tab order in the new mobile nav.** `#nav-links` sits before `#nav-toggle` in
   the DOM, so opening the menu left focus on the toggle and Tab moved *past* the links
   into page content. Fixed by moving focus into the panel on open.
3. **Tier taglines vanished on hydration.** The API sends no `description` field for pricing
   tiers, so successful hydration silently dropped copy the fallback had. This is a content-loss
   bug that only appears when everything *works* — the opposite of the usual failure mode.
4. **Hydration discarded the API's `icon` field**, always rendering a generic dot, so the
   emoji the API sends were thrown away on every successful load. Now rendered (HTML-escaped),
   with the dot kept as the fallback for items that carry no icon.
5. **The error handler for a failed bind announced success first.** QA reproduced it 3/3 with
   isolated log files to rule out output commingling, which is what made it credible enough to
   chase down to the Express source rather than dismiss as a logging artifact. See the
   *Startup failures* decision above.
6. Earlier rounds also caught a missing HTML document skeleton and a pricing hydration bug
   reading `item.featured` when the API sends `highlighted`, masked by a coincidental
   name-regex fallback.

Final QA tally: **23 PASS, 0 WARN, 0 FAIL, 1 UNTESTABLE**, with every bug raised across the
cycle closed.

Two things `tests/report.md` deliberately does *not* claim:

- **Rendered output.** No headless browser is available here, so layout, font loading, canvas
  animation, and real screen-reader behavior were verified by code review only. Those are
  marked UNTESTABLE rather than passed.
- **The `EACCES` branch.** The listener-wiring fix is structurally identical for every bind
  error, so the defect is verifiably gone by inspection — but this environment permits binding
  low ports without root, so a real `EACCES` was never triggered. That is recorded as an
  inference, not an observation.

This distinction is the point. QA independently re-derived the WCAG contrast ratios from raw
hex instead of accepting the claimed numbers, read the Express source itself rather than
trusting the root-cause writeup, and compared response bodies by ETag rather than eyeballing
JSON. Several of the bugs above were found precisely because a claim was checked instead of
believed.

---

## How to run

```bash
npm install
npm start
```

Then open **http://localhost:3001**.

Override the port if 3001 is busy:

```bash
PORT=3002 npm start
```

Run the smoke suite:

```bash
npm test
```

---

## Known open items

- Contact submissions are logged to stdout only. There is no persistence, no rate limiting,
  and no spam protection — appropriate for a demo, not for a public endpoint.
- Pricing tier descriptions live in a `STATIC_TIER_DESCRIPTIONS` map in the frontend because
  the API does not supply them. Adding a `description` field to `/api/pricing` would remove
  that duplication.
- Visual rendering has never been confirmed in a real browser.
