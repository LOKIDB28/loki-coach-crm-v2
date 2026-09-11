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
  coachNeufVise?: string | null;
  coachUnite?: string | null;
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
 * Ported as-is from the prototype: exact (case-insensitive, trimmed) match
 * on the targeted unit/stock number or new-coach description flags two
 * reps chasing the same physical unit.
 */
export function findCoachMatches<T extends DupeCandidate>(
  candidate: DupeCandidate,
  pool: T[],
  excludeId?: string
): T[] {
  const coach = (candidate.coachNeufVise || "").trim().toLowerCase();
  const unit = (candidate.coachUnite || "").trim().toLowerCase();
  if (!coach && !unit) return [];
  return pool.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const cCoach = (c.coachNeufVise || "").trim().toLowerCase();
    const cUnit = (c.coachUnite || "").trim().toLowerCase();
    return (!!unit && !!cUnit && cUnit === unit) || (!!coach && !!cCoach && cCoach === coach);
  });
}

function toDupeCandidate(d: {
  id?: string;
  contact?: Pick<Contact, "prenom" | "nom" | "telephone" | "email"> | null;
  prenom?: string | null;
  nom?: string | null;
  telephone?: string | null;
  email?: string | null;
  coach_neuf_vise?: string | null;
  coach_unite?: string | null;
}): DupeCandidate {
  return {
    id: d.id,
    prenom: d.contact?.prenom ?? d.prenom,
    nom: d.contact?.nom ?? d.nom,
    telephone: d.contact?.telephone ?? d.telephone,
    email: d.contact?.email ?? d.email,
    coachNeufVise: d.coach_neuf_vise,
    coachUnite: d.coach_unite,
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
  candidate: Pick<Deal, "coach_neuf_vise" | "coach_unite"> & { id?: string },
  deals: DealWithContact[],
  excludeId?: string
): DealWithContact[] {
  const candidateDupe = toDupeCandidate(candidate);
  const pool = deals.map((d) => ({ ...toDupeCandidate(d), _ref: d }));
  return findCoachMatches(candidateDupe, pool, excludeId).map((m) => m._ref);
}
