// Minimal Cloudflare API v4 client for zones and DNS records.
const API_BASE = process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15_000;

export class CloudflareAPIError extends Error {
  constructor(message, { status, errors = [] } = {}) {
    super(message);
    this.name = 'CloudflareAPIError';
    this.status = status;
    this.errors = errors;
  }
}

export class CloudflareClient {
  constructor(token) {
    this.token = token;
  }

  async request(method, path, { params, body } = {}) {
    const url = new URL(API_BASE + path);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new CloudflareAPIError(`Could not reach Cloudflare: ${err.message}`);
    }

    const data = await res.json().catch(() => null);
    if (!data?.success) {
      const errors = data?.errors ?? [];
      const message = errors[0]?.message ?? `Cloudflare API returned HTTP ${res.status}`;
      throw new CloudflareAPIError(message, { status: res.status, errors });
    }
    return data;
  }

  // Follows pagination so large accounts are not silently truncated.
  async listAll(path, params, perPage) {
    const results = [];
    for (let page = 1; ; page++) {
      const data = await this.request('GET', path, { params: { ...params, page, per_page: perPage } });
      results.push(...data.result);
      const totalPages = data.result_info?.total_pages ?? 1;
      if (page >= totalPages || data.result.length === 0) return results;
    }
  }

  listZones() {
    return this.listAll('/zones', {}, 50);
  }

  listRecords(zoneId, type) {
    return this.listAll(`/zones/${encodeURIComponent(zoneId)}/dns_records`, { type }, 100);
  }

  async createRecord(zoneId, record) {
    const path = `/zones/${encodeURIComponent(zoneId)}/dns_records`;
    return (await this.request('POST', path, { body: record })).result;
  }

  async updateRecord(zoneId, recordId, record) {
    const path = `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`;
    return (await this.request('PUT', path, { body: record })).result;
  }

  async deleteRecord(zoneId, recordId) {
    const path = `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`;
    await this.request('DELETE', path);
  }
}
