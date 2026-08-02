import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  getAbeekEvaluation,
  getAbeekFullRoadmap,
  getAbeekFullRoadmapByStudent,
  getGraduationProgress,
} from '../api/endpoints'
import type {
  AbeekEvaluationResponse,
  FullRoadmapResponse,
  GraduationProgressResponse,
  RoadmapCourse,
} from '../api/types'
import { flattenRoadmapCourses } from '../api/types'
import { ChartLegend } from '../components/charts/ChartLegend'
import { DonutChart } from '../components/charts/DonutChart'
import { CourseMiniList } from '../components/common/CourseMiniList'
import { CourseListModal } from '../components/modals/CourseListModal'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
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
  const { active } = useMajorTrack()
  const [evaluation, setEvaluation] = useState<AbeekEvaluationResponse | null>(null)
  const [graduation, setGraduation] = useState<GraduationProgressResponse | null>(null)
  const [roadmap, setRoadmap] = useState<FullRoadmapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [majorOpen, setMajorOpen] = useState(false)
  const [listModal, setListModal] = useState<{
    title: string
    subtitle?: string
    courses: Course[]
    groups?: Array<{ title: string; courses: Course[] }>
  } | null>(null)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const abeekId = student.studentNo || String(student.id)
        const departmentCode =
          student.tracks?.find((t) => t.departmentCode === active?.department)?.departmentCode ||
          student.tracks?.[0]?.departmentCode ||
          'CSE'

        const [data, grad] = await Promise.all([
          getAbeekEvaluation(abeekId),
          getGraduationProgress(student.id).catch(() => null),
        ])
        if (cancelled) return
        setEvaluation(data)
        setGraduation(grad)

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
  }, [student, active?.department])

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

  /** 전문교양 미이수(로드맵 REQUIRED) — 남은 과목 모달용. 학점·목록 표시는 evaluation.general 사용 */
  const generalRequiredRemaining = useMemo(
    () => splitRoadmap(generalRequiredAll).remaining,
    [generalRequiredAll],
  )
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

  // 전문교양 = evaluation.general (로드맵 GENERAL+REQUIRED로 재계산하지 않음)
  const generalEarned = toNumber(evaluation?.general?.earnedCredits)
  const generalRequiredCredits = toNumber(evaluation?.general?.requiredCredits)
  const generalPct = toPercent(evaluation?.general?.progressPercent)
  const generalCompleted = useMemo(
    () =>
      (evaluation?.general?.completedCourses ?? []).map((c) =>
        toCourse({
          courseCode: c.courseCode,
          courseName: c.courseName,
          credits: c.credits ?? c.credit,
        }),
      ),
    [evaluation?.general?.completedCourses],
  )

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

  // 인증선택: API 플래그 우선 (2021 이하는 false)
  const showCertElective =
    evaluation?.certElectiveApplicable ??
    ((evaluation?.entranceYear ?? student?.admissionYear ?? 9999) >= 2022)

  /** 2022학번부터 균형교양(균필) — graduation-progress API */
  const showBalancedLiberal =
    (graduation?.admissionYear ??
      evaluation?.entranceYear ??
      student?.admissionYear ??
      0) >= 2022

  const balancedLiberal = useMemo(() => {
    const fromCredits = graduation?.balancedLiberalCredits
    const areas = graduation?.balancedLiberalAreaProgresses ?? []
    const completed = (
      fromCredits?.completedCourses ?? areas.flatMap((a) => a.courses ?? [])
    ).map((c) => {
      const row = c as { courseCode: string; courseName: string; credit?: string; credits?: number }
      return toCourse({
        courseCode: row.courseCode,
        courseName: row.courseName,
        credits: row.credits ?? row.credit,
      })
    })
    const details = graduation?.missingBalancedLiberalAreaDetails ?? []
    const remainingFromDetails = details
      .filter((d) => d.area?.trim())
      .map((d) => {
        const hit = areas.find((a) => a.area === d.area)
        return toCourse({
          courseCode: d.area,
          courseName: d.area,
          credits: hit?.earnedCredits,
        })
      })
    const missingFromApi = (graduation?.missingBalancedLiberalAreas ?? [])
      .map((name) => name?.trim())
      .filter((name): name is string => !!name)
      .map((name) => {
        const hit = areas.find((a) => a.area === name)
        return toCourse({
          courseCode: name,
          courseName: name,
          credits: hit?.earnedCredits,
        })
      })
    const unsatisfiedAreas = areas
      .filter((a) => a.satisfied !== true)
      .map((a) =>
        toCourse({
          courseCode: a.area,
          courseName: a.area,
          credits: a.earnedCredits,
        }),
      )
    const remainingGroups = details
      .filter((d) => d.area?.trim())
      .map((d) => ({
        title: d.area,
        courses: (d.candidateCourses ?? []).map((c) =>
          toCourse({
            courseCode: c.courseCode,
            courseName: c.courseName,
            credits: c.credit,
          }),
        ),
      }))

    return {
      earned: toNumber(fromCredits?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent),
      completed,
      remaining:
        remainingFromDetails.length > 0
          ? remainingFromDetails
          : missingFromApi.length > 0
            ? missingFromApi
            : unsatisfiedAreas,
      remainingGroups,
      requiredAreas: graduation?.balancedLiberalRequiredAreaCount ?? 0,
      completedAreas: graduation?.balancedLiberalCompletedAreaCount ?? 0,
    }
  }, [graduation])

  const incompleteRequiredCourses = useMemo(
    () => (evaluation?.entranceRequiredCourses ?? []).filter((c) => c.completed === false),
    [evaluation?.entranceRequiredCourses],
  )

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
          {evaluation.graduationAbeekBasisLabel && (
            <MetaChip>{evaluation.graduationAbeekBasisLabel}</MetaChip>
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
        {!evaluation.overallSatisfied && incompleteRequiredCourses.length > 0 && (
          <p className="mt-2 text-sm text-ink-muted">
            미이수 인증필수 과목:{' '}
            <span className="font-semibold text-sejong">
              {incompleteRequiredCourses.map((c) => c.courseName).join(', ')}
            </span>
          </p>
        )}
      </div>

      <div className="mx-auto max-w-[1120px] space-y-4 px-1">
        <article className="rounded-[20px] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-3 text-base font-bold text-ink">인증 요약</h3>

          <div
            className={`grid grid-cols-2 gap-3 ${
              showBalancedLiberal ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
            }`}
          >
            <SummaryMiniGauge
              label="전문교양"
              percent={generalPct}
              earned={generalEarned}
              required={generalRequiredCredits}
            />
            <SummaryMiniGauge
              label="BSM"
              percent={bsmPct}
              earned={bsmEarned}
              required={bsmRequired}
            />
            <SummaryMiniGauge
              label="전공"
              percent={majorPct}
              earned={majorEarned}
              required={majorRequired}
            />
            <SummaryMiniGauge
              label="설계"
              percent={designPct}
              earned={toNumber(designEarned)}
              required={designRequired}
            />
            {showBalancedLiberal && (
              <SummaryMiniGauge
                label="균필"
                percent={balancedLiberal.percent}
                earned={balancedLiberal.earned}
                required={balancedLiberal.required}
              />
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl bg-panel/70 px-3.5 py-3">
              <p className="mb-2 text-sm font-bold text-ink">설계 시퀀스</p>
              <ul className="space-y-2">
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
                <p className="mt-2 text-[11px] text-ink-muted">
                  기초 → 요소 → 종합 순서를 모두 이수해야 설계 시퀀스가 충족됩니다.
                </p>
              )}
            </section>

            <section className="rounded-xl bg-panel/70 px-3.5 py-3">
              <p className="mb-2 text-sm font-bold text-ink">적용 요건 · 안내</p>
              {evaluation.graduationAbeekBasisLabel && (
                <p className="mb-2 text-xs font-semibold text-ink">
                  {evaluation.graduationAbeekBasisLabel}
                </p>
              )}
              {incompleteRequiredCourses.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-[11px] font-semibold text-sejong">미이수 인증필수 과목</p>
                  <ul className="space-y-0.5">
                    {incompleteRequiredCourses.slice(0, 4).map((c) => (
                      <li key={c.courseCode} className="text-[11px] text-ink-muted">
                        {c.courseName}
                      </li>
                    ))}
                    {incompleteRequiredCourses.length > 4 && (
                      <li className="text-[11px] text-ink-faint">
                        외 {incompleteRequiredCourses.length - 4}과목
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {requirementNotes.length > 0 ? (
                <ul className="space-y-1">
                  {requirementNotes.slice(0, 3).map((msg) => (
                    <li key={msg} className="text-[11px] leading-relaxed text-ink-muted">
                      {msg.replace(/^[·•\s]+/, '')}
                    </li>
                  ))}
                </ul>
              ) : (
                !evaluation.graduationAbeekBasisLabel &&
                incompleteRequiredCourses.length === 0 && (
                  <p className="text-[11px] text-ink-muted">
                    입학 {evaluation.entranceYear ?? '-'}년도 기준으로 평가합니다.
                  </p>
                )
              )}

              {(waivedCourses.length > 0 || waivedNotes.length > 0) && (
                <div className="mt-2 border-t border-black/5 pt-2">
                  <p className="mb-1 text-[11px] font-semibold text-ink">면제 과목</p>
                  {waivedCourses.length > 0 ? (
                    <ul className="space-y-1">
                      {waivedCourses.slice(0, 3).map((c) => (
                        <li key={c.courseCode} className="text-[11px] text-ink-muted">
                          {c.courseName}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-1">
                      {waivedNotes.slice(0, 2).map((msg) => (
                        <li key={msg} className="text-[11px] text-ink-muted">
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

        {/* 1행: 전문교양 | BSM */}
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <article className="rounded-[20px] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ink">
                전문교양{' '}
                <span className="text-sejong">{generalEarned}</span>
                {generalRequiredCredits ? (
                  <span className="text-ink-muted">/{generalRequiredCredits}</span>
                ) : null}
                학점
              </h3>
              {generalRequiredRemaining.length > 0 && (
                <RemainingButton
                  onClick={() =>
                    setListModal({
                      title: '전문교양 남은 과목',
                      subtitle: `${generalRequiredRemaining.length}과목`,
                      courses: generalRequiredRemaining,
                    })
                  }
                />
              )}
            </div>
            <AbeekCategoryBlock
              percent={generalPct}
              courses={generalCompleted}
              totalValue={generalEarned}
              legend="최소 이수 학점"
              onMore={() =>
                setListModal({
                  title: '전문교양 이수 과목',
                  subtitle: `${generalEarned}학점 · ${generalCompleted.length}과목`,
                  courses: generalCompleted,
                })
              }
            />
          </article>

          <article className="rounded-[20px] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ink">
                BSM{' '}
                <span className="text-sejong">
                  {bsmEarned}/{bsmRequired || '-'}
                </span>
                학점
              </h3>
              {bsm.remaining.length > 0 && (
                <RemainingButton
                  onClick={() =>
                    setListModal({
                      title: 'BSM 남은 과목',
                      subtitle: `${bsm.remaining.length}과목`,
                      courses: bsm.remaining,
                    })
                  }
                />
              )}
            </div>
            <AbeekCategoryBlock
              percent={bsmPct}
              courses={bsm.completed}
              totalValue={bsmEarned}
              legend="총 학점"
              onMore={() =>
                setListModal({
                  title: 'BSM 이수 과목',
                  subtitle: `${bsmEarned}학점 · ${bsm.completed.length}과목`,
                  courses: bsm.completed,
                })
              }
            />
          </article>
        </div>

        {/* 2행: 인증선택 · 균필 (해당 시) */}
        {(showCertElective || showBalancedLiberal) && (
          <div
            className={`grid items-stretch gap-4 ${
              showCertElective && showBalancedLiberal ? 'lg:grid-cols-2' : ''
            }`}
          >
            {showCertElective && (
              <article className="rounded-[20px] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-ink">
                    인증선택{' '}
                    <span className="text-sejong">{genElecEarned}</span>
                    학점
                  </h3>
                  {generalElective.remaining.length > 0 && (
                    <RemainingButton
                      onClick={() =>
                        setListModal({
                          title: '인증선택 남은 과목',
                          subtitle: `${generalElective.remaining.length}과목`,
                          courses: generalElective.remaining,
                        })
                      }
                    />
                  )}
                </div>
                <AbeekCategoryBlock
                  percent={genElecPct}
                  courses={generalElective.completed}
                  totalValue={genElecEarned}
                  legend="최소 이수 학점"
                  onMore={() =>
                    setListModal({
                      title: '인증선택 이수 과목',
                      subtitle: `${genElecEarned}학점 · ${generalElective.completed.length}과목`,
                      courses: generalElective.completed,
                    })
                  }
                />
              </article>
            )}

            {showBalancedLiberal && (
              <article className="rounded-[20px] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      균필(균형교양){' '}
                      <span className="text-sejong">
                        {balancedLiberal.earned}/{balancedLiberal.required || '-'}
                      </span>
                      학점
                    </h3>
                    {balancedLiberal.requiredAreas > 0 && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        영역 {balancedLiberal.completedAreas}/{balancedLiberal.requiredAreas} 충족
                      </p>
                    )}
                  </div>
                  {balancedLiberal.remaining.length > 0 && (
                    <RemainingButton
                      onClick={() =>
                        setListModal({
                          title: '균필 미충족 영역',
                          subtitle:
                            balancedLiberal.requiredAreas > 0
                              ? `${balancedLiberal.completedAreas}/${balancedLiberal.requiredAreas}개 영역`
                              : `${balancedLiberal.remaining.length}개`,
                          courses:
                            balancedLiberal.remainingGroups.length > 0
                              ? []
                              : balancedLiberal.remaining,
                          groups:
                            balancedLiberal.remainingGroups.length > 0
                              ? balancedLiberal.remainingGroups
                              : undefined,
                        })
                      }
                    />
                  )}
                </div>
                <AbeekCategoryBlock
                  percent={balancedLiberal.percent}
                  courses={balancedLiberal.completed}
                  totalValue={balancedLiberal.earned}
                  legend="총 학점"
                  onMore={() =>
                    setListModal({
                      title: '균필(균형교양) 이수 과목',
                      subtitle: `${balancedLiberal.earned}학점 · ${balancedLiberal.completed.length}과목`,
                      courses: balancedLiberal.completed,
                    })
                  }
                />
              </article>
            )}
          </div>
        )}

        <article className="rounded-[20px] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">
                전공{' '}
                <span className="text-sejong">
                  {majorEarned}/{majorRequired || '-'}
                </span>
                학점
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                설계 {designEarned}
                {designRequired ? `/${designRequired}` : ''}학점
                {evaluation.designSequenceSatisfied === false ? ' · 시퀀스 미충족' : ''}
              </p>
            </div>
            {(major.remaining.length > 0 || designLists.remaining.length > 0) && (
              <RemainingButton
                onClick={() =>
                  setListModal({
                    title: '전공·설계 남은 과목',
                    subtitle: `전공 ${major.remaining.length} · 설계 ${designLists.remaining.length}`,
                    courses: [...major.remaining, ...designLists.remaining],
                  })
                }
              />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AbeekCategoryBlock
              title="전공교과목"
              percent={majorPct}
              courses={major.completed}
              totalValue={majorEarned}
              legend="총 학점"
              onMore={() => setMajorOpen(true)}
            />
            <AbeekCategoryBlock
              title="설계"
              percent={designPct}
              courses={designLists.completed}
              totalValue={designEarned}
              legend="총 학점"
              onMore={() =>
                setListModal({
                  title: '설계 이수 과목',
                  subtitle: `${designEarned}학점 · ${designLists.completed.length}과목`,
                  courses: designLists.completed,
                })
              }
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
          open={listModal != null}
          onClose={() => setListModal(null)}
          title={listModal?.title ?? '과목 목록'}
          subtitle={listModal?.subtitle}
          courses={listModal?.courses ?? []}
          groups={listModal?.groups}
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
      className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-panel"
    >
      남은 과목 보기
    </button>
  )
}

function SummaryMiniGauge({
  label,
  percent,
  earned,
  required,
}: {
  label: string
  percent: number
  earned: number
  required: number
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-panel/70 px-3 py-3">
      <p className="mb-1 text-xs font-bold text-ink">{label}</p>
      <DonutChart
        percent={percent}
        size={84}
        stroke={10}
        color="#5b6470"
        label={formatPercentLabel(percent)}
      />
      <p className="mt-1.5 text-[11px] font-semibold text-ink-muted">
        <span className="text-ink">{earned}</span>/{required || '-'}학점
      </p>
    </div>
  )
}

function AbeekCategoryBlock({
  title,
  percent,
  courses,
  totalValue,
  legend,
  onMore,
}: {
  title?: string
  percent: number
  courses: Course[]
  totalValue: number | string
  legend: '최소 이수 학점' | '총 학점'
  onMore: () => void
}) {
  return (
    <section className="w-full min-w-0">
      <div className="flex w-full min-w-0 items-start gap-4 pr-1">
        <div className="flex shrink-0 flex-col items-center self-center">
          {title && (
            <p className="mb-1 text-center text-sm font-bold text-ink">{title}</p>
          )}
          <ChartLegend
            secondaryLabel={legend}
            activeColor="#5b6470"
            className="mb-2 justify-center scale-90"
          />
          <DonutChart
            percent={percent}
            size={112}
            stroke={12}
            color="#5b6470"
            label={formatPercentLabel(percent)}
          />
        </div>
        <CourseMiniList
          title="이수한 과목"
          courses={courses}
          totalValue={totalValue}
          previewCount={4}
          showMoreLink
          className="min-w-0 flex-1"
          emptyText="이수한 과목이 없습니다."
          onMoreClick={onMore}
        />
      </div>
    </section>
  )
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
      {children}
    </span>
  )
}

function DesignCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-ink-faint'
        }`}
        aria-hidden
      >
        {done ? '✓' : '–'}
      </span>
      <span className={done ? 'text-[13px] font-medium text-ink' : 'text-[13px] text-ink-muted'}>
        {label}
      </span>
      <span
        className={`ml-auto text-[11px] font-semibold ${
          done ? 'text-emerald-700' : 'text-sejong'
        }`}
      >
        {done ? '이수' : '미이수'}
      </span>
    </li>
  )
}
