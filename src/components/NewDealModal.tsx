"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Field } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import { TextArea } from "./ui/TextArea";
import { Select } from "./ui/Select";
import { findClientMatchesForDeal, findCoachMatchesForDeal, fullName, INTERETS, SOURCE_SUGGESTIONS } from "@/lib/domain";
import { getErrorMessage } from "@/lib/format";
import type { Deal, DealWithContact, NewContact, Profile } from "@/lib/types";

interface NewDealModalProps {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  existingDeals: DealWithContact[];
  onCreate: (contactInput: NewContact, dealInput: Partial<Deal>, initialNote: string) => Promise<void>;
}

const emptyDraft = {
  prenom: "",
  nom: "",
  telephone: "",
  email: "",
  ville: "",
  code_postal: "",
  type_contact: "particulier" as "particulier" | "entreprise" | "concessionnaire",
  owner_id: "" as string,
  source: "",
  niveau_interet: "" as string,
  coach_vise: "",
  note: "",
};

export function NewDealModal({ open, onClose, profiles, existingDeals, onCreate }: NewDealModalProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientDupes = useMemo(
    () =>
      findClientMatchesForDeal(
        {
          contact: { prenom: draft.prenom, nom: draft.nom, telephone: draft.telephone, email: draft.email },
        },
        existingDeals
      ),
    [draft.prenom, draft.nom, draft.telephone, draft.email, existingDeals]
  );

  const coachDupes = useMemo(
    () => findCoachMatchesForDeal({ coach_vise: draft.coach_vise }, existingDeals),
    [draft.coach_vise, existingDeals]
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
      const contactInput: NewContact = {
        prenom: draft.prenom.trim(),
        nom: draft.nom.trim(),
        telephone: draft.telephone.trim() || null,
        email: draft.email.trim() || null,
        ville: draft.ville.trim() || null,
        code_postal: draft.code_postal.trim() || null,
        type_contact: draft.type_contact,
        source: draft.source.trim() || null,
      };
      const dealInput: Partial<Deal> = {
        titre: fullName(draft) || "Nouveau dossier",
        owner_id: draft.owner_id || null,
        niveau_interet: (draft.niveau_interet || null) as Deal["niveau_interet"],
        coach_vise: draft.coach_vise.trim() || null,
      };
      await onCreate(contactInput, dealInput, draft.note.trim());
      setDraft(emptyDraft);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Erreur lors de la création du dossier."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-onyx/50 backdrop-blur-sm px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface/60 backdrop-blur-md border border-border/10 rounded-2xl shadow-xl my-auto">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border/15">
          <h2 className="text-lg font-semibold text-text min-w-0">Nouveau client — Prospect identifié</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center min-w-11 min-h-11 shrink-0 text-textSoft hover:text-text"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {(clientDupes.length > 0 || coachDupes.length > 0) && (
            <div className="space-y-1.5">
              {clientDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Client possiblement déjà existant : {clientDupes.map((d) => fullName(d.contact)).join(", ")}</span>
                </div>
              )}
              {coachDupes.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Coach/unité déjà visé par : {coachDupes.map((d) => fullName(d.contact)).join(", ")}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <TextInput value={draft.prenom} onChange={(e) => update("prenom", e.target.value)} required />
            </Field>
            <Field label="Nom">
              <TextInput value={draft.nom} onChange={(e) => update("nom", e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <TextInput value={draft.telephone} onChange={(e) => update("telephone", e.target.value)} />
            </Field>
            <Field label="Courriel">
              <TextInput type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Ville">
              <TextInput value={draft.ville} onChange={(e) => update("ville", e.target.value)} />
            </Field>
            <Field label="Code postal">
              <TextInput value={draft.code_postal} onChange={(e) => update("code_postal", e.target.value)} />
            </Field>
            <Field label="Type de client">
              <Select
                value={draft.type_contact}
                onChange={(e) => update("type_contact", e.target.value as typeof draft.type_contact)}
              >
                <option value="particulier">Particulier</option>
                <option value="entreprise">Entreprise</option>
                <option value="concessionnaire">Concessionnaire</option>
              </Select>
            </Field>
            <Field label="Représentant">
              <Select value={draft.owner_id} onChange={(e) => update("owner_id", e.target.value)}>
                <option value="">Non assigné</option>
                {profiles
                  .filter((p) => !p.is_system_account)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom || p.email}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Source">
              <TextInput list="source-suggestions-new" value={draft.source} onChange={(e) => update("source", e.target.value)} />
              <datalist id="source-suggestions-new">
                {SOURCE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Niveau d'intérêt">
              <Select value={draft.niveau_interet} onChange={(e) => update("niveau_interet", e.target.value)}>
                <option value="">—</option>
                {INTERETS.map((i) => (
                  <option key={i.v} value={i.v}>
                    {i.v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Coach visé" className="col-span-2">
              <TextInput value={draft.coach_vise} onChange={(e) => update("coach_vise", e.target.value)} />
            </Field>
          </div>

          <Field label="Notes">
            <TextArea value={draft.note} onChange={(e) => update("note", e.target.value)} rows={3} />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium px-4 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-xs font-medium px-4 py-2 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-60"
            >
              {submitting ? "Création…" : "Créer le client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
