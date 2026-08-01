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

function semesterLabel(sem: PlannedSemester, admissionYear?: number) {
  return formatGradeTerm(sem.gradeYear, sem.semester, admissionYear)
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

function parseTermKey(value?: string | null): { gradeYear: number; semester: number } | null {
  if (!value) return null
  const m = String(value).trim().match(/^(\d+)\s*[-_/]\s*([12])/)
  if (!m) return null
  return { gradeYear: Number(m[1]), semester: Number(m[2]) }
}

/** 입학년 기준 상대학년 → 표시 라벨 (5학년+는 연도-학기) */
function formatGradeTerm(gradeYear: number, semester: number, admissionYear?: number) {
  if (gradeYear >= 1 && gradeYear <= 4) return `${gradeYear}-${semester}학기`
  if (admissionYear && gradeYear > 0) {
    return `${admissionYear + gradeYear - 1}-${semester}학기`
  }
  return `${gradeYear}년차 ${semester}학기`
}

/** overStanding이 true일 때만 초과학년. 순번 문자열로 추론하지 않음 */
function resolveOverStanding(planned?: PlannedCoursesResponse | null): boolean {
  return planned?.overStanding === true
}

/**
 * 서버 lastCompletedSemester가 달력 상대학년(5학년+)으로 온 경우.
 * 구 API는 overStanding/taken 필드 없이 6-1 같은 값을 내려 next 생성을 막는다.
 */
function isCalendarMislabelledStanding(planned?: PlannedCoursesResponse | null): boolean {
  if (!planned || resolveOverStanding(planned)) return false
  const parsed = parseTermKey(planned.lastCompletedSemester)
  return !!parsed && parsed.gradeYear > 4
}

/**
 * 계획/필터에 쓸 이수 순번.
 * - 정상: lastCompletedSemester (예: 4-1)
 * - 서버가 캘린더 환산(6-1)을 넣은 경우: overStanding이 아니면 표시용으로만 4학년 클램프
 *   (실제 next 생성은 서버가 막으면 FE에서 만들 수 없음)
 */
function resolveEffectiveLastStanding(
  planned?: PlannedCoursesResponse | null,
): string | null {
  const raw = planned?.lastCompletedSemester?.trim() || null
  const parsed = parseTermKey(raw)
  if (!parsed) return raw

  if (isCalendarMislabelledStanding(planned)) {
    const sem = parsed.semester >= 2 ? 2 : 1
    return `4-${sem}`
  }

  return `${parsed.gradeYear}-${parsed.semester}`
}

/**
 * 마지막 이수 표시
 * - 순번(lastCompletedSemester) 우선: 4-1학기
 * - 실제 수강 연도가 있으면 병기: 4-1학기 (2026-1)
 */
function formatLastCompletedLabel(
  planned?: PlannedCoursesResponse | null,
  admissionYear?: number,
): string | null {
  if (!planned) return null

  const standingKey = resolveEffectiveLastStanding(planned)
  const standingParsed = parseTermKey(standingKey)
  const takenYear = toNumber(planned.lastCompletedTakenYear)
  const takenSem = toNumber(planned.lastCompletedTakenSemester)

  let label: string | null = null
  if (standingParsed) {
    label = formatGradeTerm(standingParsed.gradeYear, standingParsed.semester, admissionYear)
  } else if (standingKey) {
    label = standingKey
  }

  if (takenYear > 0 && (takenSem === 1 || takenSem === 2)) {
    const takenLabel = `${takenYear}-${takenSem}`
    label = label ? `${label} (${takenLabel})` : `${takenLabel}학기`
  }

  if (!label) return null
  if (resolveOverStanding(planned)) return `${label} · 초과학년`
  return label
}

/** 계획 학기 한도: 8학년 2학기까지 (그 이후면 다음 학기 생성 불가) */
function isPastMaxPlannableTerm(lastCompleted?: string | null) {
  const parsed = parseTermKey(lastCompleted)
  if (!parsed) return false
  return parsed.gradeYear > 8 || (parsed.gradeYear === 8 && parsed.semester >= 2)
}

function isSemesterAfterLast(
  gradeYear: number | string | null | undefined,
  semester: number | string | null | undefined,
  lastCompleted?: string | null,
) {
  const last = parseTermKey(lastCompleted)
  if (!last) return true
  const gy = toNumber(gradeYear)
  const sem = toNumber(semester)
  return gy > last.gradeYear || (gy === last.gradeYear && sem > last.semester)
}

function normalizeGrade(value?: string | null): Grade {
  if (value && (GRADES as readonly string[]).includes(value)) return value as Grade
  return 'A0'
}

/**
 * 마지막 이수 다음~4-2가 계획에 있도록 보장.
 * BE(#74)가 한 번에 채워 주면 1회 next로 충분하고,
 * 구버전이면 4-2까지 순차 추가한다.
 */
async function ensurePlannedSemesters(studentId: number): Promise<PlannedCoursesResponse> {
  let planned = await getPlannedCourses(studentId)

  // 달력 오표기(6-1 등)면 서버 next도 같은 기준으로 거절 → 무의미한 재시도 방지
  if (isCalendarMislabelledStanding(planned)) return planned

  for (let i = 0; i < 16; i++) {
    const lastKey = resolveEffectiveLastStanding(planned)
    if (isPastMaxPlannableTerm(lastKey)) return planned

    const semesters = planned.semesters ?? []
    if (hasPlansThroughCap(semesters, lastKey, 4, 2)) return planned

    const beforeIds = new Set(semesters.map((s) => s.plannedSemesterId))
    try {
      planned = await addNextPlannedSemesters(studentId, 1)
    } catch {
      break
    }

    const after = planned.semesters ?? []
    const added = after.some((s) => !beforeIds.has(s.plannedSemesterId))
    if (!added) break
  }

  return getPlannedCourses(studentId)
}

/** last 다음 학기부터 gradeYear-semester(기본 4-2)까지 모두 있는지 */
function hasPlansThroughCap(
  semesters: Array<{ gradeYear?: number | string | null; semester?: number | string | null }>,
  lastKey: string | null,
  capGrade = 4,
  capSem = 2,
) {
  const last = parseTermKey(lastKey)
  if (!last) return semesters.length > 0

  const lastStep = (last.gradeYear - 1) * 2 + last.semester
  const capStep = (capGrade - 1) * 2 + capSem
  if (lastStep >= capStep) return true

  for (let step = lastStep + 1; step <= capStep; step++) {
    const gy = Math.floor((step - 1) / 2) + 1
    const sem = ((step - 1) % 2) + 1
    const found = semesters.some(
      (s) => toNumber(s.gradeYear) === gy && toNumber(s.semester) === sem,
    )
    if (!found) return false
  }
  return true
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
    const plannedData = await ensurePlannedSemesters(student.id)
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

  const semesters = useMemo(() => {
    const all = planned?.semesters ?? []
    const lastKey = resolveEffectiveLastStanding(planned)
    // 마지막 이수 순번 이후 학기만 표시 (캘린더 6-1 오표기로 4-2가 숨겨지지 않게)
    return all.filter((s) => isSemesterAfterLast(s.gradeYear, s.semester, lastKey))
  }, [planned])
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
    const admit = student?.admissionYear ?? progress?.admissionYear
    const tips: string[] = []
    const empty = semesters.find((s) => (s.courses?.length ?? 0) === 0)
    if (empty) tips.push(`${semesterLabel(empty, admit)}에 과목을 배정하세요.`)
    const heavy = semesters.find((s) => toNumber(s.totalCredits) > 21)
    if (heavy) tips.push(`${semesterLabel(heavy, admit)} 학점이 21을 초과합니다. 분산을 권장합니다.`)
    if (plannedCourses.some((c) => c.retake)) {
      tips.push('재수강 계획이 있습니다. 기존 성적 대체 여부를 확인하세요.')
    }
    const lastLabel = formatLastCompletedLabel(planned, admit)
    if (lastLabel) {
      tips.push(`마지막 이수 학기: ${lastLabel}\n이후부터 계획 중입니다.`)
    }
    if (tips.length === 0) tips.push('현재 계획 균형이 양호합니다.\n개설 학기를 한 번 더 확인하세요.')
    return tips.slice(0, 4)
  }, [
    semesters,
    plannedCourses,
    planned,
    student?.admissionYear,
    progress?.admissionYear,
  ])

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
      await ensurePlannedSemesters(student.id)
    })
  }

  const activeSemester = useMemo(
    () => semesters.find((p) => p.plannedSemesterId === activeSemesterId) ?? null,
    [semesters, activeSemesterId],
  )
  const displayName = student?.name || '학생'
  const majorLabel = active?.label || student?.major || ''
  const admissionYear = student?.admissionYear ?? progress?.admissionYear
  const lastCompletedLabel = formatLastCompletedLabel(planned, admissionYear)
  const effectiveLastStanding = resolveEffectiveLastStanding(planned)
  const rawLastStanding = planned?.lastCompletedSemester?.trim() || null
  const calendarMislabelled = isCalendarMislabelledStanding(planned)
  const pastPlannable = isPastMaxPlannableTerm(effectiveLastStanding)
  const effectiveParsed = parseTermKey(effectiveLastStanding)
  const lastStandingAtCap =
    !calendarMislabelled &&
    !!effectiveParsed &&
    effectiveParsed.gradeYear === 4 &&
    effectiveParsed.semester >= 2

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
              {lastCompletedLabel && (
                <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
                  마지막 이수 {lastCompletedLabel}
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
              <div className="space-y-3 py-10 text-center text-sm leading-relaxed text-ink-muted">
                {calendarMislabelled ? (
                  <>
                    <p>
                      서버가 마지막 이수를 순번이 아니라 달력 학년(
                      <span className="font-semibold text-ink">{rawLastStanding}</span>
                      )으로 보고 있어 다음 학기(4-2)를 만들 수 없습니다.
                    </p>
                    <p className="text-xs text-ink-faint">
                      백엔드 `PlannedCourseService`의 기이수 순번(
                      TranscriptStandingMapper) 배포가 필요합니다. FE만으로는 4-2
                      학기 카드를 생성할 수 없습니다.
                    </p>
                  </>
                ) : pastPlannable || lastStandingAtCap ? (
                  <p>
                    이수 순번이{' '}
                    <span className="font-semibold text-ink">
                      {effectiveLastStanding || lastCompletedLabel || '-'}
                    </span>
                    까지 완료되어 추가할 정규 계획 학기가 없습니다.
                  </p>
                ) : (
                  <>
                    <p>
                      마지막 이수 순번(
                      {effectiveLastStanding || lastCompletedLabel || '-'})
                      다음 학기 계획이 없습니다.
                    </p>
                    <button
                      type="button"
                      disabled={saving || !student}
                      onClick={() => {
                        if (!student) return
                        void runAction(async () => {
                          await addNextPlannedSemesters(student.id, 1)
                        })
                      }}
                      className="rounded-full bg-sejong px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      다음 학기 추가
                    </button>
                  </>
                )}
              </div>
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
                        <p className="text-left text-sm font-bold text-ink">
                          {semesterLabel(plan, admissionYear)}
                        </p>
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
                  {activeSemester
                    ? `${semesterLabel(activeSemester, admissionYear)}에 추가`
                    : '왼쪽에서 학기를 선택하세요'}
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
                    className="rounded-lg border border-[#eee] bg-panel/60 px-3 py-2 text-xs leading-relaxed text-ink break-keep whitespace-pre-line"
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
