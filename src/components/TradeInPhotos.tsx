"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import type { DealPhoto } from "@/lib/types";

const MAX_PHOTOS = 12;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "heif"];

interface TradeInPhotosProps {
  photos: DealPhoto[];
  /** storage_path -> short-lived signed URL, refreshed by the parent - never persisted here. */
  photoUrls: Record<string, string>;
  uploading: boolean;
  error: string | null;
  onUpload: (files: File[]) => void;
  onDelete: (photo: DealPhoto) => void;
}

/**
 * Photo gallery for the trade-in vehicle ("Véhicule en échange", Section 1).
 * Private Supabase Storage bucket behind signed URLs (see lib/data.ts and
 * supabase/migrations/0015_create_deal_photos.sql) - never a public link.
 * capture="environment" biases mobile browsers toward the rear camera for
 * the main use case (a rep photographing the vehicle on-site); `multiple`
 * still allows picking existing files from the gallery too.
 */
export function TradeInPhotos({ photos, photoUrls, uploading, error, onUpload, onDelete }: TradeInPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<DealPhoto | null>(null);

  // Auto-disarms an armed delete after a few seconds rather than relying on
  // onBlur (which races the click event on the same button - a known
  // pitfall) or a click-outside listener (unreliable on touch).
  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  function isAcceptedFile(file: File): boolean {
    if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
    // iOS Safari sometimes reports an empty/non-standard MIME type for
    // HEIC/HEIF captures - fall back to the extension rather than reject a
    // real photo the bucket itself would accept.
    const ext = file.name.split(".").pop()?.toLowerCase();
    return !!ext && ACCEPTED_EXTENSIONS.includes(ext);
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setLocalError(null);

    if (photos.length + files.length > MAX_PHOTOS) {
      setLocalError(
        `Maximum de ${MAX_PHOTOS} photos par véhicule (${photos.length} déjà ajoutée${photos.length > 1 ? "s" : ""}).`
      );
    } else {
      const tooLarge = files.find((f) => f.size > MAX_FILE_SIZE);
      const invalidType = files.find((f) => !isAcceptedFile(f));
      if (tooLarge) {
        setLocalError(`"${tooLarge.name}" dépasse 10 Mo.`);
      } else if (invalidType) {
        setLocalError(`"${invalidType.name}" n'est pas un format accepté (jpg, png, heic).`);
      } else {
        onUpload(files);
      }
    }

    // Reset so selecting the exact same file(s) again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  }

  const displayedError = localError ?? error;

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-textSoft">Photos du véhicule</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || photos.length >= MAX_PHOTOS}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none"
        >
          <ImagePlus size={14} />
          {uploading ? "Envoi…" : "Ajouter des photos"}
        </button>
        <span className="text-[11px] text-textSoft tabular-nums">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {displayedError && <p className="text-xs text-red-500">{displayedError}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => {
            const url = photoUrls[photo.storage_path];
            const confirming = confirmDeleteId === photo.id;
            return (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden border border-border/15 bg-surface2"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset next/image can optimize.
                  <img
                    src={url}
                    alt="Photo du véhicule en échange"
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightboxPhoto(photo)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-textSoft">…</div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirming) {
                      onDelete(photo);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(photo.id);
                    }
                  }}
                  title={confirming ? "Confirmer la suppression" : "Supprimer cette photo"}
                  className={`absolute top-1 right-1 flex items-center justify-center min-w-7 min-h-7 rounded-full text-white transition-colors ${
                    confirming ? "bg-red-500" : "bg-onyx/60 hover:bg-onyx/80"
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {lightboxPhoto && photoUrls[lightboxPhoto.storage_path] && (
        <div
          className="fixed inset-0 z-50 bg-onyx/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            aria-label="Fermer"
            className="absolute top-4 right-4 flex items-center justify-center min-w-11 min-h-11 rounded-full bg-surface/20 text-white hover:bg-surface/30"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset next/image can optimize. */}
          <img
            src={photoUrls[lightboxPhoto.storage_path]}
            alt="Photo du véhicule en échange (agrandie)"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
