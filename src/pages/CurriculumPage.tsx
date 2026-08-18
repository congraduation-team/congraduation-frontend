import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  getAbeekEvaluation,
  getAbeekFullRoadmap,
  getAbeekFullRoadmapByStudent,
  getGraduationProgress,
  getMajorOptions,
  getStudentRoadmap,
  getStudentRoadmapByStudent,
} from '../api/endpoints'
import type {
  AbeekEvaluationResponse,
  FullRoadmapResponse,
  GraduationProgressResponse,
  RoadmapCourse,
  StudentRoadmapCourse,
  StudentRoadmapResponse,
} from '../api/types'
import { flattenRoadmapCourses, isAdminUser } from '../api/types'
import { AppShell } from '../components/layout/AppShell'
import { MajorTrackSwitcher } from '../components/modals/MajorTrackSwitcher'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
import { toNumber } from '../utils/number'

function normalizeAlertKey(value?: string | null) {
  return (value || '').replace(/\s+/g, '').toUpperCase()
}

function isFailGrade(grade?: string | null) {
  return String(grade || '').trim().toUpperCase() === 'F'
}

const SEMESTERS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'] as const

/** 행마다 auto 라벨 폭이 달라 학기 열이 어긋나지 않도록 고정 */
const ROADMAP_GRID =
  'grid grid-cols-[5.5rem_repeat(8,minmax(132px,1fr))] gap-2 items-start'

/** 뷰포트 끝에서 보이는 최소 여백 (잘림 방지, 과한 공백 축소) */
const VIEW_MARGIN = 20
const BOARD_MIN_WIDTH = 1480

type MapCategory = 'liberal' | 'common' | 'bsm' | 'major-required' | 'major-elective'
type ViewKind = 'general' | 'abeek'

type MapCourse = {
  id: string
  name: string
  hours: string
  category: MapCategory
  semester: string
  completed: boolean
  /** 설계학점 불인정 또는 F — 느낌표 표시 */
  showAlert?: boolean
  alertReason?: string
}

type MapEdge = {
  from: string
  to: string
  type: 'required' | 'optional'
}

type RowDef = {
  key: string
  label: string
  categories: readonly MapCategory[]
  border: string
}

const MAJOR_COMPLETED_CLASS =
  'border-transparent bg-[#c8012e] text-white shadow-[0_0_0_1px_rgba(200,1,46,0.25)]'
const MAJOR_REQUIRED_INCOMPLETE_CLASS = 'border-sejong bg-white text-sejong'
const MAJOR_ELECTIVE_INCOMPLETE_CLASS = 'border-transparent bg-sejong-pink text-ink'

const categoryStyle: Record<MapCategory, string> = {
  liberal: 'border-transparent bg-[#64748b] text-white',
  common: 'border-transparent bg-[#0369a1] text-white',
  bsm: 'border-transparent bg-[#0f766e] text-white',
  'major-required': MAJOR_REQUIRED_INCOMPLETE_CLASS,
  'major-elective': MAJOR_ELECTIVE_INCOMPLETE_CLASS,
}

const completedCategoryStyle: Record<MapCategory, string> = {
  liberal: 'border-transparent bg-[#64748b] text-white shadow-[0_0_0_1px_rgba(100,116,139,0.35)]',
  common: 'border-transparent bg-[#0369a1] text-white shadow-[0_0_0_1px_rgba(3,105,161,0.35)]',
  bsm: 'border-transparent bg-[#0f766e] text-white shadow-[0_0_0_1px_rgba(15,118,110,0.35)]',
  'major-required': MAJOR_COMPLETED_CLASS,
  'major-elective': MAJOR_COMPLETED_CLASS,
}

function isMajorCategory(category: MapCategory) {
  return category === 'major-required' || category === 'major-elective'
}

function courseBadgeClass(
  course: MapCourse,
  hasCompletionData: boolean,
  rowKey?: string,
): string {
  const treatAsMajor = rowKey === 'major' || isMajorCategory(course.category)

  if (treatAsMajor) {
    if (course.completed) return MAJOR_COMPLETED_CLASS
    // 미이수: 필수=흰+빨간 테두리, 선택=연한 핑크 (이전과 동일)
    const base =
      course.category === 'major-required'
        ? MAJOR_REQUIRED_INCOMPLETE_CLASS
        : MAJOR_ELECTIVE_INCOMPLETE_CLASS
    return `${base} ${hasCompletionData ? 'opacity-70' : ''}`
  }

  const base = course.completed
    ? completedCategoryStyle[course.category]
    : categoryStyle[course.category]
  return `${base} ${!course.completed && hasCompletionData ? 'opacity-70' : ''}`
}

function completedChipClass(category: MapCategory, rowKey?: string): string {
  if (rowKey === 'major' || isMajorCategory(category)) return 'bg-white text-[#c8012e]'
  if (category === 'liberal') return 'bg-white text-[#64748b]'
  if (category === 'common') return 'bg-white text-[#0369a1]'
  if (category === 'bsm') return 'bg-white text-[#0f766e]'
  return 'bg-white text-[#c8012e]'
}

/** 일반(시간표) 로드맵: 교양 → 공통교양 → 학문기초 → 전공 */
const generalRowDefs: RowDef[] = [
  { key: 'liberal', label: '교양', categories: ['liberal'], border: 'border-[#94a3b8]' },
  { key: 'common', label: '공통교양', categories: ['common'], border: 'border-[#475569]' },
  { key: 'foundation', label: '학문기초', categories: ['bsm'], border: 'border-[#334155]' },
  {
    key: 'major',
    label: '전공',
    categories: ['major-required', 'major-elective'],
    border: 'border-sejong',
  },
]

/** 공학인증 로드맵: 전문교양 / BSM / 전공 */
const abeekRowDefs: RowDef[] = [
  { key: 'liberal', label: '전문교양', categories: ['liberal'], border: 'border-[#c5c9d0]' },
  { key: 'bsm', label: 'BSM', categories: ['bsm'], border: 'border-[#4a5568]' },
  {
    key: 'major',
    label: '전공',
    categories: ['major-required', 'major-elective'],
    border: 'border-sejong',
  },
]

type NodePos = { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number }

function buildOrthogonalPath(from: NodePos, to: NodePos, bendOffset: number) {
  const startX = from.x2
  const startY = from.cy
  const endX = to.x1
  const endY = to.cy
  const midX = startX + (endX - startX) / 2 + bendOffset
  return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
}

function mapAbeekCategory(course: RoadmapCourse): MapCategory {
  if (course.category === 'GENERAL') return 'liberal'
  if (course.category === 'BSM') return 'bsm'
  if (course.role === 'REQUIRED') return 'major-required'
  return 'major-elective'
}

/** 일반 로드맵: 공학인증 bucket(BSM/GENERAL) 무시, 시간표 이수구분 기준 */
function isMajorFoundationLabel(label: string) {
  const t = label.replace(/\s+/g, '')
  return t.includes('전공기초') || t === '전기' || t.startsWith('전기(') || t.includes('(전기)')
}

function normalizeCourseCode(code: string) {
  return code.replace(/\s+/g, '').toUpperCase()
}

function isAcademicFoundationLabel(label: string) {
  if (isMajorFoundationLabel(label) || label.includes('전공')) return false
  const t = label.replace(/\s+/g, '')
  return (
    t.includes('학문기초') ||
    t.includes('기초필수') ||
    (t.includes('기초') && t.includes('필수') && !t.includes('교양'))
  )
}

function isCommonLiberalLabel(label: string) {
  if (isMajorFoundationLabel(label) || label.includes('전공') || isAcademicFoundationLabel(label)) {
    return false
  }
  return (
    label.includes('공통교양') ||
    label.includes('교양필수') ||
    label.includes('대학필수') ||
    label.includes('필수교양') ||
    (label.includes('공통') && label.includes('필수')) ||
    (label.includes('교양') && label.includes('필수'))
  )
}

