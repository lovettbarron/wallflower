'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DeviceInfo, ImportResult } from '@/lib/types';
import { getConnectedDevices, importFromDevice, queuePendingAnalysis } from '@/lib/tauri';

interface DeviceImportDialogProps {
  onClose: () => void;
}

export function DeviceImportDialog({ onClose }: DeviceImportDialogProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Set<string>>>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[] | null>(null);

  useEffect(() => {
    getConnectedDevices()
      .then((devs) => {
        setDevices(devs);
        // Select all files by default
        const initial: Record<string, Set<string>> = {};
        for (const dev of devs) {
          initial[dev.mountPoint] = new Set(dev.files);
        }
        setSelectedFiles(initial);
      })
      .catch((err) => {
        console.error('Failed to detect devices:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleFile = useCallback((mountPoint: string, file: string) => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      const set = new Set(prev[mountPoint] ?? []);
      if (set.has(file)) {
        set.delete(file);
      } else {
        set.add(file);
      }
      next[mountPoint] = set;
      return next;
    });
  }, []);

  const toggleAll = useCallback((mountPoint: string, files: string[], selectAll: boolean) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [mountPoint]: selectAll ? new Set(files) : new Set(),
    }));
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setResults(null);
    const allResults: ImportResult[] = [];

    for (const dev of devices) {
      const selected = selectedFiles[dev.mountPoint];
      if (!selected || selected.size === 0) continue;

      const files = Array.from(selected);
      setImportProgress({ current: 0, total: files.length });

      try {
        const devResults = await importFromDevice(dev.mountPoint, files);
        allResults.push(...devResults);
        setImportProgress({ current: files.length, total: files.length });
      } catch (err) {
        console.error('Import failed:', err);
        allResults.push(
          ...files.map((f) => ({
            status: 'error' as const,
            filename: f.split('/').pop() ?? f,
            error: String(err),
          }))
        );
      }
    }

    setResults(allResults);
    setImporting(false);
    queuePendingAnalysis().catch(() => {});
  }, [devices, selectedFiles]);

  const totalSelected = Object.values(selectedFiles).reduce(
    (sum, set) => sum + set.size,
    0
  );

  function groupFilesByMonth(files: string[]): { label: string; files: string[] }[] {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const groups = new Map<string, { label: string; files: string[] }>();

    for (const file of files) {
      const filename = file.split('/').pop() ?? '';
      const match = filename.match(/^(\d{2})(\d{2})\d{2}_/);
      if (match) {
        const year = 2000 + parseInt(match[1], 10);
        const monthIdx = parseInt(match[2], 10) - 1;
        const key = `${year}-${match[2]}`;
        if (!groups.has(key)) {
          groups.set(key, { label: `${MONTHS[monthIdx]} ${year}`, files: [] });
        }
        groups.get(key)!.files.push(file);
      } else {
        if (!groups.has('other')) {
          groups.set('other', { label: 'Other', files: [] });
        }
        groups.get('other')!.files.push(file);
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => (a === 'other' ? 1 : b === 'other' ? -1 : b.localeCompare(a)))
      .map(([, group]) => ({ ...group, files: group.files.sort().reverse() }));
  }

  // Results summary
  if (results) {
    const imported = results.filter((r) => r.status === 'imported').length;
    const duplicates = results.filter((r) => r.status === 'duplicate').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="mx-4 w-full max-w-lg rounded-lg p-6 shadow-xl" style={{ background: '#1E2330' }}>
          <h2 className="text-lg font-semibold text-[#E2E4E8]">Import Complete</h2>
          <div className="mt-4 space-y-2 text-sm">
            {imported > 0 && (
              <p className="text-green-400">{imported} {imported === 1 ? 'file' : 'files'} imported successfully</p>
            )}
            {duplicates > 0 && (
              <p className="text-yellow-400">{duplicates} {duplicates === 1 ? 'duplicate' : 'duplicates'} skipped</p>
            )}
            {errors > 0 && (
              <p className="text-red-400">{errors} {errors === 1 ? 'error' : 'errors'} occurred</p>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ background: '#E8863A' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-lg rounded-lg p-6 shadow-xl" style={{ background: '#1E2330' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#E2E4E8]">Import from Device</h2>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#E2E4E8]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-[#8B8F96]">Scanning for devices...</p>
        )}

        {!loading && devices.length === 0 && (
          <div className="mt-4">
            <p className="text-sm text-[#8B8F96]">
              No audio recording devices detected.
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Connect a USB recorder (e.g., Zoom F3) and try again.
            </p>
          </div>
        )}

        {!loading && devices.length > 0 && (
          <div className="mt-4 space-y-4">
            {devices.map((dev) => {
              const selected = selectedFiles[dev.mountPoint] ?? new Set();
              const allSelected = selected.size === dev.files.length;

              return (
                <div key={dev.mountPoint} className="rounded-md border border-[#2A3040] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-[#E2E4E8]">{dev.name}</h3>
                      <p className="text-xs text-[#6B7280]">{dev.mountPoint}</p>
                    </div>
                    <button
                      onClick={() => toggleAll(dev.mountPoint, dev.files, !allSelected)}
                      className="text-xs text-[#E8863A] hover:text-[#F09A52]"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="mt-2 max-h-64 overflow-y-auto">
                    {groupFilesByMonth(dev.files).map((group) => (
                      <div key={group.label} className="mb-2">
                        <p className="sticky top-0 py-1 text-xs font-semibold text-[#8B8F96]" style={{ background: '#1E2330' }}>
                          {group.label} ({group.files.length})
                        </p>
                        {group.files.map((file) => {
                          const filename = file.split('/').pop() ?? file;
                          return (
                            <label
                              key={file}
                              className="flex items-center gap-2 rounded py-1 text-sm text-[#C0C4CC] hover:bg-[#252B38]"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(file)}
                                onChange={() => toggleFile(dev.mountPoint, file)}
                                className="h-4 w-4 rounded accent-[#E8863A]"
                              />
                              <span className="truncate" title={file}>
                                {filename}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <p className="mt-1 text-xs text-[#6B7280]">
                    {selected.size} of {dev.files.length} selected
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {importing && (
          <div className="mt-4">
            <p className="text-sm text-[#C0C4CC]">
              Importing {importProgress.current} of {importProgress.total}...
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#2A3040]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  background: '#E8863A',
                  width: importProgress.total > 0
                    ? `${(importProgress.current / importProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        )}

        {!loading && devices.length > 0 && !importing && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-md border border-[#2A3040] px-4 py-2 text-sm text-[#8B8F96] hover:bg-[#252B38]"
            >
              Dismiss
            </button>
            <button
              onClick={handleImport}
              disabled={totalSelected === 0}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: '#E8863A' }}
            >
              Import Selected ({totalSelected})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
