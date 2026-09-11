"use client";

import { ArrowRightLeft, MessageSquare, Phone, Mail, MessageCircle, Users } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ActivityType, ActivityWithAuthor } from "@/lib/types";

const ACTIVITY_ICONS: Record<ActivityType, typeof MessageSquare> = {
  note: MessageSquare,
  appel: Phone,
  courriel: Mail,
  texto: MessageCircle,
  rencontre: Users,
  changement_etape: ArrowRightLeft,
  autre: MessageSquare,
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: "Note",
  appel: "Appel",
  courriel: "Courriel",
  texto: "Texto",
  rencontre: "Rencontre",
  changement_etape: "Changement d'étape",
  autre: "Autre",
};

interface ActivityFeedProps {
  activities: ActivityWithAuthor[];
  loading?: boolean;
}

/** Chronological (newest first) history/notes feed for a deal - append-only. */
export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return <p className="text-sm text-textSoft py-2">Chargement de l&apos;historique…</p>;
  }

  if (activities.length === 0) {
    return <p className="text-sm text-textSoft py-2">Aucune activité pour ce dossier.</p>;
  }

  return (
    <ul className="space-y-2">
      {activities.map((a) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? MessageSquare;
        const isStageChange = a.type === "changement_etape";
        return (
          <li
            key={a.id}
            className={`rounded-lg border px-3.5 py-2.5 ${
              isStageChange ? "border-teal/20 bg-teal/5" : "border-border/15 bg-surface2"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isStageChange ? "text-teal" : "text-textSoft"
                }`}
              >
                <Icon size={12} />
                {ACTIVITY_LABELS[a.type]}
              </span>
              <span className="text-[11px] text-textSoft shrink-0">{formatDateTime(a.created_at)}</span>
            </div>
            {a.contenu && <p className="text-sm text-text whitespace-pre-wrap">{a.contenu}</p>}
            <p className="text-[11px] text-textSoft mt-1">
              {a.author?.nom || a.author?.email || "Auteur inconnu"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
