"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
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
import { SourceCombobox } from "./ui/SourceCombobox";
import { TextArea } from "./ui/TextArea";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { CurrencyInput } from "./ui/CurrencyInput";
import { UnitPicker } from "./ui/UnitPicker";
import { Spinner } from "./ui/Spinner";
import { ErrorBanner } from "./ui/ErrorBanner";
import { Section } from "./Section";
import { ActivityFeed } from "./ActivityFeed";
import { DealDocuments } from "./DealDocuments";
import { TradeInPhotos } from "./TradeInPhotos";
import {
  ACCIDENT_OPTIONS,
  EVALUATIONS,
  findClientMatchesForDeal,
  findCoachMatchesForDeal,
  fullName,
  getDistinctSourcesWithCounts,
  getRecentSources,
  INTERETS,
  normalizeRepName,
  REP_TAB_ORDER,
  stageIcon,
  TRAVAUX_ENTRETIEN_OPTIONS,
  type TravauxEntretien,
} from "@/lib/domain";
import { formatCurrency, formatDateTime, fromDatetimeLocalValue, getErrorMessage, toDatetimeLocalValue } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { IMPORT_BADGE_COLOR } from "@/lib/theme";
import type {
  ActivityWithAuthor,
  Coach,
  Contact,
  Deal,
  DealDocument,
  DealPhoto,
  DealWithContact,
  PipelineStage,
  Profile,
} from "@/lib/types";

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
  documents: DealDocument[];
  documentUploading: boolean;
  documentError: string | null;
  onClose: () => void;
  onUpdateContact: (patch: Partial<Contact>) => Promise<void>;
  onUpdateDeal: (patch: Partial<Deal>) => Promise<void>;
  onChangeStage: (newStageId: number) => Promise<void>;
  onAddNote: (contenu: string) => Promise<void>;
  onUploadPhotos: (files: File[]) => void;
  onDeletePhoto: (photo: DealPhoto) => void;
  onUploadDocument: (file: File, originalName: string) => Promise<void>;
  onDeleteDocument: (document: DealDocument) => void;
  onGetSignedDocumentUrl: (storagePath: string) => Promise<string>;
}

