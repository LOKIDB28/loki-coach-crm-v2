export type ViewLayout = "grid" | "kanban";

/**
 * The kanban board is only ever actually rendered when explicitly selected
 * AND archived deals aren't being viewed - dragging an archived deal between
 * open pipeline stages doesn't make sense. Falling back here (rather than
 * resetting the viewLayout state itself when "Afficher les archivés" is
 * toggled on) means the archived toggle and the layout toggle stay two
 * independent pieces of state - flipping "Archivés" back off instantly
 * restores kanban with nothing to reconcile, and the stage filter (hidden
 * whenever this returns "kanban") comes back fully functional the moment
 * this returns "grid" for any reason, since it was never touched.
 */
export function effectiveViewLayout(viewLayout: ViewLayout, showArchived: boolean): ViewLayout {
  return viewLayout === "kanban" && !showArchived ? "kanban" : "grid";
}