/** 일반 로드맵: 교양 / 공통교양 / 학문기초 / 전공
 * — 공통교양·학문기초·전공이 아니면 모두 교양 */
function mapGeneralCategory(course: StudentRoadmapCourse): MapCategory {
  const label = (course.category || '').trim()

  if (isMajorFoundationLabel(label)) return 'major-required'
  if (isAcademicFoundationLabel(label)) return 'bsm'
  if (isCommonLiberalLabel(label)) return 'common'

  if (label.includes('전공')) {
    if (label.includes('선택')) return 'major-elective'
    return 'major-required'
  }

  // 이수구분이 있을 때: 공통·학문·전공이 아니면 교양 (BSM bucket으로 끌어오지 않음)
  if (label) {
    return 'liberal'
  }

  // 이수구분 없을 때만 bucket fallback
  if (course.abeekBucket === 'BSM') return 'bsm'
  if (course.abeekBucket === 'MAJOR') return 'major-elective'

  // GENERAL·OTHER·미지정 → 교양
  return 'liberal'
}

function toTermKeyFromTaken(
  takenYear: number | string | null | undefined,
  takenSemester: number | string | null | undefined,
  admissionYear?: number,
): string | null {
  const year = toNumber(takenYear)
  const semester = toNumber(takenSemester)
  if (!year || !semester) return null
  const base = admissionYear && admissionYear > 0 ? admissionYear : year
  let grade = year - base + 1
  if (grade < 1) grade = 1
  if (grade > 4) grade = 4
  const sem = semester >= 2 ? 2 : 1
  const key = `${grade}-${sem}`
  return (SEMESTERS as readonly string[]).includes(key) ? key : null
}

function takenCalendarKey(
  takenYear: number | string | null | undefined,
  takenSemester: number | string | null | undefined,
): string | null {
  const year = toNumber(takenYear)
  const semester = toNumber(takenSemester)
  if (!year || !semester) return null
  return `${year}-${semester >= 2 ? 2 : 1}`
}

function semesterOrder(term: string) {
  const idx = (SEMESTERS as readonly string[]).indexOf(term)
  return idx >= 0 ? idx : 999
}

function isSemesterKey(term: string | null | undefined): term is string {
  return !!term && (SEMESTERS as readonly string[]).includes(term.trim())
}

/**
 * 실제 수강 캘린더 학기를 시간순으로 정렬해 이수 순번(1-1…4-2)에 매핑.
 * 백엔드 termKey가 권장학기(4-2)여도, 3-2에 미리 들었으면 3-2로 표시 가능.
 * 휴학 갭이 있어도 들은 학기 순서만으로 순번이 매겨짐.
 */
function buildStandingByTakenOrder(
  items: Array<{
    completed?: boolean
    takenYear?: number | string | null
    takenSemester?: number | string | null
  }>,
): Map<string, string> {
  const keys = new Set<string>()
  for (const item of items) {
    if (item.completed !== true) continue
    const cal = takenCalendarKey(item.takenYear, item.takenSemester)
    if (cal) keys.add(cal)
  }

  const sorted = [...keys].sort((a, b) => {
    const [ay, as] = a.split('-').map(Number)
    const [by, bs] = b.split('-').map(Number)
    return ay === by ? as - bs : ay - by
  })

  const result = new Map<string, string>()
  sorted.forEach((cal, index) => {
    if (index < SEMESTERS.length) result.set(cal, SEMESTERS[index])
    else result.set(cal, '4-2')
  })
  return result
}

function pickGeneralDisplayTerm(termKeys: string[]): string | null {
  const valid = [...new Set(termKeys.map((k) => k.trim()).filter(isSemesterKey))]
  if (valid.length === 0) return null
  if (valid.length === 1) return valid[0]
  return valid.slice().sort((a, b) => semesterOrder(a) - semesterOrder(b))[0]
}

/**
 * 이수 과목 배치: 실제 들은 순번 학기 (권장학기 아님).
 */
function pickCompletedDisplayTerm(options: {
  termKeys: string[]
  takenYear?: number | string | null
  takenSemester?: number | string | null
  courseStanding?: string | null
  standingByTaken: Map<string, string>
  admissionYear?: number
}): string | null {
  const { termKeys, takenYear, takenSemester, courseStanding, standingByTaken, admissionYear } =
    options

  if (isSemesterKey(courseStanding)) return courseStanding.trim()

  const cal = takenCalendarKey(takenYear, takenSemester)
  if (cal && standingByTaken.has(cal)) return standingByTaken.get(cal)!

  // taken은 있는데 순번 맵에 없으면 입학년 환산 폴백
  const calc = toTermKeyFromTaken(takenYear, takenSemester, admissionYear)
  if (calc) return calc

  // taken 없음 → 권장/API 칸 (백엔드가 taken을 안 준 경우)
  return pickGeneralDisplayTerm(termKeys)
}

/** CompletedCourseDto 등에서 학수번호→학기 맵 */
function buildTakenTermMap(
  progress: GraduationProgressResponse | null | undefined,
  standingByTaken?: Map<string, string>,
): Map<string, string> {
  const map = new Map<string, string>()
  if (!progress) return map
  const admissionYear = progress.admissionYear

  const ingest = (courses?: Array<Record<string, unknown>>) => {
    for (const raw of courses ?? []) {
      const code = String(raw.courseCode ?? '')
      if (!code || map.has(code)) continue
      const cal = takenCalendarKey(
        raw.takenYear as string | number | null | undefined,
        raw.takenSemester as string | number | null | undefined,
      )
      const term =
        (cal ? standingByTaken?.get(cal) : undefined) ||
        toTermKeyFromTaken(
          raw.takenYear as string | number | null | undefined,
          raw.takenSemester as string | number | null | undefined,
          admissionYear,
        )
      if (term) map.set(code, term)
    }
  }

  ingest(progress.commonLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined)
  ingest(progress.electiveLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined)
  ingest(
    progress.academicFoundationCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
  )
  ingest(
    progress.majorFoundationCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
  )
  ingest(
    progress.balancedLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
  )

  return map
}

function resolveDisplayTerm(
  recommendedTerm: string,
  takenYear: number | string | null | undefined,
  takenSemester: number | string | null | undefined,
  completed: boolean | undefined,
  admissionYear?: number,
  _takenTermByCode?: Map<string, string>,
  _courseCode?: string,
  standingByTaken?: Map<string, string>,
  courseStanding?: string | null,
): string | null {
  const recommended = recommendedTerm.trim()

  if (completed) {
    return pickCompletedDisplayTerm({
      termKeys: isSemesterKey(recommended) ? [recommended] : [],
      takenYear,
      takenSemester,
      courseStanding,
      standingByTaken: standingByTaken ?? new Map(),
      admissionYear,
    })
  }

  if (isSemesterKey(recommended)) return recommended
  return null
}

function abeekToMapCourse(
  course: RoadmapCourse,
  admissionYear?: number,
  takenTermByCode?: Map<string, string>,
  standingByTaken?: Map<string, string>,
  termKey?: string,
): MapCourse | null {
  const semester = resolveDisplayTerm(
    termKey || course.recommendedTerm || '',
    course.takenYear,
    course.takenSemester,
    course.completed,
    admissionYear,
    takenTermByCode,
    course.abeekCourseCode,
    standingByTaken,
    course.standingTermKey,
  )
  if (!semester) return null

  const design =
    course.designCredits && course.designCredits > 0 ? `·설계${course.designCredits}` : ''

  return {
    id: course.abeekCourseCode,
    name: course.courseName,
    hours: `${course.credits}학점${design}`,
    category: mapAbeekCategory(course),
    semester,
    completed: course.completed === true,
  }
}

function generalToMapCourse(
  course: StudentRoadmapCourse,
  termKey: string,
): MapCourse | null {
  if (!course.courseCode) return null

  // 미이수: API term.termKey 그대로 (재계산·재정렬하지 않음)
  const semester = termKey.trim()
  if (!isSemesterKey(semester)) return null

  return {
    id: normalizeCourseCode(course.courseCode),
    name: course.courseName,
    hours: `${course.credits ?? 0}학점`,
    category: mapGeneralCategory(course),
    semester,
    completed: course.completed === true,
  }
}

