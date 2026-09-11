"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";
import { fullName } from "@/lib/domain";
import { formatDateTime, isOverdue } from "@/lib/format";
import type { Client, Profile } from "@/lib/types";

interface FollowUpsViewProps {
  clients: Client[];
  profiles: Profile[];
  onOpen: (client: Client) => void;
}

/**
 * "Suivis à faire": clients with a follow_up_date, sorted ascending, with
 * a visual overdue indicator when the date is in the past.
 */
export function FollowUpsView({ clients, profiles, onOpen }: FollowUpsViewProps) {
  const withFollowUp = clients
    .filter((c) => !!c.follow_up_date)
    .sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime());

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  if (withFollowUp.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-textFaint">
        Aucun suivi planifié pour le moment.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {withFollowUp.map((c) => {
        const overdue = isOverdue(c.follow_up_date);
        const owner = c.owner_id ? profileById.get(c.owner_id) : null;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className={`w-full flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors ${
                overdue
                  ? "border-red-700/50 bg-red-900/20 hover:border-red-600"
                  : "border-border bg-surface hover:border-brass/50"
              }`}
            >
              {overdue ? (
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
              ) : (
                <CalendarClock size={16} className="text-brass shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-heading text-sm text-text truncate">
                  {fullName({ prenom: c.prenom, nom: c.nom }) || "(sans nom)"}
                </div>
                <div className="text-xs text-textFaint truncate">
                  {owner?.nom || owner?.email || "Non assigné"}
                </div>
              </div>
              <span
                className={`text-xs shrink-0 font-heading tracking-wide ${
                  overdue ? "text-red-300" : "text-textSoft"
                }`}
              >
                {overdue ? "EN RETARD · " : ""}
                {formatDateTime(c.follow_up_date)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
