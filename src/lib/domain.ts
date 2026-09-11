// Domain constants and pure business logic, ported as-is from the legacy
// loki-coach-crm.jsx prototype (STAGES, PROVENANCES, INTERETS, EVALUATIONS,
// ACCIDENT_OPTIONS, fullName, findClientMatches, findCoachMatches). Field
// names below are camelCase to match the prototype's matching functions;
// callers pass in objects with those camelCase keys (see the `Candidate`
// type), independent of the snake_case Supabase column names in types.ts.
import {
  User,
  CalendarClock,
  Factory,
  FileText,
  FileSignature,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType, Client } from "./types";

export interface Stage {
  id: number;
  code: string;
  label: string;
  icon: LucideIcon;
}

export const STAGES: Stage[] = [
  { id: 1, code: "01", label: "Premier contact", icon: User },
  { id: 2, code: "02", label: "Suivi", icon: CalendarClock },
  { id: 3, code: "03", label: "Usine & essai", icon: Factory },
  { id: 4, code: "04", label: "Proposition", icon: FileText },
  { id: 5, code: "05", label: "Contrat", icon: FileSignature },
  { id: 6, code: "06", label: "1er service", icon: Wrench },
];

export function stageById(id: number | null | undefined): Stage | undefined {
  return STAGES.find((s) => s.id === id);
}

export const PROVENANCES = [
  "Site web",
  "Salon / Exposition",
  "Référence client",
  "Réseaux sociaux",
  "Concessionnaire",
  "Publicité",
  "Événement sportif",
  "Autre",
] as const;

export interface Interet {
  v: string;
  c: string;
}

export const INTERETS: Interet[] = [
  { v: "Faible", c: "#8A7E68" },
  { v: "Moyen", c: "#C6A15B" },
  { v: "Élevé", c: "#B8874A" },
  { v: "Très élevé", c: "#9B5A3A" },
];

export function interetColor(v: string | null | undefined): string {
  return INTERETS.find((i) => i.v === v)?.c ?? "#736A58";
}

export const EVALUATIONS = [
  "Très intéressé — prêt à avancer",
  "Intéressé — besoin de temps",
  "Hésitant",
  "Froid",
] as const;

export const ACCIDENT_OPTIONS = ["Non accidenté", "Accidenté", "Inconnu"] as const;

/** Labels for public.activities.type, keyed for use throughout the UI. */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note_premier_contact: "Note — Premier contact",
  note_suivi: "Note — Suivi",
  note_visite: "Note — Usine & essai",
  note_proposition: "Note — Proposition",
  note_contrat: "Note — Contrat",
  note_service: "Note — 1er service",
  changement_etape: "Changement d'étape",
  autre: "Autre",
};

/** Maps a pipeline stage id to the activity type used for a note logged from that stage's section. */
export const STAGE_NOTE_TYPE: Record<number, ActivityType> = {
  1: "note_premier_contact",
  2: "note_suivi",
  3: "note_visite",
  4: "note_proposition",
  5: "note_contrat",
  6: "note_service",
};

/**
 * Minimal shape the duplicate-detection helpers need. Deliberately
 * camelCase (prenom/nom/telephone/email/coachNeufVise/coachUnite) to match
 * the prototype's original field names - components pass in a client (or
 * new-client form draft) mapped to this shape.
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

/**
 * Bridges the snake_case Supabase row shape (Client/NewClient) to the
 * camelCase DupeCandidate shape the ported matching functions expect.
 */
export function toDupeCandidate(c: Partial<Client>): DupeCandidate {
  return {
    id: c.id,
    prenom: c.prenom,
    nom: c.nom,
    telephone: c.telephone,
    email: c.email,
    coachNeufVise: c.coach_neuf_vise,
    coachUnite: c.coach_unite,
  };
}

export function fullName(c: DupeCandidate): string {
  return `${(c.prenom || "").trim()} ${(c.nom || "").trim()}`.trim();
}

/**
 * Ported as-is from the prototype: exact (case-insensitive, trimmed) match
 * on phone, email, or full name identifies the same person entered more
 * than once.
 */
export function findClientMatches<T extends DupeCandidate>(
  candidate: DupeCandidate,
  clients: T[],
  excludeId?: string
): T[] {
  const phone = (candidate.telephone || "").trim().toLowerCase();
  const email = (candidate.email || "").trim().toLowerCase();
  const name = fullName(candidate).toLowerCase();
  if (!phone && !email && !name) return [];
  return clients.filter((c) => {
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
  clients: T[],
  excludeId?: string
): T[] {
  const coach = (candidate.coachNeufVise || "").trim().toLowerCase();
  const unit = (candidate.coachUnite || "").trim().toLowerCase();
  if (!coach && !unit) return [];
  return clients.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const cCoach = (c.coachNeufVise || "").trim().toLowerCase();
    const cUnit = (c.coachUnite || "").trim().toLowerCase();
    return (!!unit && !!cUnit && cUnit === unit) || (!!coach && !!cCoach && cCoach === coach);
  });
}

/**
 * Convenience wrappers for the common case in this app: candidate and pool
 * are Supabase Client rows (snake_case). Maps to DupeCandidate under the
 * hood and returns the matching full Client rows.
 */
export function findClientMatchesForClient(
  candidate: Partial<Client>,
  clients: Client[],
  excludeId?: string
): Client[] {
  const candidateDupe = toDupeCandidate(candidate);
  const pool = clients.map((c) => ({ ...toDupeCandidate(c), _ref: c }));
  const matches = findClientMatches(candidateDupe, pool, excludeId);
  return matches.map((m) => m._ref);
}

export function findCoachMatchesForClient(
  candidate: Partial<Client>,
  clients: Client[],
  excludeId?: string
): Client[] {
  const candidateDupe = toDupeCandidate(candidate);
  const pool = clients.map((c) => ({ ...toDupeCandidate(c), _ref: c }));
  const matches = findCoachMatches(candidateDupe, pool, excludeId);
  return matches.map((m) => m._ref);
}
