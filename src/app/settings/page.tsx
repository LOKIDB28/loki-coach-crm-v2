"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/format";

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // get_my_calendar_token() only ever returns the caller's own token
        // (auth.uid()) - see migration 0014. There's no table SELECT on
        // profiles.calendar_token at all, by design.
        const { data, error: rpcError } = await supabase.rpc("get_my_calendar_token");
        if (rpcError) throw rpcError;
        if (!data) throw new Error("Aucun token trouvé pour ce profil.");
        setFeedUrl(`${window.location.origin}/api/calendar/${data}.ics`);
      } catch (err) {
        setError(getErrorMessage(err, "Erreur de chargement."));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  async function handleCopy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Impossible de copier automatiquement - sélectionne et copie le lien manuellement.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/15 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            aria-label="Retour au dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-text">Paramètres</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div>
        )}

        <section className="bg-surface border border-border/15 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-text mb-1">Flux calendrier des relances</h2>
            <p className="text-xs text-textSoft">
              Un lien personnel, à toi seul, qui liste tes relances à venir (dossiers non archivés avec une date de
              suivi). Ajoute-le dans Outlook pour les voir directement dans ton calendrier, en lecture seule.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-textSoft">Chargement…</p>
          ) : feedUrl ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 rounded-lg bg-surface2 border border-border/20 px-3 py-2 text-sm text-text truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-3 py-2 rounded-lg transition-colors duration-150 ${
                    copied ? "bg-green text-onyx" : "bg-teal text-white hover:bg-teal/90"
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copié ✓" : "Copier"}
                </button>
              </div>

              <div className="rounded-lg bg-surface2 border border-border/20 px-3.5 py-3 text-xs text-textSoft space-y-1">
                <p className="font-medium text-textSoft">Dans Outlook :</p>
                <p>Ajouter un calendrier → À partir d&apos;Internet → colle ce lien.</p>
              </div>

              <p className="text-[11px] text-textSoft">
                Ce lien est personnel et donne accès à tes relances - ne le partage pas. Il ne change jamais, sauf
                demande explicite.
              </p>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
