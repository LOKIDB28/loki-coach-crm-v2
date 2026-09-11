"use client";

import { useState, type FormEvent } from "react";
import { Bus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/format";

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
      setErrorMessage(getErrorMessage(err, "Une erreur est survenue."));
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Bus size={28} className="text-teal" strokeWidth={1.75} />
          <span className="text-2xl font-semibold tracking-tight text-text">
            LOKI <span className="text-teal">Coach</span>
          </span>
        </div>

        <div className="bg-surface border border-border/15 rounded-2xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-text mb-1">Connexion</h1>
          <p className="text-sm text-textSoft mb-5">
            Entrez votre courriel professionnel. Un lien de connexion sans mot de passe vous sera envoyé.
          </p>

          {status === "sent" ? (
            <div className="rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception (et vos
              courriels indésirables).
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-textSoft mb-1">
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
                  className="w-full rounded-lg bg-surface2 border border-border/20 px-3 py-2 text-sm text-text placeholder:text-textSoft/60 focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                />
              </div>

              {status === "error" && errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-lg bg-teal text-white font-medium text-sm py-2.5 hover:bg-teal/90 transition-colors disabled:opacity-60"
              >
                {status === "sending" ? "Envoi en cours…" : "Recevoir le lien"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-textSoft mt-6">Accès réservé à l&apos;équipe LOKI Coach.</p>
      </div>
    </main>
  );
}
