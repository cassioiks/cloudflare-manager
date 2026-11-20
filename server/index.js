import { ROOT } from './env.js';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { CloudflareAPIError, CloudflareClient } from './cloudflare.js';
import { DATA_DIR, loadConfig, loadLog, saveConfig } from './store.js';
import { PublicIpError, Updater, getPublicIp } from './updater.js';

const PORT = Number(process.env.PORT) || 5480;
const HOST = process.env.HOST || '127.0.0.1';
const BASIC_AUTH = process.env.BASIC_AUTH || '';
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const STATIC_DIR = join(ROOT, 'dist');

const token = process.env.CF_API_TOKEN;
if (!token) {
  console.error('CF_API_TOKEN is not set. Copy .env.example to .env and paste your Cloudflare API token (see README).');
  process.exit(1);
}

const cf = new CloudflareClient(token);
const config = loadConfig();
const updater = new Updater({ cf, config });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- API routes

const formatRecord = (r, zoneId) => ({
  id: r.id,
  zone_id: zoneId,
  type: r.type,
  name: r.name,
  content: r.content,
  ttl: r.ttl,
  proxied: r.proxied ?? false,
  proxiable: r.proxiable ?? false,
});

function splitZoneId(body) {
  const { zone_id: zoneId, ...record } = body ?? {};
  if (!zoneId) throw new HttpError(400, 'zone_id is required');
  return { zoneId, record };
}

