import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  getAbeekEvaluation,
  getAbeekFullRoadmap,
  getAbeekFullRoadmapByStudent,
} from '../api/endpoints'
import type {
  AbeekEvaluationResponse,
  FullRoadmapResponse,
  RoadmapCourse,
} from '../api/types'
import { flattenRoadmapCourses } from '../api/types'
import { ChartLegend } from '../components/charts/ChartLegend'
import { DonutChart } from '../components/charts/DonutChart'
import { CourseMiniList } from '../components/common/CourseMiniList'
import { CourseListModal } from '../components/modals/CourseListModal'
import { useAuth } from '../context/AuthContext'
import type { Course } from '../data/mockData'
import { formatPercentLabel, toNumber, toPercent } from '../utils/number'

function toCourse(c: {
  courseCode: string
  courseName: string
  credits?: number | string
  semester?: string
}): Course {
  return {
    code: c.courseCode,
    name: c.courseName,
    credits: toNumber(c.credits),
    semester: c.semester,
  }
}

function roadmapToCourse(course: RoadmapCourse, creditOverride?: number): Course {
  return toCourse({
    courseCode: course.abeekCourseCode,
    courseName: course.courseName,
    credits: creditOverride ?? course.credits,
    semester: course.recommendedTerm,
  })
}

function isActuallyCompleted(course: RoadmapCourse) {
  return course.completed === true
}

function hasDesign(course: RoadmapCourse) {
  return course.hasDesignCredits === true || toNumber(course.designCredits) > 0
}

function splitRoadmap(courses: RoadmapCourse[]) {
  const completed = courses.filter(isActuallyCompleted).map((c) => roadmapToCourse(c))
  const remaining = courses.filter((c) => !isActuallyCompleted(c)).map((c) => roadmapToCourse(c))
  return { completed, remaining }
}

async function loadRoadmap(studentId: string, departmentCode: string, year: number) {
  try {
    return await getAbeekFullRoadmapByStudent(studentId)
  } catch {
    return getAbeekFullRoadmap({
      departmentCode,
      curriculumYear: year,
      studentId,
    })
  }
}

