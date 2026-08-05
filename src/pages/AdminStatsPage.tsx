import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../api/client'
import { getSiteStatsSummary } from '../api/endpoints'
import type { SiteStatsSummary } from '../api/types'
import { ShareDonut } from '../components/charts/ShareDonut'
import { StatBarChart } from '../components/charts/StatBarChart'
import { Sidebar } from '../components/layout/Sidebar'
import { useAuth } from '../context/AuthContext'

function formatCount(n: number) {
  return n.toLocaleString('ko-KR')
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
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
      { label: '누적', value: stats.totalVisitors, color: '#1a2b3c' },
      { label: '기이수', value: stats.transcriptUsers, color: '#4a5568' },
    ]
  }, [stats])

  const uploadShare = stats
    ? formatPercent(stats.transcriptUsers, stats.totalVisitors)
    : '0%'

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col px-8 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-sejong">ADMIN</p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">사이트 통계</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {student?.name}님 · 순 방문자와 기이수 실사용자를 확인합니다.
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
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="오늘 순 방문자"
                value={stats.todayVisitors}
                hint={`기준일 ${stats.today}`}
                accent="bg-sejong"
              />
              <MetricCard
                label="이번 달 순 방문자"
                value={stats.monthlyVisitors}
                hint={`${stats.monthStart} ~ ${stats.today}`}
                accent="bg-[#e35a74]"
              />
              <MetricCard
                label="누적 순 방문자"
                value={stats.totalVisitors}
                hint={`타임존 ${stats.timezone}`}
                accent="bg-ink"
              />
              <MetricCard
                label="기이수 실사용자"
                value={stats.transcriptUsers}
                hint="성적표를 업로드한 서로 다른 학생"
                accent="bg-bsm"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <h2 className="text-base font-bold text-ink">지표 비교</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  당일 · 월간 · 누적 방문자와 기이수 실사용자 규모
                </p>
                <div className="mt-6">
                  <StatBarChart items={barItems} />
                </div>
              </section>

              <section className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <h2 className="text-base font-bold text-ink">기이수 전환율</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  누적 방문자 대비 기이수 업로드 학생 비율
                </p>
                <div className="mt-8 flex flex-col items-center">
                  <ShareDonut
                    value={stats.transcriptUsers}
                    total={stats.totalVisitors}
                    centerLabel={uploadShare}
                    centerSub="전환율"
                  />
                  <dl className="mt-8 w-full space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5">
                      <dt className="text-ink-muted">누적 방문자</dt>
                      <dd className="font-bold text-ink">{formatCount(stats.totalVisitors)}</dd>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5">
                      <dt className="text-ink-muted">기이수 실사용자</dt>
                      <dd className="font-bold text-ink">{formatCount(stats.transcriptUsers)}</dd>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-sejong-light px-3 py-2.5">
                      <dt className="text-sejong">오늘 방문자</dt>
                      <dd className="font-bold text-sejong">{formatCount(stats.todayVisitors)}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            </div>

            <p className="mt-6 text-xs text-ink-faint">
              방문은 visitorKey(브라우저) 또는 studentId 기준이며, 같은 키는 하루 1회만 순
              방문으로 집계됩니다. 배포 직후 방문 테이블이 비어 있으면 방문자 수는 0부터
              쌓입니다.
            </p>
          </>
        ) : null}
      </main>
    </div>
  )
}
