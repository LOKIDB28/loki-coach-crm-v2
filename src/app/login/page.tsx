"use client";

import { useState, type FormEvent } from "react";
import { Bus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Bus size={28} className="text-brass" strokeWidth={1.75} />
          <span className="font-heading text-2xl uppercase tracking-widest text-text">
            LOKI <span className="text-brass">Coach</span>
          </span>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6">
          <h1 className="font-heading text-lg uppercase tracking-wide text-text mb-1">
            Connexion
          </h1>
          <p className="text-sm text-textSoft mb-5">
            Entrez votre courriel professionnel. Un lien de connexion sans mot de
            passe vous sera envoyé.
          </p>

          {status === "sent" ? (
            <div className="rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-brassSoft">
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Vérifiez
              votre boîte de réception (et vos courriels indésirables).
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-heading uppercase tracking-wide text-textSoft mb-1"
                >
                  Courriel
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@lokicoach.com"
                  className="w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm text-text placeholder:text-textFaint focus:outline-none focus:border-brass"
                />
              </div>

              {status === "error" && errorMessage && (
                <p className="text-sm text-red-400">{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-md bg-brass text-bg font-heading uppercase tracking-wide text-sm py-2 hover:bg-brassSoft transition-colors disabled:opacity-60"
              >
                {status === "sending" ? "Envoi en cours…" : "Recevoir le lien"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-textFaint mt-6">
          Accès réservé à l&apos;équipe LOKI Coach.
        </p>
      </div>
    </main>
  );
}
