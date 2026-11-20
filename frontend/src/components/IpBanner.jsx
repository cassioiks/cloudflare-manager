import { useState } from 'react';
import { SkeletonLine } from './Skeleton';

export default function IpBanner({ ip, loading, mismatchCount, schedule, managedRecords = [], onRefresh }) {
  const [showManaged, setShowManaged] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Public IP</p>
            {loading ? (
              <SkeletonLine className="w-36 h-7 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 font-mono">{ip || 'Unavailable'}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {mismatchCount > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {mismatchCount} outdated
            </span>
          )}
          {mismatchCount === 0 && !loading && ip && managedRecords.length > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All current
            </span>
          )}

          <div className="relative">
            <button
              onClick={() => setShowManaged(!showManaged)}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                managedRecords.length > 0
                  ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
              }`}
              aria-expanded={showManaged}
              aria-label="Show auto-updated records"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {managedRecords.length > 0
                ? `Auto-updating ${managedRecords.length} record${managedRecords.length !== 1 ? 's' : ''}`
                : 'No auto-updated records'}
            </button>

            {showManaged && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px]">
                {managedRecords.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500">
                    Toggle "Auto" on A records to include them in scheduled IP updates.
                  </p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {managedRecords.map((r) => (
                      <li key={r.record_id} className="px-3 py-1.5 text-sm text-gray-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        {r.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {schedule && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              schedule.enabled ? 'text-blue-700 bg-blue-50' : 'text-gray-500 bg-gray-100'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {schedule.enabled ? `Every ${schedule.interval_minutes}m` : 'Auto-update off'}
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
            aria-label="Refresh IP"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
