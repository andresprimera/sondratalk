import {
  type Circle,
  type UpdateMyCirclesInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchMyCirclesApi(): Promise<Circle[]> {
  const res = await authFetch("/api/users/me/circles")
  return res.json()
}

export async function updateMyCirclesApi(
  data: UpdateMyCirclesInput,
): Promise<Circle[]> {
  const res = await authFetch("/api/users/me/circles", {
    method: "PUT",
    body: JSON.stringify(data),
  })
  return res.json()
}
