// A user counts as "available now" only if their last heartbeat (or initial
// flip-on) landed within this window. The frontend pings every ~60s, so two
// minutes gives one missed beat of slack before we drop them from the live pool.
export const PRESENCE_FRESH_MS = 2 * 60 * 1000;
