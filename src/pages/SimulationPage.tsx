import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addNextPlannedSemesters,
  addPlannedCourse,
  deletePlannedCourse,
  deletePlannedSemester,
  getAbeekEvaluation,
  getGraduationProgress,
  getPlannedCourseCatalog,
  getPlannedCourses,
  updatePlannedCourseExpectedGrade,
} from '../api/endpoints'
import type {
  AbeekEvaluationResponse,
  ExpectedGrade,
  GraduationProgressResponse,
  PlannableCourse,
  PlannedCourseItem,
  PlannedCoursesResponse,
  PlannedSemester,
} from '../api/types'
import { DonutChart } from '../components/charts/DonutChart'
import { Sidebar } from '../components/layout/Sidebar'
import { MajorTrackSwitcher } from '../components/modals/MajorTrackSwitcher'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
import { trackTypeLabel } from '../utils/majorTrack'
import { formatPercentLabel, toNumber } from '../utils/number'

const GRADES = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'NP'] as const
type Grade = (typeof GRADES)[number]

type CourseKind = 'required' | 'elective' | 'foundation' | 'general' | 'design' | 'pass'

type CatalogItem = {
  code: string
  name: string
  category: string
  credits: number
  offeredTerms: string[]
  targetGrades: string[]
}

const kindStyle: Record<CourseKind, string> = {
  required: 'bg-sejong text-white',
  elective: 'bg-[#fde8ec] text-[#b01030]',
  foundation: 'bg-[#4a5568] text-white',
  general: 'bg-[#e8eaee] text-[#4a5568]',
  design: 'bg-[#fff1e6] text-[#c45c12]',
  pass: 'bg-[#e8f1fb] text-[#2b6cb0]',
}

/** 긴 과목명: 괄호 앞에서 줄바꿈 */
function CourseNameText({ name, className = '' }: { name: string; className?: string }) {
  const idx = name.indexOf('(')
  if (idx <= 0) {
    return <span className={`break-keep ${className}`}>{name}</span>
  }
  return (
    <span className={`break-keep ${className}`}>
      {name.slice(0, idx)}
      <wbr />
      {name.slice(idx)}
    </span>
  )
}

/** API 카테고리 enum / 한글 라벨 → UI 구분 */
function classifyByCategory(category?: string, grade?: string): { kind: CourseKind; label: string } {
  if (grade === 'P' || grade === 'NP') return { kind: 'pass', label: 'P/NP' }
  const c = category || ''
  const upper = c.toUpperCase()

  if (
    c.includes('설계') ||
    upper.includes('DESIGN') ||
    upper.includes('CAPSTONE')
  ) {
    return { kind: 'design', label: '설계' }
  }
  if (
    c.includes('교양') ||
    c.includes('균형') ||
    c.includes('공통') ||
    upper.includes('LIBERAL') ||
    upper.includes('GENERAL') ||
    upper.startsWith('LIB_')
  ) {
    return { kind: 'general', label: '교양' }
  }
  if (upper.includes('BSM') || (c.includes('기초') && !c.includes('설계'))) {
    return { kind: 'foundation', label: '기초' }
  }
  if (
    c.includes('필수') ||
    c.includes('전필') ||
    upper.includes('REQUIRED') ||
    upper.includes('MAJOR_REQ')
  ) {
    return { kind: 'required', label: '전필' }
  }
  if (
    c.includes('선택') ||
    c.includes('전선') ||
    upper.includes('ELECTIVE') ||
    upper.includes('MAJOR_ELE')
  ) {
    return { kind: 'elective', label: '전선' }
  }
  // MAJ_* 같은 enum은 그대로 노출하지 않음
  if (/^[A-Z][A-Z0-9_]+$/.test(c)) {
    return { kind: 'elective', label: '전공' }
  }
  return { kind: 'elective', label: c || '기타' }
}

/** 학수번호 여부 (MAJ_BASIC_DESIGN 같은 카테고리 enum 제외) */
function isAcademicCourseCode(code?: string | null): boolean {
  if (!code) return false
  const trimmed = code.trim()
  if (!trimmed) return false
  if (/^[A-Z][A-Z0-9_]*$/.test(trimmed) && trimmed.includes('_')) return false
  if (/^[A-Z]{2,}_/.test(trimmed)) return false
  return true
}

