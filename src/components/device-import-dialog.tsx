'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DeviceInfo, ImportResult } from '@/lib/types';
import { getConnectedDevices, importFromDevice } from '@/lib/tauri';

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
  }, [devices, selectedFiles]);

  const totalSelected = Object.values(selectedFiles).reduce(
    (sum, set) => sum + set.size,
    0
  );

  // Results summary
  if (results) {
    const imported = results.filter((r) => r.status === 'imported').length;
    const duplicates = results.filter((r) => r.status === 'duplicate').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold">Import Complete</h2>
          <div className="mt-4 space-y-2 text-sm">
            {imported > 0 && (
              <p className="text-green-700">{imported} file(s) imported successfully</p>
            )}
            {duplicates > 0 && (
              <p className="text-yellow-700">{duplicates} duplicate(s) skipped</p>
            )}
            {errors > 0 && (
              <p className="text-red-700">{errors} error(s) occurred</p>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import from Device</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
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
          <p className="mt-4 text-sm text-gray-500">Scanning for devices...</p>
        )}

        {!loading && devices.length === 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              No audio recording devices detected.
            </p>
            <p className="mt-1 text-xs text-gray-400">
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
                <div key={dev.mountPoint} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{dev.name}</h3>
                      <p className="text-xs text-gray-400">{dev.mountPoint}</p>
                    </div>
                    <button
                      onClick={() => toggleAll(dev.mountPoint, dev.files, !allSelected)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {dev.files.map((file) => {
                      const filename = file.split('/').pop() ?? file;
                      return (
                        <label
                          key={file}
                          className="flex items-center gap-2 py-1 text-sm hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(file)}
                            onChange={() => toggleFile(dev.mountPoint, file)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="truncate" title={file}>
                            {filename}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="mt-1 text-xs text-gray-400">
                    {selected.size} of {dev.files.length} selected
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {importing && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Importing {importProgress.current} of {importProgress.total}...
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
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
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Dismiss
            </button>
            <button
              onClick={handleImport}
              disabled={totalSelected === 0}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import Selected ({totalSelected})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
