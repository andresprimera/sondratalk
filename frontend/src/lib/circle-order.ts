import type { Circle } from "@base-dashboard/shared"

// Orders one page of the picker catalog so the circles the user already has
// come first, with the catalog's own ordering preserved inside each group.
// Callers apply it per page, so loading another page never reshuffles the
// chips already on screen.
//
// `selected` must be a stable list (the saved circles), never the in-progress
// draft: re-sorting on every toggle would slide the chip out from under the
// pointer and the next click would hit a different circle.
export function selectedFirst(circles: Circle[], selected: Circle[]): Circle[] {
  const selectedIds = new Set(selected.map((c) => c.id))
  return [
    ...circles.filter((c) => selectedIds.has(c.id)),
    ...circles.filter((c) => !selectedIds.has(c.id)),
  ]
}