function normalizeCourseName(name: string) {
  return name.replace(/\s+/g, '').toLowerCase()
}

/**
 * graduation-progress 기준 기이수 분류 집합.
 * 교양 = 선택·균형·total 잔여 등 (공통·학문·전공 전용 필드에 없는 기이수)
 */
function buildProgressCategoryIndex(progress: GraduationProgressResponse) {
  const common = new Set<string>()
  const academic = new Set<string>()
  const major = new Set<string>()
  const liberal = new Set<string>()
  const commonNames = new Set<string>()
  const academicNames = new Set<string>()
  const majorNames = new Set<string>()
  const liberalNames = new Set<string>()

  const ingest = (
    courses: Array<Record<string, unknown> | { courseCode?: string; courseName?: string }> | undefined,
    codes: Set<string>,
    names: Set<string>,
  ) => {
    for (const raw of courses ?? []) {
      const code = normalizeCourseCode(String(raw.courseCode ?? ''))
      const name = normalizeCourseName(String(raw.courseName ?? ''))
      if (code) codes.add(code)
      if (name) names.add(name)
    }
  }

  ingest(
    progress.commonLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    common,
    commonNames,
  )
  ingest(progress.commonLiberalCourses as Array<{ courseCode?: string; courseName?: string }> | undefined, common, commonNames)

  ingest(
    progress.academicFoundationCredits?.completedCourses as
      | Array<Record<string, unknown>>
      | undefined,
    academic,
    academicNames,
  )

  ingest(
    progress.majorFoundationCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    major,
    majorNames,
  )
  for (const summary of progress.categorySummaries ?? []) {
    const label = summary.category || ''
    if (!label.includes('전공')) continue
    ingest(summary.courses as Array<{ courseCode?: string; courseName?: string }> | undefined, major, majorNames)
  }

  ingest(
    progress.electiveLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    liberal,
    liberalNames,
  )
  ingest(
    progress.balancedLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    liberal,
    liberalNames,
  )
  for (const area of progress.balancedLiberalAreaProgresses ?? []) {
    ingest(area.courses as Array<{ courseCode?: string; courseName?: string }> | undefined, liberal, liberalNames)
  }
  ingest(
    progress.totalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    liberal,
    liberalNames,
  )

  // total에 섞인 공통·학문·전공은 교양 집합에서 제거
  for (const code of [...common, ...academic, ...major]) liberal.delete(code)
  for (const name of [...commonNames, ...academicNames, ...majorNames]) liberalNames.delete(name)

  return {
    common,
    academic,
    major,
    liberal,
    commonNames,
    academicNames,
    majorNames,
    liberalNames,
  }
}

function mapCategoryFromProgressIndex(
  code: string,
  name: string,
  index: ReturnType<typeof buildProgressCategoryIndex>,
): MapCategory | null {
  const nameKey = normalizeCourseName(name)
  if (index.common.has(code) || index.commonNames.has(nameKey)) return 'common'
  if (index.academic.has(code) || index.academicNames.has(nameKey)) return 'bsm'
  if (index.major.has(code) || index.majorNames.has(nameKey)) return 'major-required'
  if (index.liberal.has(code) || index.liberalNames.has(nameKey)) return 'liberal'
  return null
}

/**
 * 졸업진행 기이수:
 * - 공통교양 / 학문기초 / 전공: graduation-progress 전용 필드
 * - 교양: 기이수 중 위 셋에 속하지 않는 나머지 (선택·균형·K-MOOC 등)
 */
function liberalCoursesFromProgress(
  progress: GraduationProgressResponse | null | undefined,
  excludeCodes: Set<string>,
  takenTermByCode: Map<string, string>,
  standingByTaken?: Map<string, string>,
  options?: { includeRequiredOverlay?: boolean },
): MapCourse[] {
  if (!progress) return []
  const admissionYear = progress.admissionYear
  const result: MapCourse[] = []
  const seen = new Set<string>()
  const index = buildProgressCategoryIndex(progress)
  const includeRequiredOverlay = options?.includeRequiredOverlay === true

  const pushCompleted = (
    courses: Array<Record<string, unknown>> | undefined,
    category: MapCategory,
  ) => {
    for (const raw of courses ?? []) {
      const code = normalizeCourseCode(String(raw.courseCode ?? ''))
      const name = String(raw.courseName ?? '').trim()
      if (!code || !name || excludeCodes.has(code) || seen.has(code)) continue
      const cal = takenCalendarKey(
        raw.takenYear as string | number | null | undefined,
        raw.takenSemester as string | number | null | undefined,
      )
      const term =
        (cal ? standingByTaken?.get(cal) : undefined) ||
        takenTermByCode.get(code) ||
        takenTermByCode.get(String(raw.courseCode ?? '')) ||
        toTermKeyFromTaken(
          raw.takenYear as string | number | null | undefined,
          raw.takenSemester as string | number | null | undefined,
          admissionYear,
        )
      if (!term) continue
      seen.add(code)
      result.push({
        id: code,
        name,
        hours: `${toNumber((raw.credits ?? raw.credit) as string | number | undefined)}학점`,
        category,
        semester: term,
        completed: true,
      })
    }
  }

  // 전용 필드 → 공통교양 / 학문기초 / 전공 (본인 학과만)
  if (includeRequiredOverlay) {
    pushCompleted(
      progress.commonLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
      'common',
    )
    pushCompleted(
      progress.academicFoundationCredits?.completedCourses as
        | Array<Record<string, unknown>>
        | undefined,
      'bsm',
    )
    pushCompleted(
      progress.majorFoundationCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
      'major-required',
    )
    for (const summary of progress.categorySummaries ?? []) {
      if (!(summary.category || '').includes('전공')) continue
      pushCompleted(summary.courses as unknown as Array<Record<string, unknown>>, 'major-required')
    }
  }

  // 교양: 기이수 중 전공·학문기초·공통교양이 아닌 나머지 (교양선택은 로드맵에서 넣지 않음)
  pushCompleted(
    progress.electiveLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'liberal',
  )
  pushCompleted(
    progress.balancedLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'liberal',
  )
  for (const area of progress.balancedLiberalAreaProgresses ?? []) {
    pushCompleted(area.courses as unknown as Array<Record<string, unknown>>, 'liberal')
  }

  const residual = (
    (progress.totalCredits?.completedCourses as Array<Record<string, unknown>> | undefined) ?? []
  ).filter((raw) => {
    const code = normalizeCourseCode(String(raw.courseCode ?? ''))
    const nameKey = normalizeCourseName(String(raw.courseName ?? ''))
    if (!code || seen.has(code) || excludeCodes.has(code)) return false
    if (index.common.has(code) || index.academic.has(code) || index.major.has(code)) return false
    if (
      index.commonNames.has(nameKey) ||
      index.academicNames.has(nameKey) ||
      index.majorNames.has(nameKey)
    ) {
      return false
    }
    return true
  })
  pushCompleted(residual, 'liberal')

  // categorySummaries 잔여(전공 아님) → 교양 (라벨 퍼지로 공통/학문에 넣지 않음)
  for (const summary of progress.categorySummaries ?? []) {
    if ((summary.category || '').includes('전공')) continue
    const leftover = (
      summary.courses as unknown as Array<Record<string, unknown>> | undefined
    )?.filter((raw) => {
      const code = normalizeCourseCode(String(raw.courseCode ?? ''))
      const nameKey = normalizeCourseName(String(raw.courseName ?? ''))
      if (!code || seen.has(code)) return false
      if (index.common.has(code) || index.academic.has(code) || index.major.has(code)) return false
      if (
        index.commonNames.has(nameKey) ||
        index.academicNames.has(nameKey) ||
        index.majorNames.has(nameKey)
      ) {
        return false
      }
      return true
    })
    pushCompleted(leftover, 'liberal')
  }

  return result
}

