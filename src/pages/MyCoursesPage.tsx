import { useEffect, useMemo, useState } from 'react'
import { getGraduationProgress, getTranscriptMajorCredits } from '../api/endpoints'
import type { CategorySummary, TranscriptMajorCreditSummary } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { toNumber } from '../utils/number'

export function MyCoursesPage() {
  const { student } = useAuth()
  const [summaries, setSummaries] = useState<CategorySummary[]>([])
  const [majorCredits, setMajorCredits] = useState<TranscriptMajorCreditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [progress, credits] = await Promise.all([
          getGraduationProgress(student.id),
          getTranscriptMajorCredits(student.id).catch(() => null),
        ])
        if (cancelled) return
        setSummaries(progress.categorySummaries ?? [])
        setMajorCredits(credits)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '이수과목을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [student])

  const sections = useMemo(
    () =>
      summaries
        .filter((s) => (s.courses?.length ?? 0) > 0)
        .map((s) => ({
          title: s.category,
          earned: toNumber(s.earnedCredits),
          courses: s.courses.map((c) => ({
            name: c.courseName,
            credits: toNumber(c.credit),
            code: c.courseCode,
          })),
        })),
    [summaries],
  )

  const totalListedCredits = useMemo(
    () => sections.reduce((sum, s) => sum + s.courses.reduce((a, c) => a + c.credits, 0), 0),
    [sections],
  )

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-muted">이수과목을 불러오는 중...</div>
  }

  if (error) {
    return <div className="rounded-2xl bg-white p-8 text-center text-sm text-sejong">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">내 이수과목</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {student?.name}님 · {student?.major ?? ''} 이수 과목 목록입니다.
        </p>
      </div>

      {majorCredits ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CreditStat
            label="전공 필수"
            value={`${majorCredits.requiredMajorCredits ?? 0}`}
            unit="학점"
            hint={`${majorCredits.requiredMajorCourseCount ?? 0}과목`}
          />
          <CreditStat
            label="전공 선택"
            value={`${majorCredits.electiveMajorCredits ?? 0}`}
            unit="학점"
            hint={`${majorCredits.electiveMajorCourseCount ?? 0}과목`}
          />
          <CreditStat
            label="전공 합계"
            value={`${majorCredits.totalMajorCredits ?? 0}`}
            unit="학점"
            accent
          />
          <CreditStat
            label="전체 이수 과목"
            value={`${majorCredits.totalCourseCount ?? 0}`}
            unit="과목"
            hint={totalListedCredits > 0 ? `목록 합계 ${totalListedCredits}학점` : undefined}
          />
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <CreditStat
            label="이수 학점 합계"
            value={`${totalListedCredits}`}
            unit="학점"
            accent
          />
          <CreditStat
            label="이수 과목"
            value={`${sections.reduce((n, s) => n + s.courses.length, 0)}`}
            unit="과목"
          />
        </section>
      )}

      {sections.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-ink-muted">
          표시할 이수과목이 없습니다.
        </div>
      ) : (
        sections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">{section.title}</h3>
              <p className="text-sm font-semibold text-sejong">{section.earned}학점</p>
            </div>
            <div className="rounded-xl bg-panel px-5 py-4">
              <ul className="space-y-3.5">
                {section.courses.map((course) => (
                  <li
                    key={`${section.title}-${course.code}-${course.name}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4"
                  >
                    <span className="truncate text-[15px] font-medium text-ink">{course.name}</span>
                    <span className="w-14 text-right text-[15px] font-semibold text-ink">
                      {course.credits}학점
                    </span>
                    <span className="w-20 text-right text-sm text-ink-faint">{course.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))
      )}
    </div>
  )
}

function CreditStat({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string
  value: string
  unit: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${accent ? 'text-sejong' : 'text-ink'}`}>
        {value}
        <span className="ml-1 text-sm font-bold text-ink-muted">{unit}</span>
      </p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}
