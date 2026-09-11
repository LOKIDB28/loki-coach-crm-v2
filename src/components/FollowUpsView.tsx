"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";
import { fullName } from "@/lib/domain";
import { formatDateTime, isOverdue } from "@/lib/format";
import type { DealWithContact, Profile } from "@/lib/types";

interface FollowUpsViewProps {
  deals: DealWithContact[];
  profiles: Profile[];
  onOpen: (deal: DealWithContact) => void;
}

/**
 * "Suivis à faire": deals with a next_action_at, sorted ascending, with a
 * visual overdue indicator when the date is in the past.
 */
export function FollowUpsView({ deals, profiles, onOpen }: FollowUpsViewProps) {
  const withFollowUp = deals
    .filter((d) => !!d.next_action_at)
    .sort((a, b) => new Date(a.next_action_at!).getTime() - new Date(b.next_action_at!).getTime());

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  if (withFollowUp.length === 0) {
    return (
      <div className="rounded-xl border border-border/15 bg-surface px-4 py-6 text-center text-sm text-textSoft">
        Aucun suivi planifié pour le moment.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {withFollowUp.map((d) => {
        const overdue = isOverdue(d.next_action_at);
        const owner = d.owner_id ? profileById.get(d.owner_id) : null;
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onOpen(d)}
              className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                overdue
                  ? "border-red-400/40 bg-red-500/5 hover:border-red-400/70"
                  : "border-border/15 bg-surface hover:border-teal/40"
              }`}
            >
              {overdue ? (
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
              ) : (
                <CalendarClock size={16} className="text-teal shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {fullName(d.contact) || "(sans nom)"}
                </div>
                <div className="text-xs text-textSoft truncate">
                  {owner?.nom || owner?.email || "Non assigné"}
                </div>
              </div>
              <span className={`text-xs shrink-0 font-medium ${overdue ? "text-red-500" : "text-textSoft"}`}>
                {overdue ? "EN RETARD · " : ""}
                {formatDateTime(d.next_action_at)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
