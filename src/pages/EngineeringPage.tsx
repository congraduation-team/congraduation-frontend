import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  getAbeekEvaluation,
  getAbeekEvaluationDetail,
  getAbeekFullRoadmap,
  getAbeekFullRoadmapByStudent,
} from '../api/endpoints'
import type {
  AbeekDetailCourse,
  AbeekEvaluationCategoryDetail,
  AbeekEvaluationDetailResponse,
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
import { useMajorTrack } from '../context/MajorTrackContext'
import type { Course } from '../data/mockData'
import { formatPercentLabel, toNumber, toPercent } from '../utils/number'

/** 안내 문구 속 "과목(사유), 과목(사유)" 목록을 괄호 깊이 기준으로 분리 */
function splitCourseEntries(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of body) {
    if (ch === '(') depth += 1
    if (ch === ')' && depth > 0) depth -= 1
    if (ch === ',' && depth === 0) {
      const s = buf.trim()
      if (s) parts.push(s)
      buf = ''
      continue
    }
    buf += ch
  }
  const last = buf.trim()
  if (last) parts.push(last)
  return parts
}

/** 공학인증 안내 문구를 읽기 쉬운 줄로 나눔 */
function splitAbeekNote(msg: string): string[] {
  const text = msg.trim().replace(/^[·•\s]+/, '').replace(/\s+/g, ' ')
  if (!text) return []

  const designDenied = text.match(/^(설계학점\s*불인정(?:\s*[^:]+)?)\s*:\s*(.+)$/u)
  if (designDenied?.[1] && designDenied[2]) {
    const header = designDenied[1].replace(/\s+/g, ' ').trim()
    const courses = splitCourseEntries(designDenied[2].trim())
    return courses.length > 0 ? [header, ...courses] : [text]
  }

  return [text]
}

function AbeekNoteText({ msg }: { msg: string }) {
  const lines = splitAbeekNote(msg)
  if (lines.length === 0) return null

  const shortage = lines[0]?.match(
    /^(인증선택\s*부족)\s*:\s*(.+)$/u,
  )
  if (lines.length === 1 && shortage?.[1] && shortage[2]) {
    return (
      <div className="break-keep text-pretty">
        <p className="font-semibold text-sejong">{shortage[1]}</p>
        <p className="mt-1 text-ink-muted">{shortage[2]}</p>
      </div>
    )
  }

  if (lines.length === 1) {
    return <p className="break-keep text-pretty text-ink-muted">{lines[0]}</p>
  }

  const [header, ...courses] = lines
  return (
    <div className="break-keep text-pretty">
      <p className="font-semibold text-ink">{header}</p>
      <ul className="mt-2 space-y-1.5">
        {courses.map((course) => (
          <li key={course} className="text-ink-muted">
            · {course}
          </li>
        ))}
      </ul>
    </div>
  )
}

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

/** detail API 과목 → UI Course. 학수번호는 sejongCourseCode만 사용 */
function detailToCourse(c: AbeekDetailCourse): Course {
  return {
    code: (c.sejongCourseCode || '').trim(),
    name: c.courseName,
    credits: toNumber(c.credits ?? c.credit),
  }
}

