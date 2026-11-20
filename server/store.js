// Persists app state as JSON files in DATA_DIR (default: <repo>/data).
// The Cloudflare token is never written here; it only lives in .env.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT } from './env.js';

export const DATA_DIR = resolve(ROOT, process.env.DATA_DIR || 'data');
const CONFIG_PATH = join(DATA_DIR, 'config.json');
const LOG_PATH = join(DATA_DIR, 'update_log.json');
const MAX_LOG_ENTRIES = 100;

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Write to a temp file and rename, so a crash never leaves half-written JSON.
function writeJson(path, data) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path);
}

export function loadConfig() {
  const data = readJson(CONFIG_PATH, {});
  return {
    managed_records: Array.isArray(data.managed_records) ? data.managed_records : [],
    schedule: {
      interval_minutes: data.schedule?.interval_minutes ?? 5,
      enabled: data.schedule?.enabled ?? true,
    },
    last_update: data.last_update ?? null,
    last_ip: data.last_ip ?? null,
  };
}

export function saveConfig(config) {
  const { managed_records, schedule, last_update, last_ip } = config;
  writeJson(CONFIG_PATH, { managed_records, schedule, last_update, last_ip });
}

export function loadLog() {
  return readJson(LOG_PATH, []);
}

export function appendLog(entry) {
  writeJson(LOG_PATH, [entry, ...loadLog()].slice(0, MAX_LOG_ENTRIES));
}
