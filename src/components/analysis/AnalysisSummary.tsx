"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AnalysisBadge } from "./AnalysisBadge";
import { AnalysisStatus } from "./AnalysisStatus";
import {
  getAnalysisResults,
  reanalyzeJam,
  setManualTempo,
  setManualKey,
  clearManualTempo,
  clearManualKey,
} from "@/lib/tauri";

// All musical keys for the key select dropdown
const ALL_KEYS = [
  "C major", "C minor", "C# major", "C# minor",
  "D major", "D minor", "Eb major", "Eb minor",
  "E major", "E minor", "F major", "F minor",
  "F# major", "F# minor", "G major", "G minor",
  "Ab major", "Ab minor", "A major", "A minor",
  "Bb major", "Bb minor", "B major", "B minor",
];

interface AnalysisSummaryProps {
  jamId: string;
}

export function AnalysisSummary({ jamId }: AnalysisSummaryProps) {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState(false);
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState("");
  const bpmRef = useRef<HTMLInputElement>(null);

  const { data: analysis } = useQuery({
    queryKey: ["jam", jamId, "analysis"],
    queryFn: () => getAnalysisResults(jamId),
    staleTime: 30000,
  });

  const isAnalyzing = analysis?.status?.status === "analyzing";
  const hasFailed = analysis?.status?.status === "failed";

  // Focus BPM input when editing
  useEffect(() => {
    if (editingBpm && bpmRef.current) {
      bpmRef.current.focus();
      bpmRef.current.select();
    }
  }, [editingBpm]);

  // Derive completed steps from analysis results
  const completedSteps: string[] = [];
  if (analysis?.tempo) completedSteps.push("tempo");
  if (analysis?.key) completedSteps.push("key");
  if (analysis?.sections && analysis.sections.length > 0) completedSteps.push("sections");
  if (analysis?.loops !== undefined && analysis?.status?.status !== "analyzing") completedSteps.push("loops");

  const handleReanalyze = async () => {
    try {
      await reanalyzeJam(jamId);
      queryClient.invalidateQueries({ queryKey: ["jam", jamId, "analysis"] });
    } catch {
      toast.error("Failed to start re-analysis");
    }
  };

  const handleKeySelect = async (keyStr: string) => {
    const parts = keyStr.split(" ");
    const keyName = parts[0];
    const scale = parts[1] || "major";
    try {
      await setManualKey(jamId, keyName, scale);
      queryClient.invalidateQueries({ queryKey: ["jam", jamId, "analysis"] });
      toast(`Key set to ${keyStr}`, { duration: 2000 });
    } catch {
      toast.error("Failed to set key");
    }
    setEditingKey(false);
  };

  const handleBpmConfirm = async () => {
    const bpm = parseInt(bpmInput, 10);
    if (isNaN(bpm) || bpm < 20 || bpm > 300) {
      setEditingBpm(false);
      return;
    }
    try {
      await setManualTempo(jamId, bpm);
      queryClient.invalidateQueries({ queryKey: ["jam", jamId, "analysis"] });
      toast(`BPM set to ${bpm}`, { duration: 2000 });
    } catch {
      toast.error("Failed to set BPM");
    }
    setEditingBpm(false);
  };

  const handleClearKey = async () => {
    try {
      await clearManualKey(jamId);
      queryClient.invalidateQueries({ queryKey: ["jam", jamId, "analysis"] });
      toast("Key cleared -- will update on next analysis", { duration: 3000 });
    } catch {
      toast.error("Failed to clear key override");
    }
  };

  const handleClearTempo = async () => {
    try {
      await clearManualTempo(jamId);
      queryClient.invalidateQueries({ queryKey: ["jam", jamId, "analysis"] });
      toast("BPM cleared -- will update on next analysis", { duration: 3000 });
    } catch {
      toast.error("Failed to clear BPM override");
    }
  };

  // Key display
  const keyLabel = analysis?.key
    ? `${analysis.key.keyName} ${analysis.key.scale}`
    : "--";

  // BPM display
  const bpmLabel = analysis?.tempo
    ? `${Math.round(analysis.tempo.bpm)} BPM`
    : "--";

  // Sections count
  const sectionsCount = analysis?.sections?.length ?? 0;
  const sectionsLabel = sectionsCount > 0
    ? `${sectionsCount} ${sectionsCount === 1 ? "section" : "sections"}`
    : "--";

  // Loops count
  const loopsCount = analysis?.loops?.length ?? 0;
  const loopsLabel = loopsCount > 0
    ? `${loopsCount} ${loopsCount === 1 ? "loop" : "loops"}`
    : analysis?.status?.status === "complete"
      ? "No loops"
      : "--";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Key badge with inline edit */}
          {editingKey ? (
            <select
              autoFocus
              className="rounded-xl px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-[#E8863A]"
              style={{ background: "#272C36" }}
              value={keyLabel !== "--" ? keyLabel : ""}
              onChange={(e) => handleKeySelect(e.target.value)}
              onBlur={() => setEditingKey(false)}
              onKeyDown={(e) => e.key === "Escape" && setEditingKey(false)}
            >
              <option value="" disabled>Select key...</option>
              {ALL_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          ) : (
            <AnalysisBadge
              label={keyLabel}
              pending={!analysis?.key}
              manualOverride={analysis?.key?.manualOverride}
              onEdit={() => setEditingKey(true)}
              onClearOverride={handleClearKey}
            />
          )}

          {/* BPM badge with inline edit */}
          {editingBpm ? (
            <input
              ref={bpmRef}
              type="number"
              min={20}
              max={300}
              value={bpmInput}
              onChange={(e) => setBpmInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBpmConfirm();
                if (e.key === "Escape") setEditingBpm(false);
              }}
              onBlur={() => handleBpmConfirm()}
              className="w-[60px] rounded-xl px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-[#E8863A]"
              style={{
                background: "#272C36",
                fontFeatureSettings: '"tnum"',
              }}
            />
          ) : (
            <AnalysisBadge
              label={bpmLabel}
              pending={!analysis?.tempo}
              manualOverride={analysis?.tempo?.manualOverride}
              onEdit={() => {
                setBpmInput(
                  analysis?.tempo
                    ? String(Math.round(analysis.tempo.bpm))
                    : "",
                );
                setEditingBpm(true);
              }}
              onClearOverride={handleClearTempo}
              className="tabular-nums"
            />
          )}

          {/* Sections badge (not editable) */}
          <AnalysisBadge
            label={sectionsLabel}
            pending={!analysis?.sections || analysis.sections.length === 0}
          />

          {/* Loops badge (not editable) */}
          <AnalysisBadge
            label={loopsLabel}
            pending={
              !analysis?.status ||
              (analysis.status.status !== "complete" && loopsCount === 0)
            }
          />
        </div>

        {/* Re-analyze button */}
        <button
          type="button"
          onClick={handleReanalyze}
          disabled={isAnalyzing}
          className={
            hasFailed
              ? "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
              : "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#272C36] focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
          }
          style={
            hasFailed
              ? { background: "#E8863A" }
              : { color: "#E8863A" }
          }
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Analyzing...
            </>
          ) : (
            "Re-analyze"
          )}
        </button>
      </div>

      {/* Step-by-step progress when analyzing */}
      {isAnalyzing && (
        <AnalysisStatus
          currentStep={analysis?.status?.currentStep ?? null}
          completedSteps={completedSteps}
          variant="detail"
        />
      )}
    </div>
  );
}
