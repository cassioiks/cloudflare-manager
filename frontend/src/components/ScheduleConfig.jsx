import { useState } from 'react';
import { updateSchedule } from '../api';
import { useToast } from './Toaster';

export default function ScheduleConfig({ schedule, onUpdate }) {
  const [interval, setInterval_] = useState(schedule?.interval_minutes || 5);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const addToast = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateSchedule(interval, enabled);
      onUpdate(result);
      setDirty(false);
      addToast(`Auto-update ${result.enabled ? `set to every ${result.interval_minutes} minutes` : 'disabled'}`, 'success');
    } catch (e) {
      addToast(`Failed to update schedule: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Auto-Update Schedule</h2>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <button
            onClick={() => { setEnabled(!enabled); setDirty(true); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
              enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={enabled}
            aria-label="Enable auto-update"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          {enabled ? 'Enabled' : 'Disabled'}
        </label>

        {enabled && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>Every</span>
            <input
              type="number"
              value={interval}
              onChange={(e) => { setInterval_(parseInt(e.target.value, 10) || 1); setDirty(true); }}
              min="1"
              max="1440"
              className="w-20 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <span>minutes</span>
          </div>
        )}

        {dirty && (
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}
