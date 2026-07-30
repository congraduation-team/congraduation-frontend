import { useEffect, useMemo, useState } from 'react'
import {
  getAbeekEvaluation,
  getAbeekFullRoadmapByStudent,
  getAbeekOfferedCoursesByStudent,
  getGraduationProgress,
} from '../api/endpoints'
import type {
  AbeekEvaluationResponse,
  GraduationProgressResponse,
  OfferedCourse,
  RoadmapCourse,
} from '../api/types'
import { flattenRoadmapCourses } from '../api/types'
import { DonutChart } from '../components/charts/DonutChart'
import { Sidebar } from '../components/layout/Sidebar'
import { MajorTrackSwitcher } from '../components/modals/MajorTrackSwitcher'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
import { trackTypeLabel } from '../utils/majorTrack'
import { formatPercentLabel, toNumber } from '../utils/number'

const GRADES = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'F', 'P', 'NP'] as const
type Grade = (typeof GRADES)[number]

type CourseKind = 'required' | 'elective' | 'general' | 'design' | 'pass'

type PlannedCourse = {
  id: string
  code: string
  name: string
  credits: number
  designCredits: number
  kind: CourseKind
  categoryLabel: string
  grade: Grade
}

type SemesterPlan = {
  key: string
  label: string
  year: number
  semester: 1 | 2
  courses: PlannedCourse[]
}

const kindStyle: Record<CourseKind, string> = {
  required: 'bg-sejong-light text-sejong',
  elective: 'bg-[#fde8ec] text-[#b01030]',
  general: 'bg-[#eef1f4] text-ink-muted',
  design: 'bg-[#fff1e6] text-[#c45c12]',
  pass: 'bg-[#e8f1fb] text-[#2b6cb0]',
}

const kindLabel: Record<CourseKind, string> = {
  required: '전필',
  elective: '전선',
  general: '교양',
  design: '설계',
  pass: 'P/NP',
}

function nextSemesters(
  count: number,
  admissionYear?: number,
  from = new Date(),
): Omit<SemesterPlan, 'courses'>[] {
  let year = from.getFullYear()
  let semester: 1 | 2 = from.getMonth() + 1 >= 8 ? 2 : 1
  if (semester === 2) {
    year += 1
    semester = 1
  } else {
    semester = 2
  }

  const list: Omit<SemesterPlan, 'courses'>[] = []
  for (let i = 0; i < count; i++) {
    const gy = admissionYear ? year - admissionYear + 1 : null
    list.push({
      key: `${year}-${semester}`,
      label: gy && gy >= 1 && gy <= 6 ? `${gy}-${semester}학기` : `${year}-${semester}학기`,
      year,
      semester,
    })
    if (semester === 1) semester = 2
    else {
      year += 1
      semester = 1
    }
  }
  return list
}

function classifyCourse(course: {
  category?: string
  role?: string
  designCredits?: number
}): { kind: CourseKind; categoryLabel: string } {
  if ((course.designCredits ?? 0) > 0) {
    return { kind: 'design', categoryLabel: '설계' }
  }
  if (course.category === 'GENERAL') {
    return { kind: 'general', categoryLabel: '교양' }
  }
  if (course.role === 'REQUIRED' || course.role === 'BSM_REQUIRED') {
    return { kind: 'required', categoryLabel: course.category === 'BSM' ? 'BSM' : '전필' }
  }
  if (course.category === 'BSM') {
    return { kind: 'required', categoryLabel: 'BSM' }
  }
  return { kind: 'elective', categoryLabel: '전선' }
}

