import { X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  /** Omit for a non-dismissible banner (matches most call sites - the message clears itself on the next successful action). */
  onDismiss?: () => void;
  className?: string;
}

/**
 * The one error-message banner for the whole app - previously 4 near-
 * identical bordered boxes (page.tsx, settings, rapports, intelligence) plus
 * one slightly different one (DealDrawer's dismissible saveError, now
 * aligned to the same rounded-xl/px-4 py-3 as the other four) plus 6 bare
 * `<p>`/`<span>` call sites with no box at all (login, NewDealModal,
 * ReportGenerator, ExchangeRateBar, DealDocuments, TradeInPhotos).
 *
 * role="alert" - a screen reader announces the message the moment it
 * mounts, same reasoning as the two-click-delete's role="status" strip
 * elsewhere, just at the more urgent "alert" level appropriate for an
 * error rather than a transient status update.
 */
export function ErrorBanner({ message, onDismiss, className = "" }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-2 rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-500 ${className}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Fermer" className="shrink-0 hover:text-red-600">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