export function EngineeringPage() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const [evaluation, setEvaluation] = useState<AbeekEvaluationResponse | null>(null)
  const [roadmap, setRoadmap] = useState<FullRoadmapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [majorOpen, setMajorOpen] = useState(false)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const abeekId = student.studentNo || String(student.id)
        const departmentCode = student.tracks?.[0]?.departmentCode || 'CSE'

        const data = await getAbeekEvaluation(abeekId)
        if (cancelled) return
        setEvaluation(data)

        const year =
          data.graduationAbeekYear ||
          data.entranceYear ||
          student.admissionYear ||
          new Date().getFullYear()

        try {
          const map = await loadRoadmap(abeekId, departmentCode, year)
          if (!cancelled) setRoadmap(map)
        } catch {
          if (!cancelled) setRoadmap(null)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          setError(
            err.status === 400 || err.status === 404
              ? '공학인증(ABEEK) 학생 정보가 없습니다. 성적 업로드 후 다시 시도해 주세요.'
              : err.message,
          )
        } else {
          setError(err instanceof Error ? err.message : '공학인증 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [student])

  const roadmapCourses = useMemo(() => flattenRoadmapCourses(roadmap), [roadmap])

  const generalRequiredAll = useMemo(
    () => roadmapCourses.filter((c) => c.category === 'GENERAL' && c.role === 'REQUIRED'),
    [roadmapCourses],
  )
  const generalElectiveAll = useMemo(
    () => roadmapCourses.filter((c) => c.category === 'GENERAL' && c.role === 'CERT_ELECTIVE'),
    [roadmapCourses],
  )
  const bsmAll = useMemo(
    () => roadmapCourses.filter((c) => c.category === 'BSM' || c.bsm),
    [roadmapCourses],
  )
  const majorAll = useMemo(
    () => roadmapCourses.filter((c) => c.category === 'MAJOR' || c.abeekMajor),
    [roadmapCourses],
  )
  const designAll = useMemo(() => roadmapCourses.filter(hasDesign), [roadmapCourses])

  const generalRequired = useMemo(() => splitRoadmap(generalRequiredAll), [generalRequiredAll])
  const generalElective = useMemo(() => splitRoadmap(generalElectiveAll), [generalElectiveAll])
  const bsm = useMemo(() => splitRoadmap(bsmAll), [bsmAll])
  const major = useMemo(() => splitRoadmap(majorAll), [majorAll])

  const designLists = useMemo(() => {
    const completed = designAll
      .filter(isActuallyCompleted)
      .map((c) => roadmapToCourse(c, c.designCredits))
    const remaining = designAll
      .filter((c) => !isActuallyCompleted(c))
      .map((c) =>
        toCourse({
          courseCode: c.abeekCourseCode,
          courseName: c.courseName,
          credits: c.designCredits,
          semester: c.recommendedTerm,
        }),
      )
    return { completed, remaining }
  }, [designAll])

  const displayName = evaluation?.studentName || roadmap?.studentName || student?.name || '학생'
  const generalEarned = toNumber(evaluation?.general?.earnedCredits)
  const generalRequiredCredits = toNumber(evaluation?.general?.requiredCredits)
  const generalPct = toPercent(evaluation?.general?.progressPercent)

  const genReqEarned = generalRequired.completed.reduce((s, c) => s + c.credits, 0)
  const genReqNeed =
    generalRequiredAll.reduce((s, c) => s + toNumber(c.credits), 0) ||
    Math.max(generalRequiredCredits, 1)
  const genReqPct =
    genReqNeed > 0
      ? Math.max(0, Math.min(100, Math.round((genReqEarned / genReqNeed) * 100)))
      : generalPct

  const genElecEarned = generalElective.completed.reduce((s, c) => s + c.credits, 0)
  const genElecNeed = generalElectiveAll.reduce((s, c) => s + toNumber(c.credits), 0) || 1
  const genElecPct =
    generalElectiveAll.length > 0
      ? Math.max(0, Math.min(100, Math.round((genElecEarned / genElecNeed) * 100)))
      : generalPct

  const bsmEarned = toNumber(evaluation?.bsm?.earnedCredits)
  const bsmRequired = toNumber(evaluation?.bsm?.requiredCredits)
  const bsmPct = toPercent(evaluation?.bsm?.progressPercent)

  const majorEarned = toNumber(evaluation?.major?.earnedCredits)
  const majorRequired = toNumber(evaluation?.major?.requiredCredits)
  const majorPct = toPercent(evaluation?.major?.progressPercent)

  const designEarned =
    roadmap?.summary?.completedDesignCredits ??
    designLists.completed.reduce((s, c) => s + c.credits, 0)
  const designRequired =
    toNumber(evaluation?.design?.requiredCredits) ||
    toNumber(roadmap?.summary?.totalDesignCredits)
  const designPct =
    designRequired > 0
      ? Math.max(0, Math.min(100, Math.round((toNumber(designEarned) / designRequired) * 100)))
      : toPercent(evaluation?.design?.progressPercent)

  const remainingLeft = designLists.remaining.slice(0, Math.ceil(designLists.remaining.length / 2))
  const remainingRight = designLists.remaining.slice(Math.ceil(designLists.remaining.length / 2))

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-muted">공학인증을 불러오는 중...</div>
  }

  if (error || !evaluation) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <p className="text-sm text-sejong">{error ?? '데이터가 없습니다.'}</p>
        <button
          type="button"
          onClick={() => navigate('/upload')}
          className="mt-4 rounded-full bg-sejong px-5 py-2 text-sm font-semibold text-white"
        >
          성적 파일 업로드하기
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-ink">{displayName}님 공학인증 현황</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {evaluation.entranceYear ? `${evaluation.entranceYear}학번` : ''}
          {evaluation.graduationAbeekYear
            ? ` · ABEEK ${evaluation.graduationAbeekYear} 기준`
            : ''}
          {evaluation.overallSatisfied ? ' · 요건 충족' : ' · 요건 미충족'}
        </p>
        {evaluation.messages && evaluation.messages.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
            {evaluation.messages.map((msg) => (
              <li key={msg}>· {msg}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto max-w-[1080px] space-y-5">
        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-5 text-base font-bold text-ink">
            {displayName}님 전문교양{' '}
            <span className="text-sejong">
              {generalEarned}/{generalRequiredCredits || '-'}
            </span>
            학점 이수
          </h3>

          <div className="grid gap-7 md:grid-cols-2">
            <section>
              <p className="mb-2 text-sm font-bold text-ink">인증필수</p>
              <ChartLegend secondaryLabel="최소 이수 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart
                  percent={genReqPct}
                  size={120}
                  stroke={13}
                  color="#5b6470"
                  label={formatPercentLabel(genReqPct)}
                />
                <CourseMiniList
                  title="이수한 과목"
                  courses={generalRequired.completed.slice(0, 6)}
                  totalValue={genReqEarned}
                />
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-bold text-ink">인증선택</p>
              <ChartLegend secondaryLabel="최소 이수 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart
                  percent={genElecPct}
                  size={120}
                  stroke={13}
                  color="#5b6470"
                  label={formatPercentLabel(genElecPct)}
                />
                <CourseMiniList
                  title="이수한 과목"
                  courses={generalElective.completed.slice(0, 6)}
                  totalValue={genElecEarned}
                />
              </div>
            </section>
          </div>

          <div className="mt-5 flex justify-end">
            <CurriculumButton onClick={() => navigate('/curriculum')} />
          </div>
        </article>

        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 text-base font-bold text-ink">
            BSM{' '}
            <span className="text-sejong">
              {bsmEarned}/{bsmRequired || '-'}
            </span>
            학점 이수
          </h3>
          <ChartLegend secondaryLabel="총 학점" className="mb-4" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <DonutChart
              percent={bsmPct}
              size={130}
              stroke={14}
              color="#5b6470"
              label={formatPercentLabel(bsmPct)}
            />
            <div className="flex flex-1 gap-9">
              <CourseMiniList
                title="이수한 과목"
                courses={bsm.completed.slice(0, 6)}
                totalValue={bsmEarned}
              />
              <CourseMiniList title="남은 과목" courses={bsm.remaining.slice(0, 6)} />
            </div>
          </div>
        </article>

        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-base font-bold text-ink">
            전공{' '}
            <span className="text-sejong">
              {majorEarned}/{majorRequired || '-'}
            </span>
            학점 이수
          </h3>
          <p className="mb-5 mt-1 text-sm text-ink-muted">
            전공 {majorEarned}학점 · 설계 {designEarned}
            {designRequired ? `/${designRequired}` : ''}학점 이수
            {evaluation.designSequenceSatisfied === false ? ' · 설계 시퀀스 미충족' : ''}
          </p>

          <div className="grid gap-7 md:grid-cols-2">
            <section>
              <p className="mb-2 text-sm font-bold text-ink">전공교과목</p>
              <ChartLegend secondaryLabel="총 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart
                  percent={majorPct}
                  size={120}
                  stroke={13}
                  color="#5b6470"
                  label={formatPercentLabel(majorPct)}
                />
                <CourseMiniList
                  title="이수한 과목"
                  courses={major.completed.slice(0, 4)}
                  totalValue={majorEarned}
                  onTitleClick={() => setMajorOpen(true)}
                />
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-bold text-ink">설계</p>
              <ChartLegend secondaryLabel="총 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart
                  percent={designPct}
                  size={120}
                  stroke={13}
                  color="#5b6470"
                  label={formatPercentLabel(designPct)}
                />
                <CourseMiniList
                  title="이수한 과목"
                  courses={designLists.completed.slice(0, 4)}
                  totalValue={designEarned}
                />
              </div>
            </section>
          </div>

          <div className="mt-5 flex justify-end">
            <CurriculumButton onClick={() => navigate('/curriculum')} />
          </div>
        </article>

        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 text-base font-bold text-ink">전공 설계 자세히 보기</h3>
          <ChartLegend secondaryLabel="총 학점" className="mb-4" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <DonutChart
              percent={designPct}
              size={130}
              stroke={14}
              color="#5b6470"
              label={formatPercentLabel(designPct)}
            />

            <div className="min-w-0 flex-[0.9]">
              <CourseMiniList
                title="이수한 과목"
                courses={designLists.completed}
                totalValue={designEarned}
              />
            </div>

            <div className="min-w-0 flex-[1.4]">
              <p className="mb-2.5 text-sm font-bold text-ink">남은 과목</p>
              {designLists.remaining.length === 0 ? (
                <p className="text-sm text-ink-muted">남은 설계 과목이 없습니다.</p>
              ) : (
                <div className="grid gap-x-7 gap-y-2 sm:grid-cols-2">
                  <ul className="space-y-2">
                    {remainingLeft.map((course) => (
                      <li
                        key={course.code}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate text-ink">{course.name}</span>
                        <span className="shrink-0 font-semibold text-sejong">
                          {course.semester ?? '-'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2">
                    {remainingRight.map((course) => (
                      <li
                        key={course.code}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate text-ink">{course.name}</span>
                        <span className="shrink-0 font-semibold text-sejong">
                          {course.semester ?? '-'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </article>

        <CourseListModal
          open={majorOpen}
          onClose={() => setMajorOpen(false)}
          title="공학인증 요건 전공 이수 현황"
          subtitle={`${majorEarned}학점 이수`}
          courses={major.completed}
        />
      </div>
    </div>
  )
}

function CurriculumButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-sejong px-5 py-2 text-sm font-semibold text-white transition hover:bg-sejong-dark"
    >
      이수체계도 확인
    </button>
  )
}
