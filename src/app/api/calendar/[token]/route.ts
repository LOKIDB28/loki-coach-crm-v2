import { createClient } from "@supabase/supabase-js";
import { fullName } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Public .ics feed, one per rep - no Supabase Auth session at all (Outlook
 * has no way to log in). The token in the URL is the sole credential, so
 * it's never logged: no console.log of the raw param anywhere in this
 * file, and errors are reported generically rather than echoing it back.
 *
 * Uses the plain anon-key client (no cookies - there's no session to
 * carry) and the get_calendar_feed() RPC from migration 0014, which is a
 * SECURITY DEFINER function - the anon key itself has no direct table
 * access to deals/contacts/profiles beyond what that one narrow function
 * exposes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/i, "");

  // Cheap shape check before touching the DB - uuid_generate_v4() output
  // is always this shape, so anything else can't possibly match and isn't
  // worth a round-trip.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.rpc("get_calendar_feed", { p_token: token });

  if (error) {
    // Never include the token (or the raw error, which could echo it back)
    // in what gets logged or returned.
    console.error("calendar feed lookup failed");
    return new Response("Server error", { status: 500 });
  }

  if (!data || data.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const repNom: string = data[0].rep_nom ?? "Représentant";
  const origin = new URL(request.url).origin;

  const events: IcsEvent[] = data
    .filter((row: { deal_id: string | null }) => row.deal_id !== null)
    .map(
      (row: {
        deal_id: string;
        contact_prenom: string | null;
        contact_nom: string | null;
        montant: number | null;
        next_action_at: string;
      }) => {
        const clientName = fullName({ prenom: row.contact_prenom, nom: row.contact_nom }) || "(sans nom)";
        const title = row.montant !== null ? `${clientName} — ${formatCurrency(row.montant)}` : clientName;
        return {
          id: row.deal_id,
          title,
          description: `Fiche du deal : ${origin}/?deal=${row.deal_id}`,
          start: row.next_action_at,
        };
      }
    );

  const ics = buildIcsCalendar(`LOKI CRM — Relances de ${repNom}`, events);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="loki-crm-relances.ics"',
      "Cache-Control": "no-cache, must-revalidate",
    },
  });
}
