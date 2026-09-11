// Hand-written types matching supabase/migrations/0001_init.sql.
// Keep these in sync manually (no generated types in this MVP - no live
// Supabase project was available at build time to run `supabase gen types`).

export type TypeClient = "Particulier" | "Concessionnaire";

export type NiveauInteret = "Faible" | "Moyen" | "Élevé" | "Très élevé";

export type Provenance =
  | "Site web"
  | "Salon / Exposition"
  | "Référence client"
  | "Réseaux sociaux"
  | "Concessionnaire"
  | "Publicité"
  | "Événement sportif"
  | "Autre";

export type Accidente = "Non accidenté" | "Accidenté" | "Inconnu";

export type EvaluationClient =
  | "Très intéressé — prêt à avancer"
  | "Intéressé — besoin de temps"
  | "Hésitant"
  | "Froid";

export type ActivityType =
  | "note_premier_contact"
  | "note_suivi"
  | "note_visite"
  | "note_proposition"
  | "note_contrat"
  | "note_service"
  | "changement_etape"
  | "autre";

export interface Profile {
  id: string;
  nom: string | null;
  email: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  created_at: string;
  updated_at: string;

  stage: number; // 1-6
  type_client: TypeClient;
  owner_id: string | null;

  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  email: string | null;
  ville: string | null;
  code_postal: string | null;

  provenance: Provenance | null;
  niveau_interet: NiveauInteret | null;
  coach_neuf_vise: string | null;
  coach_unite: string | null;
  coach_marque: string | null;
  coach_modele: string | null;
  coach_annee: string | null;
  coach_km: string | null;
  coach_accidente: Accidente | null;

  follow_up_date: string | null;
  evaluation_client: EvaluationClient | null;

  visite_usine_date: string | null;
  essai_routier_date: string | null;

  prix_vente: number | null;
  options: string | null;
  echange_description: string | null;
  echange_numero_serie: string | null;
  echange_valeur: number | null;

  date_contrat: string | null;
  numero_contrat: string | null;
  montant_final: number | null;

  date_rdv_service: string | null;
}

/** Fields accepted when creating a client - id/created_at/updated_at are server-generated. */
export type NewClient = Partial<Omit<Client, "id" | "created_at" | "updated_at">> & {
  prenom: string;
  nom: string;
};

export interface Activity {
  id: string;
  client_id: string;
  type: ActivityType;
  contenu: string;
  created_by: string | null;
  created_at: string;
}

/** Activity joined with the author's profile, as fetched for the feed. */
export interface ActivityWithAuthor extends Activity {
  author: Profile | null;
}
