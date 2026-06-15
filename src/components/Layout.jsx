import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { Home, CalendarDays, Zap, Settings, User, Bug, CalendarCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const memberLinks = [
  { to: '/', label: 'Kalender', icon: CalendarDays },
  { to: '/bookings', label: 'Bokningar', icon: CalendarCheck },
  { to: '/electricity', label: 'El', icon: Zap },
  { to: '/issues', label: 'Felanmälan', icon: Bug },
]

export default function Layout() {
  const { profile } = useAuth()
  const location = useLocation()
  const [adminBadge, setAdminBadge] = useState(0)
  const [offerCount, setOfferCount] = useState(0)

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

  const mobileLinks = [...links, { to: '/profile', label: 'Profil', icon: User }]

  useEffect(() => {
    if (!profile) return
    supabase
      .from('reserve_offers')
      .select('id', { count: 'exact', head: true })
      .eq('offered_to_user_id', profile.id)
      .eq('status', 'pending')
      .gt('deadline', new Date().toISOString())
      .then(({ count }) => setOfferCount(count || 0))
  }, [profile])

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
            {links.map(({ to, label, icon: Icon, badge }) => {
              const hasOfferBadge = to === '/bookings' && offerCount > 0
              const hasAdminBadge = to === '/admin' && badge > 0
              return (
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
                  {hasOfferBadge && (
                    <span className="absolute top-1.5 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                  {hasAdminBadge && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white" />
                  )}
                </Link>
              )
            })}
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
        </div>
      </header>

      {/* Main content — extra bottom padding on mobile for the fixed tab bar */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar — z-40 so modals/overlays (z-50) render above it */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-16">
          {mobileLinks.map(({ to, label, icon: Icon, badge }) => {
            const isActive = location.pathname === to
            const hasOfferBadge = to === '/bookings' && offerCount > 0
            const hasAdminBadge = to === '/admin' && badge > 0
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
                  isActive ? 'text-red-600' : 'text-slate-400 active:text-slate-600'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {hasOfferBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
                  )}
                  {hasAdminBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white" />
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
