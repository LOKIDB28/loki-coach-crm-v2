// Hand-written types matching the real loki-crm-prod schema (project ref
// lxujdwlhcsgfsvqrtgfq) plus supabase/migrations/0003_extend_deals_for_mvp.sql.
// Keep in sync manually - no generated types in this MVP. Note: the option
// unions below (NiveauInteret, EvaluationClient, Accidente) are enforced by
// this app only - the 0003 columns have no DB check constraint.

export type TypeContact = "particulier" | "entreprise" | "concessionnaire";

export type Canal = "direct" | "tmcs";

export type NiveauInteret = "Faible" | "Moyen" | "Élevé" | "Très élevé";

export type Accidente = "Non accidenté" | "Accidenté" | "Inconnu";

export type EvaluationClient =
  | "Très intéressé — prêt à avancer"
  | "Intéressé — besoin de temps"
  | "Hésitant"
  | "Froid";

export type ActivityType =
  | "note"
  | "appel"
  | "courriel"
  | "texto"
  | "rencontre"
  | "changement_etape"
  | "autre";

export interface Profile {
  id: string;
  nom: string;
  email: string;
  role: "admin" | "internal" | "client";
  created_at: string;
}

export interface PipelineStage {
  id: number;
  code: string;
  label: string;
  probability: number;
  is_open: boolean;
  position: number;
}

export interface Coach {
  id: string;
  unit_number: string;
  modele: string | null;
  statut: "disponible" | "reserve" | "en_production" | "vendu" | "stock" | "livre";
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  created_at: string;
  updated_at: string;

  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  compagnie: string | null;
  ville: string | null;
  province_etat: string | null;
  code_postal: string | null;
  pays: string;
  type_contact: TypeContact;
  source: string | null;
  canal: Canal;
  owner_id: string | null;
  notes_intake: string | null;
  consent_marketing: boolean;
  archived: boolean;
}

/** Fields accepted when creating a contact - id/created_at/updated_at are server-generated. */
export type NewContact = Partial<Omit<Contact, "id" | "created_at" | "updated_at">> & {
  prenom: string;
  nom: string;
};

export interface Deal {
  id: string;
  created_at: string;
  updated_at: string;

  contact_id: string;
  coach_id: string | null;
  titre: string;
  stage_id: number;
  montant: number | null;
  valeur_echange: number | null;
  expected_close: string | null;
  owner_id: string | null;
  canal: Canal;
  source: string | null;
  lost_reason: string | null;
  next_action_at: string | null;

  // Added by 0003_extend_deals_for_mvp.sql - not present in the original
  // loki-crm-prod schema. No montant_final: montant itself doubles as the
  // proposal value and the final contract amount - there is only one
  // amount field on a deal.
  niveau_interet: NiveauInteret | null;
  coach_vise: string | null;
  evaluation_client: EvaluationClient | null;
  date_visite_usine: string | null;
  date_essai_routier: string | null;
  options: string | null;
  echange_marque: string | null;
  echange_modele: string | null;
  echange_annee: string | null;
  echange_km: string | null;
  echange_numero_serie: string | null;
  echange_accidente: Accidente | null;
  date_contrat: string | null;
  numero_contrat: string | null;
  date_rdv_service: string | null;

  // Added by 0005_add_deals_archived.sql.
  archived: boolean;
}

export type NewDeal = Partial<Omit<Deal, "id" | "created_at" | "updated_at" | "contact_id">> & {
  contact_id: string;
};

/** A deal joined with its contact - the shape the dashboard fetches and renders. */
export interface DealWithContact extends Deal {
  contact: Contact;
}

export interface Activity {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  type: ActivityType;
  contenu: string;
  created_by: string | null;
  created_at: string;
}

/** Activity joined with the author's profile, as fetched for the feed. */
export interface ActivityWithAuthor extends Activity {
  author: Profile | null;
}

// Read-only rows from loki-crm-prod's reporting views (public.v_sources,
// public.v_forecast_par_rep) - not covered by RLS policies/grants specific
// to this app, they inherit the same "interne" SELECT access as the base
// tables. Used only by the LOKI Intelligence section.

export interface SourceBreakdownRow {
  source: string;
  nb_deals: number;
  gagnes: number;
  revenus: number;
}

export interface ForecastByRepRow {
  proprietaire: string;
  nb_deals: number;
  valeur_brute: number;
  valeur_ponderee: number;
}
