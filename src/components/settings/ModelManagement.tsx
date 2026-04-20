"use client";

import { Loader2 } from "lucide-react";

interface ModelInfo {
  name: string;
  version: string;
  diskSize: string;
  status: "ready" | "downloading" | "failed" | "not_installed" | "built_in";
}

// For v1, essentia standard algorithms are built-in (no separate model downloads).
// This UI is scaffolded for forward-compatibility with TempoCNN and demucs models.
const MODELS: ModelInfo[] = [
  {
    name: "Essentia Tempo",
    version: "2.1",
    diskSize: "Built-in",
    status: "built_in",
  },
  {
    name: "Essentia Key",
    version: "2.1",
    diskSize: "Built-in",
    status: "built_in",
  },
  {
    name: "Essentia Sections",
    version: "2.1",
    diskSize: "Built-in",
    status: "built_in",
  },
];

function StatusBadge({ status }: { status: ModelInfo["status"] }) {
  switch (status) {
    case "ready":
    case "built_in":
      return (
        <span className="text-xs font-semibold text-[#E8863A]">Ready</span>
      );
    case "downloading":
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Loader2 size={10} className="animate-spin" />
          Downloading...
        </span>
      );
    case "failed":
      return (
        <span className="text-xs font-semibold" style={{ color: "#D93636" }}>
          Failed
        </span>
      );
    case "not_installed":
      return (
        <span className="text-xs text-muted-foreground">Not installed</span>
      );
  }
}

export function ModelManagement() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Installed Models
      </h3>

      {/* Model list */}
      <div className="space-y-2">
        {MODELS.map((model) => (
          <div
            key={model.name}
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: "#272C36" }}
          >
            <div className="flex items-center gap-4">
              <span className="text-sm text-foreground">{model.name}</span>
              <span className="text-xs text-muted-foreground">
                v{model.version}
              </span>
              <span className="text-xs text-muted-foreground">
                {model.diskSize}
              </span>
            </div>
            <StatusBadge status={model.status} />
          </div>
        ))}
      </div>

      {/* Total disk usage */}
      <div className="text-right">
        <span className="text-xs text-muted-foreground">
          Total disk usage: Built-in (no downloads)
        </span>
      </div>
    </div>
  );
}