function findAbeekCategory(
  detail: AbeekEvaluationDetailResponse | null | undefined,
  key: string,
): AbeekEvaluationCategoryDetail | undefined {
  return detail?.categories?.find(
    (c) => (c.categoryKey || '').toUpperCase() === key.toUpperCase(),
  )
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
  const [evaluationDetail, setEvaluationDetail] =
    useState<AbeekEvaluationDetailResponse | null>(null)
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

        const [data, detail] = await Promise.all([
          getAbeekEvaluation(abeekId),
          getAbeekEvaluationDetail(abeekId).catch(() => null),
        ])
        if (cancelled) return
        setEvaluation(data)
        setEvaluationDetail(detail)

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

  const generalCat = useMemo(
    () => findAbeekCategory(evaluationDetail, 'GENERAL'),
    [evaluationDetail],
  )
  const bsmCat = useMemo(() => findAbeekCategory(evaluationDetail, 'BSM'), [evaluationDetail])
  const majorCat = useMemo(() => findAbeekCategory(evaluationDetail, 'MAJOR'), [evaluationDetail])
  const certElectiveCat = useMemo(
    () =>
      findAbeekCategory(evaluationDetail, 'CERT_ELECTIVE') ||
      findAbeekCategory(evaluationDetail, 'GENERAL_ELECTIVE'),
    [evaluationDetail],
  )

  /** 인증필수(GENERAL) 남은 필수 — detail remainingCourses 우선 */
  const generalRequiredRemaining = useMemo(() => {
    if (generalCat?.remainingCourses) {
      return generalCat.remainingCourses.map((c) => detailToCourse(c))
    }
    return splitRoadmap(generalRequiredAll).remaining
  }, [generalCat, generalRequiredAll])

  const generalCompleted = useMemo(() => {
    if (generalCat?.completedCourses?.length) {
      return generalCat.completedCourses
        .filter((c) => {
          const role = (c.role || '').toUpperCase()
          if (role.includes('CERT_ELECTIVE') || role === 'ELECTIVE') return false
          if (c.electiveArea || c.electiveAreaLabel) return false
          return true
        })
        .map((c) => detailToCourse(c))
    }
    return (evaluation?.general?.completedCourses ?? []).map((c) =>
      toCourse({
        courseCode: '',
        courseName: c.courseName,
        credits: c.credits ?? c.credit,
      }),
    )
  }, [generalCat, evaluation?.general?.completedCourses])

  const generalElective = useMemo(() => splitRoadmap(generalElectiveAll), [generalElectiveAll])
  const bsmFromRoadmap = useMemo(() => splitRoadmap(bsmAll), [bsmAll])
  const majorFromRoadmap = useMemo(() => splitRoadmap(majorAll), [majorAll])

  const bsm = useMemo(() => {
    if (bsmCat?.completedCourses || bsmCat?.remainingCourses) {
      return {
        completed: (bsmCat.completedCourses ?? []).map((c) => detailToCourse(c)),
        remaining: (bsmCat.remainingCourses ?? []).map((c) => detailToCourse(c)),
      }
    }
    return bsmFromRoadmap
  }, [bsmCat, bsmFromRoadmap])

  const major = useMemo(() => {
    if (majorCat?.completedCourses || majorCat?.remainingCourses) {
      return {
        completed: (majorCat.completedCourses ?? []).map((c) => detailToCourse(c)),
        remaining: (majorCat.remainingCourses ?? []).map((c) => detailToCourse(c)),
      }
    }
    return majorFromRoadmap
  }, [majorCat, majorFromRoadmap])

  /** 인증선택 카드: remainingAreas 영역 목록 */
  const certElectiveRemainingAreas = useMemo(() => {
    const areas = certElectiveCat?.remainingAreas ?? []
    if (areas.length > 0) {
      return areas.map((a) =>
        toCourse({
          courseCode: (a.areaLabel || a.area || '').trim(),
          courseName: a.areaLabel || a.area || '미충족 영역',
          credits: a.remainingCourseCount ?? 0,
        }),
      )
    }
    return generalElective.remaining
  }, [certElectiveCat, generalElective.remaining])

  const certElectiveCompleted = useMemo(() => {
    if (certElectiveCat?.completedCourses?.length) {
      return certElectiveCat.completedCourses.map((c) => detailToCourse(c))
    }
    return generalElective.completed
  }, [certElectiveCat, generalElective.completed])

  const certElectiveRemainingGroups = useMemo(() => {
    const areas = certElectiveCat?.remainingAreas ?? []
    return areas
      .filter((a) => (a.areaLabel || a.area)?.trim())
      .map((a) => ({
        title: a.areaLabel || a.area || '',
        courses: (a.remainingCourses ?? []).map((c) => detailToCourse(c)),
      }))
  }, [certElectiveCat])

  const certElectiveRemainingCoursesFlat = useMemo(() => {
    if (certElectiveCat?.remainingCourses?.length) {
      return certElectiveCat.remainingCourses.map((c) => detailToCourse(c))
    }
    return certElectiveRemainingGroups.flatMap((g) => g.courses)
  }, [certElectiveCat, certElectiveRemainingGroups])

  const designLists = useMemo(() => {
    const completed = designAll
      .filter(isActuallyCompleted)
      .map((c) => roadmapToCourse(c, c.designCredits))
    const remaining = designAll
      .filter((c) => !isActuallyCompleted(c))
      .map((c) =>
        toCourse({
          courseCode: '',
          courseName: c.courseName,
          credits: c.designCredits,
          semester: c.recommendedTerm,
        }),
      )
    return { completed, remaining }
  }, [designAll])

  const displayName = evaluation?.studentName || roadmap?.studentName || student?.name || '학생'

  // 인증필수 = evaluation.general (로드맵 GENERAL+REQUIRED로 재계산하지 않음)
  const generalEarned = toNumber(
    generalCat?.earnedCredits ?? evaluation?.general?.earnedCredits,
  )
  const generalRequiredCredits = toNumber(
    generalCat?.requiredCredits ?? evaluation?.general?.requiredCredits,
  )
  const generalPct = toPercent(
    generalCat?.progressPercent ?? evaluation?.general?.progressPercent,
  )

  const genElecEarned =
    toNumber(certElectiveCat?.earnedCredits ?? evaluation?.certElective?.earnedCredits) ||
    certElectiveCompleted.reduce((s, c) => s + c.credits, 0)
  const genElecRequired =
    toNumber(certElectiveCat?.requiredCredits ?? evaluation?.certElective?.requiredCredits) ||
    generalElectiveAll.reduce((s, c) => s + toNumber(c.credits), 0)
  const genElecPct =
    toNumber(certElectiveCat?.progressPercent ?? evaluation?.certElective?.progressPercent) > 0
      ? toPercent(certElectiveCat?.progressPercent ?? evaluation?.certElective?.progressPercent)
      : genElecRequired > 0
        ? Math.max(0, Math.min(100, Math.round((genElecEarned / genElecRequired) * 100)))
        : generalPct

  const bsmEarned = toNumber(bsmCat?.earnedCredits ?? evaluation?.bsm?.earnedCredits)
  const bsmRequired = toNumber(bsmCat?.requiredCredits ?? evaluation?.bsm?.requiredCredits)
  const bsmPct =
    bsmRequired > 0
      ? Math.max(0, Math.min(100, Math.round((bsmEarned / bsmRequired) * 100)))
      : toPercent(bsmCat?.progressPercent ?? evaluation?.bsm?.progressPercent)

  const majorEarned = toNumber(majorCat?.earnedCredits ?? evaluation?.major?.earnedCredits)
  const majorRequired = toNumber(majorCat?.requiredCredits ?? evaluation?.major?.requiredCredits)
  const majorPct = toPercent(majorCat?.progressPercent ?? evaluation?.major?.progressPercent)

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
  const unrecognizedDesignCourses = (designDetail?.courses ?? []).filter(
    (c) => c.recognized === false,
  )
  const waivedCourses = evaluation.waivedGraduationOnlyCourses ?? []
  const requirementNotes: string[] = []
  const waivedNotes: string[] = []
  for (const msg of evaluation.messages ?? []) {
    if (msg.includes('면제')) waivedNotes.push(msg)
    else if (msg.includes('미이수')) continue
    else if (
      msg.includes('설계학점') &&
      msg.includes('불인정') &&
      unrecognizedDesignCourses.length > 0
    ) {
      continue
    } else if (msg.includes('학점') || msg.includes('최소') || msg.includes('유리') || msg.includes('불인정')) {
      requirementNotes.push(msg)
    }
  }

  return (
    <div className="pt-1">
      <div className="mb-6">
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
      </div>

      <div className="mx-auto max-w-[1280px] space-y-4 px-1">
        <article className="rounded-[20px] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-3 text-base font-bold text-ink">인증 요약</h3>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryMiniGauge
              label="인증필수"
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
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#e8eaee] bg-white">
            <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#e8eaee]">
              <div className="px-5 py-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <h4 className="text-[15px] font-bold text-ink">설계 시퀀스</h4>
                  <p className="text-[12px] text-ink-muted">기초 → 요소 → 종합</p>
                </div>

                <ol className="space-y-1.5">
                  <DesignCheck
                    step={1}
                    label="기초설계"
                    detail="공학설계기초"
                    done={designDetail?.hasBasicDesign === true}
                  />
                  <DesignCheck
                    step={2}
                    label="요소설계"
                    done={designDetail?.hasElementDesign === true}
                  />
                  <DesignCheck
                    step={3}
                    label="종합설계"
                    detail="Capstone"
                    done={designDetail?.hasComprehensiveDesign === true}
                  />
                </ol>

                {unrecognizedDesignCourses.length > 0 && (
                  <div className="mt-4 rounded-xl bg-[#fff6f7] px-3.5 py-3">
                    <p className="mb-2 text-[13px] font-bold text-sejong">설계학점 불인정</p>
                    <ul className="space-y-2.5">
                      {unrecognizedDesignCourses.map((c) => (
                        <li key={c.courseCode}>
                          <p className="text-sm font-semibold text-ink">{c.courseName}</p>
                          {c.reason && (
                            <p className="mt-0.5 break-keep text-pretty text-[12px] leading-relaxed text-ink-muted">
                              {c.reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-[#e8eaee] px-5 py-5 lg:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[15px] font-bold text-ink">적용 요건 · 안내</h4>
                  {evaluation.graduationAbeekBasisLabel && (
                    <span className="rounded-full bg-[#f4f5f7] px-2.5 py-1 text-[12px] font-semibold text-ink-muted">
                      {evaluation.graduationAbeekBasisLabel}
                    </span>
                  )}
                </div>

                {!evaluation.graduationAbeekBasisLabel && requirementNotes.length === 0 && (
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    입학 {evaluation.entranceYear ?? '-'}년도 기준으로 평가합니다.
                  </p>
                )}

                {requirementNotes.length > 0 && (
                  <ul className="space-y-2">
                    {requirementNotes.slice(0, 3).map((msg) => (
                      <li
                        key={msg}
                        className="rounded-xl bg-[#f7f8fa] px-3.5 py-3 text-[13px] leading-relaxed"
                      >
                        <AbeekNoteText msg={msg} />
                      </li>
                    ))}
                  </ul>
                )}

                {(waivedCourses.length > 0 || waivedNotes.length > 0) && (
                  <div className="rounded-xl bg-[#f7f8fa] px-3.5 py-3">
                    <p className="mb-2 text-[13px] font-bold text-ink">면제 과목</p>
                    {waivedCourses.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {waivedCourses.slice(0, 5).map((c) => (
                          <li
                            key={c.courseCode}
                            className="rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-ink ring-1 ring-[#e5e7eb]"
                          >
                            {c.courseName}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="space-y-1.5">
                        {waivedNotes.slice(0, 2).map((msg) => (
                          <li key={msg} className="text-[13px] leading-relaxed text-ink-muted">
                            {msg.replace(/^[·•\s]+/, '')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </article>

        {/* 카테고리 상세 — 졸업요건 DetailCreditCard와 동일 형식 */}
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <AbeekDetailCard
            title="인증필수"
            remainingTitle="남은 필수 과목"
            percent={generalPct}
            earned={generalEarned}
            required={generalRequiredCredits}
            completed={generalCompleted}
            remaining={generalRequiredRemaining}
            onOpenCompleted={() =>
              setListModal({
                title: '인증필수 이수 과목',
                subtitle: `${generalEarned}학점 · ${generalCompleted.length}과목`,
                courses: generalCompleted,
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: '인증필수 남은 과목',
                subtitle: `${generalRequiredRemaining.length}과목`,
                courses: generalRequiredRemaining,
              })
            }
          />
          <AbeekDetailCard
            title="BSM"
            remainingTitle="남은 BSM 과목"
            percent={bsmPct}
            earned={bsmEarned}
            required={bsmRequired}
            completed={bsm.completed}
            remaining={bsm.remaining}
            onOpenCompleted={() =>
              setListModal({
                title: 'BSM 이수 과목',
                subtitle: `${bsmEarned}학점 · ${bsm.completed.length}과목`,
                courses: bsm.completed,
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: 'BSM 남은 과목',
                subtitle: `${bsm.remaining.length}과목`,
                courses: bsm.remaining,
              })
            }
          />
          <AbeekDetailCard
            title="전공"
            areaHint={
              designRequired > 0
                ? `설계 ${designEarned}/${designRequired}학점${
                    evaluation.designSequenceSatisfied === false ? ' · 시퀀스 미충족' : ''
                  }`
                : undefined
            }
            remainingTitle="남은 전공 과목"
            percent={majorPct}
            earned={majorEarned}
            required={majorRequired}
            completed={major.completed}
            remaining={major.remaining}
            onOpenCompleted={() => setMajorOpen(true)}
            onOpenRemaining={() =>
              setListModal({
                title: '남은 전공 과목',
                subtitle: `${major.remaining.length}과목`,
                courses: major.remaining,
              })
            }
          />
          <AbeekDetailCard
            title="설계"
            areaHint={
              evaluation.designSequenceSatisfied === false
                ? '기초 → 요소 → 종합 시퀀스 미충족'
                : undefined
            }
            remainingTitle="남은 설계 과목"
            percent={designPct}
            earned={toNumber(designEarned)}
            required={designRequired}
            completed={designLists.completed}
            remaining={designLists.remaining}
            onOpenCompleted={() =>
              setListModal({
                title: '설계 이수 과목',
                subtitle: `${designEarned}학점 · ${designLists.completed.length}과목`,
                courses: designLists.completed,
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: '남은 설계 과목',
                subtitle: `${designLists.remaining.length}과목`,
                courses: designLists.remaining,
              })
            }
          />
          {showCertElective && (
            <AbeekDetailCard
              title="인증선택"
              remainingTitle="남은 영역"
              percent={genElecPct}
              earned={genElecEarned}
              required={genElecRequired}
              completed={certElectiveCompleted}
              remaining={certElectiveRemainingAreas}
              onOpenCompleted={() =>
                setListModal({
                  title: '인증선택 이수 과목',
                  subtitle: `${genElecEarned}학점 · ${certElectiveCompleted.length}과목`,
                  courses: certElectiveCompleted,
                })
              }
              onOpenRemaining={() =>
                setListModal({
                  title: '인증선택 남은 영역',
                  subtitle:
                    certElectiveRemainingAreas.length > 0
                      ? `${certElectiveRemainingAreas.length}개 영역`
                      : `${certElectiveRemainingCoursesFlat.length}과목`,
                  courses:
                    certElectiveRemainingGroups.length > 0
                      ? []
                      : certElectiveRemainingCoursesFlat,
                  groups:
                    certElectiveRemainingGroups.length > 0
                      ? certElectiveRemainingGroups
                      : undefined,
                })
              }
            />
          )}
        </div>

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

function CreditStatusSummary({
  earned,
  required,
}: {
  earned: number
  required?: number
}) {
  const need = required && required > 0 ? required : 0
  const hasRequirement = need > 0
  const satisfied = hasRequirement && earned >= need
  const shortfall = hasRequirement ? Math.max(0, need - earned) : 0

  return (
    <div className="mt-2 min-w-[7.75rem] text-center">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-[11px] font-semibold text-ink-muted">이수</span>
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            {earned}
            <span className="ml-0.5 text-[10px] font-bold text-ink-muted">학점</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-[11px] font-semibold text-ink-muted">필요</span>
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            {hasRequirement ? need : '-'}
            {hasRequirement && (
              <span className="ml-0.5 text-[10px] font-bold text-ink-muted">학점</span>
            )}
          </span>
        </div>
      </div>
      {hasRequirement && (
        <p
          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold leading-none ${
            satisfied
              ? 'bg-[#e7f6ee] text-[#1b7a4a]'
              : 'bg-[#fde8ec] text-sejong'
          }`}
        >
          {satisfied ? '요건 충족' : `${shortfall}학점 부족`}
        </p>
      )}
    </div>
  )
}

function AbeekDetailCard({
  title,
  remainingTitle,
  percent = 0,
  earned,
  required = 0,
  completed,
  remaining = [],
  areaHint,
  onOpenCompleted,
  onOpenRemaining,
}: {
  title: string
  remainingTitle: string
  percent?: number
  earned: number
  required?: number
  completed: Course[]
  remaining?: Course[]
  areaHint?: string
  onOpenCompleted: () => void
  onOpenRemaining: () => void
}) {
  return (
    <article className="flex h-full flex-col rounded-[20px] bg-white px-5 pb-5 pt-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <h3 className="mb-3 text-base font-bold leading-snug text-ink">{title}</h3>
      {areaHint && <p className="mb-3 text-xs font-semibold text-ink-muted">{areaHint}</p>}
      <ChartLegend secondaryLabel="총 학점" activeColor="#5b6470" className="mb-4" />

      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-1 self-center pt-1 sm:self-start sm:pt-2">
          <DonutChart
            percent={percent}
            size={100}
            stroke={11}
            color="#5b6470"
            label={formatPercentLabel(percent)}
          />
          <CreditStatusSummary earned={earned} required={required} />
        </div>

        <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-2">
          <CourseMiniList
            title="이수한 과목"
            courses={completed}
            previewCount={4}
            showMoreLink
            totalValue={earned}
            emptyText="이수한 과목이 없습니다."
            onMoreClick={onOpenCompleted}
          />
          <CourseMiniList
            title={remainingTitle}
            courses={remaining}
            previewCount={4}
            showMoreLink
            emptyText="남은 항목이 없습니다."
            onMoreClick={onOpenRemaining}
          />
        </div>
      </div>
    </article>
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

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-ink-muted">
      {children}
    </span>
  )
}

function DesignCheck({
  step,
  label,
  detail,
  done,
}: {
  step: number
  label: string
  detail?: string
  done: boolean
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-[#f7f8fa] px-3 py-2.5">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-sejong/10 text-sejong'
        }`}
        aria-hidden
      >
        {done ? '✓' : step}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {label}
          {detail ? (
            <span className="ml-1.5 text-[12px] font-medium text-ink-muted">({detail})</span>
          ) : null}
        </p>
      </div>
      <span
        className={`shrink-0 text-[12px] font-bold ${
          done ? 'text-emerald-700' : 'text-sejong'
        }`}
      >
        {done ? '이수' : '미이수'}
      </span>
    </li>
  )
}
