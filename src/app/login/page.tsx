"use client";

import { useState, type FormEvent } from "react";
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
    <main className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Same subtle brand gradient wash as the main dashboard (page.tsx) -
          reused verbatim rather than a new treatment, so the pre- and
          post-login experience read as one continuous surface. */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, #090909 0%, #007D48 50%, #00A660 100%)",
          opacity: 0.06,
        }}
      />

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-9">
          <div className="bg-onyx rounded-lg px-4 py-2 inline-flex items-center">
            <img src="/loki-coach-logo.svg" alt="LOKI Coach" className="h-7 sm:h-8 w-auto" />
          </div>
        </div>

        <div className="bg-surface border border-border/[0.12] rounded-[20px] p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.18)]">
          {status === "sent" ? (
            <>
              <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A660" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1 className="text-[23px] font-semibold tracking-[-0.015em] leading-[1.15] text-text mb-2 text-balance">
                Vérifiez vos courriels
              </h1>
              <p className="text-[13.5px] leading-[1.55] text-textSoft mb-4 max-w-[32ch]">
                Un lien de connexion a été envoyé.
              </p>
              <div className="rounded-xl border border-teal/25 bg-teal/[0.08] px-4 py-3 text-[13.5px] leading-[1.55] text-text">
                Envoyé à <strong className="text-teal">{email}</strong>. Vérifiez votre boîte de réception (et vos
                courriels indésirables).
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[23px] font-semibold tracking-[-0.015em] leading-[1.15] text-text mb-2 text-balance">
                Connexion
              </h1>
              <p className="text-[13.5px] leading-[1.55] text-textSoft mb-6 max-w-[32ch]">
                Entrez votre courriel professionnel. Un lien de connexion sans mot de passe vous sera envoyé.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[12.5px] font-semibold tracking-[0.01em] text-textSoft mb-1.5">
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
                    className="w-full min-h-11 rounded-[11px] bg-surface2 border border-border/[0.18] px-3.5 text-[14.5px] text-text placeholder:text-textSoft/55 focus:outline-none focus:border-teal focus:ring-[3px] focus:ring-teal/[0.16]"
                  />
                </div>

                {status === "error" && errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full min-h-11 rounded-[11px] bg-teal text-white font-semibold text-[14.5px] hover:bg-teal/90 transition-colors disabled:opacity-60"
                >
                  {status === "sending" ? "Envoi en cours…" : "Recevoir le lien"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs tracking-[0.01em] text-textSoft mt-7">
          Accès réservé à l&apos;équipe LOKI Coach.
        </p>
      </div>
    </main>
  );
}