function toPlanned(
  source: OfferedCourse | RoadmapCourse,
  grade: Grade = 'A0',
): PlannedCourse {
  const code =
    'abeekCourseCode' in source ? source.abeekCourseCode : (source as RoadmapCourse).abeekCourseCode
  const designCredits = toNumber(source.designCredits)
  const { kind, categoryLabel } = classifyCourse({
    category: source.category,
    role: source.role,
    designCredits,
  })
  return {
    id: `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code,
    name: source.courseName,
    credits: toNumber(source.credits) || 3,
    designCredits,
    kind: grade === 'P' || grade === 'NP' ? 'pass' : kind,
    categoryLabel: grade === 'P' || grade === 'NP' ? 'P/NP' : categoryLabel,
    grade,
  }
}

function loadPlan(studentId: number): SemesterPlan[] | null {
  try {
    const raw = localStorage.getItem(`congraduation.sim.${studentId}`)
    return raw ? (JSON.parse(raw) as SemesterPlan[]) : null
  } catch {
    return null
  }
}

function savePlan(studentId: number, plans: SemesterPlan[]) {
  localStorage.setItem(`congraduation.sim.${studentId}`, JSON.stringify(plans))
}

export function SimulationPage() {
  const { student } = useAuth()
  const { active } = useMajorTrack()
  const [progress, setProgress] = useState<GraduationProgressResponse | null>(null)
  const [evaluation, setEvaluation] = useState<AbeekEvaluationResponse | null>(null)
  const [roadmapCourses, setRoadmapCourses] = useState<RoadmapCourse[]>([])
  const [catalog, setCatalog] = useState<OfferedCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [plans, setPlans] = useState<SemesterPlan[]>([])
  const [activeSemesterKey, setActiveSemesterKey] = useState<string>('')
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const abeekId = student.studentNo || String(student.id)
        const [prog, evalData, roadmap] = await Promise.all([
          getGraduationProgress(student.id),
          getAbeekEvaluation(abeekId).catch(() => null),
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
        setEvaluation(evalData)
        const flat = flattenRoadmapCourses(roadmap)
        setRoadmapCourses(flat)

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

        const saved = loadPlan(student.id)
        if (saved && saved.length > 0) {
          setPlans(saved)
          setActiveSemesterKey(saved[0].key)
        } else {
          const shells = nextSemesters(4, student.admissionYear).map((s) => ({
            ...s,
            courses: [] as PlannedCourse[],
          }))
          // seed with incomplete required courses into recommended terms if possible
          const remaining = flat.filter((c) => c.completed !== true).slice(0, 12)
          for (const course of remaining) {
            const term = course.recommendedTerm // e.g. 3-1
            let target = shells[0]
            if (term) {
              const match = shells.find((s) => s.label.startsWith(term))
              if (match) target = match
            }
            const idx = shells.indexOf(target)
            const bucket = shells[Math.min(Math.max(idx, 0), shells.length - 1)]
            if (bucket.courses.length < 6) {
              bucket.courses.push(toPlanned(course))
            }
          }
          setPlans(shells)
          setActiveSemesterKey(shells[0]?.key ?? '')
        }
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

  useEffect(() => {
    if (!student || plans.length === 0) return
    savePlan(student.id, plans)
  }, [plans, student])

  const plannedCourses = useMemo(() => plans.flatMap((p) => p.courses), [plans])
  const plannedCodes = useMemo(() => new Set(plannedCourses.map((c) => c.code)), [plannedCourses])

  const earnedTotal = toNumber(progress?.totalCredits?.earnedCredits)
  const requiredTotal = toNumber(progress?.totalCredits?.requiredCredits) || 130
  const earnedMajor = toNumber(
    progress?.majorCredits?.earnedMajorCredits ?? evaluation?.major?.earnedCredits,
  )
  const requiredMajor =
    toNumber(progress?.majorCredits?.requiredMajorCredits ?? evaluation?.major?.requiredCredits) ||
    45

  const plannedCredits = plannedCourses.reduce((s, c) => s + c.credits, 0)
  const plannedMajorCredits = plannedCourses
    .filter((c) => c.kind === 'required' || c.kind === 'elective' || c.kind === 'design')
    .reduce((s, c) => s + c.credits, 0)

  const projectedTotal = earnedTotal + plannedCredits
  const projectedMajor = earnedMajor + plannedMajorCredits
  const totalPct = requiredTotal > 0 ? Math.min(100, Math.round((projectedTotal / requiredTotal) * 100)) : 0
  const majorPct = requiredMajor > 0 ? Math.min(100, Math.round((projectedMajor / requiredMajor) * 100)) : 0
  const completedPct =
    requiredTotal > 0 ? Math.min(100, Math.round((earnedTotal / requiredTotal) * 100)) : 0

  const missingDesignMsgs = (evaluation?.messages ?? []).filter((m) => m.includes('미이수'))
  const canGraduate =
    projectedTotal >= requiredTotal &&
    projectedMajor >= requiredMajor &&
    missingDesignMsgs.length === 0

  const gradeDist = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of GRADES) counts[g] = 0
    for (const c of plannedCourses) counts[c.grade] = (counts[c.grade] ?? 0) + 1
    return GRADES.filter((g) => (counts[g] ?? 0) > 0).map((g) => ({
      grade: g,
      count: counts[g],
    }))
  }, [plannedCourses])

  const maxGradeCount = Math.max(1, ...gradeDist.map((g) => g.count))

  const missingItems = useMemo(() => {
    const items: string[] = []
    if (projectedMajor < requiredMajor) {
      items.push(`전공 ${requiredMajor - projectedMajor}학점 부족`)
    }
    if (projectedTotal < requiredTotal) {
      items.push(`전체 ${requiredTotal - projectedTotal}학점 부족`)
    }
    const designNeed = toNumber(evaluation?.design?.requiredCredits)
    const designHave =
      toNumber(evaluation?.design?.earnedCredits) +
      plannedCourses.reduce((s, c) => s + c.designCredits, 0)
    if (designNeed > 0 && designHave < designNeed) {
      items.push(`설계 ${Math.round((designNeed - designHave) * 10) / 10}학점 부족`)
    }
    for (const msg of evaluation?.messages ?? []) {
      if (msg.includes('미이수')) items.push(msg.replace(/^[·•\s]+/, ''))
    }
    const missingRequired = roadmapCourses.filter(
      (c) =>
        c.completed !== true &&
        (c.role === 'REQUIRED' || c.role === 'BSM_REQUIRED') &&
        !plannedCodes.has(c.abeekCourseCode),
    )
    if (missingRequired.length > 0) {
      items.push(
        `필수 ${missingRequired.length}과목 미이수 (예: ${missingRequired
          .slice(0, 2)
          .map((c) => c.courseName)
          .join(', ')})`,
      )
    }
    return [...new Set(items)].slice(0, 6)
  }, [
    projectedMajor,
    requiredMajor,
    projectedTotal,
    requiredTotal,
    evaluation,
    plannedCourses,
    roadmapCourses,
    plannedCodes,
  ])

  const recommendations = useMemo(() => {
    const tips: string[] = []
    const empty = plans.find((p) => p.courses.length === 0)
    if (empty) tips.push(`${empty.label}에 과목을 배정하세요.`)
    const heavy = plans.find((p) => p.courses.reduce((s, c) => s + c.credits, 0) > 21)
    if (heavy) tips.push(`${heavy.label} 학점이 21을 초과합니다. 분산을 권장합니다.`)
    const designLeft = roadmapCourses.find(
      (c) =>
        c.completed !== true &&
        toNumber(c.designCredits) > 0 &&
        !plannedCodes.has(c.abeekCourseCode) &&
        c.courseName.toLowerCase().includes('capstone'),
    )
    if (designLeft) tips.push(`${designLeft.courseName}을(를) 우선 배치하세요.`)
    const os = roadmapCourses.find(
      (c) =>
        c.completed !== true &&
        c.courseName.includes('운영체제') &&
        !plannedCodes.has(c.abeekCourseCode),
    )
    if (os) tips.push(`선수 확인 후 ${os.courseName} 추가를 권장합니다.`)
    if (plannedCourses.some((c) => c.grade === 'P')) {
      tips.push('P/NP 과목은 전공 평점 계산에서 분리되는지 확인하세요.')
    }
    if (tips.length === 0) tips.push('현재 계획 균형이 양호합니다. 개설 여부를 한 번 더 확인하세요.')
    return tips.slice(0, 4)
  }, [plans, roadmapCourses, plannedCodes, plannedCourses])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog
      .filter((c) => !plannedCodes.has(c.abeekCourseCode))
      .filter((c) => {
        if (kindFilter === 'all') return true
        const { kind } = classifyCourse(c)
        return kind === kindFilter
      })
      .filter((c) => {
        if (!q) return true
        return (
          c.courseName.toLowerCase().includes(q) ||
          c.abeekCourseCode.toLowerCase().includes(q)
        )
      })
      .slice(0, 40)
  }, [catalog, query, kindFilter, plannedCodes])

  const addCourse = (course: OfferedCourse, semesterKey = activeSemesterKey) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.key === semesterKey
          ? {
              ...p,
              courses: p.courses.some((c) => c.code === course.abeekCourseCode)
                ? p.courses
                : [...p.courses, toPlanned(course)],
            }
          : p,
      ),
    )
  }

  const removeCourse = (semesterKey: string, courseId: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.key === semesterKey
          ? { ...p, courses: p.courses.filter((c) => c.id !== courseId) }
          : p,
      ),
    )
  }

  const updateGrade = (semesterKey: string, courseId: string, grade: Grade) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.key === semesterKey
          ? {
              ...p,
              courses: p.courses.map((c) => {
                if (c.id !== courseId) return c
                if (grade === 'P' || grade === 'NP') {
                  return { ...c, grade, kind: 'pass', categoryLabel: 'P/NP' }
                }
                const restored = classifyCourse({
                  category:
                    c.categoryLabel === '교양'
                      ? 'GENERAL'
                      : c.categoryLabel === 'BSM'
                        ? 'BSM'
                        : 'MAJOR',
                  role: c.categoryLabel === '전필' || c.categoryLabel === 'BSM' ? 'REQUIRED' : 'ELECTIVE',
                  designCredits: c.designCredits,
                })
                return {
                  ...c,
                  grade,
                  kind: c.designCredits > 0 ? 'design' : restored.kind,
                  categoryLabel: c.designCredits > 0 ? '설계' : restored.categoryLabel,
                }
              }),
            }
          : p,
      ),
    )
  }

  const moveCourse = (fromKey: string, toKey: string, courseId: string) => {
    if (fromKey === toKey) return
    setPlans((prev) => {
      let moving: PlannedCourse | undefined
      const without = prev.map((p) => {
        if (p.key !== fromKey) return p
        moving = p.courses.find((c) => c.id === courseId)
        return { ...p, courses: p.courses.filter((c) => c.id !== courseId) }
      })
      if (!moving) return prev
      return without.map((p) =>
        p.key === toKey ? { ...p, courses: [...p.courses, moving!] } : p,
      )
    })
  }

  const resetPlan = () => {
    if (!student) return
    const shells = nextSemesters(4, student.admissionYear).map((s) => ({
      ...s,
      courses: [] as PlannedCourse[],
    }))
    setPlans(shells)
    setActiveSemesterKey(shells[0]?.key ?? '')
    localStorage.removeItem(`congraduation.sim.${student.id}`)
  }

  const displayName = student?.name || '학생'
  const majorLabel = active?.label || student?.major || ''

  if (loading) {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="flex-1 px-8 py-7">
          <p className="py-20 text-center text-sm text-ink-muted">시뮬레이션을 준비하는 중...</p>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="flex-1 px-8 py-7">
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-sejong">{error}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto px-8 py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-ink">{displayName}님 미래 학기 계획</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {student?.admissionYear && (
                <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
                  {student.admissionYear}학번
                </span>
              )}
              {majorLabel && (
                <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
                  {active ? `${trackTypeLabel(active.trackType)} · ${majorLabel}` : majorLabel}
                </span>
              )}
              <span className="rounded-full bg-sejong px-3 py-1 text-xs font-semibold text-white">
                졸업 시뮬레이션
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MajorTrackSwitcher />
            <button
              type="button"
              onClick={resetPlan}
              className="rounded-full border border-[#e5e7eb] bg-white px-4 py-1.5 text-xs font-semibold text-ink hover:bg-panel"
            >
              계획 초기화
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_1.05fr_0.85fr]">
          {/* 남은 학기 로드맵 */}
          <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-base font-bold text-ink">남은 학기 로드맵</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => {
                const credits = plan.courses.reduce((s, c) => s + c.credits, 0)
                const active = plan.key === activeSemesterKey
                return (
                  <article
                    key={plan.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!dragId) return
                      const from = plans.find((p) => p.courses.some((c) => c.id === dragId))
                      if (from) moveCourse(from.key, plan.key, dragId)
                      setDragId(null)
                    }}
                    className={`flex min-h-[260px] flex-col rounded-xl border p-3 transition ${
                      active ? 'border-sejong bg-sejong-light/30' : 'border-[#eceff3] bg-panel/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSemesterKey(plan.key)}
                      className="mb-2 flex w-full items-center justify-between text-left"
                    >
                      <span className="text-sm font-bold text-ink">{plan.label}</span>
                      <span className="text-xs font-semibold text-sejong">예상 {credits}학점</span>
                    </button>
                    <ul className="flex-1 space-y-2 overflow-y-auto">
                      {plan.courses.map((course) => (
                        <li
                          key={course.id}
                          draggable
                          onDragStart={() => setDragId(course.id)}
                          onDragEnd={() => setDragId(null)}
                          className="rounded-lg border border-[#e8ebf0] bg-white px-2.5 py-2 shadow-sm"
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 cursor-grab text-ink-faint" aria-hidden>
                              ⋮⋮
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-ink">{course.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kindStyle[course.kind]}`}
                                >
                                  {course.categoryLabel}
                                </span>
                                <span className="text-[11px] text-ink-muted">{course.credits}학점</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <select
                                  value={course.grade}
                                  onChange={(e) =>
                                    updateGrade(plan.key, course.id, e.target.value as Grade)
                                  }
                                  className="rounded-md border border-[#e5e7eb] bg-panel px-2 py-1 text-[11px] font-semibold outline-none"
                                >
                                  {GRADES.map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => removeCourse(plan.key, course.id)}
                                  className="text-[11px] font-semibold text-ink-faint hover:text-sejong"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                      {plan.courses.length === 0 && (
                        <li className="py-8 text-center text-xs text-ink-faint">
                          과목을 검색해 추가하세요
                        </li>
                      )}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setActiveSemesterKey(plan.key)}
                      className="mt-2 rounded-lg border border-dashed border-[#d5dae1] py-2 text-xs font-semibold text-ink-muted hover:border-sejong hover:text-sejong"
                    >
                      + 과목 추가
                    </button>
                  </article>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee] pt-3">
              {(Object.keys(kindLabel) as CourseKind[]).map((k) => (
                <span
                  key={k}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${kindStyle[k]}`}
                >
                  {kindLabel[k]}
                </span>
              ))}
            </div>
          </section>

          {/* 검색 + 결과 */}
          <div className="space-y-5">
            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="mb-3 text-base font-bold text-ink">시간표 기반 과목 검색</h2>
              <div className="relative mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="과목명·코드 검색"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-panel py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-sejong/30"
                />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
                  ⌕
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <select
                  value={activeSemesterKey}
                  onChange={(e) => setActiveSemesterKey(e.target.value)}
                  className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  {plans.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}에 추가
                    </option>
                  ))}
                </select>
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  <option value="all">전체 구분</option>
                  <option value="required">전필/BSM</option>
                  <option value="elective">전선</option>
                  <option value="general">교양</option>
                  <option value="design">설계</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setKindFilter('all')
                  }}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-panel"
                >
                  필터 초기화
                </button>
              </div>
              <div className="max-h-[280px] overflow-auto rounded-xl border border-[#eee]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-panel text-ink-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">과목</th>
                      <th className="px-2 py-2 font-semibold">구분</th>
                      <th className="px-2 py-2 font-semibold">학점</th>
                      <th className="px-2 py-2 font-semibold">권장</th>
                      <th className="px-2 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((course) => {
                      const { categoryLabel, kind } = classifyCourse(course)
                      return (
                        <tr key={course.abeekCourseCode} className="border-t border-[#f0f0f3]">
                          <td className="px-3 py-2">
                            <p className="font-semibold text-ink">{course.courseName}</p>
                            <p className="text-[10px] text-ink-faint">{course.abeekCourseCode}</p>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kindStyle[kind]}`}
                            >
                              {categoryLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium">{course.credits ?? '-'}</td>
                          <td className="px-2 py-2 text-ink-muted">
                            {course.recommendedTerm ?? '-'}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => addCourse(course)}
                              className="rounded-full bg-sejong px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sejong-dark"
                            >
                              추가
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {searchResults.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-ink-faint">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="mb-4 text-base font-bold text-ink">시뮬레이션 결과</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center">
                  <DonutChart
                    percent={totalPct}
                    size={96}
                    stroke={10}
                    label={formatPercentLabel(totalPct)}
                  />
                  <p className="mt-2 text-xs font-bold text-ink">전체 학점</p>
                  <p className="text-[11px] text-ink-muted">
                    {projectedTotal}/{requiredTotal}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <DonutChart
                    percent={majorPct}
                    size={96}
                    stroke={10}
                    label={formatPercentLabel(majorPct)}
                  />
                  <p className="mt-2 text-xs font-bold text-ink">전공 학점</p>
                  <p className="text-[11px] text-ink-muted">
                    {projectedMajor}/{requiredMajor}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <DonutChart
                    percent={completedPct}
                    size={96}
                    stroke={10}
                    color="#5b6470"
                    label={formatPercentLabel(completedPct)}
                  />
                  <p className="mt-2 text-xs font-bold text-ink">기이수</p>
                  <p className="text-[11px] text-ink-muted">
                    {earnedTotal}/{requiredTotal}
                  </p>
                </div>
              </div>
              <div
                className={`mt-4 rounded-xl px-4 py-3 text-center text-sm font-bold ${
                  canGraduate
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-sejong-light text-sejong'
                }`}
              >
                {canGraduate
                  ? '현재 계획 기준 졸업 가능'
                  : '현재 계획으로는 요건 미충족 — 부족 요건을 확인하세요'}
              </div>
            </section>
          </div>

          {/* 우측 패널 */}
          <div className="space-y-5">
            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="mb-4 text-base font-bold text-ink">예상 성적 분포</h2>
              {gradeDist.length === 0 ? (
                <p className="text-xs text-ink-faint">계획 과목의 예상 성적이 여기 표시됩니다.</p>
              ) : (
                <ul className="space-y-2.5">
                  {gradeDist.map((item) => (
                    <li key={item.grade} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-bold text-ink">{item.grade}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel">
                        <div
                          className="h-full rounded-full bg-sejong"
                          style={{ width: `${(item.count / maxGradeCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-semibold text-ink-muted">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="mb-3 text-base font-bold text-ink">부족 요건</h2>
              <ul className="space-y-2">
                {missingItems.length === 0 ? (
                  <li className="text-xs text-emerald-700">표시할 부족 요건이 없습니다.</li>
                ) : (
                  missingItems.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 rounded-lg bg-sejong-light/50 px-3 py-2 text-xs leading-relaxed text-sejong"
                    >
                      <span className="shrink-0 font-bold">!</span>
                      <span>{item}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="mb-3 text-base font-bold text-ink">추천 액션</h2>
              <ul className="space-y-2">
                {recommendations.map((tip) => (
                  <li
                    key={tip}
                    className="rounded-lg border border-[#eee] bg-panel/60 px-3 py-2 text-xs leading-relaxed text-ink"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
