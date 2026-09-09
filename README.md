# NeuralFlow

NeuralFlow is a fictional AI startup that helps engineering teams ship AI-powered
features faster. Its platform provides adaptive model routing, real-time data
pipelines, and enterprise-grade security so product teams can plug AI into their
apps without building infrastructure from scratch.

This repository contains the NeuralFlow marketing site and its backing API: a
static landing page (`src/index.html`, `src/styles.css`) served by a small
Express.js server that also exposes JSON endpoints for the site's features,
pricing, and contact form.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)

## Install

```bash
npm install
```

## Run

```bash
npm start
```

This runs `node src/server.js`. By default the server listens on port `3001`;
set the `PORT` environment variable to override it:

```bash
PORT=4000 npm start
```

Once running, open [http://localhost:3001](http://localhost:3001) in a
browser to view the site, which is served from `src/index.html` /
`src/styles.css`.

## Test

```bash
npm test
```

Runs `tests/smoke.js`, a plain-Node smoke test (no test framework, no extra
dependencies). It boots the server as a child process on scratch port
`3500`, waits for it to start listening, then makes real HTTP requests to
verify:

- `GET /` serves the HTML page and `GET /styles.css` serves CSS (both `200`)
- `GET /server.js` is not exposed (`404`)
- `GET /api/features` returns exactly 3 items shaped `{ id, title, description }`
- `GET /api/pricing` returns exactly 3 tiers shaped `{ name, price, features }`, with exactly one `highlighted: true`
- `POST /api/contact` returns `200 { ok: true }` for a valid body, `400` for a missing field, and `400` with a JSON-related error message for malformed JSON
- `GET /api/nope` returns a JSON `404`

It kills the child process afterward, prints a `PASS n / FAIL n` summary,
and exits non-zero if any check fails.

## API Endpoints

| Method | Path             | Description                                              | Success Response                                                                 |
|--------|------------------|-----------------------------------------------------------|-----------------------------------------------------------------------------------|
| GET    | `/`              | Serves the NeuralFlow landing page (`src/index.html`).    | `200` – HTML page                                                                  |
| GET    | `/api/health`    | Health check.                                              | `200` – `{ "status": "ok" }`                                                       |
| GET    | `/api/features`  | List of AI feature highlights.                             | `200` – JSON array of feature objects                                             |
| GET    | `/api/pricing`   | List of pricing tiers.                                     | `200` – JSON array of tier objects                                                |
| POST   | `/api/contact`   | Submits a contact form message.                            | `200` – `{ "ok": true, "message": "...", "submittedAt": "..." }`                  |

Any unmatched route under `/api/*` returns a JSON `404`:

```json
{ "ok": false, "error": "Not found: GET /api/whatever" }
```

### `GET /api/health`

**Response `200`:**

```json
{ "status": "ok" }
```

### `GET /api/features`

Returns exactly 3 feature objects.

**Response `200`:**

```json
[
  {
    "id": 1,
    "title": "Adaptive Model Routing",
    "description": "NeuralFlow automatically routes each request to the best-fit model, balancing speed, cost, and quality in real time.",
    "icon": "🧠"
  },
  {
    "id": 2,
    "title": "Real-Time Data Pipelines",
    "description": "Stream, transform, and enrich your data on the fly so your AI features always work with fresh, accurate context.",
    "icon": "⚡"
  },
  {
    "id": 3,
    "title": "Enterprise-Grade Security",
    "description": "End-to-end encryption, role-based access control, and full audit logs keep your models and data locked down.",
    "icon": "🔒"
  }
]
```

### `GET /api/pricing`

Returns exactly 3 pricing tiers. The middle tier (`id: 2`, "Pro") has
`highlighted: true`.

**Response `200`:**

```json
[
  {
    "id": 1,
    "name": "Starter",
    "price": "$0",
    "period": "month",
    "features": ["Up to 1,000 API calls/month", "Community support", "1 project workspace"],
    "cta": "Get Started",
    "highlighted": false
  },
  {
    "id": 2,
    "name": "Pro",
    "price": "$49",
    "period": "month",
    "features": ["Up to 100,000 API calls/month", "Priority email support", "Unlimited project workspaces", "Advanced analytics dashboard"],
    "cta": "Start Free Trial",
    "highlighted": true
  },
  {
    "id": 3,
    "name": "Enterprise",
    "price": "Custom",
    "period": "contact us",
    "features": ["Unlimited API calls", "Dedicated support & SLA", "Custom model fine-tuning", "Single sign-on (SSO)"],
    "cta": "Contact Sales",
    "highlighted": false
  }
]
```

### `POST /api/contact`

Accepts a JSON body with `name`, `email`, and `message`, all required and
non-empty. `email` must also pass a basic sanity check (`something@something.tld`).
Every valid submission is logged to the server console with an ISO timestamp.

**Request body:**

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "message": "Interested in the Enterprise plan."
}
```

**Response `200`:**

```json
{
  "ok": true,
  "message": "Thanks for reaching out! We will get back to you soon.",
  "submittedAt": "2026-09-09T00:58:36.426Z"
}
```

**Response `400`** (missing/empty field):

```json
{
  "ok": false,
  "error": "Missing or empty required field(s): name, email, message"
}
```

**Response `400`** (invalid email):

```json
{
  "ok": false,
  "error": "Please provide a valid email address."
}
```

**Response `400`** (malformed JSON body):

```json
{
  "ok": false,
  "error": "Malformed JSON in request body."
}
```

**Example `curl`:**

```bash
curl -X POST http://localhost:3001/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","message":"Interested in the Enterprise plan."}'
```

## Project Structure

```
.
├── package.json
├── README.md
├── .gitignore
└── src/
    ├── server.js     # Express server + API routes (this doc's focus)
    ├── index.html    # Landing page markup (owned by Frontend Dev)
    └── styles.css    # Landing page styles (owned by Frontend Dev)
```
