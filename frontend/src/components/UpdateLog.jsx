import { useState } from 'react';
import EmptyState from './EmptyState';

export default function UpdateLog({ log = [] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
        aria-expanded={expanded}
      >
        <h2 className="text-sm font-semibold text-gray-900">Update Log</h2>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {log.length === 0 ? (
            <EmptyState
              title="No updates yet"
              description="The scheduler will log IP changes here."
              icon={
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="px-4 sm:px-6 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-900">{entry.message}</p>
                    <time className="text-xs text-gray-500 flex-shrink-0 ml-4" dateTime={entry.timestamp}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </time>
                  </div>
                  {entry.results && entry.results.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.results.map((r, j) => (
                        <span key={j} className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {r.name}: {r.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
