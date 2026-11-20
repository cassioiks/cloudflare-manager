const API_BASE = '';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const fetchZones = () => request('GET', '/api/zones');
export const fetchRecords = (zoneId, type) =>
  request('GET', `/api/zones/${zoneId}/records${type ? `?type=${type}` : ''}`);
export const createRecord = (data) => request('POST', '/api/records', data);
export const updateRecord = (recordId, data) => request('PUT', `/api/records/${recordId}`, data);
export const deleteRecord = (recordId, zoneId) =>
  request('DELETE', `/api/records/${recordId}`, { zone_id: zoneId });
export const bulkUpdateIp = (records) =>
  request('POST', '/api/records/bulk-update-ip', { records });
export const fetchPublicIp = () => request('GET', '/api/ip');
export const fetchStatus = () => request('GET', '/api/status');
export const fetchSettings = () => request('GET', '/api/settings');
export const updateSchedule = (intervalMinutes, enabled) =>
  request('POST', '/api/settings/schedule', { interval_minutes: intervalMinutes, enabled });
export const updateManagedRecords = (records) =>
  request('POST', '/api/settings/managed-records', { records });
