import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const BookingsPage = lazy(() => import('./pages/BookingsPage'))
const ElectricityPage = lazy(() => import('./pages/ElectricityPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const IssuesPage = lazy(() => import('./pages/IssuesPage'))

function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin" />
    </div>
  )
}

function PendingApproval() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-50 rounded-2xl mb-4">
          <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Väntar på godkännande</h2>
        <p className="text-sm text-slate-500 mb-6">
          Ditt konto har skapats men behöver godkännas av en admin innan du kan använda bokningssystemet.
        </p>
        <button
          onClick={signOut}
          className="text-sm text-slate-400 hover:text-red-500 transition-colors"
        >
          Logga ut
        </button>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" />
  if (profile && !profile.approved) return <PendingApproval />
  return children
}

function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return null
  return profile?.role === 'admin' ? children : <Navigate to="/" />
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route
              path="/login"
              element={
                <AuthRoute>
                  <LoginPage />
                </AuthRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CalendarPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="electricity" element={<ElectricityPage />} />
              <Route path="issues" element={<IssuesPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