const routes = [
  ['GET', /^\/api\/zones$/, async () => {
    const zones = await cf.listZones();
    return zones.map(({ id, name, status }) => ({ id, name, status }));
  }],

  ['GET', /^\/api\/zones\/([^/]+)\/records$/, async ({ params: [zoneId], query }) => {
    const records = await cf.listRecords(zoneId, query.get('type') || undefined);
    return records.map((r) => formatRecord(r, zoneId));
  }],

  ['POST', /^\/api\/records$/, async (ctx) => {
    const { zoneId, record } = splitZoneId(ctx.body);
    ctx.status = 201;
    return formatRecord(await cf.createRecord(zoneId, record), zoneId);
  }],

  ['POST', /^\/api\/records\/bulk-update-ip$/, async ({ body }) => {
    const records = body?.records;
    if (!Array.isArray(records) || records.length === 0) {
      throw new HttpError(400, 'records array is required');
    }
    const ip = await getPublicIp({ fresh: true });
    const results = [];
    for (const rec of records) {
      try {
        await cf.updateRecord(rec.zone_id, rec.record_id, {
          type: 'A',
          name: rec.name,
          content: ip,
          ttl: rec.ttl ?? 120,
          proxied: rec.proxied ?? false,
        });
        results.push({ record_id: rec.record_id, name: rec.name, status: 'success' });
      } catch (err) {
        results.push({ record_id: rec.record_id, name: rec.name, status: 'error', error: err.message });
      }
    }
    // Keep auto-update state in sync so the UI doesn't report a stale mismatch.
    const updated = new Set(results.filter((r) => r.status === 'success').map((r) => r.record_id));
    const touched = config.managed_records.filter((m) => updated.has(m.record_id));
    if (touched.length > 0) {
      for (const m of touched) m.last_known_content = ip;
      saveConfig(config);
    }
    return { ip, results };
  }],

  ['PUT', /^\/api\/records\/([^/]+)$/, async ({ params: [recordId], body }) => {
    const { zoneId, record } = splitZoneId(body);
    return formatRecord(await cf.updateRecord(zoneId, recordId, record), zoneId);
  }],

  ['DELETE', /^\/api\/records\/([^/]+)$/, async ({ params: [recordId], body }) => {
    const { zoneId } = splitZoneId(body);
    await cf.deleteRecord(zoneId, recordId);
    return { success: true };
  }],

  ['GET', /^\/api\/ip$/, async () => ({ ip: await getPublicIp() })],

  ['GET', /^\/api\/status$/, async () => {
    const currentIp = await getPublicIp().catch(() => null);
    return {
      current_ip: currentIp,
      last_update: config.last_update,
      last_ip: config.last_ip,
      schedule: { ...config.schedule, next_run: updater.nextRun?.toISOString() ?? null },
      managed_records: config.managed_records.map((r) => ({
        record_id: r.record_id,
        zone_id: r.zone_id,
        name: r.name,
        proxied: r.proxied ?? false,
        last_known_content: r.last_known_content ?? null,
        ip_match: currentIp ? r.last_known_content === currentIp : null,
      })),
      recent_log: loadLog().slice(0, 20),
    };
  }],

  ['GET', /^\/api\/settings$/, async () => ({
    managed_records: config.managed_records,
    schedule: config.schedule,
    last_update: config.last_update,
    last_ip: config.last_ip,
  })],

  ['POST', /^\/api\/settings\/schedule$/, async ({ body }) => {
    const interval = body?.interval_minutes ?? 5;
    const enabled = Boolean(body?.enabled ?? true);
    if (!Number.isInteger(interval) || interval < 1 || interval > 1440) {
      throw new HttpError(400, 'interval_minutes must be between 1 and 1440');
    }
    config.schedule = { interval_minutes: interval, enabled };
    saveConfig(config);
    updater.schedule(config.schedule);
    return config.schedule;
  }],

  ['POST', /^\/api\/settings\/managed-records$/, async ({ body }) => {
    const records = body?.records ?? [];
    if (!Array.isArray(records) || !records.every((r) => r?.record_id && r.zone_id && r.name)) {
      throw new HttpError(400, 'Each record must have record_id, zone_id, and name');
    }
    const seen = new Set();
    const deduped = [];
    for (const r of records) {
      const key = `${r.zone_id}|${r.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        record_id: r.record_id,
        zone_id: r.zone_id,
        name: r.name,
        proxied: r.proxied ?? false,
        last_known_content: r.last_known_content ?? null,
      });
    }
    config.managed_records = deduped;
    saveConfig(config);
    return { managed_records: deduped };
  }],
];

// ---------------------------------------------------------------- HTTP plumbing

const BODY_METHODS = new Set(['POST', 'PUT', 'DELETE']);
const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  // Requiring application/json forces a CORS preflight for cross-site requests,
  // which this server never approves, so other websites can't change your DNS.
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (!type.startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

async function handleApi(req, res, url) {
  for (const [method, pattern, handler] of routes) {
    const match = url.pathname.match(pattern);
    if (!match || method !== req.method) continue;
    const ctx = {
      params: match.slice(1).map(decodeURIComponent),
      query: url.searchParams,
      body: BODY_METHODS.has(req.method) ? await readJsonBody(req) : undefined,
      status: 200,
    };
    const data = await handler(ctx);
    return sendJson(res, ctx.status, data);
  }
  throw new HttpError(404, 'Not found');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function serveStatic(req, res, pathname) {
  let file = resolve(STATIC_DIR, `.${decodeURIComponent(pathname)}`);
  // Unknown paths (and anything escaping dist/) fall back to the single-page app.
  if (!file.startsWith(STATIC_DIR + sep) || !isFile(file)) file = join(STATIC_DIR, 'index.html');
  if (!isFile(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('The UI has not been built yet. Run `npm run build`, then restart the server.\n');
  }
  const immutable = file.startsWith(join(STATIC_DIR, 'assets') + sep);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// Without a password, only answer requests addressed to localhost or an IP
// address. This blocks DNS-rebinding attacks from malicious websites.
function hostAllowed(hostHeader) {
  if (BASIC_AUTH || ALLOWED_HOSTS.includes('*')) return true;
  let hostname;
  try {
    hostname = new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (isIP(hostname.replace(/^\[|\]$/g, ''))) return true;
  return ALLOWED_HOSTS.includes(hostname);
}

const sha256 = (value) => createHash('sha256').update(value).digest();

function authorized(req) {
  if (!BASIC_AUTH) return true;
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (!/^basic$/i.test(scheme || '') || !encoded) return false;
  const given = Buffer.from(encoded, 'base64').toString('utf8');
  return timingSafeEqual(sha256(given), sha256(BASIC_AUTH));
}

async function handle(req, res) {
  try {
    if (!hostAllowed(req.headers.host)) {
      throw new HttpError(403, `Host "${req.headers.host}" is not allowed. Set BASIC_AUTH, or add it to ALLOWED_HOSTS in .env.`);
    }
    if (!authorized(req)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Cloudflare DNS Manager", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      return res.end('Authentication required\n');
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    let status = 500;
    if (err instanceof HttpError) status = err.status;
    else if (err instanceof CloudflareAPIError || err instanceof PublicIpError) status = 502;
    else if (err instanceof URIError) status = 400;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: err.message });
    else res.end();
  }
}

// ---------------------------------------------------------------- startup

const isLoopback = (host) => host === 'localhost' || host === '::1' || host.startsWith('127.');

const server = createServer(handle);

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Set PORT in .env.` : err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
  console.log(`Cloudflare DNS Manager running at http://${shownHost}:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Auto-update: ${config.schedule.enabled ? `every ${config.schedule.interval_minutes} min` : 'off'}, ${config.managed_records.length} managed record(s)`);
  if (!isLoopback(HOST) && !BASIC_AUTH) {
    console.warn('WARNING: listening on a network interface without BASIC_AUTH. Anyone who can reach this port can edit your DNS.');
  }
  if (!isFile(join(STATIC_DIR, 'index.html'))) {
    console.warn('WARNING: UI not built yet. Run `npm run build`.');
  }
});

updater.schedule(config.schedule);
if (config.schedule.enabled) {
  // Check once shortly after startup instead of waiting a full interval.
  setTimeout(() => updater.run(), 5_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    updater.stop();
    server.close();
    process.exit(0);
  });
}
