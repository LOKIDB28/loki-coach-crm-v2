// Domain constants and pure business logic. Pipeline stages themselves are
// data now (public.pipeline_stages, fetched live - no hardcoded rep list or
// stage list anywhere, matching the "no hardcoded arrays" principle from the
// README). This module only holds the bits that are genuinely static: which
// icon represents which stage code, the option lists for fields that are
// still free text in the real schema, and the ported duplicate-detection
// logic (findClientMatches / findCoachMatches from the legacy prototype),
// adapted to the contact+deal split.
import {
  User,
  Phone,
  Users,
  FileText,
  Handshake,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { COLORS } from "./theme";
import type { Contact, Deal, DealWithContact } from "./types";

/** Icon per pipeline_stages.code - extend when a new stage code is added in Supabase. */
export const STAGE_ICONS: Record<string, LucideIcon> = {
  prospect: User,
  contact: Phone,
  rencontre: Users,
  proposition: FileText,
  negociation: Handshake,
  gagne: CheckCircle2,
  perdu: XCircle,
};

export function stageIcon(code: string): LucideIcon {
  return STAGE_ICONS[code] ?? FileText;
}

/** Suggested values for the free-text contacts.source field - not DB-enforced. */
export const SOURCE_SUGGESTIONS = [
  "Site web",
  "Salon / Exposition",
  "Référence client",
  "Réseaux sociaux",
  "Facebook",
  "Concessionnaire",
  "Publicité",
  "Événement sportif",
] as const;

export interface Interet {
  v: string;
  c: string;
}

export const INTERETS: Interet[] = [
  { v: "Faible", c: "#6B7280" },
  { v: "Moyen", c: "#00A660" },
  { v: "Élevé", c: "#00A660" },
  { v: "Très élevé", c: "#A6FA30" },
];

export function interetColor(v: string | null | undefined): string {
  return INTERETS.find((i) => i.v === v)?.c ?? "#6B7280";
}

export const EVALUATIONS = [
  "Très intéressé — prêt à avancer",
  "Intéressé — besoin de temps",
  "Hésitant",
  "Froid",
] as const;

export const ACCIDENT_OPTIONS = ["Non accidenté", "Accidenté", "Inconnu"] as const;

/**
 * Minimal shape the duplicate-detection helpers need. Deliberately
 * camelCase to match the prototype's original field names.
 */
export interface DupeCandidate {
  id?: string;
  prenom?: string | null;
  nom?: string | null;
  telephone?: string | null;
  email?: string | null;
  coachVise?: string | null;
}

export function fullName(c: { prenom?: string | null; nom?: string | null }): string {
  return `${(c.prenom || "").trim()} ${(c.nom || "").trim()}`.trim();
}

/**
 * Ported as-is from the prototype: exact (case-insensitive, trimmed) match
 * on phone, email, or full name identifies the same person entered more
 * than once.
 */
export function findClientMatches<T extends DupeCandidate>(
  candidate: DupeCandidate,
  pool: T[],
  excludeId?: string
): T[] {
  const phone = (candidate.telephone || "").trim().toLowerCase();
  const email = (candidate.email || "").trim().toLowerCase();
  const name = fullName(candidate).toLowerCase();
  if (!phone && !email && !name) return [];
  return pool.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const cPhone = (c.telephone || "").trim().toLowerCase();
    const cEmail = (c.email || "").trim().toLowerCase();
    const cName = fullName(c).toLowerCase();
    return (
      (!!phone && !!cPhone && cPhone === phone) ||
      (!!email && !!cEmail && cEmail === email) ||
      (!!name && !!cName && cName === name)
    );
  });
}

/**
 * Adapted from the prototype's findCoachMatches (originally a match on
 * either a targeted-unit number or a new-coach description, now a single
 * free-text coach_vise field): exact case-insensitive match flags two reps
 * chasing the same physical coach. Coarser than the two-field original -
 * accepted tradeoff of the coach_vise merge, revisit if it under-matches
 * in practice.
 */
export function findCoachMatches<T extends DupeCandidate>(
  candidate: DupeCandidate,
  pool: T[],
  excludeId?: string
): T[] {
  const coach = (candidate.coachVise || "").trim().toLowerCase();
  if (!coach) return [];
  return pool.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const cCoach = (c.coachVise || "").trim().toLowerCase();
    return !!cCoach && cCoach === coach;
  });
}

function toDupeCandidate(d: {
  id?: string;
  contact?: Pick<Contact, "prenom" | "nom" | "telephone" | "email"> | null;
  prenom?: string | null;
  nom?: string | null;
  telephone?: string | null;
  email?: string | null;
  coach_vise?: string | null;
}): DupeCandidate {
  return {
    id: d.id,
    prenom: d.contact?.prenom ?? d.prenom,
    nom: d.contact?.nom ?? d.nom,
    telephone: d.contact?.telephone ?? d.telephone,
    email: d.contact?.email ?? d.email,
    coachVise: d.coach_vise,
  };
}

