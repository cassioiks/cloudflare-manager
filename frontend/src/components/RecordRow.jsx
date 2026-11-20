import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { useToast } from './Toaster';
import { updateRecord, deleteRecord } from '../api';

export default function RecordRow({ record, publicIp, managed, onToggleManaged, onDelete, onUpdate }) {
  const [proxyLoading, setProxyLoading] = useState(false);
  const [optimisticProxied, setOptimisticProxied] = useState(null);
  const [optimisticManaged, setOptimisticManaged] = useState(null);
  const addToast = useToast();

  const isA = record.type === 'A';
  const ipMatch = isA && publicIp ? record.content === publicIp : null;
  const proxied = optimisticProxied !== null ? optimisticProxied : record.proxied;
  const isManaged = optimisticManaged !== null ? optimisticManaged : managed;

  const handleProxyToggle = async () => {
    const newValue = !proxied;
    setOptimisticProxied(newValue);
    setProxyLoading(true);
    try {
      await updateRecord(record.id, {
        zone_id: record.zone_id,
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl,
        proxied: newValue,
      });
      onUpdate({ ...record, proxied: newValue });
      addToast(`${record.name} proxy ${newValue ? 'enabled' : 'disabled'}`, 'success');
    } catch (e) {
      setOptimisticProxied(null);
      addToast(`Failed to toggle proxy: ${e.message}`, 'error');
    } finally {
      setProxyLoading(false);
    }
  };

  const handleAutoToggle = async () => {
    const newValue = !isManaged;
    setOptimisticManaged(newValue);
    try {
      await onToggleManaged(record);
    } catch {
      setOptimisticManaged(null);
    }
  };

  return (
    <tr className={`border-t border-gray-100 transition-colors ${
      isA && ipMatch === false ? 'bg-amber-50/50' : ''
    } ${isA && ipMatch === true ? 'bg-green-50/30' : ''}`}>
      <td className="py-3 px-4">
        {isA && (
          <button
            onClick={handleAutoToggle}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
              isManaged ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={isManaged}
            aria-label={`Auto-update ${isManaged ? 'enabled' : 'disabled'} for ${record.name}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              isManaged ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`} />
          </button>
        )}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${
          record.type === 'A' ? 'bg-blue-100 text-blue-700' :
          record.type === 'CNAME' ? 'bg-purple-100 text-purple-700' :
          record.type === 'MX' ? 'bg-orange-100 text-orange-700' :
          record.type === 'TXT' ? 'bg-gray-100 text-gray-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {record.type}
        </span>
      </td>
      <td className="py-3 px-4 text-sm font-medium text-gray-900 max-w-[200px] truncate" title={record.name}>
        {record.name}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 font-mono max-w-[200px] truncate" title={record.content}>
        {record.content}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {record.ttl === 1 ? 'Auto' : record.ttl}
      </td>
      <td className="py-3 px-4">
        {record.proxiable ? (
          <button
            onClick={handleProxyToggle}
            disabled={proxyLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 ${
              proxied ? 'bg-orange-500' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={proxied}
            aria-label={`Proxy ${proxied ? 'enabled' : 'disabled'} for ${record.name}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              proxied ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        {isA && <StatusBadge match={ipMatch} />}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            onChange={(e) => {
              if (e.target.checked) onUpdate({ ...record, _selected: true });
              else onUpdate({ ...record, _selected: false });
            }}
            checked={record._selected || false}
            aria-label={`Select ${record.name}`}
          />
          <button
            onClick={() => onDelete(record)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label={`Delete ${record.name}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
