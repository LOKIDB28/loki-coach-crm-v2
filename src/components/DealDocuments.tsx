"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { formatDate, getErrorMessage } from "@/lib/format";
import { Spinner } from "./ui/Spinner";
import type { DealDocument } from "@/lib/types";

const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MiB
const MAX_NAME_LENGTH = 200;
const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

interface DealDocumentsProps {
  documents: DealDocument[];
  uploading: boolean;
  error: string | null;
  onUpload: (file: File, originalName: string) => Promise<void>;
  onDelete: (document: DealDocument) => void;
  /** Resolves to a fresh 1h signed URL for this one document - called only when "Ouvrir" is clicked, never eagerly for the whole list. */
  onGetSignedUrl: (storagePath: string) => Promise<string>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Strips control characters and caps length - defense in depth alongside the DB's own char_length(original_name) <= 255 check (0025_create_deal_documents.sql). */
function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping C0/DEL control characters from a user-supplied filename.
  return name.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * Document gallery for a deal ("Documents", Section 6 - Gagné). Private
 * Supabase Storage bucket behind signed URLs (see lib/data.ts and
 * supabase/migrations/0025_create_deal_documents.sql), same model as
 * TradeInPhotos but adapted: a list (not a thumbnail grid, nothing to
 * preview inline) and signed URLs requested one at a time on open, not
 * eagerly for the whole list.
 */
export function DealDocuments({ documents, uploading, error, onUpload, onDelete, onGetSignedUrl }: DealDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  // MIME-type-only, deliberately not extended with TradeInPhotos' extension
  // fallback (that one exists specifically for HEIC's genuinely unreliable
  // MIME reporting in some browsers - PDF/JPEG/PNG don't have that
  // problem). data.ts's uploadDealDocument derives the storage extension
  // strictly from file.type too, never from the filename - accepting a
  // file here that it would then reject there would be a confusing,
  // inconsistent failure for no real benefit.
  function isAcceptedFile(file: File): boolean {
    return ACCEPTED_MIME_TYPES.includes(file.type);
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setLocalError(null);
    setOpenError(null);

    if (documents.length + files.length > MAX_DOCUMENTS) {
      setLocalError(
        `Maximum de ${MAX_DOCUMENTS} documents par dossier (${documents.length} déjà ajouté${documents.length > 1 ? "s" : ""}).`
      );
    } else {
      const invalidType = files.find((f) => !isAcceptedFile(f));
      const tooLarge = files.find((f) => f.size > MAX_FILE_SIZE);
      if (invalidType) {
        setLocalError(`"${invalidType.name}" n'est pas un format accepté (PDF, JPEG, PNG).`);
      } else if (tooLarge) {
        setLocalError(`"${tooLarge.name}" dépasse 20 Mo.`);
      } else {
        for (const file of files) {
          const clean = sanitizeFileName(file.name);
          if (!clean) {
            setLocalError("Nom de fichier invalide.");
            break;
          }
          // eslint-disable-next-line no-await-in-loop -- sequential on purpose, same as TradeInPhotos: each upload's row insert needs the previous one's trigger-driven activity log to have settled before the next, not fired concurrently.
          await onUpload(file, clean);
        }
      }
    }

    // Reset so selecting the exact same file(s) again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleOpen(doc: DealDocument) {
    setOpenError(null);
    // Opened synchronously, in direct response to the click - Safari (iOS in
    // particular) blocks window.open() called after an await, treating it
    // as no longer part of the user gesture. The blank tab is filled in
    // below once the signed URL actually resolves.
    const tab = window.open("", "_blank");
    if (!tab) {
      setOpenError("Le navigateur a bloqué l'ouverture d'un nouvel onglet - autorisez les fenêtres contextuelles pour ce site et réessayez.");
      return;
    }
    // Reverse tabnabbing guard - without this, the opened tab keeps a live
    // `window.opener` reference back to this page, which a malicious or
    // compromised destination could use to rewrite this tab's location
    // (e.g. to a phishing page) once it loads. Same effect as rel="noopener"
    // on a plain link, applied here since this tab is opened via script.
    tab.opener = null;
    try {
      const url = await onGetSignedUrl(doc.storage_path);
      tab.location.href = url;
    } catch (err) {
      tab.close();
      setOpenError(getErrorMessage(err, "Erreur lors de l'ouverture du document."));
    }
  }

  const displayedError = localError ?? error ?? openError;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-textSoft">Documents</p>
        <span className="text-[11px] text-textSoft tabular-nums">
          {documents.length}/{MAX_DOCUMENTS}
        </span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || documents.length >= MAX_DOCUMENTS}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none"
      >
        {uploading ? <Spinner size={13} /> : <Upload size={14} />}
        {uploading ? "Envoi…" : "Ajouter un document"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {displayedError && <p className="text-xs text-red-500">{displayedError}</p>}

      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((doc) => {
            const confirming = confirmDeleteId === doc.id;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/15 bg-surface px-3 py-2"
              >
                <FileText size={16} className="text-teal shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-text truncate">{doc.original_name}</div>
                  <div className="text-[11px] text-textSoft">
                    {formatSize(doc.size_bytes)} · {formatDate(doc.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpen(doc)}
                  className="shrink-0 text-[11px] font-medium text-teal hover:bg-teal/10 rounded-md px-2 py-1.5"
                >
                  Ouvrir
                </button>
                {confirming && (
                  <span className="shrink-0 text-[11px] font-medium text-red-500 whitespace-nowrap">
                    Appuyer encore pour supprimer
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirming) {
                      onDelete(doc);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(doc.id);
                    }
                  }}
                  title={confirming ? "Confirmer la suppression" : "Supprimer ce document"}
                  className={`shrink-0 flex items-center justify-center min-w-7 min-h-7 rounded-full transition-colors ${
                    confirming ? "bg-red-500 text-white" : "text-textSoft hover:bg-border/10 hover:text-red-500"
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
