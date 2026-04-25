"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";
import {
  listAudioDevicesDetailed,
  getSettings,
  updateSettings,
  monitorInputLevels,
} from "@/lib/tauri";
import type { InputDeviceDetail } from "@/lib/types";
import { toast } from "sonner";

const COMMON_CHANNEL_COUNTS = [1, 2, 4, 6, 8, 12, 16, 24, 32];

function buildChannelCountOptions(maxChannels: number): number[] {
  const counts = COMMON_CHANNEL_COUNTS.filter((c) => c <= maxChannels);
  if (maxChannels > 0 && !counts.includes(maxChannels)) {
    counts.push(maxChannels);
  }
  return counts;
}

function VerticalMeter({ db }: { db: number }) {
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const hasSignal = db > -60;

  return (
    <div
      className="w-full rounded-sm overflow-hidden flex flex-col-reverse"
      style={{ background: "#1a1e26", height: 100 }}
    >
      <div
        className="w-full rounded-sm transition-[height] duration-75"
        style={{
          height: `${pct}%`,
          background: hasSignal
            ? db > -6
              ? "#ef4444"
              : db > -18
                ? "#E8863A"
                : "#22c55e"
            : "#334155",
        }}
      />
    </div>
  );
}

function InlineLevelBar({ db }: { db: number }) {
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const hasSignal = db > -60;

  return (
    <div
      className="h-2 flex-1 rounded-sm overflow-hidden"
      style={{ background: "#1a1e26", minWidth: 40 }}
    >
      <div
        className="h-full rounded-sm transition-[width] duration-75"
        style={{
          width: `${pct}%`,
          background: hasSignal
            ? db > -6
              ? "#ef4444"
              : db > -18
                ? "#E8863A"
                : "#22c55e"
            : "#334155",
        }}
      />
    </div>
  );
}

export function AudioDeviceSettings() {
  const [devices, setDevices] = useState<InputDeviceDetail[]>([]);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(
    null,
  );
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [channelMap, setChannelMap] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [channelLevels, setChannelLevels] = useState<number[] | null>(null);
  const levelPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const selectedDevice =
    devices.find((d) => d.name === selectedDeviceName) ?? null;

  // Level monitoring: poll while a device is selected
  useEffect(() => {
    mountedRef.current = true;

    if (!selectedDeviceName) {
      setChannelLevels(null);
      return;
    }

    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const levels = await monitorInputLevels(selectedDeviceName);
        if (active && mountedRef.current) {
          setChannelLevels(levels);
        }
      } catch {
        // Device may have disconnected — clear levels silently
        if (active && mountedRef.current) {
          setChannelLevels(null);
        }
      }
      if (active && mountedRef.current) {
        levelPollRef.current = setTimeout(poll, 120);
      }
    }

    poll();

    return () => {
      active = false;
      mountedRef.current = false;
      if (levelPollRef.current) {
        clearTimeout(levelPollRef.current);
        levelPollRef.current = null;
      }
    };
  }, [selectedDeviceName]);

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
      } catch {
        // No audio hardware (CI) or other error — handled in render
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleDeviceChange = useCallback(
    async (name: string) => {
      const deviceName = name === "" ? null : name;
      setSelectedDeviceName(deviceName);

      const device = devices.find((d) => d.name === deviceName);
      const newChannels = device
        ? Math.min(2, device.channelCount)
        : null;
      const newMap = newChannels
        ? Array.from({ length: newChannels }, (_, i) => i)
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

  const handleChannelCountChange = useCallback(async (count: number) => {
    setChannelCount(count);
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
  }, []);

  const handleChannelRouteChange = useCallback(
    async (outputIdx: number, physicalIdx: number) => {
      setChannelMap((prev) => {
        if (!prev) return prev;
        const updated = [...prev];
        updated[outputIdx] = physicalIdx;

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

  const maxPhysicalChannels = selectedDevice ? selectedDevice.channelCount : 2;
  const channelCountOptions = selectedDevice
    ? buildChannelCountOptions(maxPhysicalChannels)
    : [];

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
              {device.name} ({device.channelCount}ch,{" "}
              {device.sampleRate / 1000}
              kHz){device.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Input levels — vertical channel strip with numbers on x-axis */}
      {selectedDeviceName && channelLevels && channelLevels.length > 0 && (
        <div>
          <label className="mb-1 block text-sm text-foreground">
            Input Levels
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Live levels from the device — find which channels have signal.
          </p>
          <div
            className="flex items-end gap-1 overflow-x-auto pb-1"
            style={{ maxWidth: "100%" }}
          >
            {channelLevels.map((db, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-1"
                style={{ minWidth: 20, flex: "0 0 auto" }}
              >
                <VerticalMeter db={db} />
                <span
                  className="text-xs text-muted-foreground"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel count picker */}
      {selectedDeviceName && channelCountOptions.length > 0 && (
        <div>
          <label
            htmlFor="channel-count"
            className="mb-1 block text-sm text-foreground"
          >
            Recording Channels
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Number of channels to record. Use the level meters above to find
            active inputs.
          </p>
          <select
            id="channel-count"
            value={channelCount ?? 2}
            onChange={(e) => handleChannelCountChange(Number(e.target.value))}
            aria-label="Recording channel count"
            className="rounded-md border px-3 py-1.5 text-sm text-foreground"
            style={{
              background: "#272C36",
              borderColor: "#323844",
            }}
          >
            {channelCountOptions.map((count) => (
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
                {channelLevels && channelLevels[channelMap[outputIdx] ?? outputIdx] !== undefined && (
                  <InlineLevelBar db={channelLevels[channelMap[outputIdx] ?? outputIdx]} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