/** Convenience wrapper: candidate and pool are deal-with-contact rows, as loaded for the dashboard. */
export function findClientMatchesForDeal(
  candidate: DealWithContact | (Partial<Deal> & { contact: Pick<Contact, "prenom" | "nom" | "telephone" | "email"> }),
  deals: DealWithContact[],
  excludeId?: string
): DealWithContact[] {
  const candidateDupe = toDupeCandidate(candidate);
  const pool = deals.map((d) => ({ ...toDupeCandidate(d), _ref: d }));
  return findClientMatches(candidateDupe, pool, excludeId).map((m) => m._ref);
}

export function findCoachMatchesForDeal(
  candidate: Pick<Deal, "coach_vise"> & { id?: string },
  deals: DealWithContact[],
  excludeId?: string
): DealWithContact[] {
  const candidateDupe = toDupeCandidate(candidate);
  const pool = deals.map((d) => ({ ...toDupeCandidate(d), _ref: d }));
  return findCoachMatches(candidateDupe, pool, excludeId).map((m) => m._ref);
}

// Fixed ascending order for deals.rate_percent, used only to assign a
// stable color intensity per value across the LOKI Intelligence rate
// charts - a value's shade never changes depending on which subset of
// deals happens to be displayed alongside it (e.g. "10%" looks the same
// in the "tous" pie and the "qualifiées ≥10%" one). Values outside this
// list (shouldn't happen - it's the full set seen in the source data)
// fall back to the darkest shade rather than erroring.
const RATE_LEGEND = [0, 1, 5, 8, 10, 15, 20, 35, 95, 99] as const;

/**
 * Single-hue teal intensity scale for rate_percent charts - darker = more
 * advanced, never a multi-color palette. Eased (quadratic ease-out) rather
 * than linear: most real deals cluster at the low end (0/1/5/8/10%), so
 * that's where the biggest jumps between adjacent steps need to be -  a
 * uniform 0.15-1.0 linear ramp made those specific values look almost
 * identical, which is the opposite of what a reader needs there.
 */
export function rateColor(value: number): string {
  const idx = RATE_LEGEND.indexOf(value as (typeof RATE_LEGEND)[number]);
  const pos = idx === -1 ? RATE_LEGEND.length - 1 : idx;
  const t = pos / (RATE_LEGEND.length - 1);
  const eased = 1 - Math.pow(1 - t, 2);
  const alpha = 0.1 + eased * 0.9;
  return `rgba(0, 166, 96, ${alpha.toFixed(2)})`;
}

// Fixed 6-hue categorical palette for charts with independent, unordered
// categories (source, province/state) - unlike the rate charts above,
// there's no "more advanced" ordering here, so a single-hue intensity scale
// would just look like noise. Every hue is still only teal/green/stone at
// full or half opacity, or teal mixed toward onyx for a darker shade -
// never a color outside the brand palette.
function mix(hexA: string, hexB: string, t: number): string {
  const a = hexA.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const b = hexB.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const [r, g, bch] = a.map((c, i) => Math.round(c + (b[i]! - c) * t));
  return `rgb(${r}, ${g}, ${bch})`;
}

const CATEGORICAL_PALETTE = [
  COLORS.teal, // 1. teal plein
  COLORS.green, // 2. vert vif
  `${COLORS.teal}80`, // 3. teal à 50% (80 hex = ~50% alpha)
  COLORS.stone, // 4. stone gray
  mix(COLORS.teal, COLORS.onyx, 0.4), // 5. teal foncé (mélangé avec onyx)
  `${COLORS.green}80`, // 6. vert vif à 50%
];

/**
 * Assigns each name in the list a color from CATEGORICAL_PALETTE, keyed by a
 * hash of the name so a given category (e.g. "Facebook") lands on the same
 * hue every time it's hashed. A pure hash alone collides often with only 6
 * hues available against real category counts (province/source charts show
 * 8-12 distinct values at once) - two of the biggest bars ending up the same
 * color defeats the point of a categorical palette. So each name's hash slot
 * is only a starting point: if it's already taken by an earlier name in this
 * same list, it probes forward to the next free slot. This guarantees every
 * category is distinct as long as <= 6 are shown together (true for every
 * chart today), while a name's color still only changes if which other
 * names it's rendered alongside changes - not across every render. "Autres"
 * is always stone gray, reserved before any hash assignment runs.
 */
export function assignCategoricalColors(names: string[]): Map<string, string> {
  const n = CATEGORICAL_PALETTE.length;
  const stoneIdx = CATEGORICAL_PALETTE.indexOf(COLORS.stone);
  const used = new Set<number>();
  const result = new Map<string, string>();
  const ordered = [...names].sort((a, b) => (a === "Autres" ? -1 : b === "Autres" ? 1 : 0));
  for (const name of ordered) {
    let slot: number;
    if (name === "Autres") {
      slot = stoneIdx;
    } else {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
      slot = hash % n;
      let attempts = 0;
      while (used.has(slot) && attempts < n) {
        slot = (slot + 1) % n;
        attempts++;
      }
    }
    used.add(slot);
    result.set(name, CATEGORICAL_PALETTE[slot]!);
  }
  return result;
}
