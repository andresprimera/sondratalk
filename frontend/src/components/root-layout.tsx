import { Outlet } from "react-router"
import { IncomingCallDialog } from "@/components/incoming-call-dialog"

// Pathless layout route at the top of the router: renders the matched page via
// <Outlet /> plus the global incoming-call ring, so the ring can appear over
// any route while still having router context (useNavigate / useLocation) and
// the socket provider's context from above RouterProvider.
export function RootLayout() {
  return (
    <>
      <Outlet />
      <IncomingCallDialog />
    </>
  )
}
