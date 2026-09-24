"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  XCircle,
  X,
} from "lucide-react";
import { Field } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import { TextArea } from "./ui/TextArea";
import { Select } from "./ui/Select";
import { CurrencyInput } from "./ui/CurrencyInput";
import { UnitPicker } from "./ui/UnitPicker";
import { Section } from "./Section";
import { ActivityFeed } from "./ActivityFeed";
import { TradeInPhotos } from "./TradeInPhotos";
import {
  ACCIDENT_OPTIONS,
  EVALUATIONS,
  findClientMatchesForDeal,
  findCoachMatchesForDeal,
  fullName,
  INTERETS,
  normalizeRepName,
  REP_TAB_ORDER,
  SOURCE_SUGGESTIONS,
  stageIcon,
} from "@/lib/domain";
import { formatCurrency, formatDateTime, fromDatetimeLocalValue, getErrorMessage, toDatetimeLocalValue } from "@/lib/format";
import { IMPORT_BADGE_COLOR } from "@/lib/theme";
import type { ActivityWithAuthor, Coach, Contact, Deal, DealPhoto, DealWithContact, PipelineStage, Profile } from "@/lib/types";

interface DealDrawerProps {
  deal: DealWithContact;
  stages: PipelineStage[];
  profiles: Profile[];
  coaches: Coach[];
  allDeals: DealWithContact[];
  activities: ActivityWithAuthor[];
  activitiesLoading: boolean;
  photos: DealPhoto[];
  photoUrls: Record<string, string>;
  photoUploading: boolean;
  photoError: string | null;
  onClose: () => void;
  onUpdateContact: (patch: Partial<Contact>) => Promise<void>;
  onUpdateDeal: (patch: Partial<Deal>) => Promise<void>;
  onChangeStage: (newStageId: number) => Promise<void>;
  onAddNote: (contenu: string) => Promise<void>;
  onUploadPhotos: (files: File[]) => void;
  onDeletePhoto: (photo: DealPhoto) => void;
}

// Local draft state for each pipeline-stage section - fields here are NOT
// autosaved (unlike the quick contact fields and stage stepper, which
// still commit immediately). Each section only writes to Supabase when its
// own "Enregistrer" button is clicked, per the project's explicit choice
// to batch stage-section edits rather than save silently per field.

interface Section1State {
  source: string;
  // Only meaningful while source === "Référence interne" - the field itself
  // stays populated if the rep switches source away and back, but is only
  // ever shown/saved while that condition holds (see saveSection1).
  reference_par_profile_id: string | null;
  niveau_interet: Deal["niveau_interet"];
  type_vehicule_vise: Deal["type_vehicule_vise"];
  // Unit qualification - a single edit point now. coach_id (moved here from
  // what was Section 2) is the real inventory link, always editable;
  // numero_unite_libre/coach_vise are the fallback pair shown only while
  // coach_id is empty, replacing the old two-fields-two-sections split
  // that let them disagree with each other.
  coach_id: string | null;
  coach_vise: string;
  numero_unite_libre: string;
  // Trade-in ("véhicule en échange") - marque/modele/annee/km/accidente/
  // numero_serie moved here from Section 4 previously; valeur_echange now
  // joins them (also moved from Section 4) so the description and the
  // dollar value of the same trade-in vehicle live in one place. Section 4
  // keeps only montant/options - each of these columns has exactly one
  // section reading/writing it, never two.
  valeur_echange: number | null;
  echange_marque: string;
  echange_modele: string;
  echange_annee: string;
  echange_km: string;
  echange_accidente: Deal["echange_accidente"];
  echange_numero_serie: string;
  dirty: boolean;
  saving: boolean;
}
function section1Defaults(deal: DealWithContact): Section1State {
  return {
    source: deal.contact.source ?? "",
    reference_par_profile_id: deal.reference_par_profile_id,
    niveau_interet: deal.niveau_interet,
    type_vehicule_vise: deal.type_vehicule_vise,
    coach_id: deal.coach_id,
    coach_vise: deal.coach_vise ?? "",
    numero_unite_libre: deal.numero_unite_libre ?? "",
    valeur_echange: deal.valeur_echange,
    echange_marque: deal.echange_marque ?? "",
    echange_modele: deal.echange_modele ?? "",
    echange_annee: deal.echange_annee ?? "",
    echange_km: deal.echange_km ?? "",
    echange_accidente: deal.echange_accidente,
    echange_numero_serie: deal.echange_numero_serie ?? "",
    dirty: false,
    saving: false,
  };
}

/** True if any trade-in field already has data - drives the initial state of the "Véhicule en échange ?" toggle so existing data reopens expanded. */
function hasEchangeData(deal: Deal): boolean {
  return Boolean(
    deal.echange_marque ||
      deal.echange_modele ||
      deal.echange_annee ||
      deal.echange_km ||
      deal.echange_numero_serie ||
      deal.echange_accidente
  );
}

