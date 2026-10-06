import { Trash2 } from "lucide-react";

interface ArmedDeleteButtonProps {
  /** Owned by the caller's list state (e.g. confirmDeleteId === item.id), not by this component - preserves the existing "only one row armed at a time" behavior from Lot 2, which a self-contained armed state here would lose. */
  armed: boolean;
  onArm: () => void;
  onConfirm: () => void;
  /** Used in the unarmed title/aria-label, e.g. "ce document" or "cette photo". */
  itemLabel: string;
  /**
   * "doc" - transparent unarmed background (DealDocuments' list row).
   * "photo" - dark disc over a photo thumbnail (TradeInPhotos' grid tile),
   * with the armed status text rendered as its own absolutely-positioned
   * strip instead of an inline sibling. Two non-armed looks, deliberately
   * not unified into one shared background.
   */
  appearance: "doc" | "photo";
}

/**
 * Shared two-click delete button (Lot 2 grammar) for DealDocuments and
 * TradeInPhotos - same armed/unarmed logic, visible status text +
 * role="status" (Lot 2), and aria-label that changes at the armed state.
 * Not a Button variant: this is an icon-only circular control with its own
 * armed/unarmed color logic, not one of Button's three variants.
 */
export function ArmedDeleteButton({ armed, onArm, onConfirm, itemLabel, appearance }: ArmedDeleteButtonProps) {
  const label = armed ? "Confirmer la suppression" : `Supprimer ${itemLabel}`;
  const unarmedClasses =
    appearance === "photo" ? "bg-onyx/60 text-white hover:bg-onyx/80" : "text-textSoft hover:bg-border/10 hover:text-red-500";

  return (
    <>
      {armed &&
        (appearance === "photo" ? (
          <div
            role="status"
            className="absolute inset-x-0 bottom-0 bg-onyx/75 text-white text-[9px] leading-tight text-center px-1 py-1"
          >
            Appuyer encore pour supprimer
          </div>
        ) : (
          <span role="status" className="shrink-0 text-[11px] font-medium text-red-500 whitespace-nowrap">
            Appuyer encore pour supprimer
          </span>
        ))}
      <button
        type="button"
        onClick={armed ? onConfirm : onArm}
        title={label}
        aria-label={label}
        className={`shrink-0 flex items-center justify-center min-w-7 min-h-7 rounded-full transition-colors ${
          armed ? "bg-red-500 text-white" : unarmedClasses
        } ${appearance === "photo" ? "absolute top-1 right-1" : ""}`}
      >
        <Trash2 size={13} />
      </button>
    </>
  );
}
