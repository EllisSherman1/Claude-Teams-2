// NeuralFlow API server
// Serves the marketing site's static assets (index.html / styles.css, owned by Frontend Dev)
// and the JSON API consumed by the frontend.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ---------------------------------------------------------------------------
// Static assets (index.html + styles.css live in src/, owned by Frontend Dev)
// ---------------------------------------------------------------------------
// express.static(__dirname) would otherwise serve this file (server.js) too,
// since it lives alongside index.html/styles.css. Allowlist the file types
// the frontend is actually built from before handing the request to static,
// so anything else (e.g. GET /server.js) falls through to the normal 404.
const STATIC_EXTENSION_ALLOWLIST = new Set(['.html', '.css']);
const serveStaticAssets = express.static(path.join(__dirname));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const ext = path.extname(req.path).toLowerCase();
  const isAllowed = req.path === '/' || STATIC_EXTENSION_ALLOWLIST.has(ext);
  if (!isAllowed) return next();
  return serveStaticAssets(req, res, next);
});

// Explicit safeguard route for "/" in case static index resolution ever changes.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/features', (req, res) => {
  const features = [
    {
      id: 1,
      title: 'Adaptive Model Routing',
      description:
        'NeuralFlow automatically routes each request to the best-fit model, balancing speed, cost, and quality in real time.',
      icon: '🧠',
    },
    {
      id: 2,
      title: 'Real-Time Data Pipelines',
      description:
        'Stream, transform, and enrich your data on the fly so your AI features always work with fresh, accurate context.',
      icon: '⚡',
    },
    {
      id: 3,
      title: 'Enterprise-Grade Security',
      description:
        'End-to-end encryption, role-based access control, and full audit logs keep your models and data locked down.',
      icon: '🔒',
    },
  ];

  res.json(features);
});

app.get('/api/pricing', (req, res) => {
  const tiers = [
    {
      id: 1,
      name: 'Starter',
      price: '$0',
      period: 'month',
      features: [
        'Up to 1,000 API calls/month',
        'Community support',
        '1 project workspace',
      ],
      cta: 'Get Started',
      highlighted: false,
    },
    {
      id: 2,
      name: 'Pro',
      price: '$49',
      period: 'month',
      features: [
        'Up to 100,000 API calls/month',
        'Priority email support',
        'Unlimited project workspaces',
        'Advanced analytics dashboard',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      id: 3,
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact us',
      features: [
        'Unlimited API calls',
        'Dedicated support & SLA',
        'Custom model fine-tuning',
        'Single sign-on (SSO)',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  res.json(tiers);
});

app.post('/api/contact', (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  const missing = [];
  if (!name) missing.push('name');
  if (!email) missing.push('email');
  if (!message) missing.push('message');

  if (missing.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Missing or empty required field(s): ${missing.join(', ')}`,
    });
  }

  // Basic email sanity check (not full RFC 5322 validation).
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({
      ok: false,
      error: 'Please provide a valid email address.',
    });
  }

  const timestamp = new Date().toISOString();
  console.log(`[contact] ${timestamp} - ${name} <${email}>: ${message}`);

  res.json({
    ok: true,
    message: 'Thanks for reaching out! We will get back to you soon.',
    submittedAt: timestamp,
  });
});

// ---------------------------------------------------------------------------
// 404 handler for unmatched /api/* routes
// ---------------------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: `Not found: ${req.method} ${req.originalUrl}` });
});

// ---------------------------------------------------------------------------
// Error-handling middleware
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.type === 'entity.parse.failed' ? 400 : err.status || 500;

  // Full stack traces are for server-side faults (5xx). A malformed request
  // body is a client error, not a server fault, and shouldn't bury real
  // 5xx stack traces under routine noise.
  if (status >= 500) {
    console.error('[error]', err);
  } else {
    console.error(
      `[error] ${req.method} ${req.originalUrl} -> ${status}: ${err.message || err.type || 'bad request'}`
    );
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      ok: false,
      error: 'Malformed JSON in request body.',
    });
  }

  res.status(err.status || 500).json({
    ok: false,
    error: 'Internal server error',
  });
});

// Deliberately not passing a callback into app.listen(): Express's app.listen
// wires whatever callback you give it as BOTH the 'listening' listener AND a
// 'error' listener (see node_modules/express/lib/application.js), so a
// callback meant to announce success would also fire - and log success - on
// a failed bind. Listening for 'listening'/'error' separately avoids that.
const server = app.listen(PORT);

server.on('listening', () => {
  console.log(`NeuralFlow API listening at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[startup] Port ${PORT} is already in use by another process.\n` +
        `[startup] Stop whatever is using it, or run on a different port: PORT=xxxx npm start`
    );
    process.exit(1);
  }

  if (err.code === 'EACCES') {
    console.error(
      `[startup] Permission denied to bind port ${PORT}.\n` +
        `[startup] Try a port above 1024, e.g.: PORT=3001 npm start`
    );
    process.exit(1);
  }

  console.error('[startup] Failed to start server:', err);
  process.exit(1);
});

module.exports = server;
