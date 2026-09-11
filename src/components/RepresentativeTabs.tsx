"use client";

import type { Profile } from "@/lib/types";

interface RepresentativeTabsProps {
  profiles: Profile[];
  counts: Record<string, number>;
  totalCount: number;
  activeOwnerId: string | null;
  onSelect: (ownerId: string | null) => void;
}

/** "Tous" + one tab per team member, driven by the live profiles list instead of a hardcoded array. */
export function RepresentativeTabs({
  profiles,
  counts,
  totalCount,
  activeOwnerId,
  onSelect,
}: RepresentativeTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <TabButton
        label="Tous"
        count={totalCount}
        active={activeOwnerId === null}
        onClick={() => onSelect(null)}
      />
      {profiles.map((p) => (
        <TabButton
          key={p.id}
          label={p.nom || p.email || "Sans nom"}
          count={counts[p.id] ?? 0}
          active={activeOwnerId === p.id}
          onClick={() => onSelect(p.id)}
        />
      ))}
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors ${
        active
          ? "border-teal bg-teal text-white"
          : "border-border/15 bg-surface text-textSoft hover:border-teal/40 hover:text-text"
      }`}
    >
      {label} <span className="tabular-nums opacity-80">({count})</span>
    </button>
  );
}
