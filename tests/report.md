# NeuralFlow — QA Test Report

**Tester:** QA
**Date:** 2026-09-08 (Round 4 — closeout verification pass)
**Scope:** `src/index.html`, `src/styles.css`, `src/server.js`, `tests/smoke.js`, `package.json`, `README.md`
**Method:** Static code review of all files (full reads, not excerpts), plus live HTTP testing against a QA-owned server instance on **`PORT=3400`**, plus repeated runs of the project's own `npm test` smoke suite (self-contained on port 3500). The team lead's instance on port 3001 was checked for existence only (`lsof`) and never queried or touched.
**No headless browser is available in this environment** (no Puppeteer/Playwright/jsdom, no screenshot tool). Anything requiring rendered pixels or literal keyboard-event simulation in a browser is marked **UNTESTABLE** — verified only by deterministic DOM/CSS/JS tracing, not observed.

---

## Summary

| Result | Count |
|---|---|
| PASS | 23 |
| WARN | 0 |
| FAIL | 0 |
| UNTESTABLE | 1 |
| **Total checks this round** | **24** |

**Overall verdict: PASS, no open bugs.** All three bugs raised across this QA cycle (mobile-nav tab order, fallback/API content drift, and the EADDRINUSE false-success log line) are now closed, each verified independently rather than taken on the reporting team's word. The resize-focus edge case flagged as a minor residual note last round is also fixed. `npm test` is 22/22 (three new regression assertions guard the EADDRINUSE fix specifically). Response bodies remain byte-identical to earlier rounds. One item stays **UNTESTABLE**, honestly: the `EACCES` path shares the same fixed listener wiring as `EADDRINUSE` (verified structurally), but it has never been triggered by a real OS-level permission error in this environment, so that generalization is not being credited as independently confirmed.

---

## Bugs — final status

### 1. Mobile nav forward-tab-order — **CLOSED** (closed round 3, re-confirmed)
`openMenu()` moves focus to the first nav link on open (`src/index.html:300-309`); Tab now flows Product → Pricing → Contact → "Talk to sales" → toggle, matching keyboard-user expectations. No change since round 3.

### 2. Fallback markup drifted from live API data — **CLOSED** (closed round 3, re-confirmed)
Feature titles/descriptions and pricing names/prices/periods/CTAs/bullets in the static fallback markup match the live API verbatim. The `STATIC_TIER_DESCRIPTIONS` map covering the API's missing tier-tagline field is confirmed correct. No change since round 3.

### 3. EADDRINUSE handling printed a false "listening" success line — **CLOSED, verified fixed this round**

**Root cause (per Backend-Dev, confirmed against the actual installed dependency, not just the claim):** `node_modules/express/lib/application.js:598` shows `app.listen`'s callback argument gets wired as *both* Node's `'listening'` listener and a `server.once('error', done)` listener:
```js
app.listen = function listen() {
  var server = http.createServer(this)
  var args = slice.call(arguments)
  if (typeof args[args.length - 1] === 'function') {
    var done = args[args.length - 1] = once(args[args.length - 1])
    server.once('error', done)
  }
  return server.listen.apply(server, args)
}
```
I read this file directly at that path/line — it's real, not a paraphrase. So the old code's `app.listen(PORT, () => console.log('listening...'))` fired that same success-logging callback on a failed bind too, because Express had quietly registered it as an error listener as well. Not a race condition, not dual-stack binding — a one-line structural cause.

