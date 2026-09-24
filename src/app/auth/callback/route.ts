import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const VALID_OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Supabase auth callback - two distinct paths land here:
 *
 * 1. `?code=` - a real magic-link email, clicked by the same browser/device
 *    that requested it (PKCE code exchange, exchangeCodeForSession). This
 *    is the original, still-default path for every real human sign-in.
 *
 * 2. `?token_hash=&type=` - a link produced by the Supabase admin API
 *    (`auth.admin.generateLink`), used by scripts/e2e-auth-setup.ts to
 *    bootstrap a Playwright session with no human ever clicking an email.
 *    Deliberately NOT routed through PKCE: an admin-generated link is
 *    opened by a browser that never called signInWithOtp itself, so no
 *    code_verifier exists anywhere for exchangeCodeForSession to match
 *    against. verifyOtp(token_hash) is Supabase's own documented path for
 *    exactly this case - a direct one-time-token exchange, no verifier
 *    needed. Real magic-link emails never carry a token_hash param, so
 *    this branch never fires for a genuine human sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type && VALID_OTP_TYPES.includes(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
