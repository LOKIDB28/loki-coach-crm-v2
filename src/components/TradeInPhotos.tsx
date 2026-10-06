"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Spinner } from "./ui/Spinner";
import { ErrorBanner } from "./ui/ErrorBanner";
import { ArmedDeleteButton } from "./ui/ArmedDeleteButton";
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
  /**
   * Fires whenever the lightbox opens or closes - DealDrawer (the only
   * current parent) uses this to defer its own Escape-to-close while a
   * photo is open on top of it. Deliberately a plain boolean callback
   * rather than relying on focus/event-bubbling order between the two
   * components, which is fragile - see the Escape handler below for why.
   */
  onLightboxOpenChange: (open: boolean) => void;
}

/**
 * Photo gallery for the trade-in vehicle ("Véhicule en échange", Section 1).
 * Private Supabase Storage bucket behind signed URLs (see lib/data.ts and
 * supabase/migrations/0015_create_deal_photos.sql) - never a public link.
 * No `capture` attribute on the file input, deliberately: it forces the
 * camera open directly, skipping the native "Take Photo" / "Choose from
 * Library" / "Choose File" picker mobile browsers otherwise show for a
 * plain `accept="image/*"` input - a rep photographing the vehicle on-site
 * and one importing already-taken photos later both need to work, not just
 * the first. `multiple` allows picking several files at once either way.
 */
export function TradeInPhotos({
  photos,
  photoUrls,
  uploading,
  error,
  onUpload,
  onDelete,
  onLightboxOpenChange,
}: TradeInPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<DealPhoto | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onLightboxOpenChange(lightboxPhoto !== null);
  }, [lightboxPhoto, onLightboxOpenChange]);

  // Purely a UX/accessibility nicety (focus lands on the close button
  // instead of staying wherever it was) - not load-bearing for Escape
  // itself, which uses a window-level listener below precisely so it
  // doesn't depend on focus location at all.
  useEffect(() => {
    if (lightboxPhoto) lightboxCloseRef.current?.focus({ preventScroll: true });
  }, [lightboxPhoto]);

  // window-level, not onKeyDown on the lightbox div: the latter only fires
  // for a keydown that actually bubbles from inside the lightbox's own
  // subtree, which depends on focus still being in there (e.g. it breaks
  // if the user clicks the image itself - not focusable, so it wouldn't
  // move focus away, but also doesn't guarantee focus stayed put either -
  // or tabs elsewhere, since nothing here traps focus). A window listener,
  // scoped to exactly while the lightbox is open, always fires regardless.
  useEffect(() => {
    if (!lightboxPhoto) return;
    function onKeyDown(e: globalThis.KeyboardEvent) {
      // Same guard as DealDrawer/NewDealModal, for consistency - an IME
      // composition elsewhere (unlikely while the lightbox itself holds no
      // text field, but this listener is window-level and fires regardless
      // of focus) shouldn't be read as "close the lightbox".
      if (e.key === "Escape" && !e.isComposing) setLightboxPhoto(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxPhoto]);

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
          {uploading ? <Spinner size={13} /> : <ImagePlus size={14} />}
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
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {displayedError && <ErrorBanner message={displayedError} />}

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
                <ArmedDeleteButton
                  armed={confirming}
                  onArm={() => setConfirmDeleteId(photo.id)}
                  onConfirm={() => {
                    onDelete(photo);
                    setConfirmDeleteId(null);
                  }}
                  itemLabel="cette photo"
                  appearance="photo"
                />
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
            ref={lightboxCloseRef}
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
