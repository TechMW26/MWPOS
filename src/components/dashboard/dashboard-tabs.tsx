"use client";

import { cn } from "@/lib/cn";

export function DashboardTabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "h-9 whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground transition-all",
            value === tab.value ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
