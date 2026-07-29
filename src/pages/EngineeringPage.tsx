import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  const [remainingModal, setRemainingModal] = useState<{
    title: string
    subtitle?: string
    courses: Course[]
  } | null>(null)

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
              ? '공학인증(ABEEK) 학생 정보가 없습니다. 기이수 성적을 다시 업로드해 주세요.'
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
  const bsmPct =
    bsmRequired > 0
      ? Math.max(0, Math.min(100, Math.round((bsmEarned / bsmRequired) * 100)))
      : toPercent(evaluation?.bsm?.progressPercent)

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

  // 인증선택은 2022~ 제도. 2021 이하 입학은 요건 없음
  const entranceYear = evaluation?.entranceYear ?? student?.admissionYear
  const showCertElective = entranceYear == null || entranceYear >= 2022

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-muted">공학인증을 불러오는 중...</div>
  }

  if (error || !evaluation) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <p className="text-sm text-sejong">{error ?? '데이터가 없습니다.'}</p>
        <p className="mt-2 text-xs text-ink-muted">
          기이수 성적 업로드 한 번으로 졸업요건·공학인증이 함께 반영됩니다.
        </p>
        <button
          type="button"
          onClick={() => navigate('/upload?update=1')}
          className="mt-4 rounded-full bg-sejong px-5 py-2 text-sm font-semibold text-white"
        >
          기이수 성적 업로드하기
        </button>
      </div>
    )
  }

  const designDetail = evaluation.designDetail
  const waivedCourses = evaluation.waivedGraduationOnlyCourses ?? []
  const requirementNotes: string[] = []
  const waivedNotes: string[] = []
  for (const msg of evaluation.messages ?? []) {
    if (msg.includes('면제')) waivedNotes.push(msg)
    else if (msg.includes('미이수')) continue
    else if (msg.includes('학점') || msg.includes('최소') || msg.includes('유리')) {
      requirementNotes.push(msg)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-ink">{displayName}님 공학인증 현황</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {evaluation.entranceYear != null && (
            <MetaChip>{String(evaluation.entranceYear).slice(-2)}학번</MetaChip>
          )}
          {evaluation.graduationAbeekYear != null && (
            <MetaChip>ABEEK {evaluation.graduationAbeekYear} 기준</MetaChip>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              evaluation.overallSatisfied
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-sejong/10 text-sejong'
            }`}
          >
            {evaluation.overallSatisfied ? '요건 충족' : '요건 미충족'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] space-y-5">
        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-base font-bold text-ink">인증 요약</h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReqCreditCard
              label="전문교양"
              earned={generalEarned}
              required={generalRequiredCredits}
            />
            <ReqCreditCard label="BSM" earned={bsmEarned} required={bsmRequired} />
            <ReqCreditCard label="전공" earned={majorEarned} required={majorRequired} />
            <ReqCreditCard
              label="설계"
              earned={toNumber(designEarned)}
              required={designRequired}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl bg-panel px-4 py-4">
              <p className="mb-3 text-sm font-bold text-ink">설계 시퀀스</p>
              <ul className="space-y-2.5">
                <DesignCheck
                  label="기초설계 (공학설계기초)"
                  done={designDetail?.hasBasicDesign === true}
                />
                <DesignCheck
                  label="요소설계"
                  done={designDetail?.hasElementDesign === true}
                />
                <DesignCheck
                  label="종합설계 (Capstone)"
                  done={designDetail?.hasComprehensiveDesign === true}
                />
              </ul>
              {designDetail?.sequenceSatisfied === false && (
                <p className="mt-3 text-xs text-ink-muted">
                  기초 → 요소 → 종합 순서를 모두 이수해야 설계 시퀀스가 충족됩니다.
                </p>
              )}
            </section>

            <section className="rounded-xl bg-panel px-4 py-4">
              <p className="mb-3 text-sm font-bold text-ink">적용 요건 · 안내</p>
              {requirementNotes.length > 0 ? (
                <ul className="space-y-2">
                  {requirementNotes.map((msg) => (
                    <li key={msg} className="text-xs leading-relaxed text-ink-muted">
                      {msg.replace(/^[·•\s]+/, '')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">
                  입학 {evaluation.entranceYear ?? '-'}년도 · 졸업 ABEEK{' '}
                  {evaluation.graduationAbeekYear ?? '-'}년도 기준으로 평가합니다.
                </p>
              )}

              {(waivedCourses.length > 0 || waivedNotes.length > 0) && (
                <div className="mt-4 border-t border-black/5 pt-3">
                  <p className="mb-2 text-xs font-semibold text-ink">면제 과목</p>
                  {waivedCourses.length > 0 ? (
                    <ul className="space-y-2">
                      {waivedCourses.map((c) => (
                        <li key={c.courseCode} className="text-xs text-ink-muted">
                          <span className="font-medium text-ink">{c.courseName}</span>
                          <span className="mt-0.5 block text-ink-faint">
                            {c.note ?? '졸업연도 신설 필수 · 입학연도 미존재로 면제'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-2">
                      {waivedNotes.map((msg) => (
                        <li key={msg} className="text-xs leading-relaxed text-ink-muted">
                          {msg.replace(/^[·•\s]+/, '')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>
        </article>
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl bg-white px-5 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-base font-bold text-ink">
                {displayName}님 전문교양{' '}
                <span className="text-sejong">
                  {generalEarned}/{generalRequiredCredits || '-'}
                </span>
                학점 이수
              </h3>
              <div className="flex flex-wrap gap-2">
                {(generalRequired.remaining.length > 0 ||
                  (showCertElective && generalElective.remaining.length > 0)) && (
                  <RemainingButton
                    onClick={() =>
                      setRemainingModal({
                        title: '전문교양 남은 과목',
                        subtitle: showCertElective
                          ? `인증필수 ${generalRequired.remaining.length} · 인증선택 ${generalElective.remaining.length}`
                          : `인증필수 ${generalRequired.remaining.length}과목`,
                        courses: [
                          ...generalRequired.remaining,
                          ...(showCertElective ? generalElective.remaining : []),
                        ],
                      })
                    }
                  />
                )}
                <CurriculumButton onClick={() => navigate('/curriculum')} />
              </div>
            </div>

            <div className={`grid gap-5 ${showCertElective ? 'sm:grid-cols-2' : ''}`}>
              <section>
                <p className="mb-2 text-sm font-bold text-ink">인증필수</p>
                <ChartLegend secondaryLabel="최소 이수 학점" className="mb-3.5" />
                <div className="flex items-start gap-3">
                  <DonutChart
                    percent={genReqPct}
                    size={100}
                    stroke={11}
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

              {showCertElective && (
                <section>
                  <p className="mb-2 text-sm font-bold text-ink">인증선택</p>
                  <ChartLegend secondaryLabel="최소 이수 학점" className="mb-3.5" />
                  <div className="flex items-start gap-3">
                    <DonutChart
                      percent={genElecPct}
                      size={100}
                      stroke={11}
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
              )}
            </div>
          </article>

          <article className="rounded-2xl bg-white px-5 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-ink">
                  BSM{' '}
                  <span className="text-sejong">
                    {bsmEarned}/{bsmRequired || '-'}
                  </span>
                  학점 이수
                </h3>
                <ChartLegend secondaryLabel="총 학점" className="mt-2" />
              </div>
              {bsm.remaining.length > 0 && (
                <RemainingButton
                  onClick={() =>
                    setRemainingModal({
                      title: 'BSM 남은 과목',
                      subtitle: `${bsm.remaining.length}과목`,
                      courses: bsm.remaining,
                    })
                  }
                />
              )}
            </div>
            <div className="flex items-start gap-3">
              <DonutChart
                percent={bsmPct}
                size={100}
                stroke={11}
                color="#5b6470"
                label={formatPercentLabel(bsmPct)}
              />
              <CourseMiniList
                title="이수한 과목"
                courses={bsm.completed.slice(0, 6)}
                totalValue={bsmEarned}
              />
            </div>
          </article>
        </div>

        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">
                전공{' '}
                <span className="text-sejong">
                  {majorEarned}/{majorRequired || '-'}
                </span>
                학점 이수
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                전공 {majorEarned}학점 · 설계 {designEarned}
                {designRequired ? `/${designRequired}` : ''}학점 이수
                {evaluation.designSequenceSatisfied === false ? ' · 설계 시퀀스 미충족' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(major.remaining.length > 0 || designLists.remaining.length > 0) && (
                <RemainingButton
                  onClick={() =>
                    setRemainingModal({
                      title: '전공·설계 남은 과목',
                      subtitle: `전공 ${major.remaining.length} · 설계 ${designLists.remaining.length}`,
                      courses: [...major.remaining, ...designLists.remaining],
                    })
                  }
                />
              )}
              <CurriculumButton onClick={() => navigate('/curriculum')} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <section>
              <p className="mb-2 text-sm font-bold text-ink">전공교과목</p>
              <ChartLegend secondaryLabel="총 학점" className="mb-3.5" />
              <div className="flex items-start gap-3">
                <DonutChart
                  percent={majorPct}
                  size={100}
                  stroke={11}
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
              <div className="flex items-start gap-3">
                <DonutChart
                  percent={designPct}
                  size={100}
                  stroke={11}
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
        </article>

        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">전공 설계 자세히 보기</h3>
              <ChartLegend secondaryLabel="총 학점" className="mt-2" />
            </div>
            {designLists.remaining.length > 0 && (
              <RemainingButton
                onClick={() =>
                  setRemainingModal({
                    title: '설계 남은 과목',
                    subtitle: `${designLists.remaining.length}과목`,
                    courses: designLists.remaining,
                  })
                }
              />
            )}
          </div>
          <div className="flex items-start gap-4">
            <DonutChart
              percent={designPct}
              size={110}
              stroke={12}
              color="#5b6470"
              label={formatPercentLabel(designPct)}
            />
            <CourseMiniList
              title="이수한 과목"
              courses={designLists.completed}
              totalValue={designEarned}
            />
          </div>
        </article>

        <CourseListModal
          open={majorOpen}
          onClose={() => setMajorOpen(false)}
          title="공학인증 요건 전공 이수 현황"
          subtitle={`${majorEarned}학점 이수`}
          courses={major.completed}
        />
        <CourseListModal
          open={remainingModal != null}
          onClose={() => setRemainingModal(null)}
          title={remainingModal?.title ?? '남은 과목'}
          subtitle={remainingModal?.subtitle}
          courses={remainingModal?.courses ?? []}
        />
      </div>
    </div>
  )
}

function RemainingButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panel"
    >
      남은 과목 보기
    </button>
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

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
      {children}
    </span>
  )
}

function ReqCreditCard({
  label,
  earned,
  required,
}: {
  label: string
  earned: number
  required: number
}) {
  const met = required > 0 && earned >= required
  return (
    <div className="rounded-xl bg-panel px-4 py-3">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-1.5 text-lg font-extrabold text-ink">
        <span className={met ? 'text-emerald-700' : 'text-sejong'}>{earned}</span>
        <span className="text-sm font-bold text-ink-muted">/{required || '-'}학점</span>
      </p>
    </div>
  )
}

function DesignCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-ink-faint'
        }`}
        aria-hidden
      >
        {done ? '✓' : '–'}
      </span>
      <span className={done ? 'font-medium text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={`ml-auto text-xs font-semibold ${done ? 'text-emerald-700' : 'text-sejong'}`}>
        {done ? '이수' : '미이수'}
      </span>
    </li>
  )
}
