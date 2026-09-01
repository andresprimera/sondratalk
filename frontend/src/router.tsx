import { createBrowserRouter } from "react-router"
import LandingPage from "@/pages/landing"
import DashboardPage from "@/pages/dashboard"
import UsersPage from "@/pages/users"
import AvailableNowPage from "@/pages/available-now"
import ApplicationsPage from "@/pages/applications"
import AdminFeedbackPage from "@/pages/admin-feedback"
import ThemesPage from "@/pages/themes"
import CirclesPage from "@/pages/circles"
import AvailabilityPage from "@/pages/availability"
import FindConversationPage from "@/pages/find-conversation"
import ConversationSchedulingPage from "@/pages/conversation-scheduling"
import MyCirclesPage from "@/pages/my-circles"
import CallPage from "@/pages/call"
import ConversationWrapUpPage from "@/pages/conversation-wrap-up"
import LoginPage from "@/pages/login"
import SignupPage from "@/pages/signup"
import RegisterPage from "@/pages/register"
import ForgotPasswordPage from "@/pages/forgot-password"
import ResetPasswordPage from "@/pages/reset-password"
import OnboardingPage from "@/pages/onboarding"
import RegistrationSurveysPage from "@/pages/registration-surveys"
import AdminMeetingsPage from "@/pages/admin-meetings"
import SettingsPage from "@/pages/settings"
import { ProtectedRoute } from "@/components/protected-route"
import { AdminRoute } from "@/components/admin-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { RootLayout } from "@/components/root-layout"

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
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
    path: "/register",
    element: <RegisterPage />,
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
    path: "/call/:meetingId/wrap-up",
    element: (
      <ProtectedRoute>
        <ConversationWrapUpPage />
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
        path: "available-now",
        element: (
          <AdminRoute>
            <AvailableNowPage />
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
        path: "applications",
        element: (
          <AdminRoute>
            <ApplicationsPage />
          </AdminRoute>
        ),
      },
      {
        path: "survey-answers",
        element: (
          <AdminRoute>
            <AdminFeedbackPage />
          </AdminRoute>
        ),
      },
      {
        path: "registration-surveys",
        element: (
          <AdminRoute>
            <RegistrationSurveysPage />
          </AdminRoute>
        ),
      },
      {
        path: "appointments",
        element: (
          <AdminRoute>
            <AdminMeetingsPage />
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
        path: "conversations/:meetingId/schedule",
        element: <ConversationSchedulingPage />,
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
    ],
  },
])
