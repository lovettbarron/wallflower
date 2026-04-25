"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { listAudioDevicesDetailed, getSettings, updateSettings } from "@/lib/tauri";
import type { InputDeviceDetail } from "@/lib/types";
import { toast } from "sonner";

/**
 * Audio interface settings component for selecting recording device,
 * channel count, and channel routing matrix.
 *
 * Self-contained: loads its own data and calls updateSettings directly.
 */
export function AudioDeviceSettings() {
  const [devices, setDevices] = useState<InputDeviceDetail[]>([]);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(null);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [channelMap, setChannelMap] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Derive the selected device detail
  const selectedDevice = devices.find((d) => d.name === selectedDeviceName) ?? null;

  // Load devices and current settings on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [deviceList, settings] = await Promise.all([
          listAudioDevicesDetailed(),
          getSettings(),
        ]);
        if (cancelled) return;
        setDevices(deviceList);
        setSelectedDeviceName(settings.recordingDeviceName);
        setChannelCount(settings.recordingChannels);
        setChannelMap(settings.recordingChannelMap);
      } catch (err) {
        // No audio hardware (CI) or other error -- handled in render
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh device list
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const deviceList = await listAudioDevicesDetailed();
      setDevices(deviceList);
    } catch {
      toast.error("Failed to scan audio devices");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Handle device selection change
  const handleDeviceChange = useCallback(
    async (name: string) => {
      const deviceName = name === "" ? null : name;
      setSelectedDeviceName(deviceName);

      // Reset channel count and map when device changes
      const device = devices.find((d) => d.name === deviceName);
      const newChannels = device ? device.channelCount : null;
      const newMap = device
        ? Array.from({ length: device.channelCount }, (_, i) => i)
        : null;

      setChannelCount(newChannels);
      setChannelMap(newMap);

      try {
        await updateSettings({
          recordingDeviceName: deviceName,
          recordingChannels: newChannels,
          recordingChannelMap: newMap,
        });
      } catch {
        toast.error("Failed to save device preference");
      }
    },
    [devices],
  );

  // Handle channel count change
  const handleChannelCountChange = useCallback(
    async (count: number) => {
      setChannelCount(count);

      // Create identity mapping for the new channel count
      const newMap = Array.from({ length: count }, (_, i) => i);
      setChannelMap(newMap);

      try {
        await updateSettings({
          recordingChannels: count,
          recordingChannelMap: newMap,
        });
      } catch {
        toast.error("Failed to save channel count");
      }
    },
    [],
  );

  // Handle individual channel routing change
  const handleChannelRouteChange = useCallback(
    async (outputIdx: number, physicalIdx: number) => {
      setChannelMap((prev) => {
        if (!prev) return prev;
        const updated = [...prev];
        updated[outputIdx] = physicalIdx;

        // Save asynchronously
        updateSettings({ recordingChannelMap: updated }).catch(() => {
          toast.error("Failed to save channel routing");
        });

        return updated;
      });
    },
    [],
  );

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading audio devices...</p>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No audio devices detected.
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm text-[#E8863A] hover:text-[#E8863A]/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Rescan
        </button>
      </div>
    );
  }

  // Determine available channel counts for the selected device
  const availableChannelCounts = selectedDevice
    ? selectedDevice.supportedChannelCounts
    : [];

  // Max physical channels on the selected device (for routing dropdowns)
  const maxPhysicalChannels = selectedDevice
    ? selectedDevice.channelCount
    : 2;

  return (
    <div className="space-y-5">
      {/* Device selector */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="audio-device" className="text-sm text-foreground">
            Input Device
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-[#E8863A] hover:text-[#E8863A]/80 transition-colors disabled:opacity-50"
            aria-label="Rescan audio devices"
          >
            <RefreshCw
              size={12}
              className={refreshing ? "animate-spin" : ""}
            />
            Rescan
          </button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Select which audio interface to record from.
        </p>
        <select
          id="audio-device"
          value={selectedDeviceName ?? ""}
          onChange={(e) => handleDeviceChange(e.target.value)}
          aria-label="Audio input device"
          className="w-full rounded-md border px-3 py-1.5 text-sm text-foreground"
          style={{
            background: "#272C36",
            borderColor: "#323844",
          }}
        >
          <option value="">System Default</option>
          {devices.map((device) => (
            <option key={device.name} value={device.name}>
              {device.name} ({device.channelCount}ch, {device.sampleRate / 1000}
              kHz){device.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Channel count picker */}
      {selectedDeviceName && availableChannelCounts.length > 0 && (
        <div>
          <label
            htmlFor="channel-count"
            className="mb-1 block text-sm text-foreground"
          >
            Recording Channels
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Number of channels to record.
          </p>
          <select
            id="channel-count"
            value={channelCount ?? maxPhysicalChannels}
            onChange={(e) => handleChannelCountChange(Number(e.target.value))}
            aria-label="Recording channel count"
            className="rounded-md border px-3 py-1.5 text-sm text-foreground"
            style={{
              background: "#272C36",
              borderColor: "#323844",
            }}
          >
            {availableChannelCounts.map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "channel" : "channels"}
                {count === maxPhysicalChannels ? " (max)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Channel routing matrix */}
      {selectedDeviceName && channelCount && channelCount > 0 && channelMap && (
        <div>
          <label className="mb-1 block text-sm text-foreground">
            Channel Routing
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Assign which physical input channel feeds each recording slot.
          </p>
          <div className="space-y-2">
            {Array.from({ length: channelCount }, (_, outputIdx) => (
              <div key={outputIdx} className="flex items-center gap-3">
                <span
                  className="w-20 text-xs text-muted-foreground"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  Output {outputIdx + 1}
                </span>
                <select
                  value={channelMap[outputIdx] ?? outputIdx}
                  onChange={(e) =>
                    handleChannelRouteChange(outputIdx, Number(e.target.value))
                  }
                  aria-label={`Output ${outputIdx + 1} source`}
                  className="rounded-md border px-3 py-1 text-sm text-foreground"
                  style={{
                    background: "#272C36",
                    borderColor: "#323844",
                  }}
                >
                  {Array.from(
                    { length: maxPhysicalChannels },
                    (_, physIdx) => (
                      <option key={physIdx} value={physIdx}>
                        Input {physIdx + 1}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
