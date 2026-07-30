import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addNextPlannedSemesters,
  addPlannedCourse,
  deletePlannedCourse,
  deletePlannedSemester,
  getAbeekFullRoadmapByStudent,
  getAbeekOfferedCoursesByStudent,
  getGraduationProgress,
  getPlannedCourses,
  updatePlannedCourseExpectedGrade,
} from '../api/endpoints'
import type {
  ExpectedGrade,
  GraduationProgressResponse,
  OfferedCourse,
  PlannedCoursesResponse,
  PlannedSemester,
  RoadmapCourse,
} from '../api/types'
import { flattenRoadmapCourses } from '../api/types'
import { ChartLegend } from '../components/charts/ChartLegend'
import { DonutChart } from '../components/charts/DonutChart'
import { Sidebar } from '../components/layout/Sidebar'
import { MajorTrackSwitcher } from '../components/modals/MajorTrackSwitcher'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
import { trackTypeLabel } from '../utils/majorTrack'
import { formatPercentLabel, toNumber, toPercent } from '../utils/number'

const EXPECTED_GRADES: ExpectedGrade[] = [
  'A+',
  'A0',
  'B+',
  'B0',
  'C+',
  'C0',
  'D+',
  'D0',
  'F',
  'P',
  'NP',
]

function formatGpa(gpa: number) {
  return gpa > 0 ? gpa.toFixed(2) : '-'
}

function semesterLabel(gradeYear?: number, semester?: number) {
  if (gradeYear == null || semester == null) return '-'
  return `${gradeYear}-${semester}`
}

function categoryBadgeClass(category?: string) {
  const c = category ?? ''
  if (c.includes('전필') || c.includes('필수') || c === 'BSM') {
    return 'bg-sejong-light text-sejong'
  }
  if (c.includes('전선') || c.includes('선택')) {
    return 'bg-[#fde8ec] text-[#b01030]'
  }
  if (c.includes('교양')) return 'bg-[#eef1f4] text-ink-muted'
  if (c.includes('설계')) return 'bg-[#fff1e6] text-[#c45c12]'
  return 'bg-panel text-ink-muted'
}

function catalogCategory(course: OfferedCourse | RoadmapCourse) {
  if (course.category === 'GENERAL') return '교양'
  if (course.role === 'REQUIRED' || course.role === 'BSM_REQUIRED') {
    return course.category === 'BSM' ? 'BSM' : '전필'
  }
  if (course.category === 'BSM') return 'BSM'
  if (toNumber(course.designCredits) > 0) return '설계'
  return '전선'
}