interface Section3State {
  next_action_at: string | null;
  evaluation_client: Deal["evaluation_client"];
  date_visite_usine: string | null;
  date_visite_bureau: string | null;
  date_essai_routier: string | null;
  dirty: boolean;
  saving: boolean;
}
function section3Defaults(deal: DealWithContact): Section3State {
  return {
    next_action_at: deal.next_action_at,
    evaluation_client: deal.evaluation_client,
    date_visite_usine: deal.date_visite_usine,
    date_visite_bureau: deal.date_visite_bureau,
    date_essai_routier: deal.date_essai_routier,
    dirty: false,
    saving: false,
  };
}

interface Section4State {
  montant: number | null;
  options: string;
  dirty: boolean;
  saving: boolean;
}
function section4Defaults(deal: DealWithContact): Section4State {
  return {
    montant: deal.montant,
    options: deal.options ?? "",
    dirty: false,
    saving: false,
  };
}

// No montant here - it's editable only in section 4 (Proposition) and
// shown read-only in section 6 (Gagné), straight from the live deal, so
// the two sections' independent "Enregistrer" buttons can never
// desynchronize the same underlying field.
interface Section6State {
  date_contrat: string | null;
  numero_contrat: string;
  date_rdv_service: string | null;
  dirty: boolean;
  saving: boolean;
}
function section6Defaults(deal: DealWithContact): Section6State {
  return {
    date_contrat: deal.date_contrat,
    numero_contrat: deal.numero_contrat ?? "",
    date_rdv_service: deal.date_rdv_service,
    dirty: false,
    saving: false,
  };
}

interface Section7State {
  lost_reason: string;
  dirty: boolean;
  saving: boolean;
}
function section7Defaults(deal: DealWithContact): Section7State {
  return { lost_reason: deal.lost_reason ?? "", dirty: false, saving: false };
}

