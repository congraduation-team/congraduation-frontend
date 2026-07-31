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
  liberal: 'bg-[#e8eaee] text-ink',
  bsm: 'bg-[#4a5568] text-white',
  'major-required': 'border-2 border-sejong bg-white text-sejong',
  'major-elective': 'bg-sejong-pink text-ink',
}

function courseBadgeClass(course: MapCourse, hasCompletionData: boolean): string {
  // 이수한 과목은 카테고리와 무관하게 빨간색
  if (course.completed) {
    return 'bg-sejong text-white shadow-[0_0_0_1px_rgba(200,1,46,0.25)]'
  }

  if (course.category === 'major-required') {
    return `${categoryStyle['major-required']} ${hasCompletionData ? 'opacity-70' : ''}`
  }

  if (course.category === 'major-elective') {
    return `${categoryStyle['major-elective']} ${hasCompletionData ? 'opacity-55' : ''}`
  }

  return `${categoryStyle[course.category]} ${hasCompletionData ? 'opacity-55' : ''}`
}

/** 일반(시간표) 로드맵: 교양 / 교양필수 / 전공 */
const generalRowDefs: RowDef[] = [
  { key: 'liberal', label: '교양', categories: ['liberal'], border: 'border-[#c5c9d0]' },
  { key: 'foundation', label: '교양필수', categories: ['bsm'], border: 'border-[#4a5568]' },
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
function mapGeneralCategory(course: StudentRoadmapCourse): MapCategory {
  const label = course.category || ''

  if (label.includes('전공')) {
    if (label.includes('선택')) return 'major-elective'
    return 'major-required'
  }

  const isRequiredLiberal =
    label.includes('교양필수') ||
    label.includes('공통교양') ||
    label.includes('기초필수') ||
    label.includes('대학필수') ||
    label.includes('필수교양') ||
    (label.includes('교양') && label.includes('필수')) ||
    (label.includes('공통') && label.includes('필수')) ||
    (label.includes('기초') && label.includes('필수'))

  if (isRequiredLiberal) return 'bsm'

  if (
    label.includes('교양') ||
    label.includes('균형') ||
    label.includes('일반선택') ||
    label.includes('자유선택') ||
    label.includes('기타')
  ) {
    return 'liberal'
  }

  // 비전공 과목은 교양 행으로
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

function abeekToMapCourse(course: RoadmapCourse): MapCourse | null {
  const semester = (course.recommendedTerm || '').trim()
  if (!semester || !(SEMESTERS as readonly string[]).includes(semester)) return null

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

function generalToMapCourse(course: StudentRoadmapCourse, termKey: string): MapCourse | null {
  const semester = termKey.trim()
  if (!semester || !(SEMESTERS as readonly string[]).includes(semester)) return null
  if (!course.courseCode) return null

  // 전공만 시간표 로드맵에서 배치. 교양·교양필수는 졸업진행(기이수)에서 합친다.
  const mapped = mapGeneralCategory(course)
  if (mapped === 'liberal' || mapped === 'bsm') {
    // 시간표에 비전공 과목이 있으면 그대로 표시
  }

  return {
    id: course.courseCode,
    name: course.courseName,
    hours: `${course.credits ?? 0}학점`,
    category: mapped,
    semester,
    completed: course.completed === true,
  }
}

/** 졸업진행의 교양/교양필수 이수 과목을 학기 칸에 배치 */
function liberalCoursesFromProgress(
  progress: GraduationProgressResponse | null | undefined,
  excludeCodes: Set<string>,
): MapCourse[] {
  if (!progress) return []
  const admissionYear = progress.admissionYear
  const result: MapCourse[] = []
  const seen = new Set<string>()

  const pushCompleted = (
    courses: Array<Record<string, unknown>> | undefined,
    category: MapCategory,
    fallbackTerm: string,
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
        ) || fallbackTerm
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

  // 교양필수(공통교양)
  pushCompleted(
    progress.commonLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'bsm',
    '1-1',
  )
  // 교양(선택·균형 등 비전공)
  pushCompleted(
    progress.electiveLiberalCredits?.completedCourses as Array<Record<string, unknown>> | undefined,
    'liberal',
    '1-2',
  )
  for (const area of progress.balancedLiberalAreaProgresses ?? []) {
    pushCompleted(area.courses as unknown as Array<Record<string, unknown>>, 'liberal', '2-1')
  }

  for (const summary of progress.categorySummaries ?? []) {
    const label = summary.category || ''
    if (label.includes('전공')) continue
    const isRequired =
      label.includes('교양필수') ||
      label.includes('공통교양') ||
      label.includes('기초필수') ||
      (label.includes('교양') && label.includes('필수'))
    const category: MapCategory = isRequired ? 'bsm' : 'liberal'
    if (!isRequired && !label.includes('교양') && !label.includes('균형') && !label.includes('선택')) {
      continue
    }
    pushCompleted(summary.courses as unknown as Array<Record<string, unknown>>, category, isRequired ? '1-1' : '2-1')
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
    const termKey = term.termKey || ''
    const fromCourses = term.courses ?? []
    const fromCategories = Object.values(term.categories ?? {}).flat()
    const merged = fromCourses.length > 0 ? fromCourses : fromCategories

    for (const course of merged) {
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
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  panRef.current = pan
  zoomRef.current = zoom

  const abeekTarget = generalRoadmap?.abeekTarget === true
  const abeekDepartmentCode =
    generalRoadmap?.abeekDepartmentCode ||
    student?.tracks?.find((t) => t.departmentCode === active?.department)?.departmentCode ||
    student?.tracks?.[0]?.departmentCode

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
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

    e.preventDefault()
    window.getSelection()?.removeAllRanges()
    e.currentTarget.setPointerCapture(e.pointerId)
    setPanning(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!panning) return
    e.preventDefault()
    setPan((prev) => {
      const next = { x: prev.x + e.movementX, y: prev.y + e.movementY }
      panRef.current = next
      return next
    })
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
    if (viewKind === 'abeek') {
      return abeekRawCourses.map(abeekToMapCourse).filter((c): c is MapCourse => c != null)
    }

    const fromTimetable = generalFlat
      .map(({ course, termKey }) => generalToMapCourse(course, termKey))
      .filter((c): c is MapCourse => c != null)

    // 전공 시간표에 이미 있는 학수번호는 교양 쪽으로 중복 추가하지 않음
    const majorCodes = new Set(
      fromTimetable.filter((c) => c.category.startsWith('major')).map((c) => c.id),
    )
    const liberalExtra = liberalCoursesFromProgress(graduation, majorCodes)
    const existing = new Set(fromTimetable.map((c) => c.id))
    const merged = [...fromTimetable]
    for (const course of liberalExtra) {
      if (existing.has(course.id)) continue
      existing.add(course.id)
      merged.push(course)
    }
    return merged
  }, [viewKind, abeekRawCourses, generalFlat, graduation])

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

      const worldX = (mx - panRef.current.x) / prevZoom
      const worldY = (my - panRef.current.y) / prevZoom
      const nextPan = {
        x: mx - worldX * nextZoom,
        y: my - worldY * nextZoom,
      }
      zoomRef.current = nextZoom
      panRef.current = nextPan
      setZoom(nextZoom)
      setPan(nextPan)
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
                  onClick={() => setViewKind('general')}
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
            : '강의 시간표 기준 학과 로드맵입니다. 교양·교양필수는 기이수(비전공) 과목 기준으로 표시합니다.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[#e5e5ea] py-3.5">
          <span className="shrink-0 text-sm font-medium text-ink">체계표 안내</span>
          <div className="flex flex-wrap items-center gap-2">
            {viewKind === 'abeek' ? (
              <>
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
              </>
            ) : (
              <>
                <LegendPill
                  active={filter === 'liberal'}
                  onClick={() => setFilter(filter === 'liberal' ? null : 'liberal')}
                  className="bg-[#e8eaee] text-ink"
                  label="교양"
                />
                <LegendPill
                  active={filter === 'bsm'}
                  onClick={() => setFilter(filter === 'bsm' ? null : 'bsm')}
                  className="bg-[#4a5568] text-white"
                  label="교양필수"
                />
              </>
            )}
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
            {viewKind === 'abeek' && (
              <>
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
              </>
            )}
            <p className="pb-0.5 text-xs text-ink-muted">휠: 확대/축소 · 드래그: 이동</p>
          </div>
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
                className={`relative h-[min(70vh,720px)] touch-none select-none overflow-hidden p-5 ${
                  panning ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <div
                  ref={boardRef}
                  className="relative min-w-[1480px] origin-top-left will-change-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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

                  <div className="relative z-10 mb-3 grid grid-cols-[auto_repeat(8,minmax(140px,1fr))] gap-2">
                    <div />
                    {SEMESTERS.map((s) => (
                      <div key={s} className="text-center text-sm font-bold text-ink">
                        {s}
                      </div>
                    ))}
                  </div>

                  {activeRowDefs.map((row) => (
                    <div
                      key={row.key}
                      className="relative z-10 mb-4 grid grid-cols-[auto_repeat(8,minmax(140px,1fr))] items-start gap-2"
                    >
                      <div className="flex items-start justify-center pt-1">
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
                            className={`relative w-full space-y-1.5 rounded-xl p-1 ${
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
                                className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-center shadow-sm ${courseBadgeClass(
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
