import { useState } from 'react';
import { createRecord } from '../api';
import { useToast } from './Toaster';

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV'];

export default function RecordForm({ zoneId, zoneName, publicIp, onCreated, onAutoManage }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: 'A', name: '', content: '', ttl: 120, proxied: false, autoUpdate: false });
  const addToast = useToast();

  const isAddressType = form.type === 'A' || form.type === 'AAAA';

  const handleUseMyIp = () => {
    if (!publicIp) return;
    setForm({ ...form, content: publicIp, autoUpdate: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        zone_id: zoneId,
        type: form.type,
        name: form.name || zoneName,
        content: form.content,
        ttl: parseInt(form.ttl, 10) || 120,
        proxied: isAddressType ? form.proxied : false,
      };
      const result = await createRecord(data);
      addToast(`Created ${result.type} record for ${result.name}`, 'success');
      onCreated(result);
      if (form.autoUpdate && isAddressType && onAutoManage) {
        await onAutoManage(result);
      }
      setForm({ type: 'A', name: '', content: '', ttl: 120, proxied: false, autoUpdate: false });
      setOpen(false);
    } catch (e) {
      addToast(`Failed to create record: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        + Add Record
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value, autoUpdate: false })}
            className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={zoneName}
            className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder={form.type === 'A' ? '1.2.3.4' : 'value'}
              required
              className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {isAddressType && publicIp && (
              <button
                type="button"
                onClick={handleUseMyIp}
                className="flex-shrink-0 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
                title={`Use current IP: ${publicIp}`}
              >
                My IP
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">TTL</label>
          <input
            type="number"
            value={form.ttl}
            onChange={(e) => setForm({ ...form, ttl: e.target.value })}
            min="1"
            className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>
      {isAddressType && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.proxied}
              onChange={(e) => setForm({ ...form, proxied: e.target.checked })}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            Proxied through Cloudflare
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.autoUpdate}
              onChange={(e) => setForm({ ...form, autoUpdate: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Auto-update IP
          </label>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Record'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