export function DealDrawer({
  deal,
  stages,
  profiles,
  coaches,
  allDeals,
  activities,
  activitiesLoading,
  photos,
  photoUrls,
  photoUploading,
  photoError,
  onClose,
  onUpdateContact,
  onUpdateDeal,
  onChangeStage,
  onAddNote,
  onUploadPhotos,
  onDeletePhoto,
}: DealDrawerProps) {
  const [localContact, setLocalContact] = useState(deal.contact);
  const [localDeal, setLocalDeal] = useState<Deal>(deal);
  const [saving, setSaving] = useState(false);

  // Archiver / Marquer gagné / Marquer perdu share one pending-confirmation
  // slot rather than three near-identical boolean flags + banners.
  const [pendingAction, setPendingAction] = useState<"archive" | "gagne" | "perdu" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Shared error surface for every save path in this drawer - previously a
  // failed request (e.g. writing to a column that doesn't exist yet) threw
  // with no catch anywhere, so it failed completely silently: the button
  // looked like it did nothing, no error ever reached the screen.
  const [saveError, setSaveError] = useState<string | null>(null);

  const [section1, setSection1] = useState(() => section1Defaults(deal));
  // Not persisted - purely local UI visibility for the trade-in fields
  // below the "Véhicule en échange ?" toggle. Starts expanded when the deal
  // already has trade-in data (e.g. opening an older deal that was filled
  // in before this toggle existed), collapsed otherwise.
  const [showEchange, setShowEchange] = useState(() => hasEchangeData(deal));
  const [contactingBusy, setContactingBusy] = useState(false);
  const [section3, setSection3] = useState(() => section3Defaults(deal));
  const [section4, setSection4] = useState(() => section4Defaults(deal));
  const [section6, setSection6] = useState(() => section6Defaults(deal));
  const [section7, setSection7] = useState(() => section7Defaults(deal));

  // Quick contact fields, the stepper, and owner_id stay autosaved - resync
  // them on every deal update, not just when switching to a different deal.
  useEffect(() => {
    setLocalContact(deal.contact);
    setLocalDeal(deal);
  }, [deal]);

  // Section drafts only reset when actually opening a different deal - an
  // unrelated autosave elsewhere (owner_id, stage stepper) must not wipe an
  // in-progress, not-yet-saved section edit.
  useEffect(() => {
    setSection1(section1Defaults(deal));
    setSection3(section3Defaults(deal));
    setSection4(section4Defaults(deal));
    setSection6(section6Defaults(deal));
    setSection7(section7Defaults(deal));
    setShowEchange(hasEchangeData(deal));
    setPendingAction(null);
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  const clientDupes = findClientMatchesForDeal(deal, allDeals, deal.id);
  const coachDupes = findCoachMatchesForDeal({ coach_vise: section1.coach_vise }, allDeals, deal.id);

  async function commitContact(patch: Partial<Contact>) {
    setLocalContact((c) => ({ ...c, ...patch }));
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdateContact(patch);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  }

  async function commitDeal(patch: Partial<Deal>) {
    setLocalDeal((d) => ({ ...d, ...patch }));
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdateDeal(patch);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  }

  async function saveSection1() {
    setSection1((s) => ({ ...s, saving: true }));
    setSaveError(null);
    try {
      await Promise.all([
        onUpdateContact({ source: section1.source || null }),
        onUpdateDeal({
          // Cleared whenever source isn't "Référence interne", regardless
          // of what's still sitting in local draft state - never persists a
          // referrer for a deal no longer attributed as an internal
          // referral.
          reference_par_profile_id: section1.source.trim() === "Référence interne" ? section1.reference_par_profile_id : null,
          niveau_interet: section1.niveau_interet,
          type_vehicule_vise: section1.type_vehicule_vise,
          coach_id: section1.coach_id,
          coach_vise: section1.coach_vise || null,
          numero_unite_libre: section1.numero_unite_libre || null,
          valeur_echange: section1.valeur_echange,
          echange_marque: section1.echange_marque || null,
          echange_modele: section1.echange_modele || null,
          echange_annee: section1.echange_annee || null,
          echange_km: section1.echange_km || null,
          echange_accidente: section1.echange_accidente,
          echange_numero_serie: section1.echange_numero_serie || null,
        }),
      ]);
      setSection1((s) => ({ ...s, saving: false, dirty: false }));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
      setSection1((s) => ({ ...s, saving: false }));
    }
  }

  // Direct write, no draft/dirty state - a one-way, timestamped action
  // (like archiving or marking gagné/perdu), not a field to correct later.
  // The deals_log_first_contact trigger captures who/when server-side; the
  // confirmation text below reads it back from the already-loaded
  // `activities` array instead of a second round-trip.
  //
  // Also advances stage_id Prospect -> Contact in the SAME update, but only
  // when the deal is still at Prospect - a deal already further along
  // (e.g. contacted after a meeting was already logged) keeps its stage
  // untouched. One UPDATE, two independent AFTER UPDATE triggers
  // (deals_log_stage + deals_log_first_contact) each fire off it, so both
  // "Prospect → Contact" and "Premier contact effectué" land in activities
  // from this single write - verified before writing this, not assumed.
  async function handleMarkContacted() {
    setContactingBusy(true);
    setSaveError(null);
    try {
      const patch: Partial<Deal> = { premier_contact_le: new Date().toISOString() };
      if (localDeal.stage_id === prospectStage?.id && contactStage) {
        patch.stage_id = contactStage.id;
      }
      await onUpdateDeal(patch);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
    } finally {
      setContactingBusy(false);
    }
  }

  async function saveSection3() {
    setSection3((s) => ({ ...s, saving: true }));
    setSaveError(null);
    try {
      await onUpdateDeal({
        next_action_at: section3.next_action_at,
        evaluation_client: section3.evaluation_client,
        date_visite_usine: section3.date_visite_usine,
        date_visite_bureau: section3.date_visite_bureau,
        date_essai_routier: section3.date_essai_routier,
      });
      setSection3((s) => ({ ...s, saving: false, dirty: false }));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
      setSection3((s) => ({ ...s, saving: false }));
    }
  }

  async function saveSection4() {
    setSection4((s) => ({ ...s, saving: true }));
    setSaveError(null);
    try {
      await onUpdateDeal({
        montant: section4.montant,
        options: section4.options || null,
      });
      setSection4((s) => ({ ...s, saving: false, dirty: false }));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
      setSection4((s) => ({ ...s, saving: false }));
    }
  }

  async function saveSection6() {
    setSection6((s) => ({ ...s, saving: true }));
    setSaveError(null);
    try {
      await onUpdateDeal({
        date_contrat: section6.date_contrat,
        numero_contrat: section6.numero_contrat || null,
        date_rdv_service: section6.date_rdv_service,
      });
      setSection6((s) => ({ ...s, saving: false, dirty: false }));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
      setSection6((s) => ({ ...s, saving: false }));
    }
  }

  async function saveSection7() {
    setSection7((s) => ({ ...s, saving: true }));
    setSaveError(null);
    try {
      await onUpdateDeal({ lost_reason: section7.lost_reason || null });
      setSection7((s) => ({ ...s, saving: false, dirty: false }));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors de l'enregistrement."));
      setSection7((s) => ({ ...s, saving: false }));
    }
  }

  const currentStage = stages.find((s) => s.id === localDeal.stage_id);

  // The stepper's arrows only ever move within the open stages - closing a
  // deal (gagné/perdu) is exclusively done via the two dedicated buttons
  // below, never as a side effect of clicking "next" past the last open
  // stage. Driven by pipeline_stages.is_open, not a hardcoded stage list.
  const openStages = stages.filter((s) => s.is_open);
  const openIndex = openStages.findIndex((s) => s.id === localDeal.stage_id);
  const isClosedStage = openIndex === -1;

  const stageByCode = (code: string) => stages.find((s) => s.code === code);
  const prospectStage = stageByCode("prospect");
  const contactStage = stageByCode("contact");

  // Internal-referral picker (Section 1, "Référence interne" source) -
  // "client" role profiles can't have made a referral, and reuses the same
  // fixed 5-person order as RepresentativeTabs so both lists read the same.
  // is_system_account excluded explicitly - a system/test account (qa-bot)
  // never made a real referral, regardless of its role.
  const internalProfiles = profiles
    .filter((p) => (p.role === "admin" || p.role === "internal") && !p.is_system_account)
    .sort((a, b) => {
      const ia = REP_TAB_ORDER.indexOf(normalizeRepName(a.nom));
      const ib = REP_TAB_ORDER.indexOf(normalizeRepName(b.nom));
      return (ia === -1 ? REP_TAB_ORDER.length : ia) - (ib === -1 ? REP_TAB_ORDER.length : ib);
    });

  // Once first contact is logged, going back to Prospect specifically is
  // blocked - every other backward move (e.g. Rencontre -> Contact) stays
  // untouched. Checked against the actual target stage's id, not a
  // hardcoded index, so it still holds if stage positions ever change.
  const targetPrevStage = openStages[openIndex - 1];
  const prevBlockedByContact = targetPrevStage?.id === prospectStage?.id && Boolean(localDeal.premier_contact_le);
  const rencontreStage = stageByCode("rencontre");
  const propositionStage = stageByCode("proposition");
  const negociationStage = stageByCode("negociation");
  const gagneStage = stageByCode("gagne");
  const perduStage = stageByCode("perdu");

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setActionBusy(true);
    setSaveError(null);
    try {
      if (pendingAction === "archive") {
        await onUpdateDeal({ archived: true });
        onClose();
      } else if (pendingAction === "gagne" && gagneStage) {
        await onChangeStage(gagneStage.id);
      } else if (pendingAction === "perdu" && perduStage) {
        await onChangeStage(perduStage.id);
      }
      setPendingAction(null);
    } catch (err) {
      // Keep the confirmation banner open on failure so "Confirmer" can be
      // retried once the error above is understood, instead of silently
      // dismissing as if nothing happened.
      setSaveError(getErrorMessage(err, "Erreur lors de l'action."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleUnarchive() {
    setSaveError(null);
    try {
      await onUpdateDeal({ archived: false });
    } catch (err) {
      setSaveError(getErrorMessage(err, "Erreur lors du désarchivage."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-onyx/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl h-full bg-bg/60 backdrop-blur-md border-l border-border/10 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border/15 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text flex items-center gap-2 min-w-0">
              <span className="truncate">{fullName(localContact) || "(sans nom)"}</span>
              {deal.source_import === "pipedrive" && (
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: IMPORT_BADGE_COLOR }}
                  title="Importé de Pipedrive"
                >
                  P
                </span>
              )}
            </h2>
            <p className="text-xs text-textSoft">{saving ? "Enregistrement…" : "Enregistré"}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {deal.archived ? (
              <button
                type="button"
                onClick={handleUnarchive}
                className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-teal"
                aria-label="Désarchiver le dossier"
                title="Désarchiver le dossier"
              >
                <ArchiveRestore size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPendingAction("archive")}
                className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-text"
                aria-label="Archiver le dossier"
                title="Archiver le dossier"
              >
                <Archive size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-text"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {saveError && (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-red-400/30 bg-red-500/5 px-3 py-2 text-sm text-red-500">
              <span>{saveError}</span>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="shrink-0 hover:text-red-600"
                aria-label="Fermer le message d'erreur"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {deal.archived && (
            <div className="rounded-lg bg-textSoft/10 px-3 py-2 text-xs text-textSoft">
              Ce dossier est archivé - masqué de la vue Pipeline par défaut.
            </div>
          )}

          {pendingAction && (
            <div
              className={`rounded-xl border px-3.5 py-3 space-y-2 backdrop-blur-sm ${
                pendingAction === "gagne"
                  ? "border-green/30 bg-green/10"
                  : pendingAction === "perdu"
                  ? "border-red-400/30 bg-red-500/5"
                  : "border-border/20 bg-surface2/70"
              }`}
            >
              <p className="text-sm text-text">
                {pendingAction === "archive" &&
                  "Archiver ce dossier ? Il disparaîtra de la vue Pipeline par défaut, mais restera consultable via «Afficher les dossiers archivés» et pourra être désarchivé à tout moment."}
                {pendingAction === "gagne" && "Marquer ce dossier comme gagné ?"}
                {pendingAction === "perdu" && "Marquer ce dossier comme perdu ?"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={confirmPendingAction}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
                >
                  {actionBusy ? "En cours…" : "Confirmer"}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setPendingAction(null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border/20 text-textSoft hover:text-text"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {(clientDupes.length > 0 || coachDupes.length > 0) && (
            <div className="space-y-1.5">
              {clientDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Ce client existe aussi dans : {clientDupes.map((d) => fullName(d.contact)).join(", ")}
                  </span>
                </div>
              )}
              {coachDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Coach/unité aussi visé par : {coachDupes.map((d) => fullName(d.contact)).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Stage stepper - open stages only (5). Closing a deal never
              happens via the arrows, only via the two buttons below. */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/15 bg-surface px-3 py-2.5">
            <button
              type="button"
              disabled={isClosedStage || openIndex <= 0 || prevBlockedByContact}
              onClick={() => onChangeStage(openStages[openIndex - 1]!.id)}
              className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-teal disabled:opacity-30 disabled:hover:text-textSoft"
              aria-label="Étape précédente"
              title={prevBlockedByContact ? "Retour à Prospect impossible - premier contact déjà enregistré" : undefined}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className={`text-xs font-medium ${isClosedStage ? "text-textSoft" : "text-teal"}`}>
                {currentStage?.label}
              </div>
              {!isClosedStage && (
                <div className="text-[11px] text-textSoft">
                  Étape {openIndex + 1} / {openStages.length}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={isClosedStage || openIndex >= openStages.length - 1}
              onClick={() => onChangeStage(openStages[openIndex + 1]!.id)}
              className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-teal disabled:opacity-30 disabled:hover:text-textSoft"
              aria-label="Étape suivante"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Always-visible, explicit close-out actions - never a side
              effect of the stepper, and never disabled by current state
              (a "perdu" deal can always be reopened as "gagné" later). */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingAction("gagne")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green text-onyx hover:bg-green/90"
            >
              <CheckCircle2 size={14} /> Marquer gagné
            </button>
            <button
              type="button"
              onClick={() => setPendingAction("perdu")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-red-400/40 text-red-500 hover:bg-red-500/10"
            >
              <XCircle size={14} /> Marquer perdu
            </button>
          </div>

          {/* "Historique & notes" - moved up here (was below the quick
              contact fields, after the 7 sections) and given a solid teal
              header band so it's unmissable the moment the drawer opens,
              not one plain-text label among several. The general note
              composer lives in the same block now, right next to the
              history it adds to - Section 5 keeps its own, dedicated to
              negotiation notes specifically, clearly relabeled so the two
              are never confused. */}
          <div className="rounded-xl overflow-hidden border border-teal/30">
            <div className="bg-teal px-4 py-2.5 flex items-center gap-2">
              <History size={15} className="text-white" />
              <h3 className="text-sm font-semibold text-white">Historique &amp; notes</h3>
            </div>
            <div className="bg-surface px-4 py-3.5 space-y-3">
              <ActivityFeed activities={activities} loading={activitiesLoading} />
              <NoteComposer
                onSubmit={onAddNote}
                label="Ajouter une note générale au dossier"
                // Forcing a light background alone left the typed text and
                // placeholder on TextArea's default theme-reactive colors
                // (text-text/placeholder:text-textSoft), which resolve to
                // near-white in dark mode - invisible on a background
                // that's always light regardless of theme. Both need the
                // same fixed-not-theme-reactive treatment as the background.
                inputClassName="!bg-paper !text-onyx placeholder:!text-stone"
              />
            </div>
          </div>

          {/* Quick contact fields - autosave, unchanged */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <TextInput
                value={localContact.prenom}
                onChange={(e) => setLocalContact((c) => ({ ...c, prenom: e.target.value }))}
                onBlur={(e) => commitContact({ prenom: e.target.value })}
              />
            </Field>
            <Field label="Nom">
              <TextInput
                value={localContact.nom}
                onChange={(e) => setLocalContact((c) => ({ ...c, nom: e.target.value }))}
                onBlur={(e) => commitContact({ nom: e.target.value })}
              />
            </Field>
            <Field label="Téléphone">
              <TextInput
                value={localContact.telephone ?? ""}
                onChange={(e) => setLocalContact((c) => ({ ...c, telephone: e.target.value }))}
                onBlur={(e) => commitContact({ telephone: e.target.value })}
              />
            </Field>
            <Field label="Courriel">
              <TextInput
                type="email"
                value={localContact.email ?? ""}
                onChange={(e) => setLocalContact((c) => ({ ...c, email: e.target.value }))}
                onBlur={(e) => commitContact({ email: e.target.value })}
              />
            </Field>
            <Field label="Ville">
              <TextInput
                value={localContact.ville ?? ""}
                onChange={(e) => setLocalContact((c) => ({ ...c, ville: e.target.value }))}
                onBlur={(e) => commitContact({ ville: e.target.value })}
              />
            </Field>
            <Field label="Code postal">
              <TextInput
                value={localContact.code_postal ?? ""}
                onChange={(e) => setLocalContact((c) => ({ ...c, code_postal: e.target.value }))}
                onBlur={(e) => commitContact({ code_postal: e.target.value })}
              />
            </Field>
            <Field label="Type de client">
              <Select
                value={localContact.type_contact}
                onChange={(e) => commitContact({ type_contact: e.target.value as Contact["type_contact"] })}
              >
                <option value="particulier">Particulier</option>
                <option value="entreprise">Entreprise</option>
                <option value="concessionnaire">Concessionnaire</option>
              </Select>
            </Field>
            <Field label="Représentant">
              <Select value={localDeal.owner_id ?? ""} onChange={(e) => commitDeal({ owner_id: e.target.value || null })}>
                <option value="">Non assigné</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom || p.email}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Per-stage sections - draft + explicit "Enregistrer" per section */}
          <div className="space-y-2.5">
            <Section
              code="1"
              title={prospectStage?.label ?? "Prospect"}
              icon={stageIcon("prospect")}
              active={localDeal.stage_id === prospectStage?.id}
              defaultOpen={localDeal.stage_id === prospectStage?.id}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source">
                  <TextInput
                    list="source-suggestions"
                    value={section1.source}
                    onChange={(e) => setSection1((s) => ({ ...s, source: e.target.value, dirty: true }))}
                  />
                  <datalist id="source-suggestions">
                    {SOURCE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Niveau d'intérêt">
                  <Select
                    value={section1.niveau_interet ?? ""}
                    onChange={(e) =>
                      setSection1((s) => ({
                        ...s,
                        niveau_interet: (e.target.value || null) as Deal["niveau_interet"],
                        dirty: true,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {INTERETS.map((i) => (
                      <option key={i.v} value={i.v}>
                        {i.v}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-textSoft mt-1">Impression initiale, avant rencontre.</p>
                </Field>
                <Field label="Type de véhicule visé" className="col-span-2">
                  <Select
                    value={section1.type_vehicule_vise ?? ""}
                    onChange={(e) =>
                      setSection1((s) => ({
                        ...s,
                        type_vehicule_vise: (e.target.value || null) as Deal["type_vehicule_vise"],
                        dirty: true,
                      }))
                    }
                  >
                    <option value="">—</option>
                    <option value="neuf">Neuf</option>
                    <option value="usager">Usager</option>
                  </Select>
                </Field>
              </div>

              {section1.source.trim() === "Référence interne" && (
                <Field label="Référé par (interne)">
                  <Select
                    value={section1.reference_par_profile_id ?? ""}
                    onChange={(e) =>
                      setSection1((s) => ({ ...s, reference_par_profile_id: e.target.value || null, dirty: true }))
                    }
                  >
                    <option value="">—</option>
                    {internalProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom || p.email}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {/* Single edit point for "which unit does this client want" -
                  previously split between this Select (once in Section 2)
                  and numero_unite_libre/coach_vise, with no cross-check
                  between them. coach_id is always editable here; the
                  roulette + free-text model fallback only show while it's
                  still empty, since a real inventory link makes them moot. */}
              <div className="pt-1">
                <Field label="Coach (inventaire)">
                  <Select
                    value={section1.coach_id ?? ""}
                    onChange={(e) => setSection1((s) => ({ ...s, coach_id: e.target.value || null, dirty: true }))}
                  >
                    <option value="">Non lié</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.unit_number} — {c.modele ?? "?"} ({c.statut})
                      </option>
                    ))}
                  </Select>
                </Field>

                {!section1.coach_id && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-textSoft mb-1.5">Numéro d&apos;unité (temporaire)</p>
                      <UnitPicker
                        key={deal.id}
                        value={section1.numero_unite_libre || null}
                        onChange={(v) => setSection1((s) => ({ ...s, numero_unite_libre: v, dirty: true }))}
                      />
                    </div>
                    <Field label="Modèle visé (si numéro exact inconnu)">
                      <TextInput
                        value={section1.coach_vise}
                        onChange={(e) => setSection1((s) => ({ ...s, coach_vise: e.target.value, dirty: true }))}
                      />
                    </Field>
                  </div>
                )}
              </div>

              {section1.type_vehicule_vise && (
                <label className="flex items-center gap-2 text-xs font-medium text-textSoft pt-1">
                  <input
                    type="checkbox"
                    checked={showEchange}
                    onChange={(e) => setShowEchange(e.target.checked)}
                    className="accent-teal w-4 h-4"
                  />
                  Véhicule en échange ?
                </label>
              )}

              {section1.type_vehicule_vise && showEchange && (
                <>
                  <p className="text-xs font-medium text-textSoft pt-1">Véhicule usagé en échange</p>
                  <Field label="Valeur d'échange">
                    <CurrencyInput
                      value={section1.valeur_echange}
                      onChange={(v) => setSection1((s) => ({ ...s, valeur_echange: v, dirty: true }))}
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <Field label="Marque">
                      <TextInput
                        value={section1.echange_marque}
                        onChange={(e) => setSection1((s) => ({ ...s, echange_marque: e.target.value, dirty: true }))}
                      />
                    </Field>
                    <Field label="Modèle">
                      <TextInput
                        value={section1.echange_modele}
                        onChange={(e) => setSection1((s) => ({ ...s, echange_modele: e.target.value, dirty: true }))}
                      />
                    </Field>
                    <Field label="Année">
                      <TextInput
                        value={section1.echange_annee}
                        onChange={(e) => setSection1((s) => ({ ...s, echange_annee: e.target.value, dirty: true }))}
                      />
                    </Field>
                    <Field label="Km">
                      <TextInput
                        value={section1.echange_km}
                        onChange={(e) => setSection1((s) => ({ ...s, echange_km: e.target.value, dirty: true }))}
                      />
                    </Field>
                    <Field label="Accidenté">
                      <Select
                        value={section1.echange_accidente ?? ""}
                        onChange={(e) =>
                          setSection1((s) => ({
                            ...s,
                            echange_accidente: (e.target.value || null) as Deal["echange_accidente"],
                            dirty: true,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {ACCIDENT_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label="N° de série (échange)">
                    <TextInput
                      value={section1.echange_numero_serie}
                      onChange={(e) => setSection1((s) => ({ ...s, echange_numero_serie: e.target.value, dirty: true }))}
                    />
                  </Field>
                  <TradeInPhotos
                    photos={photos}
                    photoUrls={photoUrls}
                    uploading={photoUploading}
                    error={photoError}
                    onUpload={onUploadPhotos}
                    onDelete={onDeletePhoto}
                  />
                </>
              )}

              <SaveSectionButton dirty={section1.dirty} saving={section1.saving} onClick={saveSection1} />
            </Section>

            <Section
              code="2"
              title={contactStage?.label ?? "Contact"}
              icon={stageIcon("contact")}
              active={localDeal.stage_id === contactStage?.id}
              defaultOpen={localDeal.stage_id === contactStage?.id}
            >
              {/* No form left here on purpose - coach_vise/coach_id moved to
                  Section 1 (single edit point). This section only tracks
                  whether the client has been reached at all, to prevent two
                  reps calling the same lead - a one-way marker, not a
                  correctable field, so once set it's a plain confirmation. */}
              {localDeal.premier_contact_le ? (
                <p className="text-sm text-text">
                  Contacté par{" "}
                  <span className="font-medium">
                    {activities.find((a) => a.type === "autre" && a.contenu === "Premier contact effectué")?.author
                      ?.nom ?? "quelqu'un"}
                  </span>
                  , le {formatDateTime(localDeal.premier_contact_le)}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={contactingBusy}
                  onClick={handleMarkContacted}
                  className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
                >
                  {contactingBusy ? "Enregistrement…" : "Marquer comme contacté"}
                </button>
              )}
            </Section>

            <Section
              code="3"
              title={rencontreStage?.label ?? "Rencontre"}
              icon={stageIcon("rencontre")}
              active={localDeal.stage_id === rencontreStage?.id}
              defaultOpen={localDeal.stage_id === rencontreStage?.id}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date de suivi">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(section3.next_action_at)}
                    onChange={(e) =>
                      setSection3((s) => ({ ...s, next_action_at: fromDatetimeLocalValue(e.target.value), dirty: true }))
                    }
                  />
                </Field>
                <Field label="Évaluation du client">
                  <Select
                    value={section3.evaluation_client ?? ""}
                    onChange={(e) =>
                      setSection3((s) => ({
                        ...s,
                        evaluation_client: (e.target.value || null) as Deal["evaluation_client"],
                        dirty: true,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {EVALUATIONS.map((ev) => (
                      <option key={ev} value={ev}>
                        {ev}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-textSoft mt-1">Évaluation après une rencontre réelle.</p>
                </Field>
                {/* Two distinct rendez-vous types, not one field for both -
                    the factory carries different on-site security rules
                    than the office, per conversation. */}
                <Field label="Date visite d'usine (accès sécurisé)">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(section3.date_visite_usine)}
                    onChange={(e) =>
                      setSection3((s) => ({
                        ...s,
                        date_visite_usine: fromDatetimeLocalValue(e.target.value),
                        dirty: true,
                      }))
                    }
                  />
                </Field>
                <Field label="Date visite au bureau">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(section3.date_visite_bureau)}
                    onChange={(e) =>
                      setSection3((s) => ({
                        ...s,
                        date_visite_bureau: fromDatetimeLocalValue(e.target.value),
                        dirty: true,
                      }))
                    }
                  />
                </Field>
                <Field label="Date essai routier">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(section3.date_essai_routier)}
                    onChange={(e) =>
                      setSection3((s) => ({
                        ...s,
                        date_essai_routier: fromDatetimeLocalValue(e.target.value),
                        dirty: true,
                      }))
                    }
                  />
                </Field>
              </div>
              <SaveSectionButton dirty={section3.dirty} saving={section3.saving} onClick={saveSection3} />
            </Section>

            <Section
              code="4"
              title={propositionStage?.label ?? "Proposition"}
              icon={stageIcon("proposition")}
              active={localDeal.stage_id === propositionStage?.id}
              defaultOpen={localDeal.stage_id === propositionStage?.id}
            >
              <Field label="Prix de vente">
                <CurrencyInput
                  value={section4.montant}
                  onChange={(v) => setSection4((s) => ({ ...s, montant: v, dirty: true }))}
                />
              </Field>
              <Field label="Options sélectionnées">
                <TextArea
                  value={section4.options}
                  onChange={(e) => setSection4((s) => ({ ...s, options: e.target.value, dirty: true }))}
                  rows={2}
                />
              </Field>
              <SaveSectionButton dirty={section4.dirty} saving={section4.saving} onClick={saveSection4} />
            </Section>

            <Section
              code="5"
              title={negociationStage?.label ?? "Négociation"}
              icon={stageIcon("negociation")}
              active={localDeal.stage_id === negociationStage?.id}
              defaultOpen={localDeal.stage_id === negociationStage?.id}
            >
              <p className="text-sm text-textSoft">Ajoutez une note ci-dessous pour suivre la négociation.</p>
              <NoteComposer onSubmit={onAddNote} label="Ajouter une note de négociation" />
            </Section>

            <Section
              code="6"
              title={gagneStage?.label ?? "Gagné"}
              icon={stageIcon("gagne")}
              active={localDeal.stage_id === gagneStage?.id}
              defaultOpen={localDeal.stage_id === gagneStage?.id}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant final">
                  <p className="rounded-lg bg-surface2 border border-border/20 px-3 py-2 text-sm text-text">
                    {formatCurrency(localDeal.montant)}
                  </p>
                  <p className="text-[11px] text-textSoft mt-1">Montant confirmé à l&apos;étape Proposition</p>
                </Field>
                <Field label="Date du contrat">
                  <TextInput
                    type="date"
                    value={section6.date_contrat ?? ""}
                    onChange={(e) =>
                      setSection6((s) => ({ ...s, date_contrat: e.target.value || null, dirty: true }))
                    }
                  />
                </Field>
                <Field label="N° de contrat">
                  <TextInput
                    value={section6.numero_contrat}
                    onChange={(e) => setSection6((s) => ({ ...s, numero_contrat: e.target.value, dirty: true }))}
                  />
                </Field>
                <Field label="Date du 1er rendez-vous service">
                  <TextInput
                    type="date"
                    value={section6.date_rdv_service ?? ""}
                    onChange={(e) =>
                      setSection6((s) => ({ ...s, date_rdv_service: e.target.value || null, dirty: true }))
                    }
                  />
                </Field>
              </div>
              <SaveSectionButton dirty={section6.dirty} saving={section6.saving} onClick={saveSection6} />
            </Section>

            <Section
              code="7"
              title={perduStage?.label ?? "Perdu"}
              icon={stageIcon("perdu")}
              active={localDeal.stage_id === perduStage?.id}
              defaultOpen={localDeal.stage_id === perduStage?.id}
            >
              <Field label="Raison de la perte">
                <TextArea
                  value={section7.lost_reason}
                  onChange={(e) => setSection7((s) => ({ ...s, lost_reason: e.target.value, dirty: true }))}
                  rows={2}
                />
              </Field>
              <SaveSectionButton dirty={section7.dirty} saving={section7.saving} onClick={saveSection7} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveSectionButton({ dirty, saving, onClick }: { dirty: boolean; saving: boolean; onClick: () => void }) {
  const [justSaved, setJustSaved] = useState(false);
  const wasSaving = useRef(false);

  // Falling edge of `saving` while `dirty` is already false is a real
  // success (on failure the section keeps dirty=true, so this never fires
  // for an error - no false "Enregistré ✓" after a failed save).
  useEffect(() => {
    if (wasSaving.current && !saving && !dirty) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1200);
      return () => clearTimeout(t);
    }
    wasSaving.current = saving;
  }, [saving, dirty]);

  const label = saving ? "Enregistrement…" : justSaved ? "Enregistré ✓" : "Enregistrer";

  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onClick}
        className={`text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-all duration-150 disabled:cursor-not-allowed ${
          justSaved ? "bg-green text-onyx" : "bg-teal text-white hover:bg-teal/90 disabled:opacity-40"
        }`}
      >
        {label}
      </button>
    </div>
  );
}

function NoteComposer({
  onSubmit,
  label = "Ajouter une note",
  inputClassName = "",
  labelClassName = "",
}: {
  onSubmit: (text: string) => Promise<void>;
  /** Distinguishes which composer this is when more than one is visible at once (Section 5's negotiation notes vs the general one). */
  label?: string;
  /** Extra classes for the textarea itself - e.g. forcing a light background when this composer sits inside a solid-color band. */
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-1">
      <label className={`block text-[13px] font-medium mb-1 tracking-[0.01em] ${labelClassName || "text-textSoft"}`}>
        {label}
      </label>
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Nouvelle note…"
        className={inputClassName}
      />
      <div className="flex justify-end mt-1.5">
        <button
          type="button"
          disabled={submitting || !text.trim()}
          onClick={handleAdd}
          className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
        >
          {submitting ? "Ajout…" : "Ajouter la note"}
        </button>
      </div>
    </div>
  );
}
