import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { OrganizationProvider } from "@/contexts/OrganizationContext"
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "@/pages/auth"
import { DashboardLayout, DashboardPage, FolderPage, WorkspaceFlowPage, UncategorizedPage } from "@/pages/dashboard"
import NotePage from "@/pages/NotePage"
import { OnboardingGuard } from "@/components/OnboardingGuard"
import LandingPage from "@/pages/LandingPage"
import NotFoundPage from "@/pages/NotFoundPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <BrowserRouter>
          <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <OnboardingGuard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:orgSlug/note/:noteId"
            element={
              <ProtectedRoute>
                <NotePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:orgSlug/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="flow" element={<WorkspaceFlowPage />} />
            <Route path="uncategorized" element={<UncategorizedPage />} />
            <Route path="*" element={<FolderPage />} />
          </Route>
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      </OrganizationProvider>
    </AuthProvider>
  )
}
