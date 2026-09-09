# NeuralFlow — QA Test Plan

**Author:** QA
**Phase:** Written before Frontend-Dev / Backend-Dev code exists, based on the agreed contract below. **Amended for Round 2** (see §8) to cover the specific fixes Frontend-Dev/Backend-Dev are making to the 5 open WARN bugs from `tests/report.md` v1.
**Status legend used later in `report.md`:** PASS / FAIL / WARN / UNTESTABLE

## Agreed contract (given to both teammates)

- `GET /api/features` → returns 3 AI feature objects (JSON array/shape TBD by Backend-Dev, but must be 3 items).
- `GET /api/pricing` → returns 3 tier objects.
- `POST /api/contact` → accepts JSON body `{name, email, message}`, logs it server-side, returns a JSON response.
- Server serves `src/index.html` as the static site at `/`, listening on port **3000** by default.
- Frontend (`src/index.html`, `src/styles.css`) is expected to fetch `/api/features` and `/api/pricing` on load (or on demand) and hydrate the DOM, and to POST to `/api/contact` from a contact form.

Numbering: `<Area prefix>-<n>`. Each item states the **Check** and the **Expected result**.

---

## 1. Frontend structure (FE-S)

1. **FE-S-1** — Check: `src/index.html` exists and is well-formed HTML5 (`<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`). Expected: valid document, no unclosed tags.
2. **FE-S-2** — Check: page has a `<title>` and meta viewport tag. Expected: present, non-empty title relevant to "NeuralFlow".
3. **FE-S-3** — Check: `src/styles.css` is linked from `index.html` via `<link rel="stylesheet" href="...">`. Expected: href resolves to a path the server actually serves (see Static Serving section).
4. **FE-S-4** — Check: page contains distinct sections for hero/intro, features, pricing, and contact form. Expected: each section present with a recognizable heading.
5. **FE-S-5** — Check: contact form has inputs matching the contract fields (`name`, `email`, `message`) — via `name=`/`id=` attributes. Expected: exactly the 3 fields (or a superset that still maps cleanly), a submit button, and `email` input uses `type="email"` (or equivalent validation).
6. **FE-S-6** — Check: containers/elements the hydration JS will target (e.g. `#features-list`, `#pricing-list`, or similar) exist in the markup. Expected: every `document.getElementById` / `querySelector` target used in inline/linked JS has a matching element in the HTML.
7. **FE-S-7** — Check: no obviously dead/placeholder links (`href="#"` used only as JS hook is fine; `href=""` or broken relative paths are not). Expected: nav links resolve to in-page anchors or valid routes.

## 2. Frontend styling / responsiveness (FE-R)

8. **FE-R-1** — Check: `styles.css` parses without syntax errors (balanced braces, no obviously malformed rules). Expected: clean CSS, verifiable by reading/linting.
9. **FE-R-2** — Check: presence of a responsive strategy — `@media` queries and/or flexible units (`%`, `rem`, `vw`, `flex`, `grid`) rather than fixed-px-only layout. Expected: at least one `@media` breakpoint for mobile (<768px typical).
10. **FE-R-3** — Check: color contrast of primary text/background pairs (read hex/rgb values from CSS, compute or estimate contrast ratio). Expected: body text vs. background meets a reasonable contrast (~4.5:1 for normal text) — **best-effort static check**, not a rendered-pixel measurement.
11. **FE-R-4** — Check: interactive elements (buttons, links, inputs) have visible `:hover`/`:focus` states defined. Expected: at least basic focus/hover styling exists (accessibility).
12. **FE-R-5** — Check: actual rendered visual layout in a browser viewport. Expected/Note: **UNTESTABLE in this terminal-only environment** — no headless browser/screenshot tool specified in scope. Will be marked UNTESTABLE, not PASS, unless a way to render is available.

## 3. Frontend ↔ API integration (FE-I)

