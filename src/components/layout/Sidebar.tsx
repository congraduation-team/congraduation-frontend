import { NavLink, useNavigate } from 'react-router-dom'
import { isAdminUser } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { AppLogo } from '../common/AppLogo'

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
    to: '/simulation',
    label: '졸업 시뮬레이션',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 17V10" />
        <path d="M12 17V7" />
        <path d="M16 17v-4" />
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
  {
    to: '/upload?update=1',
    label: '기이수 성적 업데이트',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    ),
  },
  {
    to: '/inquiry',
    label: '오류 신고 · 문의',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
]

const adminItems = [
  {
    to: '/admin',
    label: '데이터 업데이트',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.1.7.7 1.2 1.5 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.1Z" />
      </svg>
    ),
  },
  {
    to: '/admin/inquiries',
    label: '문의 · 오류 확인',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h6" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const showAdmin = isAdminUser(student)

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#eee] bg-white px-5 py-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="mb-10 flex cursor-pointer items-center gap-3 rounded-lg text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sejong"
        aria-label="홈으로 이동"
      >
        <AppLogo size={44} className="pointer-events-none" />
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-sejong">세종대학교</p>
          <p className="mt-0.5 text-sm font-medium text-ink">졸업 인증 분석</p>
        </div>
      </button>

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
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
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
        </>
      )}
    </aside>
  )
}
