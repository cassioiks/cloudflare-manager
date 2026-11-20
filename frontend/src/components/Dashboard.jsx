import { useState, useCallback, useMemo } from 'react';
import IpBanner from './IpBanner';
import ZoneCard from './ZoneCard';
import ScheduleConfig from './ScheduleConfig';
import UpdateLog from './UpdateLog';
import { SkeletonCard } from './Skeleton';
import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { useToast } from './Toaster';
import { fetchZones, fetchPublicIp, fetchStatus, updateManagedRecords } from '../api';

export default function Dashboard() {
  const addToast = useToast();
  const { data: zones, loading: zonesLoading, error: zonesError, refetch: refetchZones } = useApi(fetchZones);
  const { data: ipData, loading: ipLoading, refetch: refetchIp } = useApi(fetchPublicIp);
  const { data: status, loading: statusLoading, refetch: refetchStatus } = useApi(fetchStatus);

  const [schedule, setSchedule] = useState(null);

  const currentSchedule = schedule || status?.schedule;

  usePolling(() => {
    refetchIp();
    refetchStatus();
  }, 30000);

  const managedRecordIds = useMemo(() => {
    if (!status?.managed_records) return new Set();
    return new Set(status.managed_records.map((r) => r.record_id));
  }, [status]);

  const mismatchCount = useMemo(() => {
    if (!status?.managed_records || !ipData?.ip) return 0;
    return status.managed_records.filter(
      (r) => r.last_known_content && r.last_known_content !== ipData.ip
    ).length;
  }, [status, ipData]);

  const handleToggleManaged = useCallback(async (record) => {
    const current = status?.managed_records || [];
    const matches = (r) => r.zone_id === record.zone_id && r.name === record.name;
    const exists = current.find(matches);
    let updated;
    if (exists) {
      updated = current.filter((r) => !matches(r));
    } else {
      updated = [...current, {
        record_id: record.id,
        zone_id: record.zone_id,
        name: record.name,
        proxied: record.proxied,
        last_known_content: record.content,
      }];
    }
    try {
      await updateManagedRecords(updated);
      refetchStatus();
      addToast(exists ? `Removed ${record.name} from auto-update` : `Added ${record.name} to auto-update`, 'info');
    } catch (e) {
      addToast(`Failed: ${e.message}`, 'error');
    }
  }, [status, refetchStatus, addToast]);

  const handleAddManaged = useCallback(async (record) => {
    const current = status?.managed_records || [];
    const matches = (r) => r.zone_id === record.zone_id && r.name === record.name;
    const existing = current.find(matches);
    if (existing && existing.record_id === record.id) return;
    const entry = {
      record_id: record.id,
      zone_id: record.zone_id,
      name: record.name,
      proxied: record.proxied,
      last_known_content: record.content,
    };
    const updated = existing
      ? current.map((r) => (matches(r) ? entry : r))
      : [...current, entry];
    try {
      await updateManagedRecords(updated);
      refetchStatus();
      addToast(`Added ${record.name} to auto-update`, 'info');
    } catch (e) {
      addToast(`Failed: ${e.message}`, 'error');
    }
  }, [status, refetchStatus, addToast]);

  const handleRefresh = () => {
    refetchIp();
    refetchStatus();
    refetchZones();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5088 16.8447c.1475-.5068.0899-.9985-.162-1.3842-.2369-.3632-.6452-.578-1.1501-.6043l-8.6264-.1926c-.0824-.0075-.1273-.0825-.1123-.1575.0075-.06.0525-.105.1125-.12l8.6938-.195c1.4552-.0675 3.0304-1.2377 3.5728-2.6805l.6901-1.8229a.3195.3195 0 00.015-.195C18.9539 5.7573 15.33 2.6 10.992 2.6c-4.7356 0-8.592 3.8039-8.592 8.4959 0 .2325.015.465.03.6975l.0075.0375c.315 3.2857 2.5205 6.0637 5.5658 7.1039.48.165.9901.2775 1.5152.3375.2994.03.6063.0525.9207.0525h6.4314c.0225 0 .0524 0 .0749-.0075.5474-.075 1.0873-.4957 1.2498-1.035l-.687.6124z" />
            </svg>
            <h1 className="text-xl font-bold text-gray-900">Cloudflare DNS Manager</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <IpBanner
          ip={ipData?.ip}
          loading={ipLoading}
          mismatchCount={mismatchCount}
          schedule={currentSchedule}
          managedRecords={status?.managed_records || []}
          onRefresh={handleRefresh}
        />

        <ScheduleConfig
          schedule={currentSchedule || { interval_minutes: 5, enabled: true }}
          onUpdate={setSchedule}
        />

        {zonesError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            Failed to load zones: {zonesError}
            <button onClick={refetchZones} className="ml-2 underline hover:no-underline">Retry</button>
          </div>
        )}

        {zonesLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!zonesLoading && zones && zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            publicIp={ipData?.ip}
            managedRecordIds={managedRecordIds}
            onToggleManaged={handleToggleManaged}
            onAddManaged={handleAddManaged}
          />
        ))}

        <UpdateLog log={status?.recent_log || []} />
      </main>
    </div>
  );
}
