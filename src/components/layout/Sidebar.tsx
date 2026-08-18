import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getAdminFeedbacks } from '../../api/endpoints'
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
    badgeKey: 'openInquiries' as const,
  },
  {
    to: '/admin/stats',
    label: '사이트 통계',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16V11" />
        <path d="M12 16V7" />
        <path d="M16 16v-3" />
      </svg>
    ),
  },
]

export function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean
  onClose?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { student, logout } = useAuth()
  const showAdmin = isAdminUser(student)
  const [hasOpenInquiries, setHasOpenInquiries] = useState(false)

  useEffect(() => {
    if (!showAdmin || !student?.id) {
      setHasOpenInquiries(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const list = await getAdminFeedbacks(student.id)
        if (cancelled) return
        setHasOpenInquiries(
          (Array.isArray(list) ? list : []).some((item) => item.status === 'OPEN'),
        )
      } catch {
        if (!cancelled) setHasOpenInquiries(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [showAdmin, student?.id, location.pathname])

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[220px] shrink-0 flex-col overflow-y-auto border-r border-[#eee] bg-white px-5 py-6 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          onClose?.()
          navigate('/dashboard')
        }}
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
            onClick={() => onClose?.()}
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

      <button
        type="button"
        onClick={() => {
          onClose?.()
          void logout().finally(() => {
            navigate('/', { replace: true })
          })
        }}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        로그아웃
      </button>

      {showAdmin && (
        <>
          <p className="mb-3 mt-8 text-xs font-medium text-ink-muted">Admin</p>
          <nav className="flex flex-col gap-1">
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                onClick={() => onClose?.()}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    isActive ? 'bg-sejong-light text-sejong' : 'text-ink hover:bg-surface'
                  }`
                }
              >
                {item.icon}
                <span className="min-w-0 flex-1">{item.label}</span>
                {'badgeKey' in item && item.badgeKey === 'openInquiries' && hasOpenInquiries && (
                  <span
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-sejong text-[10px] font-bold leading-none text-white"
                    aria-label="대기 중인 문의 있음"
                    title="대기 중인 문의가 있습니다"
                  >
                    !
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}
