"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Field } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import { TextArea } from "./ui/TextArea";
import { Select } from "./ui/Select";
import { CurrencyInput } from "./ui/CurrencyInput";
import { Section } from "./Section";
import { ActivityFeed } from "./ActivityFeed";
import {
  ACCIDENT_OPTIONS,
  EVALUATIONS,
  findClientMatchesForDeal,
  findCoachMatchesForDeal,
  fullName,
  INTERETS,
  SOURCE_SUGGESTIONS,
  stageIcon,
} from "@/lib/domain";
import { formatCurrency, fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/format";
import type { ActivityWithAuthor, Coach, Contact, Deal, DealWithContact, PipelineStage, Profile } from "@/lib/types";

interface DealDrawerProps {
  deal: DealWithContact;
  stages: PipelineStage[];
  profiles: Profile[];
  coaches: Coach[];
  allDeals: DealWithContact[];
  activities: ActivityWithAuthor[];
  activitiesLoading: boolean;
  onClose: () => void;
  onUpdateContact: (patch: Partial<Contact>) => Promise<void>;
  onUpdateDeal: (patch: Partial<Deal>) => Promise<void>;
  onChangeStage: (newStageId: number) => Promise<void>;
  onAddNote: (contenu: string) => Promise<void>;
}

// Local draft state for each pipeline-stage section - fields here are NOT
// autosaved (unlike the quick contact fields and stage stepper, which
// still commit immediately). Each section only writes to Supabase when its
// own "Enregistrer" button is clicked, per the project's explicit choice
// to batch stage-section edits rather than save silently per field.

interface Section1State {
  source: string;
  niveau_interet: Deal["niveau_interet"];
  dirty: boolean;
  saving: boolean;
}
function section1Defaults(deal: DealWithContact): Section1State {
  return { source: deal.contact.source ?? "", niveau_interet: deal.niveau_interet, dirty: false, saving: false };
}

interface Section2State {
  coach_vise: string;
  coach_id: string | null;
  dirty: boolean;
  saving: boolean;
}
function section2Defaults(deal: DealWithContact): Section2State {
  return { coach_vise: deal.coach_vise ?? "", coach_id: deal.coach_id, dirty: false, saving: false };
}

interface Section3State {
  next_action_at: string | null;
  evaluation_client: Deal["evaluation_client"];
  date_visite_usine: string | null;
  date_essai_routier: string | null;
  dirty: boolean;
  saving: boolean;
}
function section3Defaults(deal: DealWithContact): Section3State {
  return {
    next_action_at: deal.next_action_at,
    evaluation_client: deal.evaluation_client,
    date_visite_usine: deal.date_visite_usine,
    date_essai_routier: deal.date_essai_routier,
    dirty: false,
    saving: false,
  };
}

interface Section4State {
  montant: number | null;
  valeur_echange: number | null;
  options: string;
  echange_marque: string;
  echange_modele: string;
  echange_annee: string;
  echange_km: string;
  echange_accidente: Deal["echange_accidente"];
  echange_numero_serie: string;
  dirty: boolean;
  saving: boolean;
}
function section4Defaults(deal: DealWithContact): Section4State {
  return {
    montant: deal.montant,
    valeur_echange: deal.valeur_echange,
    options: deal.options ?? "",
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
  onClose,
  onUpdateContact,
  onUpdateDeal,
  onChangeStage,
  onAddNote,
}: DealDrawerProps) {
  const [localContact, setLocalContact] = useState(deal.contact);
  const [localDeal, setLocalDeal] = useState<Deal>(deal);
  const [saving, setSaving] = useState(false);

  const [section1, setSection1] = useState(() => section1Defaults(deal));
  const [section2, setSection2] = useState(() => section2Defaults(deal));
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
    setSection2(section2Defaults(deal));
    setSection3(section3Defaults(deal));
    setSection4(section4Defaults(deal));
    setSection6(section6Defaults(deal));
    setSection7(section7Defaults(deal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  const clientDupes = findClientMatchesForDeal(deal, allDeals, deal.id);
  const coachDupes = findCoachMatchesForDeal({ coach_vise: section2.coach_vise }, allDeals, deal.id);

  async function commitContact(patch: Partial<Contact>) {
    setLocalContact((c) => ({ ...c, ...patch }));
    setSaving(true);
    try {
      await onUpdateContact(patch);
    } finally {
      setSaving(false);
    }
  }

  async function commitDeal(patch: Partial<Deal>) {
    setLocalDeal((d) => ({ ...d, ...patch }));
    setSaving(true);
    try {
      await onUpdateDeal(patch);
    } finally {
      setSaving(false);
    }
  }

  async function saveSection1() {
    setSection1((s) => ({ ...s, saving: true }));
    try {
      await Promise.all([
        onUpdateContact({ source: section1.source || null }),
        onUpdateDeal({ niveau_interet: section1.niveau_interet }),
      ]);
    } finally {
      setSection1((s) => ({ ...s, saving: false, dirty: false }));
    }
  }

  async function saveSection2() {
    setSection2((s) => ({ ...s, saving: true }));
    try {
      await onUpdateDeal({ coach_vise: section2.coach_vise || null, coach_id: section2.coach_id });
    } finally {
      setSection2((s) => ({ ...s, saving: false, dirty: false }));
    }
  }

  async function saveSection3() {
    setSection3((s) => ({ ...s, saving: true }));
    try {
      await onUpdateDeal({
        next_action_at: section3.next_action_at,
        evaluation_client: section3.evaluation_client,
        date_visite_usine: section3.date_visite_usine,
        date_essai_routier: section3.date_essai_routier,
      });
    } finally {
      setSection3((s) => ({ ...s, saving: false, dirty: false }));
    }
  }

  async function saveSection4() {
    setSection4((s) => ({ ...s, saving: true }));
    try {
      await onUpdateDeal({
        montant: section4.montant,
        valeur_echange: section4.valeur_echange,
        options: section4.options || null,
        echange_marque: section4.echange_marque || null,
        echange_modele: section4.echange_modele || null,
        echange_annee: section4.echange_annee || null,
        echange_km: section4.echange_km || null,
        echange_accidente: section4.echange_accidente,
        echange_numero_serie: section4.echange_numero_serie || null,
      });
    } finally {
      setSection4((s) => ({ ...s, saving: false, dirty: false }));
    }
  }

  async function saveSection6() {
    setSection6((s) => ({ ...s, saving: true }));
    try {
      await onUpdateDeal({
        date_contrat: section6.date_contrat,
        numero_contrat: section6.numero_contrat || null,
        date_rdv_service: section6.date_rdv_service,
      });
    } finally {
      setSection6((s) => ({ ...s, saving: false, dirty: false }));
    }
  }

  async function saveSection7() {
    setSection7((s) => ({ ...s, saving: true }));
    try {
      await onUpdateDeal({ lost_reason: section7.lost_reason || null });
    } finally {
      setSection7((s) => ({ ...s, saving: false, dirty: false }));
    }
  }

  const currentStageIndex = stages.findIndex((s) => s.id === localDeal.stage_id);
  const currentStage = stages[currentStageIndex];

  const stageByCode = (code: string) => stages.find((s) => s.code === code);
  const prospectStage = stageByCode("prospect");
  const contactStage = stageByCode("contact");
  const rencontreStage = stageByCode("rencontre");
  const propositionStage = stageByCode("proposition");
  const negociationStage = stageByCode("negociation");
  const gagneStage = stageByCode("gagne");
  const perduStage = stageByCode("perdu");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-onyx/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl h-full bg-bg border-l border-border/15 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border/15 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text truncate">
              {fullName(localContact) || "(sans nom)"}
            </h2>
            <p className="text-xs text-textSoft">{saving ? "Enregistrement…" : "Enregistré"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClose} className="text-textSoft hover:text-text" aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
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

          {/* Stage stepper - autosave, unchanged */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/15 bg-surface px-3 py-2.5">
            <button
              type="button"
              disabled={currentStageIndex <= 0}
              onClick={() => onChangeStage(stages[currentStageIndex - 1]!.id)}
              className="text-textSoft hover:text-teal disabled:opacity-30 disabled:hover:text-textSoft"
              aria-label="Étape précédente"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-xs font-medium text-teal">{currentStage?.label}</div>
              <div className="text-[11px] text-textSoft">
                Étape {currentStageIndex + 1} / {stages.length}
              </div>
            </div>
            <button
              type="button"
              disabled={currentStageIndex >= stages.length - 1}
              onClick={() => onChangeStage(stages[currentStageIndex + 1]!.id)}
              className="text-textSoft hover:text-teal disabled:opacity-30 disabled:hover:text-textSoft"
              aria-label="Étape suivante"
            >
              <ChevronRight size={20} />
            </button>
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

          {/* Chronological activity feed */}
          <div>
            <p className="text-xs font-medium text-textSoft mb-2">Historique &amp; notes</p>
            <ActivityFeed activities={activities} loading={activitiesLoading} />
          </div>

          {/* Per-stage sections - draft + explicit "Enregistrer" per section */}
          <div className="space-y-2.5">
            <Section
              code="1"
              title={prospectStage?.label ?? "Prospect identifié"}
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
                </Field>
              </div>
              <SaveSectionButton dirty={section1.dirty} saving={section1.saving} onClick={saveSection1} />
            </Section>

            <Section
              code="2"
              title={contactStage?.label ?? "Premier contact"}
              icon={stageIcon("contact")}
              active={localDeal.stage_id === contactStage?.id}
              defaultOpen={localDeal.stage_id === contactStage?.id}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Coach visé" className="col-span-2">
                  <TextInput
                    value={section2.coach_vise}
                    onChange={(e) => setSection2((s) => ({ ...s, coach_vise: e.target.value, dirty: true }))}
                  />
                </Field>
                <Field label="Coach (inventaire)" className="col-span-2">
                  <Select
                    value={section2.coach_id ?? ""}
                    onChange={(e) => setSection2((s) => ({ ...s, coach_id: e.target.value || null, dirty: true }))}
                  >
                    <option value="">Non lié</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.unit_number} — {c.modele ?? "?"} ({c.statut})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <SaveSectionButton dirty={section2.dirty} saving={section2.saving} onClick={saveSection2} />
            </Section>

            <Section
              code="3"
              title={rencontreStage?.label ?? "Rencontre planifiée"}
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
                </Field>
                <Field label="Date visite d'usine">
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
              title={propositionStage?.label ?? "Proposition envoyée"}
              icon={stageIcon("proposition")}
              active={localDeal.stage_id === propositionStage?.id}
              defaultOpen={localDeal.stage_id === propositionStage?.id}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix de vente">
                  <CurrencyInput
                    value={section4.montant}
                    onChange={(v) => setSection4((s) => ({ ...s, montant: v, dirty: true }))}
                  />
                </Field>
                <Field label="Valeur d'échange">
                  <CurrencyInput
                    value={section4.valeur_echange}
                    onChange={(v) => setSection4((s) => ({ ...s, valeur_echange: v, dirty: true }))}
                  />
                </Field>
              </div>
              <Field label="Options sélectionnées">
                <TextArea
                  value={section4.options}
                  onChange={(e) => setSection4((s) => ({ ...s, options: e.target.value, dirty: true }))}
                  rows={2}
                />
              </Field>
              <p className="text-xs font-medium text-textSoft pt-1">Véhicule usagé en échange</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Field label="Marque">
                  <TextInput
                    value={section4.echange_marque}
                    onChange={(e) => setSection4((s) => ({ ...s, echange_marque: e.target.value, dirty: true }))}
                  />
                </Field>
                <Field label="Modèle">
                  <TextInput
                    value={section4.echange_modele}
                    onChange={(e) => setSection4((s) => ({ ...s, echange_modele: e.target.value, dirty: true }))}
                  />
                </Field>
                <Field label="Année">
                  <TextInput
                    value={section4.echange_annee}
                    onChange={(e) => setSection4((s) => ({ ...s, echange_annee: e.target.value, dirty: true }))}
                  />
                </Field>
                <Field label="Km">
                  <TextInput
                    value={section4.echange_km}
                    onChange={(e) => setSection4((s) => ({ ...s, echange_km: e.target.value, dirty: true }))}
                  />
                </Field>
                <Field label="Accidenté">
                  <Select
                    value={section4.echange_accidente ?? ""}
                    onChange={(e) =>
                      setSection4((s) => ({
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
                  value={section4.echange_numero_serie}
                  onChange={(e) => setSection4((s) => ({ ...s, echange_numero_serie: e.target.value, dirty: true }))}
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
            </Section>

            <Section
              code="6"
              title={gagneStage?.label ?? "Fermé — gagné"}
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
              title={perduStage?.label ?? "Fermé — perdu"}
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

            <NoteComposer onSubmit={onAddNote} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveSectionButton({ dirty, saving, onClick }: { dirty: boolean; saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onClick}
        className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

function NoteComposer({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
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
      <Field label="Ajouter une note">
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Nouvelle note…"
        />
      </Field>
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
