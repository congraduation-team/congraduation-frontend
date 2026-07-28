import { NavLink, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

const tabs = [
  { to: '/dashboard', label: '졸업요건', end: true },
  { to: '/dashboard/engineering', label: '공학인증' },
  { to: '/dashboard/courses', label: '내 이수과목' },
]

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto px-8 py-7">
        <h1 className="text-3xl font-bold text-ink">Dashboard</h1>
        <div className="mt-5 flex gap-8 border-b border-[#e5e5ea]">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `pb-3 text-[15px] font-semibold transition ${
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
        <div className="mt-7">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
