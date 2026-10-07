"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Field } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import { TextArea } from "./ui/TextArea";
import { Select } from "./ui/Select";
import { Spinner } from "./ui/Spinner";
import { ErrorBanner } from "./ui/ErrorBanner";
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
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState(false);

  // `open` is a prop the parent flips instantly, but a real exit animation
  // needs this component to keep rendering for a moment after that -
  // shouldRender/visible decouple "still in the DOM, playing the closing
  // transition" from the parent's own boolean, same idea as DealDrawer's
  // mounted/closing pair (see there for the fuller version of this split).
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const MODAL_TRANSITION_MS = 200;
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Focused when the "Fermer sans enregistrer ?" banner replaces the
  // Annuler/Créer pair in the sticky footer (see below) - lands on Annuler,
  // not Confirmer, so an accidental Enter keypress doesn't discard the draft.
  const cancelInBannerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => setShouldRender(false), MODAL_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Separate from the effect above on purpose: that one fires on the render
  // where `shouldRender` is still false (it's what sets it true), so the
  // real form JSX - firstFieldRef included - doesn't exist in the DOM yet.
  // This one is keyed on shouldRender itself, so it only runs on the
  // following render, once that JSX has actually committed - the rAF just
  // waits one more frame past that so the opacity/scale transition starts
  // from its initial state instead of skipping straight to the end one.
  useEffect(() => {
    if (!shouldRender) return;
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      firstFieldRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [shouldRender]);

  // The banner now renders in the footer (always visible, outside the
  // scrollable area - see the form below), so it no longer needs scrolling
  // into view the way DealDrawer's equivalent banner still does. What it
  // does need: focus lands on Annuler, not Confirmer, so an accidental
  // Enter keypress right after Escape doesn't discard the draft.
  useEffect(() => {
    if (pendingClose) cancelInBannerRef.current?.focus({ preventScroll: true });
  }, [pendingClose]);

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

  if (!shouldRender) return null;

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function reallyClose() {
    setDraft(emptyDraft);
    setError(null);
    setDirty(false);
    setPendingClose(false);
    onClose();
  }

  // Same rationale as DealDrawer's identical guard: a native popup (the
  // "Source" datalist, or a date/datetime-local picker) also closes on
  // Escape as pure browser behavior, invisible to script except through
  // what's currently focused - skip our own close logic for that keypress
  // rather than risk closing the modal underneath it too.
  function isAutocompleteOrDateField(el: Element | null): boolean {
    if (!el || el.tagName !== "INPUT") return false;
    const input = el as HTMLInputElement;
    return input.hasAttribute("list") || ["date", "datetime-local", "time", "month", "week"].includes(input.type);
  }

  function attemptClose() {
    if (pendingClose) return;
    if (dirty) {
      setPendingClose(true);
    } else {
      reallyClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    // Same reasoning as DealDrawer's identical guard: a dead-key accent
    // sequence (^ then e for ê, etc.) is an IME composition in progress -
    // some browsers fire this same Escape to cancel just that composition.
    // nativeEvent, not e.isComposing directly - this project's installed
    // @types/react doesn't declare that property on the synthetic event,
    // even though React does forward it; the underlying native event has it.
    if (e.nativeEvent.isComposing) return;
    if (isAutocompleteOrDateField(document.activeElement)) return;
    attemptClose();
  }

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) attemptClose();
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
      reallyClose();
    } catch (err) {
      setError(getErrorMessage(err, "Erreur lors de la création du dossier."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-onyx/50 backdrop-blur-sm px-4 py-6 overflow-y-auto transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div
        className={`w-full max-w-2xl bg-surface/60 backdrop-blur-md border border-border/10 rounded-2xl shadow-xl my-auto transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border/15">
          <h2 className="text-lg font-semibold text-text min-w-0">Nouveau client — Prospect identifié</h2>
          <button
            type="button"
            onClick={attemptClose}
            className="flex items-center justify-center min-w-11 min-h-11 shrink-0 text-textSoft hover:text-text"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* flex-col + a dedicated scroll area (not the whole form) so the
            footer below is a normal flex sibling, never something the
            scrollable content can cover - the last field is guaranteed
            visible above it once scrolled to the bottom, by construction,
            not by padding math. min-h-0 is required here: a flex child's
            default min-height is its content's own height, not 0 - without
            it this inner area can't actually shrink to scroll (same fix as
            Rapports' table container). */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[75vh]">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prénom">
                <TextInput ref={firstFieldRef} value={draft.prenom} onChange={(e) => update("prenom", e.target.value)} required />
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
                    .filter((p) => !p.is_system_account && p.role !== "admin")
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
              {/* sm:col-span-2, not a bare col-span-2 - at grid-cols-1 (below
                  640px) an unconditional span-2 forces CSS Grid to create an
                  implicit second column track to satisfy it, which then
                  squeezes every OTHER field (auto-placed in column 1 only)
                  down to that implicit track's width instead of the full
                  row - confirmed via getComputedStyle, not assumed. Only
                  spans 2 once sm:grid-cols-2 actually exists. */}
              <Field label="Coach visé" className="sm:col-span-2">
                <TextInput value={draft.coach_vise} onChange={(e) => update("coach_vise", e.target.value)} />
              </Field>
            </div>

            <Field label="Notes">
              <TextArea value={draft.note} onChange={(e) => update("note", e.target.value)} rows={3} />
            </Field>

            {error && <ErrorBanner message={error} />}
          </div>

          {/* Footer - a plain flex sibling below the scroll area, never
              overlapping it, so it's visible without scrolling regardless
              of form length or keyboard state (when the keyboard is closed
              - with it open, behavior depends on the device/browser, not
              guaranteed here; no visualViewport handling added).
              pb-[calc(...)] mirrors page.tsx's mobile tab bar
              (pb-[env(safe-area-inset-bottom)]) - combined with the base
              0.75rem instead of replacing it, so "Créer le client" never
              sits under an iPhone's home-indicator area. */}
          <div className="shrink-0 border-t border-border/15 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            {pendingClose ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-sm text-text">Fermer sans enregistrer ? Les informations saisies seront perdues.</p>
                <div className="flex gap-2 justify-end shrink-0">
                  {/* Focused on arming (see the effect above) - Annuler, not
                      Confirmer, so an accidental Enter doesn't discard the draft. */}
                  <button
                    ref={cancelInBannerRef}
                    type="button"
                    onClick={() => setPendingClose(false)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border/20 text-textSoft hover:text-text"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={reallyClose}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-teal text-white hover:bg-teal/90"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={attemptClose}
                  className="text-xs font-medium px-4 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
                >
                  {submitting && <Spinner size={11} />}
                  {submitting ? "Création…" : "Créer le client"}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
