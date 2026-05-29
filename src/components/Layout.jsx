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

const adminLinks = [
  { to: '/admin', label: 'Admin', icon: Settings },
]

export default function Layout() {
  const { profile } = useAuth()
  const location = useLocation()
  const [offerCount, setOfferCount] = useState(0)

  const links = [
    ...memberLinks,
    ...(profile?.role === 'admin' ? adminLinks : []),
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
            {links.map(({ to, label, icon: Icon }) => {
              const hasBadge = to === '/bookings' && offerCount > 0
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors relative ${
                    location.pathname === to
                      ? 'bg-red-50 text-red-700 font-medium'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {hasBadge && (
                    <span className="absolute top-1.5 right-1 w-2 h-2 bg-amber-500 rounded-full" />
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

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-16">
          {mobileLinks.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to
            const hasBadge = to === '/bookings' && offerCount > 0
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
                  {hasBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
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
