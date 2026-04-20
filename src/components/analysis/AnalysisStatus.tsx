"use client";

import { Check, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Tempo", "Key", "Sections", "Loops"] as const;

interface AnalysisStatusProps {
  currentStep: string | null;
  completedSteps: string[];
  variant: "card" | "detail";
}

export function AnalysisStatus({
  currentStep,
  completedSteps,
  variant,
}: AnalysisStatusProps) {
  if (variant === "card") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1 w-1">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[#E8863A]" />
        </span>
        <span className="text-xs text-muted-foreground">Analyzing...</span>
      </div>
    );
  }

  // Detail variant: step-by-step progress
  return (
    <div className="mt-4 flex items-center gap-2">
      {STEPS.map((step) => {
        const stepKey = step.toLowerCase();
        const isCompleted = completedSteps.includes(stepKey);
        const isCurrent = currentStep === stepKey;

        return (
          <div key={step} className="flex items-center gap-1">
            {isCompleted ? (
              <Check size={12} className="text-[#E8863A]" />
            ) : isCurrent ? (
              <Loader2 size={12} className="animate-spin text-[#E8863A]" />
            ) : (
              <Minus size={12} className="text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-xs",
                isCompleted || isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
