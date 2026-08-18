import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../api/client'
import { getSiteStatsSummary } from '../api/endpoints'
import type { SiteStatsSummary } from '../api/types'
import { StatBarChart } from '../components/charts/StatBarChart'
import { StatLineChart } from '../components/charts/StatLineChart'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** API 월별 시계열이 있으면 사용하고, 없으면 최근 6개월 축 + 이번 달 값만 채움 */
function buildSixMonthSeries(stats: SiteStatsSummary) {
  const today = parseIsoDate(stats.today)
  const byMonth = new Map<string, number>()
  for (const row of stats.monthlySeries ?? []) {
    byMonth.set(row.month, row.visitors)
  }

  return Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1)
    const key = monthKey(date)
    const isCurrent = offset === 0
    return {
      label: `${date.getMonth() + 1}월`,
      value: byMonth.get(key) ?? (isCurrent ? stats.monthlyVisitors : 0),
    }
  })
}

type MetricCardProps = {
  label: string
  value: number
  hint: string
  accent?: string
}

function MetricCard({ label, value, hint, accent = 'bg-sejong' }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{formatCount(value)}</p>
      <p className="mt-2 text-xs text-ink-faint">{hint}</p>
    </div>
  )
}

export function AdminStatsPage() {
  const { student } = useAuth()
  const [stats, setStats] = useState<SiteStatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSiteStatsSummary()
      setStats(data)
    } catch (err) {
      setStats(null)
      setError(err instanceof ApiError ? err.message : '통계를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const barItems = useMemo(() => {
    if (!stats) return []
    return [
      { label: '오늘', value: stats.todayVisitors, color: '#c8012e' },
      { label: '이번 달', value: stats.monthlyVisitors, color: '#e35a74' },
      { label: '누적', value: stats.totalVisitors, color: '#f0a3b1' },
    ]
  }, [stats])

  const monthlyLineItems = useMemo(() => (stats ? buildSixMonthSeries(stats) : []), [stats])
  const hasMonthlySeries = Boolean(stats?.monthlySeries?.length)

  return (
    <AppShell>
      <main className="flex min-w-0 flex-1 flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-sejong">ADMIN</p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">사이트 통계</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {student?.name}님 · 로그인 방문자를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg bg-sejong px-4 py-2 text-sm font-semibold text-white transition hover:bg-sejong-dark disabled:opacity-60"
          >
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="rounded-2xl bg-white px-6 py-16 text-center text-sm text-ink-muted shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            통계를 불러오는 중…
          </div>
        ) : stats ? (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="오늘 로그인 방문자"
                value={stats.todayVisitors}
                hint={`기준일 ${stats.today}`}
                accent="bg-sejong"
              />
              <MetricCard
                label="이번 달 로그인 방문자"
                value={stats.monthlyVisitors}
                hint={`${stats.monthStart} ~ ${stats.today}`}
                accent="bg-[#e35a74]"
              />
              <MetricCard
                label="누적 로그인 방문자"
                value={stats.totalVisitors}
                hint="출시일 기준"
                accent="bg-ink"
              />
            </div>

            <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.85fr)]">
              <section className="flex h-full flex-col rounded-2xl bg-white px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <h2 className="text-lg font-bold text-ink">월별 로그인 방문자</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  최근 6개월 · 이번 달 {formatCount(stats.monthlyVisitors)}명
                </p>
                <div className="mt-2">
                  <StatLineChart items={monthlyLineItems} />
                </div>
              </section>

              <section className="flex h-full flex-col rounded-2xl bg-white px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <h2 className="text-lg font-bold text-ink">지표 비교</h2>
                <p className="mt-0.5 text-sm text-ink-muted">오늘 · 이번 달 · 누적 로그인 방문자</p>
                <div className="relative mt-2 min-h-[200px] flex-1">
                  <StatBarChart
                    className="absolute inset-0 h-full w-full"
                    items={barItems}
                    orientation="vertical"
                  />
                </div>
              </section>
            </div>
            {!hasMonthlySeries && (
              <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                월별 시계열이 없으면 이번 달만 표시되고, 이전 달은 0으로 둡니다.
              </p>
            )}

            <p className="mt-6 text-xs text-ink-faint">
              로그인한 학생(studentId)만 방문으로 집계됩니다. 같은 학생은 하루 1회만 순 방문으로
              기록되며, 로그인 API에서도 자동으로 기록됩니다. 익명 방문은 통계에 포함되지
              않습니다.
            </p>
          </>
        ) : null}
      </main>
    </AppShell>
  )
}
