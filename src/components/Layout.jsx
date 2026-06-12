import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { Home, CalendarDays, Zap, Settings, Menu, X, User, Bug } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const memberLinks = [
  { to: '/', label: 'Kalender', icon: CalendarDays },
  { to: '/bookings', label: 'Mina bokningar', icon: Home },
  { to: '/electricity', label: 'El-kalkylator', icon: Zap },
  { to: '/issues', label: 'Felanmälan', icon: Bug },
]

export default function Layout() {
  const { profile } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminBadge, setAdminBadge] = useState(0)

  // Hämta antal väntande användare + öppna felanmälningar + obetalda depositioner för admin-badge
  useEffect(() => {
    if (profile?.role !== 'admin') return

    async function fetchBadgeCount() {
      const [{ count: pendingCount }, { count: issueCount }, { count: unpaidCount }] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('approved', false).not('email', 'like', '%@deleted.local'),
        supabase.from('issues').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('deposit_paid', false).eq('status', 'confirmed'),
      ])
      setAdminBadge((pendingCount ?? 0) + (issueCount ?? 0) + (unpaidCount ?? 0))
    }

    fetchBadgeCount()

    // Realtime: uppdatera badge när users, issues eller bookings ändras
    const channel = supabase
      .channel('admin-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchBadgeCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, fetchBadgeCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBadgeCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.role])

  const links = [
    ...memberLinks,
    ...(profile?.role === 'admin'
      ? [{ to: '/admin', label: 'Admin', icon: Settings, badge: adminBadge }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-base text-slate-800">
            <Home className="w-5 h-5 text-red-600" />
            <span>BIK-stugan</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon, badge }) => (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === to
                    ? 'bg-red-50 text-red-700 font-medium'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white" />
                )}
              </Link>
            ))}
            <div className="w-px h-5 bg-slate-200 mx-2" />
            <Link
              to="/profile"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === '/profile'
                  ? 'bg-red-50 text-red-700 font-medium'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4" />
              {profile?.name}
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-slate-500"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-200 bg-white px-4 pb-4">
            {links.map(({ to, label, icon: Icon, badge }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                  location.pathname === to
                    ? 'bg-red-50 text-red-700 font-medium'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge > 0 && (
                  <span className="ml-auto w-2.5 h-2.5 bg-red-600 rounded-full" />
                )}
              </Link>
            ))}
            <div className="border-t border-slate-200 mt-2 pt-2">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                  location.pathname === '/profile'
                    ? 'bg-red-50 text-red-700 font-medium'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                {profile?.name}
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

