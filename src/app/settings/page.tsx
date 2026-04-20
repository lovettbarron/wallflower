"use client";

import { ModelManagement } from "@/components/settings/ModelManagement";
import { AnalysisProfileSelector } from "@/components/settings/AnalysisProfileSelector";
import { SettingsPage } from "@/components/settings/SettingsPage";

/**
 * Settings route page.
 * The primary settings UI is rendered by SettingsPage component
 * which already includes ModelManagement and AnalysisProfileSelector.
 * This route provides direct navigation to /settings.
 */
export default function SettingsRoutePage() {
  return (
    <SettingsPage
      onBack={() => {
        if (typeof window !== "undefined") {
          window.history.back();
        }
      }}
    />
  );
}
