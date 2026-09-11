"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Field } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import { TextArea } from "./ui/TextArea";
import { Select } from "./ui/Select";
import {
  ACCIDENT_OPTIONS,
  fullName,
  findClientMatchesForClient,
  findCoachMatchesForClient,
  INTERETS,
  PROVENANCES,
} from "@/lib/domain";
import type { Client, NewClient, Profile } from "@/lib/types";

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  existingClients: Client[];
  onCreate: (input: NewClient, initialNote: string) => Promise<void>;
}

const emptyDraft = {
  prenom: "",
  nom: "",
  telephone: "",
  email: "",
  ville: "",
  code_postal: "",
  type_client: "Particulier" as "Particulier" | "Concessionnaire",
  owner_id: "" as string,
  provenance: "" as string,
  niveau_interet: "" as string,
  coach_neuf_vise: "",
  coach_unite: "",
  coach_marque: "",
  coach_modele: "",
  coach_annee: "",
  coach_km: "",
  coach_accidente: "" as string,
  note: "",
};

export function NewClientModal({ open, onClose, profiles, existingClients, onCreate }: NewClientModalProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientDupes = useMemo(
    () =>
      findClientMatchesForClient(
        { prenom: draft.prenom, nom: draft.nom, telephone: draft.telephone, email: draft.email },
        existingClients
      ),
    [draft.prenom, draft.nom, draft.telephone, draft.email, existingClients]
  );

  const coachDupes = useMemo(
    () =>
      findCoachMatchesForClient(
        { coach_neuf_vise: draft.coach_neuf_vise, coach_unite: draft.coach_unite },
        existingClients
      ),
    [draft.coach_neuf_vise, draft.coach_unite, existingClients]
  );

  if (!open) return null;

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.prenom.trim() && !draft.nom.trim()) {
      setError("Le prénom ou le nom est requis.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: NewClient = {
        stage: 1,
        prenom: draft.prenom.trim(),
        nom: draft.nom.trim(),
        telephone: draft.telephone.trim() || null,
        email: draft.email.trim() || null,
        ville: draft.ville.trim() || null,
        code_postal: draft.code_postal.trim() || null,
        type_client: draft.type_client,
        owner_id: draft.owner_id || null,
        provenance: (draft.provenance || null) as NewClient["provenance"],
        niveau_interet: (draft.niveau_interet || null) as NewClient["niveau_interet"],
        coach_neuf_vise: draft.coach_neuf_vise.trim() || null,
        coach_unite: draft.coach_unite.trim() || null,
        coach_marque: draft.coach_marque.trim() || null,
        coach_modele: draft.coach_modele.trim() || null,
        coach_annee: draft.coach_annee.trim() || null,
        coach_km: draft.coach_km.trim() || null,
        coach_accidente: (draft.coach_accidente || null) as NewClient["coach_accidente"],
      };
      await onCreate(input, draft.note.trim());
      setDraft(emptyDraft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création du client.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-lg shadow-xl my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-heading text-lg uppercase tracking-wide text-text">
            Nouveau client — 01 · Premier contact
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-textSoft hover:text-text"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {(clientDupes.length > 0 || coachDupes.length > 0) && (
            <div className="space-y-1.5">
              {clientDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-red-900/30 border border-red-700/40 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Client possiblement déjà existant :{" "}
                    {clientDupes.map((c) => fullName(c)).join(", ")}
                  </span>
                </div>
              )}
              {coachDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-900/30 border border-amber-700/40 px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Coach/unité déjà visé par : {coachDupes.map((c) => fullName(c)).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <TextInput
                value={draft.prenom}
                onChange={(e) => update("prenom", e.target.value)}
                required
              />
            </Field>
            <Field label="Nom">
              <TextInput value={draft.nom} onChange={(e) => update("nom", e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <TextInput
                value={draft.telephone}
                onChange={(e) => update("telephone", e.target.value)}
              />
            </Field>
            <Field label="Courriel">
              <TextInput
                type="email"
                value={draft.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="Ville">
              <TextInput value={draft.ville} onChange={(e) => update("ville", e.target.value)} />
            </Field>
            <Field label="Code postal">
              <TextInput
                value={draft.code_postal}
                onChange={(e) => update("code_postal", e.target.value)}
              />
            </Field>
            <Field label="Type de client">
              <Select
                value={draft.type_client}
                onChange={(e) => update("type_client", e.target.value as "Particulier" | "Concessionnaire")}
              >
                <option value="Particulier">Particulier</option>
                <option value="Concessionnaire">Concessionnaire</option>
              </Select>
            </Field>
            <Field label="Représentant">
              <Select value={draft.owner_id} onChange={(e) => update("owner_id", e.target.value)}>
                <option value="">Non assigné</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom || p.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Provenance">
              <Select value={draft.provenance} onChange={(e) => update("provenance", e.target.value)}>
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
                value={draft.niveau_interet}
                onChange={(e) => update("niveau_interet", e.target.value)}
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
                value={draft.coach_neuf_vise}
                onChange={(e) => update("coach_neuf_vise", e.target.value)}
              />
            </Field>
            <Field label="N° d'unité / stock">
              <TextInput
                value={draft.coach_unite}
                onChange={(e) => update("coach_unite", e.target.value)}
              />
            </Field>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="font-heading text-[11px] uppercase tracking-wide text-textSoft mb-2">
              Véhicule usagé en échange
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Field label="Marque">
                <TextInput
                  value={draft.coach_marque}
                  onChange={(e) => update("coach_marque", e.target.value)}
                />
              </Field>
              <Field label="Modèle">
                <TextInput
                  value={draft.coach_modele}
                  onChange={(e) => update("coach_modele", e.target.value)}
                />
              </Field>
              <Field label="Année">
                <TextInput
                  value={draft.coach_annee}
                  onChange={(e) => update("coach_annee", e.target.value)}
                />
              </Field>
              <Field label="Km">
                <TextInput
                  value={draft.coach_km}
                  onChange={(e) => update("coach_km", e.target.value)}
                />
              </Field>
              <Field label="Accidenté">
                <Select
                  value={draft.coach_accidente}
                  onChange={(e) => update("coach_accidente", e.target.value)}
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
          </div>

          <Field label="Notes">
            <TextArea value={draft.note} onChange={(e) => update("note", e.target.value)} rows={3} />
          </Field>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="font-heading text-xs uppercase tracking-wide px-4 py-2 rounded-md border border-border text-textSoft hover:text-text"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="font-heading text-xs uppercase tracking-wide px-4 py-2 rounded-md bg-brass text-bg hover:bg-brassSoft disabled:opacity-60"
            >
              {submitting ? "Création…" : "Créer le client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
