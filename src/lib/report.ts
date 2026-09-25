// Pure calculation helpers for the team report (/rapports) - no
// Supabase/React dependency, same pattern as lib/format.ts and
// lib/calendar.ts. Kept separate from the ReportGenerator component so the
// math is independently reasoned about/testable, and so stageCountsByRep
// can be shared with RepStageForecastChart (LOKI Intelligence) instead of
// existing as two copies that could silently drift apart.
//
// Deliberately excluded from this report (per explicit client direction):
// conversion rate, closed revenue, win rate - only one deal has ever
// reached "Gagné" in the whole system, so any percentage here would look
// precise while being meaningless. Also excluded: activity/note count as an
// activity proxy - too easy to game by logging empty notes.

import { REP_FILTERS } from "./calendar";
import type { DealWithContact, PipelineStage, Profile } from "./types";

export type ReportPeriod = "semaine" | "mois" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * "Cette semaine" = lundi de la semaine courante à maintenant. "Ce mois" =
 * 1er du mois courant à maintenant. Ni l'un ni l'autre ne peut s'étendre
 * dans le futur - une période de rapport s'arrête toujours à "maintenant".
 * "Dates personnalisées" utilise les bornes fournies telles quelles
 * (customEnd inclut la journée entière).
 */
export function getPeriodRange(period: ReportPeriod, customStart?: string, customEnd?: string): PeriodRange {
  const now = new Date();

  if (period === "semaine") {
    const start = new Date(now);
    const day = start.getDay(); // 0 = dimanche
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }

  if (period === "mois") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start, end: now };
  }

  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
  const end = customEnd ? new Date(`${customEnd}T23:59:59`) : now;
  return { start, end };
}

function isWithinRange(value: string | null, range: PeriodRange): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/**
 * Seuil "stagnant" pour la toute première version de ce rapport - une
 * estimation de départ, PAS un chiffre dérivé d'un vrai historique de
 * ventes fermées (un seul deal "Gagné" existe dans tout le système à ce
 * jour, ce qui est insuffisant pour calculer une durée normale par étape).
 * Documenté aussi dans l'UI (ReportGenerator) pour que ce ne soit pas un
 * chiffre caché - à ajuster une fois qu'il y aura assez de cycles fermés
 * pour dériver un vrai seuil, potentiellement différent par étape.
 */
export const STAGNATION_THRESHOLD_DAYS = 14;

/**
 * Pour chaque deal : le timestamp de son entrée dans son étape *actuelle*.
 * `stageChanges` est chaque ligne d'activité changement_etape (deal_id +
 * created_at) du système - regroupée ici au dernier changement par deal
 * plutôt que d'exiger que l'appelant le fasse. Un deal absent de
 * `stageChanges` n'a jamais changé d'étape depuis sa création : son propre
 * created_at sert alors de repère.
 */
export function latestStageEntryByDeal(
  deals: DealWithContact[],
  stageChanges: { deal_id: string; created_at: string }[]
): Map<string, string> {
  const latest = new Map<string, string>();
  for (const row of stageChanges) {
    const current = latest.get(row.deal_id);
    if (!current || new Date(row.created_at).getTime() > new Date(current).getTime()) {
      latest.set(row.deal_id, row.created_at);
    }
  }
  const result = new Map<string, string>();
  for (const deal of deals) {
    result.set(deal.id, latest.get(deal.id) ?? deal.created_at);
  }
  return result;
}

/** Deals d'un représentant donné, à une étape donnée - le filtre partagé derrière stageCountsByRep et RepStageForecastChart (nb_deals/valeur_brute/valeur_ponderee y appliquent chacun leur propre agrégat sur le même sous-ensemble). */
export function dealsForRepAndStage(
  deals: DealWithContact[],
  repProfileId: string,
  stageId: number
): DealWithContact[] {
  return deals.filter((d) => d.owner_id === repProfileId && d.stage_id === stageId);
}

/** Nb de deals actifs par étape ouverte, pour un représentant donné. */
export function stageCountsByRep(
  deals: DealWithContact[],
  openStages: PipelineStage[],
  repProfileId: string
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const stage of openStages) {
    counts[stage.id] = dealsForRepAndStage(deals, repProfileId, stage.id).length;
  }
  return counts;
}

export interface ReportRow {
  label: (typeof REP_FILTERS)[number]["label"];
  profileId: string | null;
  /** null = aucun deal créé dans la période avec un premier contact loggé - pas 0, pour ne pas afficher "0 jour" comme si c'était une vraie mesure. */
  avgFirstContactDays: number | null;
  firstContactSampleSize: number;
  stagnantCount: number;
  overdueFollowUpsInPeriod: number;
  stageCounts: Record<number, number>;
}

/**
 * Calcule les 4 métriques par représentant (Fred/Jeff/PM - REP_FILTERS,
 * le même trio fixe que le calendrier et RepStageForecastChart, pas les 5
 * personnes de REP_TAB_ORDER). Portée période : seuls le délai moyen de
 * 1er contact et les relances en retard sont bornés à `period` - le compte
 * de deals stagnants et la répartition par étape sont volontairement un
 * instantané de l'état actuel ("actuellement stagnants", "deals actifs"),
 * indépendant de la période choisie.
 */
export function computeReportRows(params: {
  deals: DealWithContact[];
  profiles: Profile[];
  openStages: PipelineStage[];
  stageEntryByDeal: Map<string, string>;
  period: PeriodRange;
  stagnationThresholdDays?: number;
}): ReportRow[] {
  const {
    deals,
    profiles,
    openStages,
    stageEntryByDeal,
    period,
    stagnationThresholdDays = STAGNATION_THRESHOLD_DAYS,
  } = params;
  const now = Date.now();

  return REP_FILTERS.map((rep) => {
    const profileId = profiles.find((p) => p.email === rep.email)?.id ?? null;
    if (!profileId) {
      return {
        label: rep.label,
        profileId: null,
        avgFirstContactDays: null,
        firstContactSampleSize: 0,
        stagnantCount: 0,
        overdueFollowUpsInPeriod: 0,
        stageCounts: {},
      };
    }

    const repDeals = deals.filter((d) => d.owner_id === profileId);

    const firstContactSamples = repDeals.filter((d) => isWithinRange(d.created_at, period) && d.premier_contact_le);
    const avgFirstContactDays =
      firstContactSamples.length > 0
        ? firstContactSamples.reduce((sum, d) => {
            const delayMs = new Date(d.premier_contact_le as string).getTime() - new Date(d.created_at).getTime();
            return sum + delayMs / 86_400_000;
          }, 0) / firstContactSamples.length
        : null;

    const activeRepDeals = repDeals.filter((d) => !d.archived && openStages.some((s) => s.id === d.stage_id));
    const stagnantCount = activeRepDeals.filter((d) => {
      const enteredAt = stageEntryByDeal.get(d.id);
      if (!enteredAt) return false;
      return (now - new Date(enteredAt).getTime()) / 86_400_000 >= stagnationThresholdDays;
    }).length;

    const overdueFollowUpsInPeriod = repDeals.filter(
      (d) => d.next_action_at && new Date(d.next_action_at).getTime() < now && isWithinRange(d.next_action_at, period)
    ).length;

    return {
      label: rep.label,
      profileId,
      avgFirstContactDays,
      firstContactSampleSize: firstContactSamples.length,
      stagnantCount,
      overdueFollowUpsInPeriod,
      stageCounts: stageCountsByRep(deals, openStages, profileId),
    };
  });
}
