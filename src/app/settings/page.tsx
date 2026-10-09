"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/format";
import { Button } from "@/components/ui/Button";
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
  // "Régénérer mon lien": idle → confirm (inline banner, same grammar as
  // DealDrawer's "Marquer perdu" confirmation) → busy (RPC in flight) →
  // back to idle with either regenDone or regenError set.
  const [regenStep, setRegenStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [regenDone, setRegenDone] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  // Focused when the confirmation opens - Annuler, not Confirmer, so an
  // accidental Enter doesn't invalidate the rep's current link (same rule
  // as NewDealModal's close-without-saving banner).
  const regenCancelRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (regenStep === "confirm") regenCancelRef.current?.focus({ preventScroll: true });
  }, [regenStep]);

  function armRegenerate() {
    setRegenError(null);
    setRegenDone(false);
    setRegenStep("confirm");
  }

  async function confirmRegenerate() {
    setRegenStep("busy");
    setRegenError(null);
    try {
      // regenerate_my_calendar_token() (migration 0029) only ever touches
      // the caller's own profiles row and returns the new token. The token
      // is the feed's sole credential: it goes straight into feedUrl and
      // nowhere else - never logged, never put in an error message (the
      // catch below shows a fixed string, not the RPC error), so nothing
      // here can carry it to the console or to Sentry.
      const { data, error: rpcError } = await supabase.rpc("regenerate_my_calendar_token");
      if (rpcError || typeof data !== "string" || !data) throw new Error("regenerate failed");
      setFeedUrl(`${window.location.origin}/api/calendar/${data}.ics`);
      setCopied(false);
      setRegenDone(true);
    } catch {
      // Deliberately not "your old link still works": if the response was
      // lost after the database committed, the old link is already dead.
      setRegenError("Le lien n'a pas pu être régénéré. Recharge la page pour voir le lien actuel, puis réessaie.");
    } finally {
      setRegenStep("idle");
    }
  }

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

              <div className="border-t border-border/15 pt-4 space-y-3">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <p className="text-[11px] text-textSoft">Lien partagé par erreur ? Remplace-le par un nouveau lien.</p>
                  <Button
                    variant="destructive"
                    size="compact"
                    disabled={regenStep !== "idle"}
                    onClick={armRegenerate}
                  >
                    <RefreshCw size={14} /> Régénérer mon lien
                  </Button>
                </div>

                {regenStep !== "idle" && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-3.5 py-3 space-y-2">
                    <p className="text-sm text-text">
                      L&apos;ancien lien cessera de fonctionner. Il faudra supprimer l&apos;ancien calendrier dans Outlook et
                      t&apos;abonner au nouveau lien.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={regenStep === "busy"}
                        onClick={confirmRegenerate}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
                      >
                        {regenStep === "busy" && <Spinner size={11} />}
                        {regenStep === "busy" ? "En cours…" : "Confirmer"}
                      </button>
                      <button
                        ref={regenCancelRef}
                        type="button"
                        disabled={regenStep === "busy"}
                        onClick={() => setRegenStep("idle")}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border/20 text-textSoft hover:text-text disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {regenError && <ErrorBanner message={regenError} />}

                {regenDone && (
                  <p role="status" className="text-xs text-text">
                    Nouveau lien créé, l&apos;ancien ne fonctionne plus. Dans Outlook, supprime l&apos;ancien calendrier,
                    puis abonne-toi au lien ci-dessus.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
