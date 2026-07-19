import { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Login from './pages/Login'
import AdvisorPanel from './components/AdvisorPanel'
import { authApi } from './services/api'
import './index.css'

// Lazy-load routed pages so the initial bundle stays small — only Login/shell
// are needed before auth, everything else loads on first navigation.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Circulars = lazy(() => import('./pages/Circulars'))
const Obligations = lazy(() => import('./pages/Obligations'))
const Findings = lazy(() => import('./pages/Findings'))
const ActionPlan = lazy(() => import('./pages/ActionPlan'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const RegulatoryReplay = lazy(() => import('./pages/RegulatoryReplay'))

function RouteFallback() {
  return (
    <div className="p-8 space-y-4">
      <div className="skeleton h-8 w-64 skeleton-shimmer" />
      <div className="skeleton h-32 w-full skeleton-shimmer" />
      <div className="grid grid-cols-3 gap-4">
        <div className="skeleton h-24 skeleton-shimmer" />
        <div className="skeleton h-24 skeleton-shimmer" />
        <div className="skeleton h-24 skeleton-shimmer" />
      </div>
    </div>
  )
}

function App() {
  // undecided (still checking a stored token) vs true/false once resolved,
  // so we don't flash the login screen for a user with a valid session.
  const [authStatus, setAuthStatus] = useState<'checking' | 'authed' | 'anon'>('checking')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setAuthStatus('anon')
      return
    }
    // Don't just trust a stored token — it may be expired or revoked server-side.
    // Validate it against the real API before restoring the session.
    authApi.me()
      .then((res) => {
        localStorage.setItem('argus_user', JSON.stringify(res.data))
        setAuthStatus('authed')
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('argus_user')
        setAuthStatus('anon')
      })
  }, [])

  const handleLogout = async () => {
    // Revoke the token server-side before clearing it locally — otherwise a
    // captured/leaked token would remain valid against the API indefinitely.
    // Must await: clearing localStorage first would strip the Authorization
    // header off this very request via the axios interceptor.
    try {
      await authApi.logout()
    } catch {
      // Even if revocation fails (e.g. already expired, network hiccup),
      // still clear local state so the user is signed out client-side.
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('argus_user')
    setAuthStatus('anon')
  }

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-argus-bg">
        <div className="w-8 h-8 border-2 border-argus-line border-t-argus-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (authStatus === 'anon') {
    return <Login onLogin={() => setAuthStatus('authed')} />
  }

  return (
    <div className="flex h-screen bg-argus-bg text-argus-text relative overflow-hidden argus-ground">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
        <Header
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto bg-transparent">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/circulars" element={<Circulars />} />
              <Route path="/circulars/:id/obligations" element={<Obligations />} />
              <Route path="/findings" element={<Findings />} />
              <Route path="/findings/:findingId/replay" element={<RegulatoryReplay />} />
              <Route path="/action-plan" element={<ActionPlan />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <AdvisorPanel />
      </div>
    </div>
  )
}

export default App