13. **FE-I-1** — Check: JS fetch call for features uses path `/api/features` (exact match, no typos, correct leading slash). Expected: matches server route exactly.
14. **FE-I-2** — Check: JS fetch call for pricing uses path `/api/pricing`. Expected: matches server route exactly.
15. **FE-I-3** — Check: contact form submit handler calls `fetch('/api/contact', {method: 'POST', ...})` with `Content-Type: application/json` header and `JSON.stringify(...)` body containing `name`, `email`, `message` keys — field names must match exactly what backend expects (case-sensitive). Expected: field names identical on both sides.
16. **FE-I-4** — Check: form submit handler calls `event.preventDefault()` (or equivalent) to stop default form submission/page reload. Expected: present; otherwise the fetch would race a full page navigation.
17. **FE-I-5** — Check: JS handles the fetch response (`.then`/`await`) and renders returned data into the DOM elements identified in FE-S-6, using field names that match the actual JSON shape returned by the backend (e.g. `feature.title` vs `feature.name`). Expected: field names align; mismatches are logged as bugs.
18. **FE-I-6** — Check: JS has error handling (`.catch` or try/catch) for failed fetches (network error, non-2xx). Expected: some fallback/error UI or console handling, not an unhandled promise rejection.
19. **FE-I-7** — Check: after successful contact POST, UI gives user feedback (success message) rather than silently doing nothing. Expected: visible confirmation.

## 4. Backend endpoints (BE-E)

