import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  getAbeekFullRoadmap,
  getAbeekFullRoadmapByStudent,
  getGraduationProgress,
  getMajorOptions,
  getStudentRoadmap,
  getStudentRoadmapByStudent,
} from '../api/endpoints'
import type {
  FullRoadmapResponse,
  GraduationProgressResponse,
  RoadmapCourse,
  StudentRoadmapCourse,
  StudentRoadmapResponse,
} from '../api/types'
import { flattenRoadmapCourses } from '../api/types'
import { Sidebar } from '../components/layout/Sidebar'
import { MajorTrackSwitcher } from '../components/modals/MajorTrackSwitcher'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
import { toNumber } from '../utils/number'

const SEMESTERS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'] as const

/** 행마다 auto 라벨 폭이 달라 학기 열이 어긋나지 않도록 고정 */
const ROADMAP_GRID =
  'grid grid-cols-[5.5rem_repeat(8,minmax(132px,1fr))] gap-2 items-start'

/** 뷰포트 끝에서 보이는 최소 여백 (잘림 방지, 과한 공백 축소) */
const VIEW_MARGIN = 20
const BOARD_MIN_WIDTH = 1480

type MapCategory = 'liberal' | 'bsm' | 'major-required' | 'major-elective'
type ViewKind = 'general' | 'abeek'

