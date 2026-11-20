import { useState, useCallback, useEffect } from 'react';
import RecordRow from './RecordRow';
import RecordForm from './RecordForm';
import EmptyState from './EmptyState';
import { SkeletonRow } from './Skeleton';
import { useToast } from './Toaster';
import { fetchRecords, bulkUpdateIp, deleteRecord as apiDeleteRecord } from '../api';
import ConfirmModal from './ConfirmModal';

export default function ZoneCard({ zone, publicIp, managedRecordIds, onToggleManaged, onAddManaged }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const addToast = useToast();

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecords(zone.id);
      setRecords(data.map((r) => ({ ...r, _selected: false })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [zone.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleUpdate = (updated) => {
    setRecords((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiDeleteRecord(deleteTarget.id, deleteTarget.zone_id);
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      addToast(`Deleted ${deleteTarget.type} record ${deleteTarget.name}`, 'success');
      setDeleteTarget(null);
    } catch (e) {
      addToast(`Failed to delete: ${e.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectedARecords = records.filter((r) => r._selected && r.type === 'A');

  const handleBulkUpdate = async () => {
    setBulkLoading(true);
    try {
      const toUpdate = selectedARecords.map((r) => ({
        record_id: r.id,
        zone_id: r.zone_id,
        name: r.name,
        ttl: r.ttl,
        proxied: r.proxied,
      }));
      const result = await bulkUpdateIp(toUpdate);
      const successCount = result.results.filter((r) => r.status === 'success').length;
      const errorCount = result.results.filter((r) => r.status === 'error').length;
      if (errorCount > 0) {
        addToast(`Updated ${successCount}, failed ${errorCount}`, 'error');
      } else {
        addToast(`Updated ${successCount} records to ${result.ip}`, 'success');
      }
      setRecords((prev) => prev.map((r) => {
        const res = result.results.find((x) => x.record_id === r.id);
        if (res && res.status === 'success') return { ...r, content: result.ip, _selected: false };
        return r;
      }));
      setBulkConfirm(false);
    } catch (e) {
      addToast(`Bulk update failed: ${e.message}`, 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCreated = (newRecord) => {
    setRecords((prev) => [...prev, { ...newRecord, _selected: false }]);
  };

  const selectAllA = () => {
    setRecords((prev) => prev.map((r) => r.type === 'A' ? { ...r, _selected: true } : r));
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{zone.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {records.length} record{records.length !== 1 ? 's' : ''}
            {!loading && <span className="mx-1">·</span>}
            {!loading && <span className={zone.status === 'active' ? 'text-green-600' : 'text-gray-500'}>{zone.status}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedARecords.length > 0 && (
            <button
              onClick={() => setBulkConfirm(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Update IP ({selectedARecords.length})
            </button>
          )}
          <button
            onClick={selectAllA}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            Select all A
          </button>
        </div>
      </div>

      {loading && (
        <div className="divide-y divide-gray-100">
          {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50">
          Failed to load records: {error}
          <button onClick={loadRecords} className="ml-2 underline hover:no-underline">Retry</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          title="No DNS records"
          description="This zone has no DNS records yet."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          }
        />
      )}

      {!loading && !error && records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50/50">
                <th className="py-2 px-4 w-10">Auto</th>
                <th className="py-2 px-4">Type</th>
                <th className="py-2 px-4">Name</th>
                <th className="py-2 px-4">Content</th>
                <th className="py-2 px-4">TTL</th>
                <th className="py-2 px-4">Proxy</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  publicIp={publicIp}
                  managed={managedRecordIds.has(r.id)}
                  onToggleManaged={onToggleManaged}
                  onDelete={setDeleteTarget}
                  onUpdate={handleUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 sm:px-6 pb-4">
        <RecordForm zoneId={zone.id} zoneName={zone.name} publicIp={publicIp} onCreated={handleCreated} onAutoManage={onAddManaged} />
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete DNS Record"
        message={deleteTarget ? `Delete ${deleteTarget.type} record "${deleteTarget.name}" (${deleteTarget.content})? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={bulkConfirm}
        title="Update IP Address"
        message={`Update ${selectedARecords.length} A record${selectedARecords.length !== 1 ? 's' : ''} to ${publicIp || 'current IP'}?\n\n${selectedARecords.map((r) => `• ${r.name}`).join('\n')}`}
        confirmLabel="Update All"
        loading={bulkLoading}
        onConfirm={handleBulkUpdate}
        onCancel={() => setBulkConfirm(false)}
      />
    </div>
  );
}
