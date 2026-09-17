import type { Circle } from "@base-dashboard/shared"

// The picker's catalog is paginated and ordered by popularity, so the circles a
// user already has scatter across pages — a few near the top, more appearing
// only after "Load more". Rendering their saved list as one block up front, and
// dropping those entries from the catalog below, keeps every picked circle
// together regardless of which page it would otherwise land on (including ones
// no loaded page contains yet).
//
// `pinned` must be a stable list (the saved circles), never the in-progress
// draft: re-deriving the block on every toggle would move the chip out from
// under the pointer, so the next click would land on a different circle.
export function pinnedFirst(catalog: Circle[], pinned: Circle[]): Circle[] {
  const pinnedIds = new Set(pinned.map((c) => c.id))
  return [...pinned, ...catalog.filter((c) => !pinnedIds.has(c.id))]
}