type MapCourse = {
  id: string
  name: string
  hours: string
  category: MapCategory
  semester: string
  completed: boolean
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

const categoryStyle: Record<MapCategory, string> = {
  liberal: 'border-transparent bg-[#e8eaee] text-ink',
  bsm: 'border-transparent bg-[#4a5568] text-white',
  'major-required': 'border-sejong bg-white text-sejong',
  'major-elective': 'border-transparent bg-sejong-pink text-ink',
}

function courseBadgeClass(course: MapCourse, hasCompletionData: boolean): string {
  // 이수한 과목은 카테고리와 무관하게 빨간색 (테두리는 정렬용으로 유지)
  if (course.completed) {
    return 'border-transparent bg-sejong text-white shadow-[0_0_0_1px_rgba(200,1,46,0.25)]'
  }

  if (course.category === 'major-required') {
    return `${categoryStyle['major-required']} ${hasCompletionData ? 'opacity-70' : ''}`
  }

  if (course.category === 'major-elective') {
    return `${categoryStyle['major-elective']} ${hasCompletionData ? 'opacity-55' : ''}`
  }

  // 교양·기초필수(BSM): 카테고리 고유 색 유지 (미이수 opacity로 회색빛 나지 않게)
  return categoryStyle[course.category]
}

/** 일반(시간표) 로드맵: 교양 / 기초필수 / 전공 */
const generalRowDefs: RowDef[] = [
  { key: 'liberal', label: '교양', categories: ['liberal'], border: 'border-[#c5c9d0]' },
  { key: 'foundation', label: '기초필수', categories: ['bsm'], border: 'border-[#4a5568]' },
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
function isFoundationRequiredLabel(label: string) {
  return (
    label.includes('기초필수') ||
    label.includes('교양필수') ||
    label.includes('공통교양') ||
    label.includes('대학필수') ||
    label.includes('필수교양') ||
    label.includes('학문기초') ||
    (label.includes('기초') && label.includes('필수')) ||
    (label.includes('교양') && label.includes('필수')) ||
    (label.includes('공통') && label.includes('필수'))
  )
}

/** 일반 로드맵: 공학인증 bucket + 시간표 이수구분 */
function mapGeneralCategory(course: StudentRoadmapCourse): MapCategory {
  // 공학인증 대상 학과: API가 채운 GENERAL/BSM/MAJOR 우선
  if (course.abeekBucket === 'GENERAL') return 'liberal'
  if (course.abeekBucket === 'BSM') return 'bsm'

  const label = course.category || ''

  if (isFoundationRequiredLabel(label)) return 'bsm'

  // 「전공기초」라도 abeekBucket이 MAJOR면 전공 (C프로그래밍 등)
  // BSM bucket은 위에서 이미 기초필수로 처리됨

  if (label.includes('전공')) {
    if (label.includes('선택')) return 'major-elective'
    return 'major-required'
  }

  if (
    label.includes('교양') ||
    label.includes('균형') ||
    label.includes('일반선택') ||
    label.includes('통과')
  ) {
    return 'liberal'
  }

  // MAJOR bucket 이거나 이수구분 불명 → 전공선택으로
  if (course.abeekBucket === 'MAJOR') {
    return label.includes('필수') ? 'major-required' : 'major-elective'
  }

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

function semesterOrder(term: string) {
  const idx = (SEMESTERS as readonly string[]).indexOf(term)
  return idx >= 0 ? idx : 999
}

/**
 * 일반 로드맵 표시 학기 — API termKey / standingTermKey만 사용.
 * takenYear−admissionYear 캘린더 환산으로 다시 넣지 않음 (휴학 시 4-1 몰림 방지).
 * 동일 과목이 여러 칸에 중복되면 가장 이른 이수순번을 씀.
 */
function pickGeneralDisplayTerm(termKeys: string[]): string | null {
  const valid = [
    ...new Set(
      termKeys
        .map((k) => k.trim())
        .filter((k) => (SEMESTERS as readonly string[]).includes(k)),
    ),
  ]
  if (valid.length === 0) return null
  if (valid.length === 1) return valid[0]
  return valid.slice().sort((a, b) => semesterOrder(a) - semesterOrder(b))[0]
}

/** CompletedCourseDto 등 takenYear/takenSemester가 있는 목록에서 학수번호→학기 맵 생성 */
function buildTakenTermMap(
  progress: GraduationProgressResponse | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>()
  if (!progress) return map
  const admissionYear = progress.admissionYear

  const ingest = (courses?: Array<Record<string, unknown>>) => {
    for (const raw of courses ?? []) {
      const code = String(raw.courseCode ?? '')
      if (!code || map.has(code)) continue
      const term = toTermKeyFromTaken(
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
  takenTermByCode?: Map<string, string>,
  courseCode?: string,
): string | null {
  const recommended = recommendedTerm.trim()
  // 권장/API 학기 칸을 우선 — 캘린더 환산으로 옮기지 않음
  if (recommended && (SEMESTERS as readonly string[]).includes(recommended)) return recommended
  if (completed) {
    const fromFields = toTermKeyFromTaken(takenYear, takenSemester, admissionYear)
    const fromMap = courseCode ? takenTermByCode?.get(courseCode) : undefined
    if (fromFields || fromMap) return fromFields || fromMap || null
  }
  return null
}

function abeekToMapCourse(
  course: RoadmapCourse,
  admissionYear?: number,
  takenTermByCode?: Map<string, string>,
): MapCourse | null {
  const semester = resolveDisplayTerm(
    course.recommendedTerm || '',
    course.takenYear,
    course.takenSemester,
    course.completed,
    admissionYear,
    takenTermByCode,
    course.abeekCourseCode,
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

  const semester = pickGeneralDisplayTerm([termKey])
  if (!semester) return null

  return {
    id: course.courseCode,
    name: course.courseName,
    hours: `${course.credits ?? 0}학점`,
    category: mapGeneralCategory(course),
    semester,
    completed: course.completed === true,
  }
}

/**
 * 졸업진행 기이수:
 * - 기초필수: 공통교양/기초필수 등
 * - 교양: 전공·기초필수 아닌 이수 과목
 * - 수강 학기(takenYear/Semester)가 없으면 배치하지 않음 (가짜 2-1 방지)
 */
function liberalCoursesFromProgress(
  progress: GraduationProgressResponse | null | undefined,
  excludeCodes: Set<string>,
  takenTermByCode: Map<string, string>,
): MapCourse[] {
  if (!progress) return []
  const admissionYear = progress.admissionYear
  const result: MapCourse[] = []
  const seen = new Set<string>()

  const pushCompleted = (
    courses: Array<Record<string, unknown>> | undefined,
    category: MapCategory,
  ) => {
    for (const raw of courses ?? []) {
      const code = String(raw.courseCode ?? '')
      const name = String(raw.courseName ?? '')
      if (!code || !name || excludeCodes.has(code) || seen.has(code)) continue
      const term =
        toTermKeyFromTaken(
          raw.takenYear as string | number | null | undefined,
          raw.takenSemester as string | number | null | undefined,
          admissionYear,
        ) || takenTermByCode.get(code)
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

  // 기초필수 — CompletedCourseDto(takenYear 포함)
  pushCompleted(
    progress.commonLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'bsm',
  )
  pushCompleted(
    progress.academicFoundationCredits?.completedCourses as
      | Array<Record<string, unknown>>
      | undefined,
    'bsm',
  )

  // 교양 — CompletedCourseDto
  pushCompleted(
    progress.electiveLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'liberal',
  )
  pushCompleted(
    progress.balancedLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'liberal',
  )

  // categorySummaries / 균형영역은 CategoryCourse라 학기 없음 → 맵에 있을 때만
  for (const summary of progress.categorySummaries ?? []) {
    const label = summary.category || ''
    if (label.includes('전공')) continue
    const category: MapCategory = isFoundationRequiredLabel(label) ? 'bsm' : 'liberal'
    pushCompleted(summary.courses as unknown as Array<Record<string, unknown>>, category)
  }
  for (const area of progress.balancedLiberalAreaProgresses ?? []) {
    pushCompleted(area.courses as unknown as Array<Record<string, unknown>>, 'liberal')
  }

  return result
}

function flattenStudentRoadmapCourses(
  roadmap: StudentRoadmapResponse | null | undefined,
): Array<{ course: StudentRoadmapCourse; termKey: string }> {
  if (!roadmap) return []
  const list: Array<{ course: StudentRoadmapCourse; termKey: string }> = []
  const seen = new Set<string>()

  for (const term of roadmap.terms ?? []) {
    const termKey = (term.standingTermKey || term.termKey || '').trim()
    const fromCourses = term.courses ?? []
    const fromCategories = Object.values(term.categories ?? {}).flat()
    // courses와 categories 모두 병합 (한쪽만 쓰면 GENERAL/BSM이 빠질 수 있음)
    const merged = [...fromCourses, ...fromCategories]

    for (const course of merged) {
      if (!course?.courseCode) continue
      const key = `${termKey}:${course.courseCode}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ course, termKey })
    }
  }
  return list
}

function buildAbeekEdges(courses: RoadmapCourse[]): MapEdge[] {
  const ids = new Set(courses.map((c) => c.abeekCourseCode))
  const edges: MapEdge[] = []
  for (const course of courses) {
    for (const pre of course.prerequisiteCourseCodes ?? []) {
      if (!ids.has(pre) || !ids.has(course.abeekCourseCode)) continue
      edges.push({ from: pre, to: course.abeekCourseCode, type: 'required' })
    }
  }
  return edges
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

export function CurriculumPage() {
  const { student } = useAuth()
  const { active } = useMajorTrack()

  const [viewKind, setViewKind] = useState<ViewKind>('general')
  const [departmentName, setDepartmentName] = useState(student?.major || '')
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(
    student?.major ? [student.major] : [],
  )
  const [generalRoadmap, setGeneralRoadmap] = useState<StudentRoadmapResponse | null>(null)
  const [abeekRoadmap, setAbeekRoadmap] = useState<FullRoadmapResponse | null>(null)
  const [graduation, setGraduation] = useState<GraduationProgressResponse | null>(null)
  const [generalLoading, setGeneralLoading] = useState(true)
  const [abeekLoading, setAbeekLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'all' | 'mine'>('all')
  const [filter, setFilter] = useState<string | null>(null)
  const [paths, setPaths] = useState<Array<{ d: string; type: MapEdge['type']; key: string }>>([])
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const [boardSize, setBoardSize] = useState({ w: BOARD_MIN_WIDTH, h: 600 })

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
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await getGraduationProgress(student.id)
        if (!cancelled) setGraduation(data)
      } catch {
        if (!cancelled) setGraduation(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [student?.id])

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
        if (student?.id && (!departmentName || departmentName === student.major)) {
          try {
            data = await getStudentRoadmapByStudent(student.id)
          } catch {
            if (!departmentName) throw new Error('학과 정보를 확인할 수 없습니다.')
            data = await getStudentRoadmap(departmentName, student.id)
          }
        } else if (departmentName) {
          data = await getStudentRoadmap(departmentName, student?.id)
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
  }, [departmentName, student?.id, student?.major])

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
  const generalFlat = useMemo(() => flattenStudentRoadmapCourses(generalRoadmap), [generalRoadmap])

  const edges = useMemo(
    () => (viewKind === 'abeek' ? buildAbeekEdges(abeekRawCourses) : []),
    [viewKind, abeekRawCourses],
  )

  const allCourses = useMemo(() => {
    const admissionYear = graduation?.admissionYear ?? student?.admissionYear
    const takenTermByCode = buildTakenTermMap(graduation)

    // ABEEK 뷰용: 이수 과목 takenYear 보강
    for (const course of abeekRawCourses) {
      if (!course.completed || !course.abeekCourseCode || takenTermByCode.has(course.abeekCourseCode)) {
        continue
      }
      const term = toTermKeyFromTaken(course.takenYear, course.takenSemester, admissionYear)
      if (term) takenTermByCode.set(course.abeekCourseCode, term)
    }

    if (viewKind === 'abeek') {
      return abeekRawCourses
        .map((c) => abeekToMapCourse(c, admissionYear, takenTermByCode))
        .filter((c): c is MapCourse => c != null)
    }

    // 학수번호별 API 칸 모아서 이수순번/중복 정리
    const grouped = new Map<string, Array<{ course: StudentRoadmapCourse; termKey: string }>>()
    for (const item of generalFlat) {
      const code = item.course.courseCode
      if (!code) continue
      const list = grouped.get(code) ?? []
      list.push(item)
      grouped.set(code, list)
    }

    const fromTimetable: MapCourse[] = []
    for (const [, instances] of grouped) {
      const completedInst = instances.find((i) => i.course.completed === true)
      if (completedInst) {
        const termKeys = instances.map((i) => i.termKey)
        const semester = pickGeneralDisplayTerm(termKeys)
        if (!semester) continue
        fromTimetable.push({
          id: completedInst.course.courseCode,
          name: completedInst.course.courseName,
          hours: `${completedInst.course.credits ?? 0}학점`,
          category: mapGeneralCategory(completedInst.course),
          semester,
          completed: true,
        })
        continue
      }

      for (const { course, termKey } of instances) {
        const mapped = generalToMapCourse(course, termKey)
        if (mapped) fromTimetable.push(mapped)
      }
    }

    const byId = new Map(fromTimetable.map((c) => [c.id, c]))
    const majorCodes = new Set(
      [...byId.values()].filter((c) => c.category.startsWith('major')).map((c) => c.id),
    )
    const liberalExtra = liberalCoursesFromProgress(graduation, majorCodes, takenTermByCode)
    for (const course of liberalExtra) {
      const existing = byId.get(course.id)
      if (existing) {
        // 시간표에서 전공으로 잘못 들어간 기이수 교양/기초 → 올바른 행으로 재분류
        if (existing.category.startsWith('major') && !course.category.startsWith('major')) {
          existing.category = course.category
          existing.completed = existing.completed || course.completed
          // 이수 학기는 시간표 termKey 우선 (휴학 순번 유지)
        }
        continue
      }
      byId.set(course.id, course)
    }
    return [...byId.values()]
  }, [viewKind, abeekRawCourses, generalFlat, graduation, student?.admissionYear])

  const activeRowDefs = viewKind === 'abeek' ? abeekRowDefs : generalRowDefs

  const hasCompletionData = useMemo(
    () => allCourses.some((c) => c.completed === true),
    [allCourses],
  )

  const courses = useMemo(() => {
    let list = allCourses
    if (mode === 'mine') list = list.filter((c) => c.completed)
    if (filter === 'liberal') list = list.filter((c) => c.category === 'liberal')
    if (filter === 'bsm') list = list.filter((c) => c.category === 'bsm')
    if (filter === 'major-required') list = list.filter((c) => c.category === 'major-required')
    if (filter === 'major-elective') list = list.filter((c) => c.category === 'major-elective')
    return list
  }, [allCourses, mode, filter])

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
  }, [loading, error, allCourses.length, courses, mode, filter, viewKind, departmentName])

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
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto px-8 py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-bold text-ink">이수체계도</h1>
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

        <p className="mt-3 text-sm text-ink-muted">
          {viewKind === 'abeek'
            ? '공학인증(ABEEK) 이수체계도입니다. 전문교양·BSM·전공을 표시합니다.'
            : '강의 시간표 기준 학과 로드맵입니다. 이수한 과목은 빨간색으로 표시됩니다.'}
        </p>

        {viewKind === 'abeek' && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[#e5e5ea] py-3.5">
          <span className="shrink-0 text-sm font-medium text-ink">체계표 안내</span>
          <div className="flex flex-wrap items-center gap-2">
            <LegendPill
              active={filter === 'liberal'}
              onClick={() => setFilter(filter === 'liberal' ? null : 'liberal')}
              className="bg-[#e8eaee] text-ink"
              label="전문교양"
            />
            <LegendPill
              active={filter === 'bsm'}
              onClick={() => setFilter(filter === 'bsm' ? null : 'bsm')}
              className="bg-[#4a5568] text-white"
              label="BSM(기초수학, 과학)"
            />
            <LegendPill
              active={filter === 'major-required'}
              onClick={() => setFilter(filter === 'major-required' ? null : 'major-required')}
              className="border-2 border-sejong bg-white text-sejong"
              label="전공필수"
            />
            <LegendPill
              active={filter === 'major-elective'}
              onClick={() => setFilter(filter === 'major-elective' ? null : 'major-elective')}
              className="bg-sejong-pink text-ink"
              label="전공선택"
            />
            {hasCompletionData && (
              <span className="rounded-full bg-sejong px-3.5 py-1.5 text-xs font-semibold text-white">
                이수 과목
              </span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-ink">필수 선수과목</span>
              <svg width="56" height="12" viewBox="0 0 56 12" aria-hidden>
                <line x1="0" y1="6" x2="46" y2="6" stroke="#222" strokeWidth="1.8" />
                <polygon points="46,1.5 56,6 46,10.5" fill="#222" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-ink">선택 선수과목</span>
              <svg width="56" height="12" viewBox="0 0 56 12" aria-hidden>
                <line
                  x1="0"
                  y1="6"
                  x2="46"
                  y2="6"
                  stroke="#222"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                />
                <polygon points="46,1.5 56,6 46,10.5" fill="#222" />
              </svg>
            </div>
            <p className="pb-0.5 text-xs text-ink-muted">휠: 확대/축소 · 드래그·스크롤: 이동</p>
          </div>
        </div>
        )}

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
                className={`relative h-[min(72vh,760px)] touch-none select-none overflow-auto overscroll-none ${
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

                  {activeRowDefs.map((row) => (
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
                                }`}
                                className={`relative box-border flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 px-2.5 py-1.5 text-center shadow-sm ${courseBadgeClass(
                                  course,
                                  hasCompletionData,
                                )}`}
                              >
                                {course.category === 'major-required' && !course.completed && (
                                  <span className="absolute -top-1.5 right-1 rounded-full bg-sejong px-1.5 py-[1px] text-[9px] font-bold leading-none text-white">
                                    필수
                                  </span>
                                )}
                                {course.completed && (
                                  <span className="absolute -top-1.5 right-1 rounded-full bg-white px-1.5 py-[1px] text-[9px] font-bold leading-none text-sejong">
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
                                  {course.name.toLowerCase().includes('capstone') && (
                                    <span
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
    </div>
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