function toCatalogItem(course: PlannableCourse): CatalogItem | null {
  const code = course.courseCodes?.[0]
  if (!code || !course.courseName) return null
  return {
    code,
    name: course.courseName,
    category: course.category || '',
    credits: toNumber(course.credits?.[0]) || 3,
    offeredTerms: course.offeredTerms ?? [],
    targetGrades: course.targetGrades ?? [],
  }
}

function semesterLabel(sem: PlannedSemester) {
  return `${sem.gradeYear}-${sem.semester}학기`
}

/** "2026-1" / "2025-2" → "1학기" / "2학기" */
function formatOfferedSemester(term?: string) {
  if (!term) return '-'
  const m = term.match(/(?:^|-)([12])(?:\s*$)/)
  if (m) return `${m[1]}학기`
  if (term.includes('1')) return '1학기'
  if (term.includes('2')) return '2학기'
  return term
}

function normalizeGrade(value?: string | null): Grade {
  if (value && (GRADES as readonly string[]).includes(value)) return value as Grade
  return 'A0'
}

export function SimulationPage() {
  const { student } = useAuth()
  const { active } = useMajorTrack()
  const [progress, setProgress] = useState<GraduationProgressResponse | null>(null)
  const [evaluation, setEvaluation] = useState<AbeekEvaluationResponse | null>(null)
  const [planned, setPlanned] = useState<PlannedCoursesResponse | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [codeByName, setCodeByName] = useState<Map<string, string>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [activeSemesterId, setActiveSemesterId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [dragId, setDragId] = useState<number | null>(null)

  const applyPlanned = useCallback((data: PlannedCoursesResponse) => {
    setPlanned(data)
    const semesters = data.semesters ?? []
    setActiveSemesterId((prev) => {
      if (prev != null && semesters.some((s) => s.plannedSemesterId === prev)) return prev
      return semesters[0]?.plannedSemesterId ?? null
    })
  }, [])

  const refreshAll = useCallback(async () => {
    if (!student) return
    const abeekId = student.studentNo || String(student.id)
    let plannedData = await getPlannedCourses(student.id)
    if (!plannedData.semesters?.length) {
      plannedData = await addNextPlannedSemesters(student.id, 4)
    }
    const [prog, evalData] = await Promise.all([
      getGraduationProgress(student.id),
      getAbeekEvaluation(abeekId).catch(() => null),
    ])
    applyPlanned(plannedData)
    setProgress(prog)
    setEvaluation(evalData)
  }, [student, applyPlanned])

  useEffect(() => {
    if (!student) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await refreshAll()
        if (cancelled) return
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
  }, [student, refreshAll])

  useEffect(() => {
    if (!student) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await getPlannedCourseCatalog({
          departmentName: student.major || undefined,
        })
        if (cancelled) return
        const map = new Map<string, string>()
        for (const item of (res.courses ?? []).map(toCatalogItem)) {
          if (!item) continue
          if (!map.has(item.name)) map.set(item.name, item.code)
        }
        setCodeByName(map)
      } catch {
        /* 학수번호 보조 조회 실패는 무시 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [student])

  useEffect(() => {
    if (!student) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const res = await getPlannedCourseCatalog({
          keyword: query.trim() || undefined,
          departmentName: student.major || undefined,
        })
        if (cancelled) return
        const items = (res.courses ?? [])
          .map(toCatalogItem)
          .filter((c): c is CatalogItem => c != null)
        setCatalog(items)
        setCodeByName((prev) => {
          const next = new Map(prev)
          for (const item of items) {
            if (!next.has(item.name)) next.set(item.name, item.code)
          }
          return next
        })
      } catch {
        if (!cancelled) setCatalog([])
      }
    }, query.trim() ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [student, query])

  const resolveCourseCode = useCallback(
    (course: PlannedCourseItem) => {
      if (isAcademicCourseCode(course.courseCode)) return course.courseCode
      return codeByName.get(course.courseName) || ''
    },
    [codeByName],
  )

  const semesters = planned?.semesters ?? []
  const plannedCourses = useMemo(
    () => semesters.flatMap((s) => s.courses ?? []),
    [semesters],
  )
  const plannedCodes = useMemo(
    () => new Set(plannedCourses.map((c) => c.courseCode)),
    [plannedCourses],
  )

  const earnedTotal = toNumber(progress?.totalCredits?.earnedCredits)
  const requiredTotal = toNumber(progress?.totalCredits?.requiredCredits) || 130
  const earnedMajor = toNumber(
    progress?.majorCredits?.earnedMajorCredits ?? evaluation?.major?.earnedCredits,
  )
  const requiredMajor =
    toNumber(progress?.majorCredits?.requiredMajorCredits ?? evaluation?.major?.requiredCredits) ||
    45

  const plannedCredits =
    toNumber(planned?.totalPlannedCredits) ||
    plannedCourses.reduce((s, c) => s + toNumber(c.credit), 0)
  const plannedMajorCredits = plannedCourses
    .filter((c) => {
      const { kind } = classifyByCategory(c.category, c.expectedGrade)
      return kind === 'required' || kind === 'elective' || kind === 'design'
    })
    .reduce((s, c) => s + toNumber(c.credit), 0)

  const projectedTotal = earnedTotal + plannedCredits
  const projectedMajor = earnedMajor + plannedMajorCredits
  const totalPct =
    requiredTotal > 0 ? Math.min(100, Math.round((projectedTotal / requiredTotal) * 100)) : 0
  const majorPct =
    requiredMajor > 0 ? Math.min(100, Math.round((projectedMajor / requiredMajor) * 100)) : 0
  const completedPct =
    requiredTotal > 0 ? Math.min(100, Math.round((earnedTotal / requiredTotal) * 100)) : 0

  const canGraduate =
    progress?.graduationEligible === true ||
    (projectedTotal >= requiredTotal && projectedMajor >= requiredMajor)

  const gradeDist = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of GRADES) counts[g] = 0
    for (const c of plannedCourses) {
      const g = normalizeGrade(c.expectedGrade)
      counts[g] = (counts[g] ?? 0) + 1
    }
    return GRADES.filter((g) => (counts[g] ?? 0) > 0).map((g) => ({
      grade: g,
      count: counts[g],
    }))
  }, [plannedCourses])

  const maxGradeCount = Math.max(1, ...gradeDist.map((g) => g.count))

  const missingItems = useMemo(() => {
    const items: string[] = []
    for (const blocker of progress?.graduationBlockers ?? []) {
      if (blocker) items.push(blocker)
    }
    if (projectedMajor < requiredMajor) {
      items.push(`전공 ${Math.max(0, requiredMajor - projectedMajor)}학점 부족`)
    }
    if (projectedTotal < requiredTotal) {
      items.push(`전체 ${Math.max(0, requiredTotal - projectedTotal)}학점 부족`)
    }
    for (const msg of evaluation?.messages ?? []) {
      if (msg.includes('미이수')) items.push(msg.replace(/^[·•\s]+/, ''))
    }
    return [...new Set(items)].slice(0, 6)
  }, [progress?.graduationBlockers, projectedMajor, requiredMajor, projectedTotal, requiredTotal, evaluation])

  const recommendations = useMemo(() => {
    const tips: string[] = []
    const empty = semesters.find((s) => (s.courses?.length ?? 0) === 0)
    if (empty) tips.push(`${semesterLabel(empty)}에 과목을 배정하세요.`)
    const heavy = semesters.find((s) => toNumber(s.totalCredits) > 21)
    if (heavy) tips.push(`${semesterLabel(heavy)} 학점이 21을 초과합니다. 분산을 권장합니다.`)
    if (plannedCourses.some((c) => c.retake)) {
      tips.push('재수강 계획이 있습니다. 기존 성적 대체 여부를 확인하세요.')
    }
    if (planned?.lastCompletedSemester) {
      tips.push(`마지막 이수 학기: ${planned.lastCompletedSemester} 이후부터 계획 중입니다.`)
    }
    if (tips.length === 0) tips.push('현재 계획 균형이 양호합니다. 개설 학기를 한 번 더 확인하세요.')
    return tips.slice(0, 4)
  }, [semesters, plannedCourses, planned?.lastCompletedSemester])

  const searchResults = useMemo(() => {
    return catalog
      .filter((c) => !plannedCodes.has(c.code))
      .filter((c) => {
        if (kindFilter === 'all') return true
        return classifyByCategory(c.category).kind === kindFilter
      })
      .slice(0, 50)
  }, [catalog, kindFilter, plannedCodes])

  const runAction = async (fn: () => Promise<void>) => {
    if (!student) return
    setSaving(true)
    setActionError(null)
    try {
      await fn()
      await refreshAll()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '요청에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCourse = (course: CatalogItem) => {
    if (!student || activeSemesterId == null) return
    const target = semesters.find((s) => s.plannedSemesterId === activeSemesterId)
    if (!target) return
    void runAction(async () => {
      await addPlannedCourse(student.id, {
        plannedSemesterId: target.plannedSemesterId,
        gradeYear: target.gradeYear,
        semester: target.semester,
        courseCode: course.code,
        courseName: course.name,
        category: course.category,
        credit: String(course.credits),
        expectedGrade: 'A0',
      })
    })
  }

  const handleRemoveCourse = (courseId: number) => {
    if (!student) return
    void runAction(async () => {
      await deletePlannedCourse(student.id, courseId)
    })
  }

  const handleUpdateGrade = (courseId: number, grade: Grade) => {
    if (!student) return
    void runAction(async () => {
      await updatePlannedCourseExpectedGrade(student.id, courseId, grade as ExpectedGrade)
    })
  }

  const handleMoveCourse = (course: PlannedCourseItem, toSemesterId: number) => {
    if (!student || course.plannedSemesterId === toSemesterId) return
    const target = semesters.find((s) => s.plannedSemesterId === toSemesterId)
    if (!target) return
    void runAction(async () => {
      await deletePlannedCourse(student.id, course.id)
      await addPlannedCourse(student.id, {
        plannedSemesterId: target.plannedSemesterId,
        gradeYear: target.gradeYear,
        semester: target.semester,
        courseCode: course.courseCode,
        courseName: course.courseName,
        category: course.category,
        credit: String(course.credit ?? ''),
        expectedGrade: normalizeGrade(course.expectedGrade),
      })
    })
  }

  const handleReset = () => {
    if (!student) return
    void runAction(async () => {
      const current = await getPlannedCourses(student.id)
      for (const sem of current.semesters ?? []) {
        await deletePlannedSemester(student.id, sem.plannedSemesterId)
      }
      await addNextPlannedSemesters(student.id, 4)
    })
  }

  const activeSemester = useMemo(
    () => semesters.find((p) => p.plannedSemesterId === activeSemesterId) ?? null,
    [semesters, activeSemesterId],
  )
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
              {planned?.lastCompletedSemester && (
                <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
                  마지막 이수 {planned.lastCompletedSemester}
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
              onClick={handleReset}
              disabled={saving}
              className="rounded-full border border-[#e5e7eb] bg-white px-4 py-1.5 text-xs font-semibold text-ink hover:bg-panel disabled:opacity-50"
            >
              계획 초기화
            </button>
          </div>
        </div>

        {actionError && (
          <p className="mb-4 rounded-xl bg-sejong-light px-4 py-2 text-sm text-sejong">{actionError}</p>
        )}
        {saving && (
          <p className="mb-3 text-xs font-semibold text-ink-muted">계획 저장 중...</p>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.15fr_1.05fr_0.85fr]">
          <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-base font-bold text-ink">남은 학기 로드맵</h2>
            {semesters.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                계획 학기가 없습니다. 계획 초기화로 학기를 생성해 주세요.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {semesters.map((plan) => {
                  const courses = plan.courses ?? []
                  const credits = toNumber(plan.totalCredits) ||
                    courses.reduce((s, c) => s + toNumber(c.credit), 0)
                  const activeCard = plan.plannedSemesterId === activeSemesterId
                  return (
                    <article
                      key={plan.plannedSemesterId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveSemesterId(plan.plannedSemesterId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveSemesterId(plan.plannedSemesterId)
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragId == null) return
                        const moving = plannedCourses.find((c) => c.id === dragId)
                        if (moving) handleMoveCourse(moving, plan.plannedSemesterId)
                        setDragId(null)
                      }}
                      className={`flex h-[320px] cursor-pointer flex-col rounded-xl border p-3 transition ${
                        activeCard
                          ? 'border-sejong bg-sejong-light/30 ring-1 ring-sejong/30'
                          : 'border-[#eceff3] bg-panel/40 hover:border-sejong/40'
                      }`}
                    >
                      <div className="mb-2 flex shrink-0 w-full items-center justify-between gap-2">
                        <p className="text-left text-sm font-bold text-ink">{semesterLabel(plan)}</p>
                        <span className="text-xs font-semibold text-sejong">예상 {credits}학점</span>
                      </div>
                      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                        {courses.map((course) => {
                          const { kind, label } = classifyByCategory(
                            course.category,
                            course.expectedGrade,
                          )
                          const courseNo = resolveCourseCode(course)
                          return (
                            <li
                              key={course.id}
                              draggable
                              onDragStart={() => setDragId(course.id)}
                              onDragEnd={() => setDragId(null)}
                              className="rounded-lg border border-[#e8ebf0] bg-white px-2 py-1.5"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="shrink-0 cursor-grab text-[10px] leading-none text-ink-faint" aria-hidden>
                                  ⋮⋮
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start gap-1.5">
                                    <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-ink">
                                      <CourseNameText name={course.courseName} />
                                    </p>
                                    <select
                                      value={normalizeGrade(course.expectedGrade)}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        handleUpdateGrade(course.id, e.target.value as Grade)
                                      }
                                      className="shrink-0 rounded border border-[#e5e7eb] bg-panel px-1 py-0.5 text-[10px] font-semibold outline-none"
                                    >
                                      {GRADES.map((g) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveCourse(course.id)
                                      }}
                                      className="shrink-0 text-[10px] font-semibold text-ink-faint hover:text-sejong"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                    {courseNo && (
                                      <span className="text-[10px] tabular-nums text-ink-faint">
                                        {courseNo}
                                      </span>
                                    )}
                                    <span
                                      className={`rounded-full px-1.5 py-px text-[9px] font-bold ${kindStyle[kind]}`}
                                    >
                                      {label}
                                    </span>
                                    <span className="text-[10px] text-ink-muted">
                                      {toNumber(course.credit)}학점
                                    </span>
                                    {course.retake && (
                                      <span className="rounded-full bg-panel px-1.5 py-px text-[9px] font-semibold text-ink-muted">
                                        재수강
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                        {courses.length === 0 && (
                          <li className="py-8 text-center text-xs text-ink-faint">
                            오른쪽에서 과목을 검색해 추가하세요
                          </li>
                        )}
                      </ul>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <div className="space-y-5">
            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="mb-3 text-base font-bold text-ink">시간표 기반 과목 검색</h2>
              <div className="relative mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="과목명 검색"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-panel py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-sejong/30"
                />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
                  ⌕
                </span>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="rounded-lg border border-sejong/30 bg-sejong-light px-3 py-1.5 text-xs font-bold text-sejong">
                  {activeSemester ? `${semesterLabel(activeSemester)}에 추가` : '왼쪽에서 학기를 선택하세요'}
                </p>
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  <option value="all">전체 구분</option>
                  <option value="required">전필</option>
                  <option value="foundation">기초</option>
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
                      <th className="px-2 py-2 font-semibold">개설</th>
                      <th className="px-2 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((course) => {
                      const { label, kind } = classifyByCategory(course.category)
                      return (
                        <tr key={`${course.code}-${course.name}`} className="border-t border-[#f0f0f3]">
                          <td className="px-3 py-2">
                            <p className="font-semibold leading-snug text-ink">
                              <CourseNameText name={course.name} />
                            </p>
                            <p className="text-[10px] text-ink-faint">{course.code}</p>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${kindStyle[kind]}`}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium">{course.credits}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-ink-muted">
                            {formatOfferedSemester(course.offeredTerms[0])}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleAddCourse(course)}
                              disabled={saving || activeSemesterId == null}
                              className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-sejong px-3 py-1 text-[11px] font-bold text-white hover:bg-sejong-dark disabled:opacity-50"
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
                  canGraduate ? 'bg-emerald-50 text-emerald-700' : 'bg-sejong-light text-sejong'
                }`}
              >
                {canGraduate
                  ? '현재 계획 기준 졸업 가능'
                  : '현재 계획으로는 요건 미충족 — 부족 요건을 확인하세요'}
              </div>
            </section>
          </div>

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