**Fix:** `src/server.js:195-225` no longer passes a callback to `app.listen`; it attaches `'listening'` and `'error'` as separate, independent listeners on the returned server:
```js
const server = app.listen(PORT);
server.on('listening', () => { console.log(`NeuralFlow API listening at http://localhost:${PORT}`); });
server.on('error', (err) => { /* EADDRINUSE / EACCES / generic handling, unchanged */ });
```

**Verification (live, not just code review):** started a server on `PORT=3400`, then attempted a second bind on the same port **3 times in a row**, each attempt's output isolated to its own log file:
```
exit code: 1
[startup] Port 3400 is already in use by another process.
[startup] Stop whatever is using it, or run on a different port: PORT=xxxx npm start
```
No "listening" line appears in any of the three failing attempts' output, and the first server's own log stayed untouched (still a single "listening" line) across all three attempts — confirms the fix works and that these are genuinely independent processes, not a repeat of the earlier log-commingling I ruled out last round. **Confirmed resolved.**

`tests/smoke.js` now also asserts this directly (three new checks, all passing — see `npm test` results below): no false "listening" line before the failure, the port-in-use error is reported, and the process exits non-zero.

**What remains unverified — `EACCES`:** the fix applies the same separated-listener structure to both the `EADDRINUSE` and `EACCES` branches (`src/server.js:206-221`), so the specific bug (a callback double-wired as both success and error handler) is structurally gone for both. But I have not personally triggered a real `EACCES` — this environment permits binding to low ports without elevated privileges, so there's no way to force one here. Recording this precisely: **the code fix is structurally verified for EACCES; the runtime behavior under a genuine EACCES has not been independently observed by QA in any round.** Marked **UNTESTABLE**, not PASS — the generalization from EADDRINUSE to EACCES is reasonable but not something I watched happen.

---

## Resize-focus edge case — **CLOSED, verified fixed**

**Original note (round 3):** if a keyboard user opened the mobile nav, focused a link inside it, then resized the viewport back above 760px, `closeMenu()` fired with no focus restoration, dropping focus to `<body>`.

**Fix:** `src/index.html:327-340`:
```js
window.addEventListener("resize", function () {
  if (window.innerWidth <= 760) return;
  var focusWasInPanel = links.contains(document.activeElement);
  closeMenu();
  if (!focusWasInPanel) return;
  var fallbackTarget = (toggle.offsetParent !== null) ? toggle : document.querySelector(".wordmark");
  if (fallbackTarget) fallbackTarget.focus();
});
```

**Verification (code trace):**
- **Menu never opened, window resized:** `document.activeElement` is not inside `#nav-links` (it's `<body>` or whatever else had focus), so `focusWasInPanel` is `false`. `closeMenu()` runs (harmless no-op if already closed) and the function returns *before* touching focus. **Confirmed: does not steal focus from someone who never opened the menu** — this was explicitly the case the team lead asked me to check, and it holds.
- **Menu open, focus on a link inside it, resized past 760px:** `focusWasInPanel` is `true`. After `closeMenu()`, `.nav-toggle` is `display:none` above the breakpoint (media query at `src/styles.css:654`), so `toggle.offsetParent` is `null` → falls back to `.wordmark`, which is unconditionally visible and focusable. Focus lands somewhere sensible and visible instead of being silently dropped. **Confirmed resolved.**
- The `window.innerWidth <= 760` early-return correctly mirrors the CSS breakpoint (`@media (max-width: 760px)`), so the two stay in sync.

---

## Other round-4 checks

| Check | Result | Evidence |
|---|---|---|
| `npm test` (full smoke suite) | **PASS** | **22/22** — the original 19 plus three new EADDRINUSE regression assertions ("no false listening line before the failure", "reports the port-in-use error", "exits non-zero"), all passing. |
| Core routes / negative-path suite (spot re-check, not a full re-run since nothing in this diff touches these paths) | **PASS** | `GET /`, `/styles.css` (200), `/server.js` (404), `/api/health`, `/api/features` (200), `/api/pricing` (200), valid contact POST (200 `{"ok":true,...}`), malformed-JSON POST (400 `{"ok":false,"error":"Malformed JSON in request body."}`) — all re-checked live on 3400, unchanged from prior rounds. |
| Server survives repeated failed-bind attempts | **PASS** | The first server instance stayed healthy and unaffected (confirmed via its unchanged log and a working health check) across three separate failed second-bind attempts. |
| Port hygiene | **PASS / FYI** | QA's own ports (3400, 3500) confirmed clean after testing. Port 3001 confirmed to exist (presence check only, never queried). Noticed one stray leftover process not mentioned in the team lead's cleanup note: `node -e require('net').createServer().listen(3610)` (PID 32633 at time of writing) is still running — likely left over from the team lead's own EADDRINUSE repro on port 3610, distinct from the 3599/3601-3603 holders already mentioned as cleaned up. Not a code bug, not touched by QA (not ours to kill), flagging for the team lead's own cleanup. |

---

## Untestable items

- **`EACCES` runtime behavior.** See the detailed note under bug #3 above — the fix is structurally verified (same corrected listener wiring as the confirmed-fixed `EADDRINUSE` path), but no real `EACCES` has been triggered and observed in this environment. Recorded as UNTESTABLE rather than PASS to avoid crediting an inference as an observation.
- **Rendered layout, real keyboard/focus behavior, and screen-reader announcements in an actual browser.** No headless browser (Puppeteer/Playwright/jsdom) is installed or available at any point across this QA cycle. All DOM/focus-order/ARIA findings in this report and its predecessors are verified by deterministic code tracing, not by observing a real browser or assistive technology.

---

## Live evidence (round 4, `PORT=3400` / `PORT=3500`)

```
GET /                → 200, text/html
GET /styles.css       → 200, text/css
GET /server.js        → 404
GET /api/health        → 200 {"status":"ok"}
GET /api/features      → 200
GET /api/pricing       → 200
POST /api/contact (valid)          → 200 {"ok":true,...}
POST /api/contact (malformed JSON) → 400 {"ok":false,"error":"Malformed JSON in request body."}

EADDRINUSE repro (3x, PORT=3400, second bind against an already-running first instance):
  attempt 1: exit 1, only the port-in-use message, no false "listening" line
  attempt 2: exit 1, only the port-in-use message, no false "listening" line
  attempt 3: exit 1, only the port-in-use message, no false "listening" line
  first instance's own log: unchanged (single "listening" line) across all three attempts

npm test → PASS 22 / FAIL 0
```

Both QA server instances (3400, and `npm test`'s self-managed 3500) were killed/exited cleanly after testing. Port 3001 was never queried or touched.
