"use client";

import { ArrowRightLeft, MessageSquare } from "lucide-react";
import { ACTIVITY_TYPE_LABELS } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import type { ActivityWithAuthor } from "@/lib/types";

interface ActivityFeedProps {
  activities: ActivityWithAuthor[];
  loading?: boolean;
}

/**
 * Chronological (newest first) history/notes feed for a client - the
 * append-only replacement for the prototype's six free-text note fields,
 * plus every stage-change entry.
 */
export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return <p className="text-sm text-textFaint py-2">Chargement de l&apos;historique…</p>;
  }

  if (activities.length === 0) {
    return <p className="text-sm text-textFaint py-2">Aucune activité pour ce dossier.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {activities.map((a) => {
        const isStageChange = a.type === "changement_etape";
        return (
          <li
            key={a.id}
            className="rounded-md border border-border bg-surface2 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-1.5 font-heading text-[11px] uppercase tracking-wide text-brassSoft">
                {isStageChange ? (
                  <ArrowRightLeft size={12} />
                ) : (
                  <MessageSquare size={12} />
                )}
                {ACTIVITY_TYPE_LABELS[a.type]}
              </span>
              <span className="text-[11px] text-textFaint shrink-0">
                {formatDateTime(a.created_at)}
              </span>
            </div>
            {a.contenu && <p className="text-sm text-text whitespace-pre-wrap">{a.contenu}</p>}
            <p className="text-[11px] text-textFaint mt-1">
              {a.author?.nom || a.author?.email || "Auteur inconnu"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
