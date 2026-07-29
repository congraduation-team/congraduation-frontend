import { NavLink } from 'react-router-dom'
import { isAdminUser } from '../../api/types'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  {
    to: '/dashboard',
    label: '나의 인증 현황',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    to: '/curriculum',
    label: '이수체계도',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
]

const adminItem = {
  to: '/admin',
  label: '관리자',
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.1.7.7 1.2 1.5 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.1Z" />
    </svg>
  ),
}

export function Sidebar() {
  const { student } = useAuth()
  const showAdmin = isAdminUser(student)

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#eee] bg-white px-5 py-6">
      <div className="mb-10">
        <p className="text-lg font-bold text-sejong">세종대학교</p>
        <p className="mt-0.5 text-sm font-medium text-ink">졸업 인증 분석</p>
      </div>

      <p className="mb-3 text-xs font-medium text-ink-muted">Main page</p>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? 'bg-sejong-light text-sejong' : 'text-ink hover:bg-surface'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {showAdmin && (
        <>
          <p className="mb-3 mt-8 text-xs font-medium text-ink-muted">Admin</p>
          <nav className="flex flex-col gap-1">
            <NavLink
              to={adminItem.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-sejong-light text-sejong' : 'text-ink hover:bg-surface'
                }`
              }
            >
              {adminItem.icon}
              {adminItem.label}
            </NavLink>
          </nav>
        </>
      )}
    </aside>
  )
}