export function SimulationPage() {
  const { student } = useAuth()
  const { active } = useMajorTrack()

  const [progress, setProgress] = useState<GraduationProgressResponse | null>(null)
  const [plan, setPlan] = useState<PlannedCoursesResponse | null>(null)
  const [catalog, setCatalog] = useState<OfferedCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [addTargetSemesterId, setAddTargetSemesterId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const refreshAll = useCallback(async () => {
    if (!student) return
    const [prog, planned] = await Promise.all([
      getGraduationProgress(student.id),
      getPlannedCourses(student.id),
    ])
    setProgress(prog)
    setPlan(planned)
  }, [student])

  async function runAction(fn: () => Promise<void>) {
    if (!student || busy) return
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      await refreshAll()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '요청에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleAddSemesters = (count: number) =>
    runAction(async () => {
      if (!student) return
      await addNextPlannedSemesters(student.id, count)
    })

  const handleAddCourse = (course: OfferedCourse) =>
    runAction(async () => {
      if (!student || addTargetSemesterId == null) return
      await addPlannedCourse(student.id, {
        plannedSemesterId: addTargetSemesterId,
        courseCode: course.abeekCourseCode,
        courseName: course.courseName,
        category: catalogCategory(course),
        credit: String(toNumber(course.credits) || 3),
        expectedGrade: 'A0',
      })
      setAddTargetSemesterId(null)
      setQuery('')
    })

  const handleGradeChange = (plannedCourseId: number, expectedGrade: string) =>
    runAction(async () => {
      if (!student) return
      await updatePlannedCourseExpectedGrade(student.id, plannedCourseId, expectedGrade)
    })

  const handleDeleteCourse = (plannedCourseId: number) =>
    runAction(async () => {
      if (!student) return
      await deletePlannedCourse(student.id, plannedCourseId)
    })

  const handleDeleteSemester = (plannedSemesterId: number) =>
    runAction(async () => {
      if (!student) return
      await deletePlannedSemester(student.id, plannedSemesterId)
    })

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const abeekId = student.studentNo || String(student.id)
        const [prog, planned, roadmap] = await Promise.all([
          getGraduationProgress(student.id),
          getPlannedCourses(student.id),
          getAbeekFullRoadmapByStudent(abeekId).catch(() => null),
        ])

        let offered: OfferedCourse[] = []
        try {
          const now = new Date()
          const termYear = now.getFullYear()
          const semester = now.getMonth() + 1 >= 8 ? 2 : 1
          const res = await getAbeekOfferedCoursesByStudent({
            studentId: abeekId,
            termYear,
            semester,
          })
          offered = res.offeredCourses ?? []
        } catch {
          offered = []
        }

        if (cancelled) return

        setProgress(prog)
        setPlan(planned)

        const flat = flattenRoadmapCourses(roadmap)
        const fromRoadmap: OfferedCourse[] = flat
          .filter((c) => c.completed !== true)
          .map((c) => ({
            abeekCourseCode: c.abeekCourseCode,
            courseName: c.courseName,
            category: c.category,
            role: c.role,
            credits: c.credits,
            designCredits: c.designCredits,
            recommendedTerm: c.recommendedTerm,
          }))

        const byCode = new Map<string, OfferedCourse>()
        for (const c of [...offered, ...fromRoadmap]) {
          if (!byCode.has(c.abeekCourseCode)) byCode.set(c.abeekCourseCode, c)
        }
        setCatalog([...byCode.values()])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '시뮬레이션 데이터를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [student])

  const semesters = plan?.semesters ?? []
  const plannedCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const s of semesters) {
      for (const c of s.courses ?? []) codes.add(c.courseCode)
    }
    return codes
  }, [semesters])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog
      .filter((c) => !plannedCodes.has(c.abeekCourseCode))
      .filter((c) => {
        if (!q) return true
        return (
          c.courseName.toLowerCase().includes(q) ||
          c.abeekCourseCode.toLowerCase().includes(q)
        )
      })
      .slice(0, 30)
  }, [catalog, plannedCodes, query])

  const totalEarned = toNumber(progress?.totalCredits?.earnedCredits)
  const totalRequired = toNumber(progress?.totalCredits?.requiredCredits)
  const totalPct = toPercent(progress?.totalCredits?.progressPercent)
  const majorEarned = toNumber(progress?.majorCredits?.earnedMajorCredits)
  const majorRequired = toNumber(progress?.majorCredits?.requiredMajorCredits)
  const majorPct = toPercent(progress?.majorCredits?.majorCreditsProgressPercent)
  const totalGpa = toNumber(progress?.averageGradePoint)
  const majorGpa = toNumber(progress?.majorGradePoint)
  const liberalGpa = toNumber(progress?.liberalGradePoint)
  const plannedCredits = toNumber(plan?.totalPlannedCredits)
  const eligible = progress?.graduationEligible === true
  const blockers = progress?.graduationBlockers ?? []

  const displayName = student?.name || '학생'
  const majorTitle = active
    ? `${trackTypeLabel(active.trackType)} (${active.label})`
    : progress?.major ?? '전공'

  if (loading) {
    return (
      <div className="flex min-h-screen bg-page">
        <Sidebar />
        <main className="flex-1 px-8 py-20 text-center text-sm text-ink-muted">
          시뮬레이션을 불러오는 중...
        </main>
      </div>
    )
  }

  if (error || !progress) {
    return (
      <div className="flex min-h-screen bg-page">
        <Sidebar />
        <main className="flex-1 px-8 py-10">
          <div className="rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <p className="text-sm text-sejong">{error ?? '데이터가 없습니다.'}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <main className="flex-1 overflow-auto px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-[1100px] space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-ink">남은 학기 계획 시뮬레이션</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {displayName}님 · {majorTitle}
                {plan?.lastCompletedSemester
                  ? ` · 마지막 이수 ${plan.lastCompletedSemester}`
                  : ''}
              </p>
            </div>
            <MajorTrackSwitcher />
          </div>

          {actionError && (
            <div className="rounded-xl border border-[#f3c4cc] bg-[#fff5f6] px-4 py-3 text-sm text-sejong">
              {actionError}
            </div>
          )}

          {/* 1. 상단 요약 */}
          <section className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-ink">계획 반영 졸업 현황</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    eligible ? 'bg-[#e8f6ee] text-[#1b7a45]' : 'bg-[#fff1e6] text-[#c45c12]'
                  }`}
                >
                  {eligible ? '졸업 가능' : '졸업 요건 미충족'}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                계획 학점 {plannedCredits > 0 ? `${plannedCredits}학점` : '없음'} 포함
              </p>
            </div>

            {blockers.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-[#fff8f5] px-4 py-3">
                {blockers.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-[#a14a1a]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c45c12]" />
                    {b}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryStat
                label="총 학점"
                value={`${totalEarned}${totalRequired ? `/${totalRequired}` : ''}`}
                hint="이수(계획 포함)"
              />
              <SummaryStat
                label="전공 학점"
                value={`${majorEarned}${majorRequired ? `/${majorRequired}` : ''}`}
                hint="이수(계획 포함)"
              />
              <SummaryStat label="총 평점" value={formatGpa(totalGpa)} hint="/ 4.5" />
              <SummaryStat label="전공 평점" value={formatGpa(majorGpa)} hint="/ 4.5" />
              <SummaryStat label="교양 평점" value={formatGpa(liberalGpa)} hint="/ 4.5" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4 rounded-xl bg-panel/70 px-4 py-3">
                <DonutChart
                  percent={totalPct}
                  size={88}
                  stroke={10}
                  label={formatPercentLabel(totalPct)}
                />
                <div>
                  <p className="text-sm font-bold text-ink">전체 학점</p>
                  <ChartLegend secondaryLabel="총 학점" className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-panel/70 px-4 py-3">
                <DonutChart
                  percent={majorPct}
                  size={88}
                  stroke={10}
                  label={formatPercentLabel(majorPct)}
                />
                <div>
                  <p className="text-sm font-bold text-ink">전공 학점</p>
                  <ChartLegend secondaryLabel="총 학점" className="mt-1" />
                </div>
              </div>
            </div>
          </section>

          {/* 2. 남은 학기 계획 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">남은 학기 계획</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleAddSemesters(1)}
                  className="rounded-full bg-sejong px-4 py-2 text-sm font-semibold text-white hover:bg-sejong-dark disabled:opacity-50"
                >
                  다음 학기 추가
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleAddSemesters(2)}
                  className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-panel disabled:opacity-50"
                >
                  학기 2개 추가
                </button>
              </div>
            </div>

            {semesters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8dbe0] bg-white px-6 py-10 text-center">
                <p className="text-sm text-ink-muted">아직 계획 학기가 없습니다.</p>
                <p className="mt-1 text-xs text-ink-muted">
                  「다음 학기 추가」로 {plan?.lastCompletedSemester ?? '이수 다음'} 학기부터
                  순차 생성됩니다.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {semesters.map((sem) => (
                  <SemesterCard
                    key={sem.plannedSemesterId}
                    semester={sem}
                    busy={busy}
                    isAdding={addTargetSemesterId === sem.plannedSemesterId}
                    onToggleAdd={() => {
                      setQuery('')
                      setAddTargetSemesterId((id) =>
                        id === sem.plannedSemesterId ? null : sem.plannedSemesterId,
                      )
                    }}
                    onGradeChange={handleGradeChange}
                    onDeleteCourse={handleDeleteCourse}
                    onDeleteSemester={handleDeleteSemester}
                    searchPanel={
                      addTargetSemesterId === sem.plannedSemesterId ? (
                        <CourseSearchPanel
                          query={query}
                          onQueryChange={setQuery}
                          results={searchResults}
                          busy={busy}
                          onSelect={handleAddCourse}
                          onClose={() => {
                            setAddTargetSemesterId(null)
                            setQuery('')
                          }}
                        />
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* 3. 하단 상세 */}
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h3 className="mb-3 text-base font-bold text-ink">졸업요건 카테고리</h3>
              <ul className="space-y-2">
                {(progress.categorySummaries ?? []).slice(0, 8).map((cat) => {
                  const earned = toNumber(cat.earnedCredits)
                  const required = toNumber(cat.requiredCredits)
                  const pct = toPercent(cat.progressPercent)
                  return (
                    <li
                      key={cat.category}
                      className="flex items-center justify-between gap-3 rounded-xl bg-panel/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{cat.category}</p>
                        <p className="text-xs text-ink-muted">
                          {earned}
                          {required ? `/${required}` : ''}학점
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-bold ${
                          cat.satisfied ? 'text-[#1b7a45]' : 'text-sejong'
                        }`}
                      >
                        {cat.satisfied ? '충족' : `${pct}%`}
                      </span>
                    </li>
                  )
                })}
                {(progress.categorySummaries ?? []).length === 0 && (
                  <li className="text-sm text-ink-muted">카테고리 정보가 없습니다.</li>
                )}
              </ul>
            </article>

            <article className="rounded-2xl bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h3 className="mb-3 text-base font-bold text-ink">부족한 조건</h3>
              {blockers.length === 0 ? (
                <p className="rounded-xl bg-[#e8f6ee] px-4 py-3 text-sm font-semibold text-[#1b7a45]">
                  현재 계획 기준으로 부족한 조건이 없습니다.
                </p>
              ) : (
                <ul className="space-y-2">
                  {blockers.map((b) => (
                    <li
                      key={b}
                      className="rounded-xl border border-[#f3d5c4] bg-[#fff8f5] px-4 py-3 text-sm text-[#a14a1a]"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {progress.graduationWork?.required && (
                <p className="mt-3 text-xs text-ink-muted">
                  졸업작품/시험:{' '}
                  <span
                    className={
                      progress.graduationWork.satisfied ? 'text-[#1b7a45]' : 'text-sejong'
                    }
                  >
                    {progress.graduationWork.satisfied ? '충족' : '미충족'}
                  </span>
                  {progress.graduationWork.detail
                    ? ` · ${progress.graduationWork.detail}`
                    : ''}
                </p>
              )}
            </article>
          </section>
        </div>
      </main>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl bg-panel/70 px-4 py-3">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p>}
    </div>
  )
}

function SemesterCard({
  semester,
  busy,
  isAdding,
  onToggleAdd,
  onGradeChange,
  onDeleteCourse,
  onDeleteSemester,
  searchPanel,
}: {
  semester: PlannedSemester
  busy: boolean
  isAdding: boolean
  onToggleAdd: () => void
  onGradeChange: (id: number, grade: string) => void
  onDeleteCourse: (id: number) => void
  onDeleteSemester: (id: number) => void
  searchPanel: ReactNode
}) {
  const courses = semester.courses ?? []
  const total = toNumber(semester.totalCredits)
  const label = semesterLabel(semester.gradeYear, semester.semester)
  const empty = semester.empty === true || courses.length === 0

  return (
    <article className="rounded-2xl bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">{label}학기</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            계획 {total > 0 ? `${total}학점` : '0학점'}
            {empty ? ' · 빈 학기' : ` · ${courses.length}과목`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onToggleAdd}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50 ${
              isAdding
                ? 'bg-panel text-ink'
                : 'bg-sejong text-white hover:bg-sejong-dark'
            }`}
          >
            {isAdding ? '닫기' : '과목 추가'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDeleteSemester(semester.plannedSemesterId)}
            className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-panel disabled:opacity-50"
          >
            학기 삭제
          </button>
        </div>
      </div>

      {searchPanel}

      {empty && !isAdding ? (
        <p className="rounded-xl border border-dashed border-[#e5e7eb] px-4 py-6 text-center text-sm text-ink-muted">
          과목을 추가해 학기를 채워보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-panel/60 px-3 py-2.5"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${categoryBadgeClass(
                  course.category,
                )}`}
              >
                {course.category || '과목'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{course.courseName}</p>
                <p className="text-[11px] text-ink-muted">
                  {course.courseCode} · {toNumber(course.credit) || '-'}학점
                  {course.expectedGradePoint != null && toNumber(course.expectedGradePoint) > 0
                    ? ` · ${toNumber(course.expectedGradePoint).toFixed(1)}`
                    : ''}
                </p>
              </div>
              <select
                value={course.expectedGrade ?? 'A0'}
                disabled={busy}
                onChange={(e) => onGradeChange(course.id, e.target.value)}
                className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-1.5 text-sm font-semibold text-ink disabled:opacity-50"
              >
                {EXPECTED_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeleteCourse(course.id)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-white hover:text-sejong disabled:opacity-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function CourseSearchPanel({
  query,
  onQueryChange,
  results,
  busy,
  onSelect,
  onClose,
}: {
  query: string
  onQueryChange: (v: string) => void
  results: OfferedCourse[]
  busy: boolean
  onSelect: (course: OfferedCourse) => void
  onClose: () => void
}) {
  return (
    <div className="mb-3 rounded-xl border border-[#e5e7eb] bg-panel/40 p-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="과목명·코드 검색"
          className="min-w-0 flex-1 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none focus:border-sejong"
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 text-sm font-semibold text-ink-muted hover:bg-white"
        >
          취소
        </button>
      </div>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
        {results.map((course) => (
          <li key={course.abeekCourseCode}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelect(course)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {course.courseName}
                </span>
                <span className="text-[11px] text-ink-muted">
                  {course.abeekCourseCode} · {catalogCategory(course)} ·{' '}
                  {toNumber(course.credits) || 3}학점
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-sejong">추가</span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-2 py-3 text-center text-sm text-ink-muted">검색 결과가 없습니다.</li>
        )}
      </ul>
    </div>
  )
}
