"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/format";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { clearStoredThemePreference, getStoredThemePreference, subscribeThemeChange } from "@/lib/theme-preference";

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // null until the effect below runs client-side - getStoredThemePreference
  // reads localStorage, which doesn't exist during server render. The
  // "revenir au réglage de l'ordinateur" link only ever needs to appear
  // after that, so starting hidden (rather than guessing) is correct here,
  // unlike the anti-flash <head> script's own correctness requirement.
  const [storedThemePref, setStoredThemePref] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setStoredThemePref(getStoredThemePreference());
    // The header's own ThemeToggle button (above, in this same page) is a
    // SEPARATE component instance with its own state - clicking it doesn't
    // by itself update this page's storedThemePref. subscribeThemeChange is
    // what makes the link below appear/disappear live, without a reload.
    return subscribeThemeChange(() => setStoredThemePref(getStoredThemePreference()));
  }, []);

  function handleResetTheme() {
    clearStoredThemePreference();
    setStoredThemePref(null);
  }

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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
              aria-label="Retour au dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-text">Paramètres</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && <ErrorBanner message={error} />}

        <section className="bg-surface border border-border/15 rounded-xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-text mb-1">Apparence</h2>
            <p className="text-xs text-textSoft">
              Suit le réglage clair/sombre de l&apos;ordinateur par défaut. Le bouton{" "}
              <span aria-hidden="true">☀/☾</span> en haut à droite impose un choix manuel, mémorisé sur cet appareil
              seulement.
            </p>
          </div>
          {storedThemePref && (
            <button
              type="button"
              onClick={handleResetTheme}
              className="text-xs font-medium text-teal hover:underline"
            >
              Revenir au réglage de l&apos;ordinateur
            </button>
          )}
        </section>

        <section className="bg-surface border border-border/15 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-text mb-1">Flux calendrier des suivis</h2>
            <p className="text-xs text-textSoft">
              Un lien personnel, à toi seul, qui affiche dans Outlook, en lecture seule, les dates de tes dossiers
              non archivés : relances, essais routiers, visites d&apos;usine, visites au bureau et rendez-vous de
              service, passés et à venir. Chaque événement montre le type et le nom du client, avec un lien vers la
              fiche.
            </p>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-textSoft">
              <Spinner /> Chargement…
            </p>
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
                <p className="font-medium text-textSoft">Abonne-toi au lien, n&apos;importe pas le fichier :</p>
                <p>
                  Outlook web : Calendrier → Ajouter un calendrier → S&apos;abonner à partir du web → colle ce lien,
                  donne-lui un nom, puis valide.
                </p>
                <p>Outlook sur l&apos;ordinateur : Ajouter un calendrier → À partir d&apos;Internet → colle ce lien.</p>
                <p>
                  Ne télécharge pas le fichier .ics pour l&apos;ouvrir ou l&apos;importer : une copie importée ne se met
                  jamais à jour.
                </p>
              </div>

              <p className="text-[11px] text-textSoft">
                Outlook relit le lien de lui-même : un changement fait dans le CRM peut prendre de quelques heures à
                plus de 24 h à apparaître, selon la version d&apos;Outlook. Le CRM ne peut pas forcer cette mise à
                jour.
              </p>

              <p className="text-[11px] text-textSoft">
                Ce lien est personnel : il donne accès à tes dossiers et aux noms de tes clients, sans mot de passe.
                Ne le partage pas.
              </p>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
