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
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/format";
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

  useEffect(() => {
    setLocalContact(deal.contact);
    setLocalDeal(deal);
  }, [deal]);

  const clientDupes = findClientMatchesForDeal(deal, allDeals, deal.id);
  const coachDupes = findCoachMatchesForDeal(localDeal, allDeals, deal.id);

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

          {/* Stage stepper */}
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

          {/* Quick contact fields */}
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

          {/* Per-stage sections */}
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
                    value={localContact.source ?? ""}
                    onChange={(e) => setLocalContact((c) => ({ ...c, source: e.target.value }))}
                    onBlur={(e) => commitContact({ source: e.target.value || null })}
                  />
                  <datalist id="source-suggestions">
                    {SOURCE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Niveau d'intérêt">
                  <Select
                    value={localDeal.niveau_interet ?? ""}
                    onChange={(e) => commitDeal({ niveau_interet: (e.target.value || null) as Deal["niveau_interet"] })}
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
                    value={localDeal.coach_vise ?? ""}
                    onChange={(e) => setLocalDeal((d) => ({ ...d, coach_vise: e.target.value }))}
                    onBlur={(e) => commitDeal({ coach_vise: e.target.value })}
                  />
                </Field>
                <Field label="Coach (inventaire)" className="col-span-2">
                  <Select
                    value={localDeal.coach_id ?? ""}
                    onChange={(e) => commitDeal({ coach_id: e.target.value || null })}
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
                    value={toDatetimeLocalValue(localDeal.next_action_at)}
                    onChange={(e) => commitDeal({ next_action_at: fromDatetimeLocalValue(e.target.value) })}
                  />
                </Field>
                <Field label="Évaluation du client">
                  <Select
                    value={localDeal.evaluation_client ?? ""}
                    onChange={(e) =>
                      commitDeal({ evaluation_client: (e.target.value || null) as Deal["evaluation_client"] })
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
                    value={toDatetimeLocalValue(localDeal.date_visite_usine)}
                    onChange={(e) => commitDeal({ date_visite_usine: fromDatetimeLocalValue(e.target.value) })}
                  />
                </Field>
                <Field label="Date essai routier">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(localDeal.date_essai_routier)}
                    onChange={(e) => commitDeal({ date_essai_routier: fromDatetimeLocalValue(e.target.value) })}
                  />
                </Field>
              </div>
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
                  <CurrencyInput value={localDeal.montant} onChange={(v) => commitDeal({ montant: v })} />
                </Field>
                <Field label="Valeur d'échange">
                  <CurrencyInput value={localDeal.valeur_echange} onChange={(v) => commitDeal({ valeur_echange: v })} />
                </Field>
              </div>
              <Field label="Options sélectionnées">
                <TextArea
                  value={localDeal.options ?? ""}
                  onChange={(e) => setLocalDeal((d) => ({ ...d, options: e.target.value }))}
                  onBlur={(e) => commitDeal({ options: e.target.value })}
                  rows={2}
                />
              </Field>
              <p className="text-xs font-medium text-textSoft pt-1">Véhicule usagé en échange</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Field label="Marque">
                  <TextInput
                    value={localDeal.echange_marque ?? ""}
                    onChange={(e) => setLocalDeal((d) => ({ ...d, echange_marque: e.target.value }))}
                    onBlur={(e) => commitDeal({ echange_marque: e.target.value })}
                  />
                </Field>
                <Field label="Modèle">
                  <TextInput
                    value={localDeal.echange_modele ?? ""}
                    onChange={(e) => setLocalDeal((d) => ({ ...d, echange_modele: e.target.value }))}
                    onBlur={(e) => commitDeal({ echange_modele: e.target.value })}
                  />
                </Field>
                <Field label="Année">
                  <TextInput
                    value={localDeal.echange_annee ?? ""}
                    onChange={(e) => setLocalDeal((d) => ({ ...d, echange_annee: e.target.value }))}
                    onBlur={(e) => commitDeal({ echange_annee: e.target.value })}
                  />
                </Field>
                <Field label="Km">
                  <TextInput
                    value={localDeal.echange_km ?? ""}
                    onChange={(e) => setLocalDeal((d) => ({ ...d, echange_km: e.target.value }))}
                    onBlur={(e) => commitDeal({ echange_km: e.target.value })}
                  />
                </Field>
                <Field label="Accidenté">
                  <Select
                    value={localDeal.echange_accidente ?? ""}
                    onChange={(e) =>
                      commitDeal({ echange_accidente: (e.target.value || null) as Deal["echange_accidente"] })
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
                  value={localDeal.echange_numero_serie ?? ""}
                  onChange={(e) => setLocalDeal((d) => ({ ...d, echange_numero_serie: e.target.value }))}
                  onBlur={(e) => commitDeal({ echange_numero_serie: e.target.value })}
                />
              </Field>
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
              <p className="text-xs text-textSoft -mt-1">
                Le montant final est le même champ que le prix de vente saisi à l&apos;étape Proposition -
                ajustable ici aussi si le montant signé diffère.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant final">
                  <CurrencyInput value={localDeal.montant} onChange={(v) => commitDeal({ montant: v })} />
                </Field>
                <Field label="Date du contrat">
                  <TextInput
                    type="date"
                    value={localDeal.date_contrat ?? ""}
                    onChange={(e) => commitDeal({ date_contrat: e.target.value || null })}
                  />
                </Field>
                <Field label="N° de contrat">
                  <TextInput
                    value={localDeal.numero_contrat ?? ""}
                    onChange={(e) => setLocalDeal((d) => ({ ...d, numero_contrat: e.target.value }))}
                    onBlur={(e) => commitDeal({ numero_contrat: e.target.value })}
                  />
                </Field>
                <Field label="Date du 1er rendez-vous service">
                  <TextInput
                    type="date"
                    value={localDeal.date_rdv_service ?? ""}
                    onChange={(e) => commitDeal({ date_rdv_service: e.target.value || null })}
                  />
                </Field>
              </div>
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
                  value={localDeal.lost_reason ?? ""}
                  onChange={(e) => setLocalDeal((d) => ({ ...d, lost_reason: e.target.value }))}
                  onBlur={(e) => commitDeal({ lost_reason: e.target.value })}
                  rows={2}
                />
              </Field>
            </Section>

            <NoteComposer onSubmit={onAddNote} />
          </div>
        </div>
      </div>
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
        <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Nouvelle note…" />
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
