import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { MajorTrackSwitcher } from '../modals/MajorTrackSwitcher'
import { useAbeekTarget } from '../../hooks/useAbeekTarget'
import { AppShell } from './AppShell'

type DashboardTab = {
  to: string
  label: string
  end?: boolean
  abeekOnly?: boolean
}

const tabs: DashboardTab[] = [
  { to: '/dashboard', label: '졸업요건', end: true },
  { to: '/dashboard/engineering', label: '공학인증', abeekOnly: true },
  { to: '/dashboard/courses', label: '내 이수과목' },
]

export function DashboardLayout() {
  const location = useLocation()
  const { abeekTarget, loading: abeekLoading } = useAbeekTarget()
  const visibleTabs = tabs.filter((tab) => !tab.abeekOnly || abeekTarget)

  if (
    !abeekLoading &&
    !abeekTarget &&
    location.pathname.startsWith('/dashboard/engineering')
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-auto px-4 pb-10 pt-5 md:px-8 md:pb-12 md:pt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Dashboard</h1>
          <MajorTrackSwitcher />
        </div>
        <div className="mt-5 flex gap-6 overflow-x-auto border-b border-[#e5e5ea] md:gap-8">
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `shrink-0 pb-3 text-[15px] font-semibold transition ${
                  isActive
                    ? 'border-b-[3px] border-sejong text-sejong'
                    : 'border-b-[3px] border-transparent text-ink-muted hover:text-ink'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-7 md:mt-9">
          <Outlet />
        </div>
      </main>
    </AppShell>
  )
}