function recommendedCommonLiberalTerm(courseCode?: string) {
  switch ((courseCode || '').trim()) {
    case 'GEN_SEMINAR_B':
    case 'GEN_MAJOR_EXPLORATION':
    case 'GEN_PHILOSOPHY':
    case 'GEN_UNIVERSE':
    case 'GEN_UNI_ENG_READING_2021':
    case 'GEN_WORLD_HISTORY_LEGACY':
      return '1-2'
    case 'GEN_STARTUP1':
      return '2-1'
    case 'GEN_CAREER_JOB':
      return '3-1'
    default:
      return '1-1'
  }
}

function remainingRequiredSlotsFromProgress(
  progress: GraduationProgressResponse | null | undefined,
  existing: Map<string, MapCourse>,
): MapCourse[] {
  if (!progress) return []
  const existingNames = new Set(
    [...existing.values()].map((course) => normalizeCourseName(course.name)),
  )
  const existingIds = new Set(existing.keys())
  const result: MapCourse[] = []

  const push = (
    code: string | undefined,
    name: string | undefined,
    credit: string | number | undefined,
    category: MapCategory,
    term: string | undefined,
  ) => {
    const trimmedName = (name || '').trim()
    if (!trimmedName) return
    const nameKey = normalizeCourseName(trimmedName)
    if (existingNames.has(nameKey)) return
    const id = normalizeCourseCode(code || '') || `REQ-${category}-${nameKey}`
    if (!id || existingIds.has(id)) return
    const semester = isSemesterKey(term) ? term.trim() : '1-1'
    existingNames.add(nameKey)
    existingIds.add(id)
    result.push({
      id,
      name: trimmedName,
      hours: `${toNumber(credit)}학점`,
      category,
      semester,
      completed: false,
    })
  }

  for (const item of progress.remainingCommonLiberalRequiredCourses ?? []) {
    const course = item.course
    push(
      course?.courseCode,
      course?.courseName,
      course?.credit,
      'common',
      recommendedCommonLiberalTerm(course?.courseCode),
    )
  }
  for (const course of progress.remainingAcademicFoundationRequiredCourses ?? []) {
    push(course.courseCode, course.courseName, course.credit, 'bsm', course.recommendedTerm)
  }

  return result
}

function normalizeDepartmentName(name?: string | null) {
  return (name || '').replace(/\s+/g, '').toLowerCase()
}

function collectOwnDepartmentNames(
  student?: {
    major?: string | null
    secondaryMajor?: string | null
    tracks?: Array<{ departmentCode?: string }>
  } | null,
  extraDepartments?: Array<string | null | undefined>,
) {
  const names: string[] = []
  const push = (name?: string | null) => {
    const normalized = normalizeDepartmentName(name)
    if (normalized && !names.includes(normalized)) names.push(normalized)
  }
  push(student?.major)
  push(student?.secondaryMajor)
  for (const track of student?.tracks ?? []) {
    push(track.departmentCode)
  }
  for (const name of extraDepartments ?? []) {
    push(name)
  }
  return names
}

function isOwnDepartmentRoadmap(
  selectedDepartment?: string | null,
  ownDepartments: string[] = [],
) {
  const selected = normalizeDepartmentName(selectedDepartment)
  if (!selected) return ownDepartments.length > 0
  return ownDepartments.includes(selected)
}

