import { daysSince, formatDateTime } from "@/lib/format";
import type { DealWithContact } from "@/lib/types";

interface DealHoverContentProps {
  deal: DealWithContact;
  /** From latestStageEntryByDeal (lib/report.ts) - always present, falls back to created_at there. */
  stageEnteredAt: string | undefined;
  /** From latestActivityByDeal (lib/report.ts) - absent (not a fallback date) when the deal has zero logged activities. */
  lastActivityAt: string | undefined;
}

/** The 3-line body of the Pipeline/Kanban card hover tooltip - shared so DealGrid (page.tsx) and KanbanColumn render identical content. */
export function DealHoverContent({ deal, stageEnteredAt, lastActivityAt }: DealHoverContentProps) {
  const daysInStage = stageEnteredAt ? daysSince(stageEnteredAt) : null;

  return (
    <div className="space-y-1">
      {daysInStage !== null && (
        <div>
          {daysInStage} jour{daysInStage === 1 ? "" : "s"} dans cette étape
        </div>
      )}
      <div>Dernière activité : {lastActivityAt ? formatDateTime(lastActivityAt) : "Aucune"}</div>
      {deal.next_action_at && <div>Prochaine relance : {formatDateTime(deal.next_action_at)}</div>}
    </div>
  );
}
