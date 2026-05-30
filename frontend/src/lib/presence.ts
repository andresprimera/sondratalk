import { authFetch } from "@/lib/api"

export async function heartbeatPresenceApi(): Promise<void> {
  await authFetch("/api/users/me/availability/heartbeat", { method: "POST" })
}
