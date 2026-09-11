"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react";
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
  findClientMatchesForClient,
  findCoachMatchesForClient,
  fullName,
  INTERETS,
  PROVENANCES,
  STAGES,
} from "@/lib/domain";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/format";
import type { ActivityWithAuthor, Client, Profile } from "@/lib/types";

interface ClientDrawerProps {
  client: Client;
  profiles: Profile[];
  allClients: Client[];
  activities: ActivityWithAuthor[];
  activitiesLoading: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<Client>) => Promise<void>;
  onChangeStage: (newStage: number) => Promise<void>;
  onAddNote: (stageId: number, contenu: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ClientDrawer({
  client,
  profiles,
  allClients,
  activities,
  activitiesLoading,
  onClose,
  onUpdate,
  onChangeStage,
  onAddNote,
  onDelete,
}: ClientDrawerProps) {
  const [local, setLocal] = useState(client);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setLocal(client);
    setConfirmingDelete(false);
  }, [client]);

  const clientDupes = findClientMatchesForClient(local, allClients, local.id);
  const coachDupes = findCoachMatchesForClient(local, allClients, local.id);

  async function commit(patch: Partial<Client>) {
    setLocal((l) => ({ ...l, ...patch }));
    setSaving(true);
    try {
      await onUpdate(patch);
    } finally {
      setSaving(false);
    }
  }

  const currentStageIndex = STAGES.findIndex((s) => s.id === local.stage);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="w-full sm:max-w-xl h-full bg-bg border-l border-border overflow-y-auto">
        <div className="sticky top-0 z-10 bg-bg border-b border-border px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-text truncate">
              {fullName({ prenom: local.prenom, nom: local.nom }) || "(sans nom)"}
            </h2>
            <p className="text-xs text-textFaint">
              {saving ? "Enregistrement…" : "Enregistré"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmingDelete((v) => !v)}
              className="text-textFaint hover:text-red-400"
              aria-label="Supprimer le client"
              title="Supprimer le client"
            >
              <Trash2 size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-textSoft hover:text-text"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {confirmingDelete && (
            <div className="rounded-md border border-red-700/50 bg-red-900/20 px-3.5 py-3 space-y-2">
              <p className="text-sm text-red-300">
                Supprimer définitivement ce client et tout son historique ?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  className="font-heading text-xs uppercase tracking-wide px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600"
                >
                  Confirmer la suppression
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="font-heading text-xs uppercase tracking-wide px-3 py-1.5 rounded-md border border-border text-textSoft hover:text-text"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {(clientDupes.length > 0 || coachDupes.length > 0) && (
            <div className="space-y-1.5">
              {clientDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-red-900/30 border border-red-700/40 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Ce client existe aussi dans : {clientDupes.map((c) => fullName(c)).join(", ")}
                  </span>
                </div>
              )}
              {coachDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-900/30 border border-amber-700/40 px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Coach/unité aussi visé par : {coachDupes.map((c) => fullName(c)).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Stage stepper */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2.5">
            <button
              type="button"
              disabled={currentStageIndex <= 0}
              onClick={() => onChangeStage(STAGES[currentStageIndex - 1]!.id)}
              className="text-textSoft hover:text-brass disabled:opacity-30 disabled:hover:text-textSoft"
              aria-label="Étape précédente"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="font-heading text-xs uppercase tracking-wide text-brassSoft">
                {STAGES[currentStageIndex]?.code} · {STAGES[currentStageIndex]?.label}
              </div>
              <div className="text-[11px] text-textFaint">Étape {local.stage} / 6</div>
            </div>
            <button
              type="button"
              disabled={currentStageIndex >= STAGES.length - 1}
              onClick={() => onChangeStage(STAGES[currentStageIndex + 1]!.id)}
              className="text-textSoft hover:text-brass disabled:opacity-30 disabled:hover:text-textSoft"
              aria-label="Étape suivante"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Quick contact fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <TextInput
                value={local.prenom ?? ""}
                onChange={(e) => setLocal((l) => ({ ...l, prenom: e.target.value }))}
                onBlur={(e) => commit({ prenom: e.target.value })}
              />
            </Field>
            <Field label="Nom">
              <TextInput
                value={local.nom ?? ""}
                onChange={(e) => setLocal((l) => ({ ...l, nom: e.target.value }))}
                onBlur={(e) => commit({ nom: e.target.value })}
              />
            </Field>
            <Field label="Téléphone">
              <TextInput
                value={local.telephone ?? ""}
                onChange={(e) => setLocal((l) => ({ ...l, telephone: e.target.value }))}
                onBlur={(e) => commit({ telephone: e.target.value })}
              />
            </Field>
            <Field label="Courriel">
              <TextInput
                type="email"
                value={local.email ?? ""}
                onChange={(e) => setLocal((l) => ({ ...l, email: e.target.value }))}
                onBlur={(e) => commit({ email: e.target.value })}
              />
            </Field>
            <Field label="Ville">
              <TextInput
                value={local.ville ?? ""}
                onChange={(e) => setLocal((l) => ({ ...l, ville: e.target.value }))}
                onBlur={(e) => commit({ ville: e.target.value })}
              />
            </Field>
            <Field label="Code postal">
              <TextInput
                value={local.code_postal ?? ""}
                onChange={(e) => setLocal((l) => ({ ...l, code_postal: e.target.value }))}
                onBlur={(e) => commit({ code_postal: e.target.value })}
              />
            </Field>
            <Field label="Type de client">
              <Select
                value={local.type_client}
                onChange={(e) => commit({ type_client: e.target.value as Client["type_client"] })}
              >
                <option value="Particulier">Particulier</option>
                <option value="Concessionnaire">Concessionnaire</option>
              </Select>
            </Field>
            <Field label="Représentant">
              <Select
                value={local.owner_id ?? ""}
                onChange={(e) => commit({ owner_id: e.target.value || null })}
              >
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
            <p className="font-heading text-xs uppercase tracking-wide text-textSoft mb-2">
              Historique &amp; notes
            </p>
            <ActivityFeed activities={activities} loading={activitiesLoading} />
          </div>

          {/* Per-stage sections */}
          <div className="space-y-2.5">
            <Section
              code="01"
              title="Premier contact"
              icon={STAGES[0]!.icon}
              active={local.stage === 1}
              defaultOpen={local.stage === 1}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Provenance">
                  <Select
                    value={local.provenance ?? ""}
                    onChange={(e) => commit({ provenance: (e.target.value || null) as Client["provenance"] })}
                  >
                    <option value="">—</option>
                    {PROVENANCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Niveau d'intérêt">
                  <Select
                    value={local.niveau_interet ?? ""}
                    onChange={(e) =>
                      commit({ niveau_interet: (e.target.value || null) as Client["niveau_interet"] })
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
                <Field label="Coach neuf visé">
                  <TextInput
                    value={local.coach_neuf_vise ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, coach_neuf_vise: e.target.value }))}
                    onBlur={(e) => commit({ coach_neuf_vise: e.target.value })}
                  />
                </Field>
                <Field label="N° d'unité / stock">
                  <TextInput
                    value={local.coach_unite ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, coach_unite: e.target.value }))}
                    onBlur={(e) => commit({ coach_unite: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Field label="Marque (échange)">
                  <TextInput
                    value={local.coach_marque ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, coach_marque: e.target.value }))}
                    onBlur={(e) => commit({ coach_marque: e.target.value })}
                  />
                </Field>
                <Field label="Modèle">
                  <TextInput
                    value={local.coach_modele ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, coach_modele: e.target.value }))}
                    onBlur={(e) => commit({ coach_modele: e.target.value })}
                  />
                </Field>
                <Field label="Année">
                  <TextInput
                    value={local.coach_annee ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, coach_annee: e.target.value }))}
                    onBlur={(e) => commit({ coach_annee: e.target.value })}
                  />
                </Field>
                <Field label="Km">
                  <TextInput
                    value={local.coach_km ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, coach_km: e.target.value }))}
                    onBlur={(e) => commit({ coach_km: e.target.value })}
                  />
                </Field>
                <Field label="Accidenté">
                  <Select
                    value={local.coach_accidente ?? ""}
                    onChange={(e) =>
                      commit({ coach_accidente: (e.target.value || null) as Client["coach_accidente"] })
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
              <NoteComposer onSubmit={(text) => onAddNote(1, text)} />
            </Section>

            <Section
              code="02"
              title="Suivi"
              icon={STAGES[1]!.icon}
              active={local.stage === 2}
              defaultOpen={local.stage === 2}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date de suivi">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(local.follow_up_date)}
                    onChange={(e) =>
                      commit({ follow_up_date: fromDatetimeLocalValue(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Évaluation du client">
                  <Select
                    value={local.evaluation_client ?? ""}
                    onChange={(e) =>
                      commit({
                        evaluation_client: (e.target.value || null) as Client["evaluation_client"],
                      })
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
              </div>
              <NoteComposer onSubmit={(text) => onAddNote(2, text)} />
            </Section>

            <Section
              code="03"
              title="Usine & essai"
              icon={STAGES[2]!.icon}
              active={local.stage === 3}
              defaultOpen={local.stage === 3}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date visite d'usine">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(local.visite_usine_date)}
                    onChange={(e) =>
                      commit({ visite_usine_date: fromDatetimeLocalValue(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Date essai routier">
                  <TextInput
                    type="datetime-local"
                    value={toDatetimeLocalValue(local.essai_routier_date)}
                    onChange={(e) =>
                      commit({ essai_routier_date: fromDatetimeLocalValue(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <NoteComposer onSubmit={(text) => onAddNote(3, text)} />
            </Section>

            <Section
              code="04"
              title="Proposition"
              icon={STAGES[3]!.icon}
              active={local.stage === 4}
              defaultOpen={local.stage === 4}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix de vente">
                  <CurrencyInput
                    value={local.prix_vente}
                    onChange={(v) => commit({ prix_vente: v })}
                  />
                </Field>
                <Field label="Valeur d'échange">
                  <CurrencyInput
                    value={local.echange_valeur}
                    onChange={(v) => commit({ echange_valeur: v })}
                  />
                </Field>
              </div>
              <Field label="Options sélectionnées">
                <TextArea
                  value={local.options ?? ""}
                  onChange={(e) => setLocal((l) => ({ ...l, options: e.target.value }))}
                  onBlur={(e) => commit({ options: e.target.value })}
                  rows={2}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Description du coach en échange">
                  <TextInput
                    value={local.echange_description ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, echange_description: e.target.value }))}
                    onBlur={(e) => commit({ echange_description: e.target.value })}
                  />
                </Field>
                <Field label="N° de série (échange)">
                  <TextInput
                    value={local.echange_numero_serie ?? ""}
                    onChange={(e) =>
                      setLocal((l) => ({ ...l, echange_numero_serie: e.target.value }))
                    }
                    onBlur={(e) => commit({ echange_numero_serie: e.target.value })}
                  />
                </Field>
              </div>
              <NoteComposer onSubmit={(text) => onAddNote(4, text)} />
            </Section>

            <Section
              code="05"
              title="Contrat"
              icon={STAGES[4]!.icon}
              active={local.stage === 5}
              defaultOpen={local.stage === 5}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date du contrat">
                  <TextInput
                    type="date"
                    value={local.date_contrat ?? ""}
                    onChange={(e) => commit({ date_contrat: e.target.value || null })}
                  />
                </Field>
                <Field label="N° de contrat">
                  <TextInput
                    value={local.numero_contrat ?? ""}
                    onChange={(e) => setLocal((l) => ({ ...l, numero_contrat: e.target.value }))}
                    onBlur={(e) => commit({ numero_contrat: e.target.value })}
                  />
                </Field>
                <Field label="Montant final">
                  <CurrencyInput
                    value={local.montant_final}
                    onChange={(v) => commit({ montant_final: v })}
                  />
                </Field>
              </div>
              <NoteComposer onSubmit={(text) => onAddNote(5, text)} />
            </Section>

            <Section
              code="06"
              title="1er service"
              icon={STAGES[5]!.icon}
              active={local.stage === 6}
              defaultOpen={local.stage === 6}
            >
              <Field label="Date du 1er rendez-vous service">
                <TextInput
                  type="date"
                  value={local.date_rdv_service ?? ""}
                  onChange={(e) => commit({ date_rdv_service: e.target.value || null })}
                />
              </Field>
              <NoteComposer onSubmit={(text) => onAddNote(6, text)} />
            </Section>
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
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Nouvelle note pour cette étape…"
        />
      </Field>
      <div className="flex justify-end mt-1.5">
        <button
          type="button"
          disabled={submitting || !text.trim()}
          onClick={handleAdd}
          className="font-heading text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-md bg-brass text-bg hover:bg-brassSoft disabled:opacity-50"
        >
          {submitting ? "Ajout…" : "Ajouter la note"}
        </button>
      </div>
    </div>
  );
}
