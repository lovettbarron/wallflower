"use client";

import type { ReactNode } from "react";

interface DateGroupProps {
  label: string;
  children: ReactNode;
}

export function DateGroup({ label, children }: DateGroupProps) {
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="mb-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
