"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { formatDate, getErrorMessage } from "@/lib/format";
import type { ExchangeRateWithAuthor } from "@/lib/types";

interface ExchangeRateBarProps {
  rate: ExchangeRateWithAuthor;
  onUpdate: (usdToCad: number) => Promise<void>;
}

/**
 * Display + inline edit for the shared exchange_rates row (see
 * supabase/migrations/0020_create_exchange_rates.sql) - open to any
 * internal user, RLS is the only gate, no extra role check here. Saving
 * updates the one shared row in place; every viewer's next fetch sees the
 * new value, there's no per-user override.
 */
export function ExchangeRateBar({ rate, onUpdate }: ExchangeRateBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(rate.usd_to_cad));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Taux invalide.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(parsed);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, "Erreur lors de la mise à jour."));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(String(rate.usd_to_cad));
    setError(null);
  }

  const authorName = rate.updated_by_profile?.nom || rate.updated_by_profile?.email || null;

  return (
    <div className="flex items-center gap-2 text-xs text-textSoft flex-wrap">
      {editing ? (
        <>
          <span>1 USD =</span>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-24 rounded-md bg-surface2 border border-border/20 px-2 py-1 text-xs text-text focus:outline-none focus:border-teal"
          />
          <span>CAD</span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-teal font-medium hover:underline disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={cancel} className="hover:underline">
            Annuler
          </button>
        </>
      ) : (
        <>
          <span>
            Taux : 1 USD = {rate.usd_to_cad} CAD, mis à jour le {formatDate(rate.updated_at)}
            {authorName ? ` par ${authorName}` : ""}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-teal hover:underline">
            <Pencil size={11} /> Modifier
          </button>
        </>
      )}
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
