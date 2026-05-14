import { createBrowserRouter } from "react-router"
import LandingPage from "@/pages/landing"
import DashboardPage from "@/pages/dashboard"
import UsersPage from "@/pages/users"
import ThemesPage from "@/pages/themes"
import CirclesPage from "@/pages/circles"
import AvailabilityPage from "@/pages/availability"
import FindConversationPage from "@/pages/find-conversation"
import MyCirclesPage from "@/pages/my-circles"
import CallPage from "@/pages/call"
import LoginPage from "@/pages/login"
import SignupPage from "@/pages/signup"
import ForgotPasswordPage from "@/pages/forgot-password"
import ResetPasswordPage from "@/pages/reset-password"
import OnboardingPage from "@/pages/onboarding"
import SettingsPage from "@/pages/settings"
import { ProtectedRoute } from "@/components/protected-route"
import { AdminRoute } from "@/components/admin-route"
import { DashboardLayout } from "@/components/dashboard-layout"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/onboarding",
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/call/:meetingId",
    element: (
      <ProtectedRoute>
        <CallPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "users",
        element: (
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        ),
      },
      {
        path: "themes",
        element: (
          <AdminRoute>
            <ThemesPage />
          </AdminRoute>
        ),
      },
      {
        path: "circles",
        element: (
          <AdminRoute>
            <CirclesPage />
          </AdminRoute>
        ),
      },
      {
        path: "availability",
        element: <AvailabilityPage />,
      },
      {
        path: "find-conversation",
        element: <FindConversationPage />,
      },
      {
        path: "my-circles",
        element: <MyCirclesPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
])
