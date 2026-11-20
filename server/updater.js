// Dynamic DNS: looks up the public IPv4 address and keeps managed A records
// pointed at it on a fixed interval.
import { CloudflareAPIError } from './cloudflare.js';
import { appendLog, saveConfig } from './store.js';

const IP_SOURCES = ['https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com'];
const IP_CACHE_MS = 30_000;
const RECORD_TTL = 120;

export class PublicIpError extends Error {}

let ipCache = { ip: null, at: 0 };

function isIPv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

// Cached for 30s for the UI; the updater always asks for a fresh value.
export async function getPublicIp({ fresh = false } = {}) {
  if (!fresh && ipCache.ip && Date.now() - ipCache.at < IP_CACHE_MS) return ipCache.ip;
  for (const url of IP_SOURCES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      const ip = (await res.text()).trim();
      if (isIPv4(ip)) {
        ipCache = { ip, at: Date.now() };
        return ip;
      }
    } catch {
      // try the next source
    }
  }
  throw new PublicIpError('Could not determine public IP from any source');
}

export class Updater {
  constructor({ cf, config }) {
    this.cf = cf;
    this.config = config;
    this.timer = null;
    this.nextRun = null;
    this.running = false;
  }

  schedule({ interval_minutes, enabled }) {
    this.stop();
    if (!enabled) return;
    const ms = interval_minutes * 60_000;
    this.nextRun = new Date(Date.now() + ms);
    this.timer = setInterval(() => {
      this.nextRun = new Date(Date.now() + ms);
      this.run();
    }, ms);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.nextRun = null;
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.update();
    } catch (err) {
      console.error('[updater] unexpected error:', err);
    } finally {
      this.running = false;
    }
  }

  async update() {
    const { cf, config } = this;
    if (config.managed_records.length === 0) return;

    let ip;
    try {
      ip = await getPublicIp({ fresh: true });
    } catch (err) {
      console.error(`[updater] ${err.message}`);
      appendLog({ timestamp: new Date().toISOString(), message: err.message, ip: null, results: [] });
      return;
    }

    const results = [];
    for (const record of config.managed_records) {
      if (record.last_known_content === ip) continue;
      const payload = { type: 'A', name: record.name, content: ip, ttl: RECORD_TTL, proxied: record.proxied ?? false };
      try {
        await cf.updateRecord(record.zone_id, record.record_id, payload);
        record.last_known_content = ip;
        results.push({ name: record.name, status: 'success' });
      } catch (err) {
        // The record was deleted and recreated in Cloudflare (new ID): find it by name and retry once.
        const freshId = err instanceof CloudflareAPIError && err.status === 404
          ? await this.findRecordId(record.zone_id, record.name)
          : null;
        if (!freshId) {
          results.push({ name: record.name, status: 'error', error: err.message });
          continue;
        }
        try {
          await cf.updateRecord(record.zone_id, freshId, payload);
          record.record_id = freshId;
          record.last_known_content = ip;
          results.push({ name: record.name, status: 'success', healed: true });
        } catch (retryErr) {
          results.push({ name: record.name, status: 'error', error: retryErr.message });
        }
      }
    }

    if (results.length === 0 && ip === config.last_ip) return;

    config.last_ip = ip;
    config.last_update = new Date().toISOString();
    saveConfig(config);

    if (results.length > 0) {
      appendLog({ timestamp: config.last_update, message: `Updated IP to ${ip}`, ip, results });
      for (const r of results) {
        console.log(`[updater] ${r.name} -> ${ip}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
      }
    }
  }

  async findRecordId(zoneId, name) {
    try {
      const records = await this.cf.listRecords(zoneId, 'A');
      return records.find((r) => r.name === name)?.id ?? null;
    } catch {
      return null;
    }
  }
}
