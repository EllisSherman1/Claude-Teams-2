// Plain-Node smoke test for the NeuralFlow API server.
// Boots src/server.js as a child process on a scratch port, hits it with
// real HTTP requests, and asserts on status/content-type/body shape.
// No test framework, no new dependencies.

'use strict';

const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3500;
const EADDRINUSE_PORT = 3501;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_PATH = path.join(__dirname, '..', 'src', 'server.js');

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`PASS - ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail });
    console.log(`FAIL - ${name}${detail ? ` (${detail})` : ''}`);
  }
}

function request(method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(body, 'utf8');
    const req = http.request(
      `${BASE_URL}${urlPath}`,
      {
        method,
        headers: {
          ...(payload ? { 'Content-Length': payload.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json;
          try {
            json = JSON.parse(text);
          } catch (e) {
            json = undefined;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForServer(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Server did not start listening within ${timeoutMs}ms`));
    }, timeoutMs);

    function onData(chunk) {
      const text = chunk.toString('utf8');
      process.stdout.write(`[server] ${text}`);
      if (settled) return;
      if (text.includes('listening at')) {
        settled = true;
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[server:err] ${chunk.toString('utf8')}`);
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Server process exited early with code ${code}`));
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runChecks() {
  // GET /
  {
    const res = await request('GET', '/');
    record('GET / returns 200', res.status === 200, `got ${res.status}`);
    record(
      'GET / content-type is text/html',
      typeof res.headers['content-type'] === 'string' &&
        res.headers['content-type'].includes('text/html'),
      `got ${res.headers['content-type']}`
    );
  }

  // GET /styles.css
  {
    const res = await request('GET', '/styles.css');
    record('GET /styles.css returns 200', res.status === 200, `got ${res.status}`);
    record(
      'GET /styles.css content-type is text/css',
      typeof res.headers['content-type'] === 'string' &&
        res.headers['content-type'].includes('text/css'),
      `got ${res.headers['content-type']}`
    );
  }

  // GET /server.js should NOT be exposed
  {
    const res = await request('GET', '/server.js');
    record('GET /server.js returns 404', res.status === 404, `got ${res.status}`);
  }

  // GET /api/features
  {
    const res = await request('GET', '/api/features');
    record('GET /api/features returns 200', res.status === 200, `got ${res.status}`);
    const arr = Array.isArray(res.json) ? res.json : [];
    record('GET /api/features returns exactly 3 items', arr.length === 3, `got ${arr.length}`);
    const shapeOk =
      arr.length === 3 &&
      arr.every(
        (item) =>
          item &&
          typeof item.id !== 'undefined' &&
          typeof item.title === 'string' &&
          typeof item.description === 'string'
      );
    record('GET /api/features items have id/title/description', shapeOk);
  }

  // GET /api/pricing
  {
    const res = await request('GET', '/api/pricing');
    record('GET /api/pricing returns 200', res.status === 200, `got ${res.status}`);
    const arr = Array.isArray(res.json) ? res.json : [];
    record('GET /api/pricing returns exactly 3 tiers', arr.length === 3, `got ${arr.length}`);
    const shapeOk =
      arr.length === 3 &&
      arr.every(
        (tier) =>
          tier &&
          typeof tier.name === 'string' &&
          typeof tier.price === 'string' &&
          Array.isArray(tier.features)
      );
    record('GET /api/pricing tiers have name/price/features', shapeOk);
    const highlightedCount = arr.filter((tier) => tier && tier.highlighted === true).length;
    record(
      'GET /api/pricing has exactly one highlighted tier',
      highlightedCount === 1,
      `got ${highlightedCount}`
    );
  }

  // POST /api/contact - valid
  {
    const res = await request('POST', '/api/contact', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QA Bot',
        email: 'qa@example.com',
        message: 'Hello from the smoke test',
      }),
    });
    record('POST /api/contact (valid) returns 200', res.status === 200, `got ${res.status}`);
    record(
      'POST /api/contact (valid) returns {ok:true}',
      !!res.json && res.json.ok === true,
      `got ${res.text}`
    );
  }

  // POST /api/contact - missing field
  {
    const res = await request('POST', '/api/contact', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Bot', message: 'no email' }),
    });
    record(
      'POST /api/contact (missing field) returns 400',
      res.status === 400,
      `got ${res.status}`
    );
  }

  // POST /api/contact - malformed JSON
  {
    const res = await request('POST', '/api/contact', {
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    record(
      'POST /api/contact (malformed JSON) returns 400',
      res.status === 400,
      `got ${res.status}`
    );
    const mentionsJson =
      !!res.json && typeof res.json.error === 'string' && /json/i.test(res.json.error);
    record(
      'POST /api/contact (malformed JSON) error message mentions JSON',
      mentionsJson,
      `got ${res.text}`
    );
  }

  // GET /api/nope - unknown API route
  {
    const res = await request('GET', '/api/nope');
    record('GET /api/nope returns 404', res.status === 404, `got ${res.status}`);
    record(
      'GET /api/nope returns JSON body',
      typeof res.json === 'object' && res.json !== null,
      `got ${res.text}`
    );
  }
}

// Regression guard for a real bug found in review: Express's app.listen(port, cb)
// wires `cb` as BOTH the 'listening' listener AND an 'error' listener (see
// node_modules/express/lib/application.js), so a callback meant to announce
// success would also fire - and log a false success line - on a failed bind,
// before the real error is reported. Occupy a scratch port first, then boot
// the server on it and check it reports failure only, never false success.
function runEaddrInUseCheck() {
  return new Promise((resolve, reject) => {
    const holder = net.createServer();
    holder.on('error', (err) => reject(new Error(`holder failed to bind: ${err.message}`)));
    holder.listen(EADDRINUSE_PORT, () => {
      const child = spawn(process.execPath, [SERVER_PATH], {
        env: { ...process.env, PORT: String(EADDRINUSE_PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });

      const timer = setTimeout(() => {
        child.kill();
        holder.close();
        reject(new Error('server did not exit after EADDRINUSE within 5000ms'));
      }, 5000);

      child.on('exit', (code) => {
        clearTimeout(timer);
        holder.close();

        record(
          'EADDRINUSE: no false "listening" line before the failure',
          !output.includes('listening at'),
          `output was: ${output.trim()}`
        );
        record(
          'EADDRINUSE: reports the port-in-use error',
          output.includes('already in use'),
          `output was: ${output.trim()}`
        );
        record('EADDRINUSE: exits non-zero', code !== 0, `got exit code ${code}`);

        resolve();
      });
    });
  });
}

async function main() {
  const child = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child, 10000);
    await runChecks();
  } catch (err) {
    failed += 1;
    failures.push({ name: 'test run', detail: err.message });
    console.log(`FAIL - test run (${err.message})`);
  } finally {
    child.kill();
  }

  try {
    await runEaddrInUseCheck();
  } catch (err) {
    failed += 1;
    failures.push({ name: 'EADDRINUSE check', detail: err.message });
    console.log(`FAIL - EADDRINUSE check (${err.message})`);
  }

  console.log('');
  console.log(`PASS ${passed} / FAIL ${failed}`);
  if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`));
    process.exit(1);
  }
  process.exit(0);
}

main();