function flattenStudentRoadmapCourses(
  roadmap: StudentRoadmapResponse | null | undefined,
  options?: { ignoreCompleted?: boolean },
): Array<{ course: StudentRoadmapCourse; termKey: string }> {
  if (!roadmap) return []
  const list: Array<{ course: StudentRoadmapCourse; termKey: string }> = []
  const seen = new Set<string>()
  const ignoreCompleted = options?.ignoreCompleted === true

  for (const term of roadmap.terms ?? []) {
    const calendarTermKey = (term.termKey || '').trim()
    // 기이수: standing 우선 / 미이수: termKey 그대로 (달력·standing으로 덮지 않음)
    const completedTermKey = (term.standingTermKey || term.termKey || '').trim()
    const fromCourses = term.courses ?? []
    const fromCategories = Object.values(term.categories ?? {}).flat()
    // courses와 categories 모두 병합 (한쪽만 쓰면 GENERAL/BSM이 빠질 수 있음)
    const merged = [...fromCourses, ...fromCategories]

    for (const course of merged) {
      if (!course?.courseCode) continue
      const completed = !ignoreCompleted && course.completed === true
      const termKey = completed ? completedTermKey : calendarTermKey
      if (!termKey) continue
      const key = `${termKey}:${course.courseCode}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push({
        course: completed
          ? course
          : {
              ...course,
              completed: false,
              takenYear: undefined,
              takenSemester: undefined,
              standingTermKey: undefined,
              completedTermKey: undefined,
            },
        termKey,
      })
    }
  }
  return list
}

/** 긴 과목명: 괄호·영한 경계·구분자 앞에서만 줄바꿈 */
function CourseNameText({ name }: { name: string }) {
  const parts = name
    .split(
      /(?=[(\[])|(?<=[·/,:])|(?<=[A-Za-z0-9])(?=[가-힣])|(?<=[가-힣])(?=[A-Za-z0-9])/,
    )
    .filter(Boolean)
  return (
    <span className="break-keep [word-break:keep-all] [overflow-wrap:normal]">
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </span>
  )
}

function collectProgressTakenItems(
  progress: GraduationProgressResponse | null | undefined,
): Array<{
  completed: boolean
  takenYear?: number | string | null
  takenSemester?: number | string | null
}> {
  if (!progress) return []
  const out: Array<{
    completed: boolean
    takenYear?: number | string | null
    takenSemester?: number | string | null
  }> = []

  const ingest = (courses?: Array<Record<string, unknown>>) => {
    for (const raw of courses ?? []) {
      out.push({
        completed: true,
        takenYear: raw.takenYear as string | number | null | undefined,
        takenSemester: raw.takenSemester as string | number | null | undefined,
      })
    }
  }

  ingest(progress.commonLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined)
  ingest(progress.electiveLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined)
  ingest(
    progress.academicFoundationCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
  )
  ingest(
    progress.majorFoundationCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
  )
  ingest(
    progress.balancedLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
  )
  return out
}

export function CurriculumPage() {
  const { student } = useAuth()
  const { active, majorTracksProgress } = useMajorTrack()

  const [viewKind, setViewKind] = useState<ViewKind>('general')
  const [departmentName, setDepartmentName] = useState(student?.major || '')
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(
    student?.major ? [student.major] : [],
  )
  const [generalRoadmap, setGeneralRoadmap] = useState<StudentRoadmapResponse | null>(null)
  const [abeekRoadmap, setAbeekRoadmap] = useState<FullRoadmapResponse | null>(null)
  const [graduation, setGraduation] = useState<GraduationProgressResponse | null>(null)
  const [abeekEvaluation, setAbeekEvaluation] = useState<AbeekEvaluationResponse | null>(null)
  const [generalLoading, setGeneralLoading] = useState(true)
  const [abeekLoading, setAbeekLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'all' | 'mine'>('all')
  const [filter, setFilter] = useState<string | null>(null)
  const [paths, setPaths] = useState<Array<{ d: string; type: MapEdge['type']; key: string }>>([])
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const [boardSize, setBoardSize] = useState({ w: BOARD_MIN_WIDTH, h: 600 })

  const ownDepartments = useMemo(
    () =>
      collectOwnDepartmentNames(student, [
        active?.department,
        ...majorTracksProgress.map((track) => track.department),
      ]),
    [student, active?.department, majorTracksProgress],
  )
  const isOwnDepartment = isOwnDepartmentRoadmap(departmentName, ownDepartments)

  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const zoomRef = useRef(zoom)
  const dragRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  zoomRef.current = zoom

  const abeekTarget = generalRoadmap?.abeekTarget === true
  const abeekDepartmentCode =
    generalRoadmap?.abeekDepartmentCode ||
    student?.tracks?.find((t) => t.departmentCode === active?.department)?.departmentCode ||
    student?.tracks?.[0]?.departmentCode

  const resetView = () => {
    setZoom(1)
    zoomRef.current = 1
    const viewport = viewportRef.current
    if (viewport) {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    }
  }

  useEffect(() => {
    if (student?.major) setDepartmentName((prev) => prev || student.major)
  }, [student?.major])

  useEffect(() => {
    resetView()
    setFilter(null)
  }, [viewKind, departmentName])

  useEffect(() => {
    if (viewKind === 'abeek' && !abeekTarget) setViewKind('general')
  }, [viewKind, abeekTarget])

  useEffect(() => {
    if (!student?.id) {
      setGraduation(null)
      setAbeekEvaluation(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const abeekId = student.studentNo || String(student.id)
      try {
        const [grad, abeek] = await Promise.all([
          getGraduationProgress(student.id),
          getAbeekEvaluation(abeekId).catch(() => null),
        ])
        if (!cancelled) {
          setGraduation(grad)
          setAbeekEvaluation(abeek)
        }
      } catch {
        if (!cancelled) {
          setGraduation(null)
          setAbeekEvaluation(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [student?.id, student?.studentNo])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, select, input')) return

    const viewport = viewportRef.current
    if (!viewport) return

    e.preventDefault()
    window.getSelection()?.removeAllRanges()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
    setPanning(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!panning) return
    const viewport = viewportRef.current
    if (!viewport) return
    e.preventDefault()

    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    let nextLeft = dragRef.current.scrollLeft - (e.clientX - dragRef.current.x)
    let nextTop = dragRef.current.scrollTop - (e.clientY - dragRef.current.y)

    // 끝에서는 더 이상 이동하지 않음 (일반·공학인증 공통)
    if (nextLeft < 0 || nextLeft > maxLeft) {
      nextLeft = Math.max(0, Math.min(maxLeft, nextLeft))
      dragRef.current.scrollLeft = nextLeft
      dragRef.current.x = e.clientX
    }
    if (nextTop < 0 || nextTop > maxTop) {
      nextTop = Math.max(0, Math.min(maxTop, nextTop))
      dragRef.current.scrollTop = nextTop
      dragRef.current.y = e.clientY
    }

    viewport.scrollLeft = nextLeft
    viewport.scrollTop = nextTop
  }

  const endPan = (e: PointerEvent<HTMLDivElement>) => {
    if (!panning) return
    setPanning(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await getMajorOptions()
        if (cancelled || !Array.isArray(list) || list.length === 0) return
        const names = list.map((d) => d.name).filter(Boolean)
        setDepartmentOptions(names)
        setDepartmentName((prev) => {
          if (prev && names.includes(prev)) return prev
          if (student?.major && names.includes(student.major)) return student.major
          return names[0] || prev
        })
      } catch {
        // keep default
      }
    })()
    return () => {
      cancelled = true
    }
  }, [student?.major])

  // 기본: 시간표 기반 일반 로드맵
  useEffect(() => {
    if (!departmentName && !student?.id) {
      setGeneralLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setGeneralLoading(true)
      setError(null)
      try {
        let data: StudentRoadmapResponse
        if (student?.id && isOwnDepartment) {
          try {
            if (!departmentName || departmentName === student.major) {
              data = await getStudentRoadmapByStudent(student.id)
            } else {
              data = await getStudentRoadmap(departmentName, student.id)
            }
          } catch {
            if (!departmentName) throw new Error('학과 정보를 확인할 수 없습니다.')
            data = await getStudentRoadmap(departmentName, student.id)
          }
        } else if (departmentName) {
          // 타학과: 본인 이수(공통교양·학문기초·전공)를 붙이지 않음
          data = await getStudentRoadmap(departmentName)
        } else {
          throw new Error('학과를 선택해 주세요.')
        }

        if (!cancelled) {
          setGeneralRoadmap(data)
          if (data.departmentName && !departmentName) {
            setDepartmentName(data.departmentName)
          }
          if (data.departmentName) {
            setDepartmentOptions((prev) =>
              prev.includes(data.departmentName!) ? prev : [...prev, data.departmentName!],
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGeneralRoadmap(null)
          setError(err instanceof Error ? err.message : '로드맵을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setGeneralLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [departmentName, isOwnDepartment, student?.id, student?.major])

  // 공학인증 로드맵 (버튼으로 전환 시에만)
  useEffect(() => {
    if (viewKind !== 'abeek') {
      setAbeekRoadmap(null)
      setAbeekLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setAbeekLoading(true)
      setError(null)
      try {
        const abeekId = student?.studentNo || (student ? String(student.id) : undefined)
        let data: FullRoadmapResponse

        if (abeekId) {
          try {
            data = await getAbeekFullRoadmapByStudent(abeekId)
          } catch {
            if (!abeekDepartmentCode) throw new Error('공학인증 학과 코드가 없습니다.')
            data = await getAbeekFullRoadmap({
              departmentCode: abeekDepartmentCode,
              curriculumYear: student?.admissionYear || new Date().getFullYear(),
              studentId: abeekId,
            })
          }
        } else {
          if (!abeekDepartmentCode) throw new Error('공학인증 학과 코드가 없습니다.')
          data = await getAbeekFullRoadmap({
            departmentCode: abeekDepartmentCode,
            curriculumYear: new Date().getFullYear(),
          })
        }

        if (!cancelled) setAbeekRoadmap(data)
      } catch (err) {
        if (!cancelled) {
          setAbeekRoadmap(null)
          setError(err instanceof Error ? err.message : '공학인증 로드맵을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setAbeekLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viewKind, student, abeekDepartmentCode])

  const loading = viewKind === 'abeek' ? abeekLoading : generalLoading

  const abeekRawCourses = useMemo(() => flattenRoadmapCourses(abeekRoadmap), [abeekRoadmap])
  const generalFlat = useMemo(
    () => flattenStudentRoadmapCourses(generalRoadmap, { ignoreCompleted: !isOwnDepartment }),
    [generalRoadmap, isOwnDepartment],
  )

  const edges = useMemo(
    () => [] as MapEdge[],
    [],
  )

  const allCourses = useMemo(() => {
    const applyOwnProgress = isOwnDepartment
    const overlayProgress = applyOwnProgress ? graduation : null
    const admissionYear = graduation?.admissionYear ?? student?.admissionYear
    const progressTaken = collectProgressTakenItems(graduation)

    const generalStandingByTaken = buildStandingByTakenOrder([
      ...generalFlat.map(({ course }) => ({
        completed: course.completed,
        takenYear: course.takenYear,
        takenSemester: course.takenSemester,
      })),
      ...progressTaken,
    ])

    const abeekTermItems: Array<{
      course: RoadmapCourse
      termKey: string
    }> = []
    for (const term of abeekRoadmap?.terms ?? []) {
      const termKey = (term.termKey || '').trim()
      for (const courses of Object.values(term.categories ?? {})) {
        if (!Array.isArray(courses)) continue
        for (const course of courses) {
          abeekTermItems.push({ course, termKey })
        }
      }
    }
    for (const course of abeekRoadmap?.unscheduledCourses ?? []) {
      abeekTermItems.push({ course, termKey: course.recommendedTerm || '' })
    }

    const abeekStandingByTaken = buildStandingByTakenOrder([
      ...abeekTermItems.map(({ course }) => ({
        completed: course.completed,
        takenYear: course.takenYear,
        takenSemester: course.takenSemester,
      })),
      ...progressTaken,
    ])

    const standingByTaken =
      viewKind === 'abeek' ? abeekStandingByTaken : generalStandingByTaken
    const takenTermByCode = buildTakenTermMap(graduation, standingByTaken)

    // ABEEK 뷰용: 이수 과목 taken → 순번 보강
    for (const { course, termKey } of abeekTermItems) {
      if (!course.completed || !course.abeekCourseCode || takenTermByCode.has(course.abeekCourseCode)) {
        continue
      }
      const term = pickCompletedDisplayTerm({
        termKeys: [termKey, course.recommendedTerm || ''].filter(Boolean),
        takenYear: course.takenYear,
        takenSemester: course.takenSemester,
        courseStanding: course.standingTermKey,
        standingByTaken: abeekStandingByTaken,
        admissionYear,
      })
      if (term) takenTermByCode.set(course.abeekCourseCode, term)
    }

    if (viewKind === 'abeek') {
      const byId = new Map<string, MapCourse>()
      for (const { course, termKey } of abeekTermItems) {
        const mapped = abeekToMapCourse(
          course,
          admissionYear,
          takenTermByCode,
          abeekStandingByTaken,
          termKey || course.recommendedTerm,
        )
        if (!mapped) continue
        const existing = byId.get(mapped.id)
        if (!existing || (mapped.completed && !existing.completed)) {
          byId.set(mapped.id, mapped)
        } else if (mapped.completed && existing.completed) {
          byId.set(mapped.id, mapped)
        }
      }
      return [...byId.values()]
    }

    // 학수번호별 API 칸 모아서 이수순번/중복 정리
    const grouped = new Map<string, Array<{ course: StudentRoadmapCourse; termKey: string }>>()
    for (const item of generalFlat) {
      const code = normalizeCourseCode(item.course.courseCode || '')
      if (!code) continue
      const list = grouped.get(code) ?? []
      list.push(item)
      grouped.set(code, list)
    }

    const fromTimetable: MapCourse[] = []
    for (const [, instances] of grouped) {
      const completedInst = instances.find((i) => i.course.completed === true)
      const representative = completedInst ?? instances[0]
      // 교양선택 등 로드맵 교양은 넣지 않음. 교양 행은 기이수 잔여만
      if (representative && mapGeneralCategory(representative.course) === 'liberal') continue
      if (completedInst) {
        const termKeys = instances.map((i) => i.termKey)
        const semester = pickCompletedDisplayTerm({
          termKeys,
          takenYear: completedInst.course.takenYear,
          takenSemester: completedInst.course.takenSemester,
          courseStanding:
            completedInst.course.standingTermKey || completedInst.course.completedTermKey,
          standingByTaken: generalStandingByTaken,
          admissionYear,
        })
        if (!semester) continue
        fromTimetable.push({
          id: normalizeCourseCode(completedInst.course.courseCode),
          name: completedInst.course.courseName,
          hours: `${completedInst.course.credits ?? 0}학점`,
          category: mapGeneralCategory(completedInst.course),
          semester,
          completed: true,
        })
        continue
      }

      // incomplete 동일 courseCode 중복: last-wins 금지 → 앞쪽 학기(termKey) 하나만
      const preferred = instances
        .slice()
        .sort((a, b) => semesterOrder(a.termKey) - semesterOrder(b.termKey))[0]
      const mapped = generalToMapCourse(preferred.course, preferred.termKey)
      if (mapped) fromTimetable.push(mapped)
    }

    // last-wins Map 대신 이수 우선·동일하면 앞쪽 학기 유지
    const byId = new Map<string, MapCourse>()
    for (const course of fromTimetable) {
      const existing = byId.get(course.id)
      if (!existing) {
        byId.set(course.id, course)
        continue
      }
      if (course.completed && !existing.completed) {
        byId.set(course.id, course)
        continue
      }
      if (course.completed === existing.completed) {
        if (semesterOrder(course.semester) < semesterOrder(existing.semester)) {
          byId.set(course.id, course)
        }
      }
    }
    const protectedCodes = new Set(
      [...byId.values()]
        .filter(
          (c) =>
            c.category.startsWith('major') || c.category === 'bsm' || c.category === 'common',
        )
        .map((c) => c.id),
    )
    const liberalExtra = liberalCoursesFromProgress(
      graduation,
      protectedCodes,
      takenTermByCode,
      generalStandingByTaken,
      { includeRequiredOverlay: applyOwnProgress },
    )
    for (const course of liberalExtra) {
      const existing = byId.get(course.id)
      if (existing) {
        // progress 전용 필드(공통/학문/전공)만 덮어씀. 교양 잔여로는 전공·학문기초를 내리지 않음
        if (course.category === 'liberal') {
          if (existing.category === 'liberal' || existing.category === 'common') {
            existing.category = 'liberal'
          }
        } else {
          existing.category = course.category
        }
        if (course.completed && course.semester) {
          existing.completed = true
          existing.semester = course.semester
        }
        continue
      }
      byId.set(course.id, course)
    }

    for (const course of remainingRequiredSlotsFromProgress(overlayProgress, byId)) {
      byId.set(course.id, course)
    }

    // progress에 명시된 분류만 확정. 매칭 실패 시 전공·학문기초는 유지
    if (overlayProgress) {
      const index = buildProgressCategoryIndex(overlayProgress)
      for (const course of byId.values()) {
        if (!course.completed) continue
        const hit = mapCategoryFromProgressIndex(course.id, course.name, index)
        if (hit) {
          course.category = hit
          continue
        }
        // 공통으로 잘못 들어간 기이수만 교양으로 (전공·학문기초는 건드리지 않음)
        if (course.category === 'common') {
          course.category = 'liberal'
        }
      }
    }

    // 동일 학기·동일 과목명 중복(학수번호 표기 차이) 제거 — 이수 우선
    const byNameSem = new Map<string, MapCourse>()
    for (const course of byId.values()) {
      const key = `${course.semester}::${course.name.replace(/\s+/g, '')}`
      const existing = byNameSem.get(key)
      if (!existing) {
        byNameSem.set(key, course)
        continue
      }
      if (course.completed && !existing.completed) {
        byNameSem.set(key, course)
      }
    }
    return [...byNameSem.values()]
  }, [
    viewKind,
    abeekRawCourses,
    abeekRoadmap,
    generalFlat,
    isOwnDepartment,
    graduation,
    student?.admissionYear,
  ])

  const courseAlertIndex = useMemo(() => {
    const designCodes = new Set<string>()
    const designNames = new Set<string>()
    for (const c of abeekEvaluation?.designDetail?.courses ?? []) {
      if (c.recognized !== false) continue
      if (c.courseCode?.trim()) designCodes.add(c.courseCode.trim())
      if (c.courseName?.trim()) designNames.add(normalizeAlertKey(c.courseName))
    }

    const failCodes = new Set<string>()
    const failNames = new Set<string>()
    const markFail = (code?: string | null, name?: string | null, grade?: string | null) => {
      if (!isFailGrade(grade)) return
      if (code?.trim()) failCodes.add(code.trim())
      if (name?.trim()) failNames.add(normalizeAlertKey(name))
    }

    for (const { course } of generalFlat) {
      markFail(course.courseCode, course.courseName, course.grade)
    }
    for (const course of abeekRawCourses) {
      markFail(course.abeekCourseCode, course.courseName, course.grade)
    }

    return { designCodes, designNames, failCodes, failNames }
  }, [abeekEvaluation, generalFlat, abeekRawCourses])

  const allCoursesWithAlerts = useMemo(() => {
    // 느낌표(!)는 공학인증 로드맵에서만 표시
    if (viewKind !== 'abeek') return allCourses
    const { designCodes, designNames, failCodes, failNames } = courseAlertIndex
    return allCourses.map((course) => {
      const nameKey = normalizeAlertKey(course.name)
      const designHit = designCodes.has(course.id) || designNames.has(nameKey)
      const failHit = failCodes.has(course.id) || failNames.has(nameKey)
      if (!designHit && !failHit) return course
      return {
        ...course,
        showAlert: true,
        alertReason: failHit
          ? 'F 성적'
          : '설계학점 불인정 (이수했으나 설계학점 미인정)',
      }
    })
  }, [allCourses, courseAlertIndex, viewKind])

  const activeRowDefs = viewKind === 'abeek' ? abeekRowDefs : generalRowDefs
  const presentCategories = useMemo(() => {
    const set = new Set<MapCategory>()
    for (const course of allCoursesWithAlerts) {
      if (!isSemesterKey(course.semester)) continue
      set.add(course.category)
    }
    return set
  }, [allCoursesWithAlerts])
  const visibleRowDefs = useMemo(
    () =>
      activeRowDefs.filter((row) =>
        row.categories.some((category) => presentCategories.has(category)),
      ),
    [activeRowDefs, presentCategories],
  )

  useEffect(() => {
    if (!filter) return
    if (filter === 'major') {
      if (
        !presentCategories.has('major-required') &&
        !presentCategories.has('major-elective')
      ) {
        setFilter(null)
      }
      return
    }
    if (!presentCategories.has(filter as MapCategory)) setFilter(null)
  }, [filter, presentCategories])

  const hasCompletionData = useMemo(
    () => allCoursesWithAlerts.some((c) => c.completed === true),
    [allCoursesWithAlerts],
  )

  const courses = useMemo(() => {
    let list = allCoursesWithAlerts
    if (mode === 'mine') list = list.filter((c) => c.completed)
    if (filter === 'liberal') list = list.filter((c) => c.category === 'liberal')
    if (filter === 'common') list = list.filter((c) => c.category === 'common')
    if (filter === 'bsm') list = list.filter((c) => c.category === 'bsm')
    if (filter === 'major') {
      list = list.filter((c) => c.category === 'major-required' || c.category === 'major-elective')
    }
    if (filter === 'major-required') list = list.filter((c) => c.category === 'major-required')
    if (filter === 'major-elective') list = list.filter((c) => c.category === 'major-elective')
    return list
  }, [allCoursesWithAlerts, mode, filter])

  const visibleIds = useMemo(() => new Set(courses.map((c) => c.id)), [courses])

  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)),
    [edges, visibleIds],
  )

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return

    const update = () => {
      const boardRect = board.getBoundingClientRect()
      const scaleX = board.offsetWidth > 0 ? boardRect.width / board.offsetWidth : 1
      const scaleY = board.offsetHeight > 0 ? boardRect.height / board.offsetHeight : 1
      const positions: Record<string, NodePos> = {}

      Object.entries(nodeRefs.current).forEach(([id, el]) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const x1 = (r.left - boardRect.left) / scaleX
        const y1 = (r.top - boardRect.top) / scaleY
        const x2 = (r.right - boardRect.left) / scaleX
        const y2 = (r.bottom - boardRect.top) / scaleY
        positions[id] = {
          x1,
          y1,
          x2,
          y2,
          cx: (x1 + x2) / 2,
          cy: (y1 + y2) / 2,
        }
      })

      const next = visibleEdges
        .map((edge, index) => {
          const from = positions[edge.from]
          const to = positions[edge.to]
          if (!from || !to) return null
          const bendOffset = ((index % 5) - 2) * 6
          return {
            key: `${edge.from}-${edge.to}`,
            type: edge.type,
            d: buildOrthogonalPath(from, to, bendOffset),
          }
        })
        .filter(Boolean) as Array<{ d: string; type: MapEdge['type']; key: string }>

      setPaths(next)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(board)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
    }
  }, [visibleEdges, courses, mode, filter, viewKind, departmentName])

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board || loading || error || allCourses.length === 0) return

    const update = () => {
      // transform 이전 레이아웃 크기 — minWidth만으로 불필요하게 키우지 않음
      const w = Math.max(board.scrollWidth, board.offsetWidth)
      const h = Math.max(board.scrollHeight, board.offsetHeight, 280)
      setBoardSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(board)
    return () => observer.disconnect()
  }, [loading, error, allCourses.length, visibleRowDefs.length, courses, mode, filter, viewKind, departmentName])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || loading || error || allCourses.length === 0) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const prevZoom = zoomRef.current
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const nextZoom = Math.min(2.5, Math.max(0.45, prevZoom * factor))
      if (nextZoom === prevZoom) return

      const contentX = (viewport.scrollLeft + mx - VIEW_MARGIN) / prevZoom
      const contentY = (viewport.scrollTop + my - VIEW_MARGIN) / prevZoom

      zoomRef.current = nextZoom
      setZoom(nextZoom)

      requestAnimationFrame(() => {
        viewport.scrollLeft = contentX * nextZoom + VIEW_MARGIN - mx
        viewport.scrollTop = contentY * nextZoom + VIEW_MARGIN - my
      })
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [loading, error, allCourses.length])

  const titleLabel =
    viewKind === 'abeek'
      ? `${departmentName || '학과'} 공학인증 로드맵`
      : `${departmentName || '학과'} 로드맵`

  return (
    <AppShell>
      <main className="flex-1 overflow-auto px-4 py-5 md:px-8 md:py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold text-ink md:text-3xl">이수체계도</h1>
            <MajorTrackSwitcher />
            <div className="flex overflow-hidden rounded-full border border-[#ddd] text-sm font-semibold">
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`px-4 py-1.5 ${mode === 'all' ? 'bg-sejong text-white' : 'bg-white text-ink'}`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setMode('mine')}
                className={`px-4 py-1.5 ${mode === 'mine' ? 'bg-sejong text-white' : 'bg-white text-ink'}`}
              >
                마이
              </button>
            </div>
            {isAdminUser(student) && (
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                학과
                <select
                  value={departmentName}
                  onChange={(e) => {
                    setDepartmentName(e.target.value)
                    setViewKind('general')
                  }}
                  className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-sejong/30"
                >
                  {departmentOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {abeekTarget && (
              <div className="flex overflow-hidden rounded-full border border-[#ddd] text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setViewKind('general')
                    setFilter(null)
                  }}
                  className={`px-4 py-1.5 ${
                    viewKind === 'general' ? 'bg-ink text-white' : 'bg-white text-ink'
                  }`}
                >
                  일반 로드맵
                </button>
                <button
                  type="button"
                  onClick={() => setViewKind('abeek')}
                  className={`px-4 py-1.5 ${
                    viewKind === 'abeek' ? 'bg-sejong text-white' : 'bg-white text-ink'
                  }`}
                >
                  공학인증
                </button>
              </div>
            )}
          </div>
        </div>



        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[#e5e5ea] py-3.5">
          <span className="shrink-0 text-sm font-medium text-ink">체계표 안내</span>
          <div className="flex flex-wrap items-center gap-2">
            {viewKind === 'abeek' ? (
              <>
                {presentCategories.has('liberal') && (
                  <LegendPill
                    active={filter === 'liberal'}
                    onClick={() => setFilter(filter === 'liberal' ? null : 'liberal')}
                    className="bg-[#64748b] text-white"
                    label="전문교양"
                  />
                )}
                {presentCategories.has('bsm') && (
                  <LegendPill
                    active={filter === 'bsm'}
                    onClick={() => setFilter(filter === 'bsm' ? null : 'bsm')}
                    className="bg-[#0f766e] text-white"
                    label="BSM(기초수학, 과학)"
                  />
                )}
              </>
            ) : (
              <>
                {presentCategories.has('liberal') && (
                  <LegendPill
                    active={filter === 'liberal'}
                    onClick={() => setFilter(filter === 'liberal' ? null : 'liberal')}
                    className="bg-[#64748b] text-white"
                    label="교양"
                  />
                )}
                {presentCategories.has('common') && (
                  <LegendPill
                    active={filter === 'common'}
                    onClick={() => setFilter(filter === 'common' ? null : 'common')}
                    className="bg-[#0369a1] text-white"
                    label="공통교양"
                  />
                )}
                {presentCategories.has('bsm') && (
                  <LegendPill
                    active={filter === 'bsm'}
                    onClick={() => setFilter(filter === 'bsm' ? null : 'bsm')}
                    className="bg-[#0f766e] text-white"
                    label="학문기초"
                  />
                )}
                {presentCategories.has('major-required') && (
                  <LegendPill
                    active={filter === 'major-required'}
                    onClick={() => setFilter(filter === 'major-required' ? null : 'major-required')}
                    className="border-2 border-sejong bg-white text-sejong"
                    label="전공필수"
                  />
                )}
                {presentCategories.has('major-elective') && (
                  <LegendPill
                    active={filter === 'major-elective'}
                    onClick={() => setFilter(filter === 'major-elective' ? null : 'major-elective')}
                    className="bg-sejong-pink text-ink"
                    label="전공선택"
                  />
                )}
              </>
            )}
            {viewKind === 'abeek' && (
              <>
                {presentCategories.has('major-required') && (
                  <LegendPill
                    active={filter === 'major-required'}
                    onClick={() => setFilter(filter === 'major-required' ? null : 'major-required')}
                    className="border-2 border-sejong bg-white text-sejong"
                    label="전공필수"
                  />
                )}
                {presentCategories.has('major-elective') && (
                  <LegendPill
                    active={filter === 'major-elective'}
                    onClick={() => setFilter(filter === 'major-elective' ? null : 'major-elective')}
                    className="bg-sejong-pink text-ink"
                    label="전공선택"
                  />
                )}
              </>
            )}
          </div>
          {viewKind === 'abeek' && (
            <div className="ml-auto flex flex-wrap items-end gap-4">
              <p className="pb-0.5 text-xs text-ink-muted">휠: 확대/축소 · 드래그·스크롤: 이동</p>
            </div>
          )}
          {viewKind === 'general' && (
            <p className="ml-auto pb-0.5 text-xs text-ink-muted">휠: 확대/축소 · 드래그·스크롤: 이동</p>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          {loading ? (
            <p className="py-16 text-center text-sm text-ink-muted">{titleLabel}을 불러오는 중...</p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-sejong">{error}</p>
          ) : allCourses.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-muted">
              {departmentName || '선택 학과'} 로드맵 과목이 없습니다.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-[#eee] px-4 py-2">
                <p className="text-sm font-semibold text-ink">{titleLabel}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(0.45, zoomRef.current / 1.12)
                      zoomRef.current = next
                      setZoom(next)
                    }}
                    className="rounded-lg border border-[#e5e7eb] px-2.5 py-1 text-sm font-semibold text-ink hover:bg-surface"
                  >
                    −
                  </button>
                  <span className="min-w-12 text-center text-xs font-semibold text-ink-muted">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(2.5, zoomRef.current * 1.12)
                      zoomRef.current = next
                      setZoom(next)
                    }}
                    className="rounded-lg border border-[#e5e7eb] px-2.5 py-1 text-sm font-semibold text-ink hover:bg-surface"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={resetView}
                    className="rounded-lg border border-[#e5e7eb] px-3 py-1 text-xs font-semibold text-ink hover:bg-surface"
                  >
                    초기화
                  </button>
                </div>
              </div>

              <div
                ref={viewportRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onDragStart={(e) => e.preventDefault()}
                className={`relative h-[min(62vh,760px)] touch-none select-none overflow-auto overscroll-none md:h-[min(72vh,760px)] ${
                  panning ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <div
                  style={{
                    boxSizing: 'border-box',
                    width: Math.max(boardSize.w, BOARD_MIN_WIDTH) * zoom + VIEW_MARGIN * 2,
                    height: boardSize.h * zoom + VIEW_MARGIN * 2,
                    padding: VIEW_MARGIN,
                  }}
                >
                  <div
                    ref={boardRef}
                    className="relative origin-top-left will-change-transform"
                    style={{
                      width: Math.max(boardSize.w, BOARD_MIN_WIDTH),
                      minWidth: BOARD_MIN_WIDTH,
                      transform: `scale(${zoom})`,
                      transformOrigin: '0 0',
                      paddingRight: 12,
                      paddingBottom: 16,
                    }}
                  >
                  <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
                    <defs>
                      <marker
                        id="arrow-required"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
                      </marker>
                      <marker
                        id="arrow-optional"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
                      </marker>
                    </defs>
                    {paths.map((path) => (
                      <path
                        key={path.key}
                        d={path.d}
                        fill="none"
                        stroke={path.type === 'required' ? '#555' : '#888'}
                        strokeWidth="1.5"
                        strokeDasharray={path.type === 'optional' ? '5 4' : undefined}
                        markerEnd={`url(#arrow-${path.type})`}
                      />
                    ))}
                  </svg>

                  <div className={`relative z-10 mb-3 ${ROADMAP_GRID}`}>
                    <div />
                    {SEMESTERS.map((s) => (
                      <div key={s} className="text-center text-sm font-bold text-ink">
                        {s}
                      </div>
                    ))}
                  </div>

                  {visibleRowDefs.map((row) => (
                    <div key={row.key} className={`relative z-10 mb-4 ${ROADMAP_GRID}`}>
                      <div className="flex w-[5.5rem] items-start justify-center pt-1">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-center text-[11px] font-bold text-ink ${row.border}`}
                        >
                          {row.label}
                        </span>
                      </div>
                      {SEMESTERS.map((semester) => {
                        const cellCourses = courses.filter(
                          (c) =>
                            c.semester === semester &&
                            (row.categories as readonly MapCategory[]).includes(c.category),
                        )
                        const isFirstMajor = row.key === 'major' && semester === '1-1'
                        const showPrereqBox =
                          viewKind === 'abeek' && isFirstMajor && cellCourses.length > 0

                        return (
                          <div
                            key={`${row.key}-${semester}`}
                            className={`relative w-full min-w-0 space-y-1.5 rounded-xl p-1 ${
                              showPrereqBox
                                ? 'h-fit border border-dashed border-sejong bg-sejong-light/40'
                                : ''
                            }`}
                          >
                            {showPrereqBox && (
                              <p className="text-center text-[10px] font-semibold leading-tight text-sejong">
                                모든 전공의 선수 과목
                              </p>
                            )}
                            {cellCourses.map((course) => (
                              <div
                                key={`${course.id}-${course.semester}`}
                                ref={(el) => {
                                  nodeRefs.current[course.id] = el
                                }}
                                title={`${course.name} ${course.hours}${
                                  course.completed ? ' · 이수' : ''
                                }${
                                  course.category === 'major-required' && !course.completed
                                    ? ' · 전공필수'
                                    : ''
                                }${course.alertReason ? ` · ${course.alertReason}` : ''}`}
                                className={`relative box-border flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 px-2.5 py-1.5 text-center shadow-sm ${courseBadgeClass(
                                  course,
                                  hasCompletionData,
                                  row.key,
                                )}`}
                              >
                                {course.category === 'major-required' && !course.completed && (
                                  <span className="absolute -top-1.5 right-1 rounded-full bg-[#c8012e] px-1.5 py-[1px] text-[9px] font-bold leading-none text-white">
                                    필수
                                  </span>
                                )}
                                {course.completed && (
                                  <span
                                    className={`absolute -top-1.5 right-1 rounded-full px-1.5 py-[1px] text-[9px] font-bold leading-none ${completedChipClass(course.category, row.key)}`}
                                  >
                                    이수
                                  </span>
                                )}
                                <p
                                  className={`w-full font-semibold leading-snug ${
                                    course.name.length >= 14 ? 'text-[10px]' : 'text-[10.5px]'
                                  }`}
                                >
                                  <CourseNameText name={course.name} />
                                </p>
                                <div className="flex items-center justify-center gap-1 whitespace-nowrap text-[10px] font-medium opacity-90">
                                  <span>{course.hours}</span>
                                  {course.showAlert && (
                                    <span
                                      title={course.alertReason}
                                      className={`inline-flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold ${
                                        course.completed
                                          ? 'bg-white text-sejong'
                                          : 'bg-sejong text-white'
                                      }`}
                                    >
                                      !
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}

function LegendPill({
  label,
  className,
  active,
  onClick,
}: {
  label: string
  className: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${className} ${
        active ? 'ring-2 ring-offset-1 ring-ink' : ''
      }`}
    >
      {label}
    </button>
  )
}
