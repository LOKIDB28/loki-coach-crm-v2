"use client";

import { AlertTriangle, Mail, MapPin, Phone } from "lucide-react";
import { fullName, interetColor, stageById } from "@/lib/domain";
import type { Client } from "@/lib/types";

interface ClientCardProps {
  client: Client;
  ownerName: string | null;
  hasClientDupe: boolean;
  hasCoachDupe: boolean;
  onOpen: () => void;
}

export function ClientCard({ client, ownerName, hasClientDupe, hasCoachDupe, onOpen }: ClientCardProps) {
  const stage = stageById(client.stage);
  const name = fullName({ prenom: client.prenom, nom: client.nom }) || "(sans nom)";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left w-full bg-surface border border-border rounded-lg p-4 hover:border-brass/60 transition-colors flex flex-col gap-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-heading text-base leading-tight text-text truncate">{name}</div>
          <div className="text-xs text-textFaint">{client.type_client}</div>
        </div>
        <span className="shrink-0 font-heading text-[11px] uppercase tracking-wide rounded px-2 py-1 border border-border bg-surface2 text-brassSoft">
          {stage?.code} {stage?.label}
        </span>
      </div>

      <div className="space-y-1 text-sm text-textSoft">
        {client.telephone && (
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="text-textFaint" />
            <span className="truncate">{client.telephone}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-1.5">
            <Mail size={13} className="text-textFaint" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {(client.ville || client.code_postal) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-textFaint" />
            <span className="truncate">
              {[client.ville, client.code_postal].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-textFaint truncate">{ownerName ?? "Non assigné"}</span>
        {client.niveau_interet && (
          <span className="inline-flex items-center gap-1.5 text-xs text-textSoft">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: interetColor(client.niveau_interet) }}
            />
            {client.niveau_interet}
          </span>
        )}
      </div>

      {(hasClientDupe || hasCoachDupe) && (
        <div className="space-y-1">
          {hasClientDupe && (
            <div className="flex items-center gap-1.5 rounded-md bg-red-900/30 border border-red-700/40 px-2 py-1 text-[11px] text-red-300">
              <AlertTriangle size={12} />
              Ce client existe déjà ailleurs (nom, tél. ou courriel identique)
            </div>
          )}
          {hasCoachDupe && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-900/30 border border-amber-700/40 px-2 py-1 text-[11px] text-amber-300">
              <AlertTriangle size={12} />
              Coach/unité déjà visé par un autre dossier
            </div>
          )}
        </div>
      )}
    </button>
  );
}