// Upper bound for echange_entretien_km - a real odometer reading never gets
// remotely close to this (7 digits), it's just a sanity backstop against a
// mistyped/pasted value, same spirit as rejecting negatives.
const MAX_ECHANGE_ENTRETIEN_KM = 9_999_999;

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
  // Maintenance history (0027_add_echange_entretien_history.sql, by request
  // from Fred) - date/km stay as their real null-able types (not coerced to
  // "" like the free-text fields above) so an empty input can be told apart
  // from "not touched" and sent as null, never as an empty string that the
  // date/integer columns would reject.
  echange_entretien_date: string | null;
  echange_entretien_km: number | null;
  echange_entretien_travaux: TravauxEntretien[];
  echange_entretien_notes: string;
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
    echange_entretien_date: deal.echange_entretien_date,
    echange_entretien_km: deal.echange_entretien_km,
    echange_entretien_travaux: deal.echange_entretien_travaux ?? [],
    echange_entretien_notes: deal.echange_entretien_notes ?? "",
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
      deal.echange_accidente ||
      deal.echange_entretien_date ||
      deal.echange_entretien_km != null ||
      (deal.echange_entretien_travaux && deal.echange_entretien_travaux.length > 0) ||
      deal.echange_entretien_notes
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
  documents,
  documentUploading,
  documentError,
  onClose,
  onUpdateContact,
  onUpdateDeal,
  onChangeStage,
  onAddNote,
  onUploadPhotos,
  onDeletePhoto,
  onUploadDocument,
  onDeleteDocument,
  onGetSignedDocumentUrl,
}: DealDrawerProps) {
  const [localContact, setLocalContact] = useState(deal.contact);
  // In-progress text of the Téléphone field while it has focus; null = not
  // editing, the field then shows the stored number formatted.
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [localDeal, setLocalDeal] = useState<Deal>(deal);
  const [saving, setSaving] = useState(false);

  // Slide-in/out, not an instant pop - matches the same path both ways
  // (enters from the right, leaves back the same way). `mounted` flips one
  // frame after first paint so the initial translate-x-full state actually
  // transitions instead of skipping straight to translate-x-0. `closing`
  // holds the drawer at translate-x-full while `onClose` is delayed long
  // enough for that transition to finish, instead of unmounting instantly.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const DRAWER_TRANSITION_MS = 380;
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  // Set by TradeInPhotos while its lightbox is open - lets this drawer's own
  // Escape handling defer to it deterministically, independent of focus
  // (see the window keydown effect below for why that matters).
  const [topLayerOpen, setTopLayerOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    // Purely a UX/accessibility nicety (focus lands somewhere sensible
    // instead of staying on whatever triggered the open) - not load-bearing
    // for Escape-to-close itself, which no longer depends on focus at all.
    closeBtnRef.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, DRAWER_TRANSITION_MS);
  }

  // Archiver / Marquer gagné / Marquer perdu / fermer (si non enregistré)
  // share one pending-confirmation slot rather than near-identical boolean
  // flags + banners for each.
  const [pendingAction, setPendingAction] = useState<"archive" | "gagne" | "perdu" | "close" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // A banner opened from Escape/backdrop-click can be triggered from any
  // scroll position in the drawer (unlike the archive/gagné/perdu buttons,
  // which already sit right next to where their own banner renders) -
  // scrolled into view every time so it's never invisible above the fold.
  useEffect(() => {
    if (pendingAction) bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pendingAction]);

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
          // Already null-able end to end (set directly by the date/number
          // inputs below, never coerced through an empty string) - no ||
          // null needed here, unlike the free-text fields above.
          echange_entretien_date: section1.echange_entretien_date,
          echange_entretien_km: section1.echange_entretien_km,
          echange_entretien_travaux: section1.echange_entretien_travaux,
          echange_entretien_notes: section1.echange_entretien_notes || null,
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

  // Brief opacity dip on the stepper's center label when the stage itself
  // changes (not on every render) - a fade between names instead of a hard
  // swap. Purely cosmetic: onChangeStage/localDeal are the actual source of
  // truth, this never delays or blocks anything.
  const [stageFading, setStageFading] = useState(false);
  const prevStageIdRef = useRef(localDeal.stage_id);
  useEffect(() => {
    if (prevStageIdRef.current === localDeal.stage_id) return;
    prevStageIdRef.current = localDeal.stage_id;
    setStageFading(true);
    const t = setTimeout(() => setStageFading(false), 160);
    return () => clearTimeout(t);
  }, [localDeal.stage_id]);

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

  // allDeals already carries contact.source/contact.created_at (same fetch
  // the rest of the app already uses) - no extra query for this.
  const recentSources = getRecentSources(allDeals, new Date());
  const allKnownSources = getDistinctSourcesWithCounts(allDeals)
    .filter((s) => s.source !== null)
    .map((s) => s.source as string);

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

  const hasUnsavedChanges =
    section1.dirty || section3.dirty || section4.dirty || section6.dirty || section7.dirty;

  /**
   * A native popup (the "Source" datalist's suggestion list, or a date/
   * datetime-local field's picker) also closes on Escape, as pure browser
   * behavior we never see as a keydown with any reliable "a popup was
   * open" signal - the only thing script can check is what's currently
   * focused. Treating Escape as a no-op while one of these is focused means
   * at worst a second Escape (with focus moved elsewhere) is needed to
   * close the drawer - far better than the popup and the drawer both
   * reacting to the same keypress.
   */
  function isAutocompleteOrDateField(el: Element | null): boolean {
    if (!el || el.tagName !== "INPUT") return false;
    const input = el as HTMLInputElement;
    return input.hasAttribute("list") || ["date", "datetime-local", "time", "month", "week"].includes(input.type);
  }

  function attemptClose() {
    // A banner is already up (archive/gagné/perdu, or this same close
    // confirmation from a previous attempt) - leave it to its own
    // Confirmer/Annuler rather than layering another dismissal on top.
    if (pendingAction) return;
    if (hasUnsavedChanges) {
      setPendingAction("close");
    } else {
      handleClose();
    }
  }

  // window-level, not a React onKeyDown on the backdrop div: that earlier
  // version only fired for a keydown that actually bubbled from inside this
  // subtree, which silently stopped working the moment focus ended up
  // anywhere else (lost to document.body, tabbed out with no focus trap,
  // or - the case that matters here - inside TradeInPhotos' lightbox,
  // nested one level deeper). A window listener always fires regardless of
  // focus location, so "which layer handles this Escape" is decided
  // explicitly below (topLayerOpen) instead of being an accident of
  // whatever currently happens to have focus.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "Escape") return;
      // A dead-key accent sequence (^ then e for ê, " then a for ä, etc.)
      // is an IME composition in progress - some browsers fire this same
      // Escape keydown to cancel just that composition, not to ask for
      // anything else. isComposing true means the key never left the
      // input's own composition handling, so this doesn't interpret it as
      // a request to close.
      if (e.isComposing) return;
      if (topLayerOpen) return; // TradeInPhotos' lightbox owns this keypress instead
      if (isAutocompleteOrDateField(document.activeElement)) return;
      attemptClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) attemptClose();
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    if (pendingAction === "close") {
      setPendingAction(null);
      handleClose();
      return;
    }
    setActionBusy(true);
    setSaveError(null);
    try {
      if (pendingAction === "archive") {
        await onUpdateDeal({ archived: true });
        handleClose();
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

  const drawerVisible = mounted && !closing;

  return (
    <div
      className={`glass-scrim fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        drawerVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleBackdropClick}
    >
      {/* Opaque, no blur - a reading surface (deal sections, fields),
          never glass. text-textSoft measured as low as 1.60:1 here when
          this was bg-bg/60 backdrop-blur-md (worse still for the active
          stage's own near-transparent bg-teal/[0.04] section) - see
          globals.css's own comment on .glass-scrim/.glass-bar for the
          full history. shadow-xl added (this panel had none before) since
          depth no longer comes from blur. */}
      <div
        className={`w-full sm:max-w-xl h-full bg-bg border-l border-border/10 shadow-xl overflow-y-auto transition-transform duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          drawerVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Stays glass - this is a floating bar, content scrolls beneath
            it. Worst-case contrast measured (fictional extremes behind
            it, both themes): 14.71:1 light / 14.00:1 dark - the 90%
            opacity leaves at most a 10% contribution from whatever
            scrolls underneath, nowhere near enough to threaten this
            title text's contrast. */}
        <div className="glass-bar sticky top-0 z-10 border-b px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text tracking-[-0.01em] flex items-center gap-2 min-w-0">
              <span className="truncate">{fullName(localContact) || "(sans nom)"}</span>
              {deal.source_import === "pipedrive" && (
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: IMPORT_BADGE_COLOR }}
                  title="Importé de Pipedrive"
                  role="img"
                  aria-label="Importé de Pipedrive"
                >
                  P
                </span>
              )}
            </h2>
            <p className="text-xs text-textSoft flex items-center gap-1.5">
              {saving ? <Spinner size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-teal" />}
              {saving ? "Enregistrement…" : "Enregistré"}
            </p>
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
              ref={closeBtnRef}
              type="button"
              onClick={attemptClose}
              className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-text"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError(null)} />}

          {deal.archived && (
            <div className="rounded-lg bg-textSoft/10 px-3 py-2 text-xs text-textSoft">
              Ce dossier est archivé - masqué de la vue Pipeline par défaut.
            </div>
          )}

          {pendingAction && (
            // No blur of its own (was backdrop-blur-sm - glass on glass,
            // floating on the drawer panel's own blur) - the panel above
            // is opaque now, so this tint composites against a solid
            // backdrop directly. Same reserved-color tints as before,
            // unchanged (bg-green/10 etc.) - only the base under them
            // changed from translucent to opaque.
            <div
              ref={bannerRef}
              className={`rounded-xl border px-3.5 py-3 space-y-2 ${
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
                {pendingAction === "close" && "Fermer sans enregistrer ? Les modifications non enregistrées seront perdues."}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={confirmPendingAction}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
                >
                  {actionBusy && <Spinner size={11} />}
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
          <div className="rounded-xl border border-border/15 bg-surface px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={isClosedStage || openIndex <= 0 || prevBlockedByContact}
                onClick={() => onChangeStage(openStages[openIndex - 1]!.id)}
                className="flex items-center justify-center min-w-11 min-h-11 text-textSoft hover:text-teal disabled:opacity-30 disabled:hover:text-textSoft"
                aria-label="Étape précédente"
              >
                <ChevronLeft size={20} />
              </button>
              <div className={`text-center transition-opacity duration-150 ${stageFading ? "opacity-20" : "opacity-100"}`}>
                <div className={`text-xs font-medium tracking-[-0.005em] ${isClosedStage ? "text-textSoft" : "text-teal"}`}>
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
            {/* Same progress already spelled out as "Étape X / Y" above,
                just also drawn as a bar - previewed and approved alongside
                the rest of this pass. Purely visual, no new state: reads
                straight off openIndex/openStages. */}
            {!isClosedStage && (
              <div className="flex gap-1 mt-2.5 px-0.5">
                {openStages.map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                      i <= openIndex ? "bg-teal" : "bg-border/20"
                    }`}
                  />
                ))}
              </div>
            )}
            {/* Was title= on the prev-stage chevron alone - invisible on
                touch and to a sighted keyboard user (no hover, and a title
                attribute isn't read without one). A visible line explains it
                regardless of input method, same reasoning as the two-click
                delete's "Appuyer encore pour supprimer" in DealDocuments/
                TradeInPhotos. */}
            {prevBlockedByContact && (
              <p className="text-[11px] text-textSoft text-center pt-2 mt-2 border-t border-border/10">
                Retour à Prospect impossible - premier contact déjà enregistré
              </p>
            )}
          </div>

          {/* Always-visible, explicit close-out actions - never a side
              effect of the stepper, and never disabled by current state
              (a "perdu" deal can always be reopened as "gagné" later). */}
          <div className="flex gap-2">
            {/* Stays a plain <button>, not <Button> - the reserved vert vif
                (COLORS.green, see theme.ts) never passes through the shared
                component. Only the height/padding classes are copied from
                Button's own compact+touch size so this row-mate grows to
                44px on mobile in lockstep with "Marquer perdu" below,
                instead of one of the two opting out. */}
            <button
              type="button"
              onClick={() => setPendingAction("gagne")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium min-h-11 px-3.5 sm:min-h-0 sm:py-1.5 sm:px-3 rounded-lg bg-green text-onyx hover:bg-green/90"
            >
              <CheckCircle2 size={14} /> Marquer gagné
            </button>
            <Button
              variant="destructive"
              size="compact"
              className="flex-1"
              onClick={() => setPendingAction("perdu")}
            >
              <XCircle size={14} /> Marquer perdu
            </Button>
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
            <div className="relative bg-teal px-4 py-2.5 flex items-center gap-2">
              {/* Bright top edge = light catching a material, not flat paint - same idea as the login/calendar pass, nothing structural. */}
              <div className="absolute inset-x-0 top-0 h-px bg-white/35" />
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
                value={phoneDraft ?? formatPhone(localContact.telephone)}
                onChange={(e) => setPhoneDraft(e.target.value)}
                onBlur={(e) => {
                  setPhoneDraft(null);
                  const formatted = formatPhone(e.target.value);
                  // Shown formatted, but the stored text is never rewritten
                  // unless the user actually changed the number - tabbing
                  // through an untouched field must not reformat (i.e.
                  // rewrite) an existing contact's phone in the database.
                  if (formatted === formatPhone(localContact.telephone)) return;
                  commitContact({ telephone: formatted || null });
                }}
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
                {profiles
                  .filter((p) => !p.is_system_account && p.role !== "admin")
                  .map((p) => (
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
                  <SourceCombobox
                    value={section1.source}
                    onChange={(v) => setSection1((s) => ({ ...s, source: v, dirty: true }))}
                    recentSources={recentSources}
                    allKnownSources={allKnownSources}
                  />
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

                  {/* Maintenance history (0027_add_echange_entretien_history.sql,
                      by request from Fred) - visually set apart (dashed teal
                      border) since this block is already dense. All 4 fields
                      stay in section1's draft state exactly like the rest of
                      this block: unchecking "Véhicule en échange ?" only hides
                      this (showEchange, local UI state), it never clears
                      section1 itself - same as every other echange_* field
                      here, nothing new introduced for these four. */}
                  <div className="rounded-lg border border-dashed border-teal/35 bg-teal/[0.04] p-3 space-y-3">
                    <p className="text-xs font-medium text-teal">Historique d&apos;entretien</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date du dernier entretien">
                        <TextInput
                          type="date"
                          value={section1.echange_entretien_date ?? ""}
                          onChange={(e) =>
                            setSection1((s) => ({
                              ...s,
                              // Empty input -> null, never "" - the column is
                              // `date`, which rejects an empty string outright.
                              echange_entretien_date: e.target.value || null,
                              dirty: true,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Kilométrage à cet entretien">
                        <TextInput
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={MAX_ECHANGE_ENTRETIEN_KM}
                          step={1}
                          value={section1.echange_entretien_km === null ? "" : String(section1.echange_entretien_km)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw.trim() === "") {
                              // Empty input -> null, never "" - the column is
                              // `integer`, which rejects an empty string too.
                              setSection1((s) => ({ ...s, echange_entretien_km: null, dirty: true }));
                              return;
                            }
                            // Rejected outright, not rounded/floored/clamped -
                            // a decimal, a negative, or a value past the cap
                            // is never written to state (not relying on the
                            // input's own min/max/step, which a browser
                            // doesn't actually enforce against direct typing/
                            // paste); the field just doesn't budge from its
                            // last valid value until an actual in-range
                            // positive integer is typed.
                            const n = Number(raw);
                            if (Number.isInteger(n) && n >= 0 && n <= MAX_ECHANGE_ENTRETIEN_KM) {
                              setSection1((s) => ({ ...s, echange_entretien_km: n, dirty: true }));
                            }
                          }}
                        />
                      </Field>
                    </div>
                    <Field label="Travaux effectués">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {TRAVAUX_ENTRETIEN_OPTIONS.map((travail) => (
                          <label
                            key={travail}
                            className="flex items-center gap-2 min-h-11 px-1 text-xs font-medium text-textSoft"
                          >
                            <input
                              type="checkbox"
                              checked={section1.echange_entretien_travaux.includes(travail)}
                              onChange={(e) =>
                                setSection1((s) => ({
                                  ...s,
                                  echange_entretien_travaux: e.target.checked
                                    ? [...s.echange_entretien_travaux, travail]
                                    : s.echange_entretien_travaux.filter(
                                        (t: TravauxEntretien) => t !== travail
                                      ),
                                  dirty: true,
                                }))
                              }
                              className="accent-teal w-4 h-4 shrink-0"
                            />
                            {travail}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Notes">
                      <TextArea
                        value={section1.echange_entretien_notes}
                        onChange={(e) =>
                          setSection1((s) => ({ ...s, echange_entretien_notes: e.target.value, dirty: true }))
                        }
                        rows={2}
                      />
                    </Field>
                  </div>

                  <TradeInPhotos
                    photos={photos}
                    photoUrls={photoUrls}
                    uploading={photoUploading}
                    error={photoError}
                    onUpload={onUploadPhotos}
                    onDelete={onDeletePhoto}
                    onLightboxOpenChange={setTopLayerOpen}
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
              <DealDocuments
                documents={documents}
                uploading={documentUploading}
                error={documentError}
                onUpload={onUploadDocument}
                onDelete={onDeleteDocument}
                onGetSignedUrl={onGetSignedDocumentUrl}
              />
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
        className={`flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-all duration-150 disabled:cursor-not-allowed ${
          justSaved ? "bg-green text-onyx" : "bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
        }`}
      >
        {saving && <Spinner size={11} />}
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
