"use client";

import type { Profile } from "@/lib/types";

interface RepresentativeTabsProps {
  profiles: Profile[];
  counts: Record<string, number>;
  totalCount: number;
  /** Empty array = "Tous" selected (no filter). */
  activeOwnerIds: string[];
  /** Toggles a single rep in/out of the selection. */
  onToggle: (ownerId: string) => void;
  /** Resets to "Tous" - always clears the whole selection, never just adds itself as one more choice. */
  onSelectAll: () => void;
}

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeRepName(name: string): string {
  return name.normalize("NFD").replace(DIACRITICS_RE, "").trim().toLowerCase();
}

// Fixed display order confirmed in conversation, "Tous" always first - the
// profiles list itself stays dynamic (live from Supabase), this only
// controls the order the fetched rows render in. Matched by normalized
// (accent/case-insensitive) `nom`, not id/email, since that's the one field
// guaranteed stable across environments. Values below are the exact `nom`
// rows confirmed by direct SQL query against profiles - notably "Jeff Gagne"
// (no accent) and "Pierre-Mathieu" (no "Roy"), not the fuller names that
// would otherwise be guessed. Anyone not in this list (a new rep added
// later) sorts after these five, in whatever order the query returned them
// - never dropped.
const REP_TAB_ORDER = ["Frederick Sabourin", "Jeff Gagne", "Pierre-Mathieu", "Marie-Pierre Boutin", "Louis-Philippe Deblois"].map(
  normalizeRepName
);

/** "Tous" + one tab per team member, driven by the live profiles list instead of a hardcoded array. Multi-select: several rep tabs can be active at once (e.g. comparing two reps' portfolios for duplicates), "Tous" always resets the whole selection rather than joining it as one more choice. */
export function RepresentativeTabs({
  profiles,
  counts,
  totalCount,
  activeOwnerIds,
  onToggle,
  onSelectAll,
}: RepresentativeTabsProps) {
  const orderedProfiles = [...profiles].sort((a, b) => {
    const ia = REP_TAB_ORDER.indexOf(normalizeRepName(a.nom));
    const ib = REP_TAB_ORDER.indexOf(normalizeRepName(b.nom));
    return (ia === -1 ? REP_TAB_ORDER.length : ia) - (ib === -1 ? REP_TAB_ORDER.length : ib);
  });

  return (
    <div className="flex sm:flex-wrap overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none gap-2 -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
      <TabButton
        label="Tous"
        count={totalCount}
        active={activeOwnerIds.length === 0}
        onClick={onSelectAll}
      />
      {orderedProfiles.map((p) => (
        <TabButton
          key={p.id}
          label={p.nom || p.email || "Sans nom"}
          count={counts[p.id] ?? 0}
          active={activeOwnerIds.includes(p.id)}
          onClick={() => onToggle(p.id)}
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
      className={`shrink-0 snap-start min-h-11 text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors ${
        active
          ? "border-teal bg-teal text-white"
          : "border-border/15 bg-surface text-textSoft hover:border-teal/40 hover:text-text"
      }`}
    >
      {label} <span className="tabular-nums opacity-80">({count})</span>
    </button>
  );
}
