"use client";

import { AlertTriangle, Clock, Mail, MapPin, Phone } from "lucide-react";
import { fullName, interetColor } from "@/lib/domain";
import { daysOverdue, formatCurrency, formatDateTime, isOverdue, isWithinHours } from "@/lib/format";
import { IMPORT_BADGE_COLOR } from "@/lib/theme";
import type { DealWithContact, PipelineStage } from "@/lib/types";

interface DealCardProps {
  deal: DealWithContact;
  stage: PipelineStage | undefined;
  ownerName: string | null;
  hasClientDupe: boolean;
  hasCoachDupe: boolean;
  onOpen: () => void;
}

export function DealCard({ deal, stage, ownerName, hasClientDupe, hasCoachDupe, onOpen }: DealCardProps) {
  const { contact } = deal;
  const name = fullName(contact) || "(sans nom)";

  const stageBadgeClass =
    stage?.code === "gagne"
      ? "bg-green text-onyx"
      : stage?.code === "perdu"
      ? "bg-stone/15 text-stone"
      : "bg-surface2 text-teal";

  const overdue = isOverdue(deal.next_action_at);
  const soon = !overdue && isWithinHours(deal.next_action_at, 48);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative text-left w-full bg-surface border border-border/15 rounded-xl p-4 hover:border-teal/40 transition-colors flex flex-col gap-2.5 shadow-sm ${
        deal.archived ? "opacity-60" : ""
      }`}
    >
      {/* Provenance badge, not a status/interaction indicator - anchored to
          the card's actual corner (half-overlapping the border) rather than
          competing with the name/montant/stage cluster inside the padding. */}
      {deal.source_import === "pipedrive" && (
        <span
          className="absolute -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold text-white shadow-sm z-10"
          style={{ backgroundColor: IMPORT_BADGE_COLOR }}
          title="Importé de Pipedrive"
        >
          P
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-medium leading-tight text-text truncate">{name}</div>
          <div className="text-xs text-textSoft capitalize truncate">{contact.type_contact}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 max-w-[45%]">
          {deal.montant !== null && deal.montant !== undefined && (
            <span className="text-lg font-bold text-text truncate max-w-full">{formatCurrency(deal.montant)}</span>
          )}
          <span
            className={`text-[11px] font-medium rounded-full px-2.5 py-1 truncate max-w-full transition-colors duration-150 ${stageBadgeClass}`}
          >
            {stage?.label ?? "—"}
          </span>
          {deal.archived && (
            <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-textSoft/15 text-textSoft">
              Archivé
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 text-sm text-textSoft">
        {contact.telephone && (
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="text-textSoft/70" />
            <span className="truncate">{contact.telephone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-1.5">
            <Mail size={13} className="text-textSoft/70" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {(contact.ville || contact.code_postal) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-textSoft/70" />
            <span className="truncate">{[contact.ville, contact.code_postal].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Colors here are RELANCE_COLORS (lib/theme.ts) - dangerRed #D91A2A /
          infoBlue #1A6FBF, outside the brand palette by explicit request,
          reserved to these two states only. Rounded-full pill + persistent
          fill + clock icon is deliberately unlike DealDrawer's "Marquer
          perdu" (rounded-lg outline button, XCircle, Tailwind red-400/500,
          no fill until hover) so the two never read as the same control
          despite both living in the red family. */}
      {(overdue || soon) && (
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] w-fit ${
            overdue
              ? "bg-[#D91A2A]/15 border border-[#D91A2A]/30 text-[#D91A2A] font-semibold"
              : "bg-[#1A6FBF]/10 border border-[#1A6FBF]/20 text-[#1A6FBF] font-medium"
          }`}
        >
          <Clock size={12} />
          {overdue
            ? daysOverdue(deal.next_action_at!) >= 1
              ? `En retard (${daysOverdue(deal.next_action_at!)}j)`
              : "En retard"
            : `Bientôt · ${formatDateTime(deal.next_action_at)}`}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/15">
        <span className="text-xs text-textSoft truncate min-w-0">{ownerName ?? "Non assigné"}</span>
        {deal.niveau_interet && (
          <span className="inline-flex items-center gap-1.5 text-xs text-textSoft shrink-0">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: interetColor(deal.niveau_interet) }}
            />
            {deal.niveau_interet}
          </span>
        )}
      </div>

      {(hasClientDupe || hasCoachDupe) && (
        <div className="space-y-1">
          {hasClientDupe && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-500">
              <AlertTriangle size={12} />
              Ce client existe déjà ailleurs (nom, tél. ou courriel identique)
            </div>
          )}
          {hasCoachDupe && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600">
              <AlertTriangle size={12} />
              Coach/unité déjà visé par un autre dossier
            </div>
          )}
        </div>
      )}
    </button>
  );
}