20. **BE-E-1** — Check: `GET /api/features` returns HTTP 200, `Content-Type: application/json`, and a JSON array of exactly 3 objects. Expected: status 200, 3 items, each a plausible "feature" shape (e.g. title/description).
21. **BE-E-2** — Check: `GET /api/pricing` returns HTTP 200, `Content-Type: application/json`, JSON array of exactly 3 tier objects. Expected: status 200, 3 items, each with name/price-ish fields.
22. **BE-E-3** — Check: `POST /api/contact` with a valid `{name, email, message}` JSON body returns a success status (200/201) and a JSON response. Expected: success response; contact data is logged server-side (checked via server stdout).
23. **BE-E-4** — Check: server listens on port 3000 by default (or `process.env.PORT` fallback to 3000). Expected: confirmed by reading server startup code and (for QA's own run) overriding via `PORT` env var.
24. **BE-E-5** — Check: `GET /` serves `src/index.html` with `Content-Type: text/html`. Expected: status 200, HTML content containing expected markup.
25. **BE-E-6** — Check: unknown routes generally, not just `/api/*`. Expected: sane 404 behavior, no server crash.

## 5. Backend validation / error handling (BE-V)

26. **BE-V-1** — Check: `POST /api/contact` with a missing required field (e.g. no `email`) is rejected. Expected: HTTP 400 with a JSON error message, not a 500 crash or silent 200.
27. **BE-V-2** — Check: `POST /api/contact` with malformed JSON body (broken syntax). Expected: HTTP 400, server does not crash (no unhandled exception / stack trace leak, process stays alive).
28. **BE-V-3** — Check: `POST /api/contact` with an empty body / wrong `Content-Type` (e.g. `text/plain`). Expected: graceful 400/415, not a crash.
29. **BE-V-4** — Check: `express.json()` (or equivalent body parser) is registered as middleware before the `/api/contact` route. Expected: present in `src/server.js`; absence would make `req.body` undefined and is a bug.
30. **BE-V-5** — Check: basic email format validation on `POST /api/contact` (optional but good practice). Expected: WARN (not FAIL) if absent, since not explicitly in the contract — but note as an improvement.
31. **BE-V-6** — Check: GET requests to `/api/contact` (wrong method). Expected: 404 or 405, not a crash, not treated as a valid contact submission.

## 6. Static serving (SS)

32. **SS-1** — Check: `GET /styles.css` (or whatever path `index.html` actually links) returns HTTP 200 with `Content-Type: text/css`. Expected: matches the `<link href>` in FE-S-3 exactly — this is the primary place a frontend/backend path mismatch bug would show up.
33. **SS-2** — Check: static file serving does not expose the whole project (e.g. `/package.json`, `/server.js`, `/../` traversal) beyond `src/`. Expected: sensitive files not served; directory traversal blocked. WARN if broad `express.static('.')` on repo root is used.
34. **SS-3** — Check: any additional static assets referenced by `index.html` (images, fonts, JS files) actually exist and are served with correct MIME types. Expected: no 404s for linked assets.

## 7. Cross-cutting / integration (XC)

35. **XC-1** — Check: `package.json` declares `express` as a dependency, a `start` script (`node src/server.js` or similar), and correct `main`/entry point. Expected: `npm start` (or documented command) actually boots the server.
36. **XC-2** — Check: `README.md` accurately documents how to install (`npm install`), run (`npm start`/`node src/server.js`), the port used, and the API endpoints/contract. Expected: instructions match actual behavior verified in this plan.
37. **XC-3** — Check: end-to-end flow — boot server, load `/`, confirm page fetches features/pricing successfully and a contact POST succeeds — using `curl` since no browser is available. Expected: full request chain works with real HTTP calls, not just code inspection.
38. **XC-4** — Check: server does not crash or hang under any of the malformed-input tests above (BE-V-1..3) — verified by confirming the background process is still alive/responsive after each. Expected: process survives all negative tests.
39. **XC-5** — Check: consistent field naming across the whole stack for the contact form (`name`/`email`/`message`) — cross-reference FE-I-3, FE-S-5, BE-E-3, BE-V-1. Expected: single source of truth, no silent renames (e.g. frontend sends `full_name`, backend expects `name`).
40. **XC-6** — Check: no secrets/credentials committed (`.env`, API keys) in any of the new files. Expected: none found.

---

## 8. Round 2 revision checks (R2)

Context: this round moves the default port 3000 → 3001, and targets the 5 open bugs from report v1 (#3 contrast, #4 source exposure, #5 error message, #6 mobile nav) plus README accuracy. Existing checks above (BE-E-4, SS-1, SS-2, BE-V-2, FE-R-2/3, XC-2) are **re-run against the new code**, not replaced — these new R2 items are additive, more specific versions targeting the exact regressions/fixes in flight. QA's own scratch instance for this round uses **`PORT=3400`** (not 3111/3112 as in round 1) to avoid clashing with the team lead's now-3001 instance.

41. **R2-1** — Check: server default port is 3001 (was 3000). Expected: `src/server.js`'s `PORT` fallback reads `process.env.PORT || 3001`; site loads at `http://localhost:3001/` with no `PORT` env var set. Supersedes/updates BE-E-4.
42. **R2-2** — Check: `GET /server.js` no longer serves backend source. Expected: HTTP 404 (or equivalent — not 200, not the file's contents). Fixes bug #4 (SS-2 WARN).
43. **R2-3** — Check: `GET /styles.css` still works after whatever static-root change fixed R2-2. Expected: HTTP 200, `Content-Type: text/css`, same content as before — i.e. the fix for R2-2 didn't collaterally break legitimate static assets. Re-run of SS-1 as a regression guard.
44. **R2-4** — Check: malformed-JSON POST to `/api/contact` (`-d '{bad json'`) returns a client-facing message that says something like "malformed JSON" / "invalid JSON" / "bad request body", not "Internal server error". Expected: HTTP 400 (unchanged) with corrected message text. Fixes bug #5.
45. **R2-5** — Check: WCAG AA contrast for `--mist-dim` (or whatever variable/color now services small text) against **both** `--ink-950` and `--ind-850` (the two backgrounds it's used on per report v1 finding #3: `.hero-meta`/`.logos-label`/`.footer-copy`/`.contact-facts dt` on `--ink-950`, `.price-period` on `--ink-850`). Expected: ≥ 4.5:1 on both, computed via sRGB relative luminance from the actual hex values in `styles.css`, not estimated. QA computes this independently rather than trusting Frontend-Dev's claim. Fixes bug #3.
46. **R2-6** — Check: a working mobile nav exists below the 760px breakpoint — i.e. `.nav-links { display: none; }` alone (bug #6) has been replaced by an actual toggle/hamburger mechanism. Expected: (a) some control (button) is present and visible at ≤760px that reveals the nav links; (b) that control is keyboard-operable (a real `<button>`, not a bare `<div>` with only a click handler) and has an accessible name (`aria-label` or visible text) — not just a CSS-only checkbox hack with no label; (c) nav links remain reachable by keyboard/screen reader when the panel is open (not `display:none`'d away entirely with no alternative). WARN, not FAIL, if the toggle works but lacks `aria-expanded`/`aria-controls` (nice-to-have, not contractually required). Fixes bug #6.
47. **R2-7** — Check: `README.md` says port 3001 everywhere it mentions a port (default port line, example URLs, `PORT=` override examples). Expected: no leftover `3000` references; consistent with actual server behavior (R2-1).
48. **R2-8** — Check (regression guard): previously-closed bugs (missing HTML skeleton, pricing `highlighted` field mismatch) have not regressed during this round's edits. Expected: `<!DOCTYPE html>`/`<html>`/`<head>`/`<body>` still present; `hydratePricing` still reads `item.highlighted` and matches live `/api/pricing` payload.
49. **R2-9** — Check (regression guard): all previously-PASSing BE-V/BE-E/FE-I checks still pass unchanged (email validation, required-field 400s, wrong-method 404, contact success flow, features/pricing hydration). Expected: no new regressions introduced by the port change or static-root restructuring.

---

## Draft curl commands (round 1, historical — used ports 3111/3112)

```bash
# Start server on non-default port to avoid clashing with team lead
PORT=3111 node src/server.js &

# Basic endpoint checks
curl -i http://localhost:3111/
curl -i http://localhost:3111/styles.css
curl -i http://localhost:3111/api/features
curl -i http://localhost:3111/api/pricing
curl -i http://localhost:3111/api/nope        # unknown API route

# Valid contact POST
curl -i -X POST http://localhost:3111/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"QA Bot","email":"qa@example.com","message":"Hello from QA"}'

# Missing field
curl -i -X POST http://localhost:3111/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"QA Bot","message":"no email"}'

# Malformed JSON
curl -i -X POST http://localhost:3111/api/contact \
  -H "Content-Type: application/json" \
  -d '{bad json'

# Wrong content-type
curl -i -X POST http://localhost:3111/api/contact \
  -H "Content-Type: text/plain" \
  -d 'name=x&email=y&message=z'

# Wrong method
curl -i http://localhost:3111/api/contact
```

## Draft curl commands (round 2 — use PORT=3400; never touch 3001, the team lead's port)

```bash
PORT=3400 node src/server.js &

# R2-1: default port / boot check
curl -i http://localhost:3400/

# R2-2 / R2-3: static-root fix didn't break styles.css, did block server.js
curl -i http://localhost:3400/server.js       # expect 404
curl -i http://localhost:3400/styles.css      # expect 200, text/css

# R2-4: malformed JSON error message
curl -i -X POST http://localhost:3400/api/contact \
  -H "Content-Type: application/json" \
  -d '{bad json'

# Regression guards (R2-8/R2-9): re-run round-1 suite against 3400
curl -i http://localhost:3400/api/features
curl -i http://localhost:3400/api/pricing
curl -i -X POST http://localhost:3400/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"QA Bot","email":"qa@example.com","message":"Hello from QA"}'
curl -i -X POST http://localhost:3400/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"QA Bot","message":"no email"}'
curl -i http://localhost:3400/api/contact     # wrong method, expect 404
```

## Notes

- Items FE-R-5 (real rendering) and any claim about pixel-perfect visual design will be marked **UNTESTABLE** in `tests/report.md` rather than PASS/FAIL — this environment has no browser/screenshot capability.
- Round 1: QA booted the server on `PORT=3111`/`3112` (not 3000). Round 2: QA boots on **`PORT=3400`** (not 3001, which is now the team lead's port) — never touch 3001. Server is killed after testing in both rounds.
- This plan is reviewed once code lands and amended only if the actual implementation reveals an item was mis-specified (e.g., different field/variable names than assumed) — such deviations become bugs, not silent plan edits. §8 (R2) was added when Frontend-Dev/Backend-Dev announced round 2 was in progress, before their code was reviewed.
