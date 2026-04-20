"use client";

import { useState } from "react";

type AnalysisProfile = "full" | "standard" | "lightweight";

const PROFILES: {
  value: AnalysisProfile;
  label: string;
  description: string;
}[] = [
  {
    value: "full",
    label: "Full",
    description: "All analysis steps, highest accuracy",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Core analysis, good accuracy",
  },
  {
    value: "lightweight",
    label: "Lightweight",
    description: "Tempo and key only, fastest",
  },
];

// Auto-detected recommended profile (placeholder for hardware detection)
const RECOMMENDED_PROFILE: AnalysisProfile = "full";

export function AnalysisProfileSelector() {
  const [profile, setProfile] = useState<AnalysisProfile>(RECOMMENDED_PROFILE);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as AnalysisProfile;
    setProfile(val);
    // TODO: Save to settings via Tauri command when backend supports it
  };

  return (
    <div className="mb-6 space-y-2">
      <label
        htmlFor="analysis-profile"
        className="block text-sm font-semibold text-foreground"
      >
        Analysis Profile
      </label>

      <select
        id="analysis-profile"
        value={profile}
        onChange={handleChange}
        className="w-full rounded-lg border px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#E8863A]"
        style={{
          background: "#272C36",
          borderColor: "#323844",
        }}
      >
        {PROFILES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label} -- {p.description}
          </option>
        ))}
      </select>

      <p className="text-xs text-muted-foreground">
        {profile === RECOMMENDED_PROFILE
          ? `Auto-detected for your hardware: ${PROFILES.find((p) => p.value === profile)?.label}`
          : "Controls which analysis steps run and model quality"}
      </p>
    </div>
  );
}
