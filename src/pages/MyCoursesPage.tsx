import { useEffect, useMemo, useState } from 'react'
import { getGraduationProgress } from '../api/endpoints'
import type { CategorySummary } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { toNumber } from '../utils/number'

export function MyCoursesPage() {
  const { student } = useAuth()
  const [summaries, setSummaries] = useState<CategorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const data = await getGraduationProgress(student.id)
        if (!cancelled) setSummaries(data.categorySummaries ?? [])
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
          courses: s.courses.map((c) => ({
            name: c.courseName,
            credits: toNumber(c.credit),
            code: c.courseCode,
          })),
        })),
    [summaries],
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
            <h3 className="mb-4 text-base font-bold text-ink">{section.title}</h3>
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
