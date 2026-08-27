import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGraduationProgress, getPlannedCourseCatalog, getStudentRoadmapByStudent } from '../api/endpoints'
import type { CategoryCourse, GraduationProgressResponse } from '../api/types'
import { ChartLegend } from '../components/charts/ChartLegend'
import { DonutChart } from '../components/charts/DonutChart'
import { CourseMiniList } from '../components/common/CourseMiniList'
import { CourseListModal } from '../components/modals/CourseListModal'
import { EnglishCertModal } from '../components/modals/EnglishCertModal'
import { SWCodingCertModal } from '../components/modals/SWCodingCertModal'
import { useAuth } from '../context/AuthContext'
import { useMajorTrack } from '../context/MajorTrackContext'
import { classicReading } from '../data/mockData'
import {
  isGuidanceStatus,
  trackStatusClass,
  trackStatusLabel,
  trackTypeLabel,
} from '../utils/majorTrack'
import { formatPercentLabel, toNumber, toPercent } from '../utils/number'
import { CertDetailText } from '../utils/certDetail'
import {
  englishProgressLine,
  englishRequirementPreviewFromCert,
  englishRequirementsFromCert,
} from '../utils/englishCertification'
import {
  isAcademicCourseCode,
  lookupAcademicCodeByName,
  normalizeCourseNameKey,
} from '../utils/courseCode'

function isElectiveLiberalCategory(category?: string) {
  const c = category || ''
  return c.includes('교선') || c.includes('교양선택') || c.includes('선택교양')
}

function isDoubleMajorRequiredCategory(category?: string) {
  const c = category || ''
  return c.includes('복필') || c.includes('복수전필') || c.includes('복전필')
}

function isDoubleMajorElectiveCategory(category?: string) {
  const c = category || ''
  return c.includes('복선') || c.includes('복수전선') || c.includes('복전선')
}

function toUiCourses(
  courses?: CategoryCourse[] | Array<Record<string, unknown>>,
  codeByName?: Map<string, string>,
) {
  return (courses ?? [])
    .map((c) => {
      const row = c as Record<string, unknown>
      const name = String(row.courseName ?? row.name ?? '').trim()
      const rawCode = String(row.courseCode ?? row.code ?? '').trim()
      let code = ''
      if (isAcademicCourseCode(rawCode)) {
        code = rawCode
      } else if (rawCode && codeByName && name) {
        code = lookupAcademicCodeByName(name, codeByName) || ''
      }
      const creditRaw = row.credit ?? row.credits
      const hasCredit = creditRaw != null && String(creditRaw).trim() !== ''
      const credits = hasCredit ? toNumber(creditRaw as string | number) : undefined
      const base: { name: string; credits?: number; code: string; semester?: string } = {
        name,
        code,
      }
      if (credits != null && credits > 0) base.credits = credits
      if (row.recommendedTerm != null && String(row.recommendedTerm) !== '') {
        base.semester = String(row.recommendedTerm)
      }
      return base
    })
    .filter((c) => c.name)
}

export function GraduationPage() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const { active, setMajorTracksProgress } = useMajorTrack()
  const [progress, setProgress] = useState<GraduationProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [englishOpen, setEnglishOpen] = useState(false)
  const [swOpen, setSwOpen] = useState(false)
  const [listModal, setListModal] = useState<{
    title: string
    subtitle?: string
    courses: ReturnType<typeof toUiCourses>
    groups?: Array<{ title: string; courses: ReturnType<typeof toUiCourses> }>
  } | null>(null)
  /** 과목명 → 학수번호 (MAJ_* 대체용) */
  const [codeByName, setCodeByName] = useState<Map<string, string>>(() => new Map())

  const mapCourses = useCallback(
    (courses?: CategoryCourse[] | Array<Record<string, unknown>>) =>
      toUiCourses(courses, codeByName),
    [codeByName],
  )

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getGraduationProgress(student.id)
        if (!cancelled) {
          setProgress(data)
          setMajorTracksProgress(data.majorTracks ?? [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '졸업요건 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [student, setMajorTracksProgress])

  useEffect(() => {
    if (!student) return
    let cancelled = false
    ;(async () => {
      const map = new Map<string, string>()
      const ingest = (name?: string | null, code?: string | null) => {
        if (!name || !isAcademicCourseCode(code)) return
        const key = normalizeCourseNameKey(name)
        if (key && !map.has(key)) map.set(key, code!.trim())
      }
      try {
        const [catalog, roadmap] = await Promise.all([
          getPlannedCourseCatalog({
            studentId: student.id,
            departmentName: student.major || active?.label || undefined,
          }).catch(() => null),
          getStudentRoadmapByStudent(student.id).catch(() => null),
        ])
        for (const course of catalog?.courses ?? []) {
          ingest(course.courseName, course.courseCodes?.[0])
        }
        for (const term of roadmap?.terms ?? []) {
          for (const course of term.courses ?? []) {
            ingest(course.courseName, course.courseCode)
          }
          for (const list of Object.values(term.categories ?? {})) {
            if (!Array.isArray(list)) continue
            for (const course of list) {
              ingest(course.courseName, course.courseCode)
            }
          }
        }
      } catch {
        /* 학수번호 보조 조회 실패는 무시 */
      }
      if (!cancelled) setCodeByName(map)
    })()
    return () => {
      cancelled = true
    }
  }, [student, active?.label])

  const activeTrack = useMemo(() => {
    const tracks = progress?.majorTracks ?? []
    if (!active || tracks.length === 0) return null
    return (
      tracks.find((t) => t.department === active.department) ??
      tracks.find((t) => t.trackType === active.trackType) ??
      null
    )
  }, [progress?.majorTracks, active])

  const isSecondaryTrack = Boolean(active && !active.isPrimary && activeTrack)

  const majorRequired = useMemo(() => {
    if (isSecondaryTrack) {
      const summary = progress?.categorySummaries?.find((c) =>
        isDoubleMajorRequiredCategory(c.category),
      )
      return {
        category: summary?.category ?? '복필',
        courses: summary?.courses ?? [],
        remaining: summary?.remainingCourses ?? summary?.missingCourses ?? [],
      }
    }

    const summary = progress?.categorySummaries?.find(
      (c) => c.category.includes('전공필수') || c.category === '전필',
    )
    const remainingFromApi =
      progress?.remainingMajorRequiredCourses ??
      summary?.remainingCourses ??
      summary?.missingCourses ??
      []

    return {
      category: summary?.category ?? '전공필수',
      courses: summary?.courses ?? [],
      remaining: remainingFromApi,
    }
  }, [progress, isSecondaryTrack])

  const majorElective = useMemo(() => {
    if (isSecondaryTrack) {
      const summary = progress?.categorySummaries?.find((c) =>
        isDoubleMajorElectiveCategory(c.category),
      )
      return {
        category: summary?.category ?? '복선',
        courses: summary?.courses ?? [],
        remaining: summary?.remainingCourses ?? summary?.missingCourses ?? [],
      }
    }

    const found = progress?.categorySummaries?.find(
      (c) => c.category.includes('전공선택') || c.category === '전선',
    )
    const remainingFromApi =
      progress?.remainingMajorElectiveCourses ??
      found?.remainingCourses ??
      found?.missingCourses ??
      []

    return {
      category: found?.category ?? '전공선택',
      courses: found?.courses ?? [],
      remaining: remainingFromApi,
    }
  }, [progress, isSecondaryTrack])

  const liberalRequired = useMemo(() => {
    const fromCredits = progress?.commonLiberalCredits
    const fromSummary = progress?.categorySummaries?.find(
      (c) =>
        c.category.includes('교양필수') ||
        c.category.includes('공통교양') ||
        c.category === '교필',
    )
    const remainingFromApi = (progress?.remainingCommonLiberalRequiredCourses ?? [])
      .map((row) => row.course)
      .filter((c): c is NonNullable<typeof c> => !!c?.courseName)

    return {
      earned: toNumber(fromCredits?.earnedCredits ?? fromSummary?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits ?? fromSummary?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent ?? fromSummary?.progressPercent),
      courses:
        fromCredits?.completedCourses ??
        fromSummary?.courses ??
        progress?.commonLiberalCourses ??
        [],
      remaining:
        remainingFromApi.length > 0
          ? remainingFromApi
          : fromCredits?.remainingCourses ??
            fromCredits?.missingCourses ??
            fromSummary?.remainingCourses ??
            fromSummary?.missingCourses ??
            [],
    }
  }, [progress])

  const liberalElective = useMemo(() => {
    const fromCredits = progress?.electiveLiberalCredits
    const fromSummary = progress?.categorySummaries?.find((c) =>
      isElectiveLiberalCategory(c.category),
    )
    return {
      earned: toNumber(fromCredits?.earnedCredits ?? fromSummary?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits ?? fromSummary?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent ?? fromSummary?.progressPercent),
      courses: fromCredits?.completedCourses ?? fromSummary?.courses ?? [],
      remaining:
        fromCredits?.remainingCourses ??
        fromCredits?.missingCourses ??
        fromSummary?.remainingCourses ??
        fromSummary?.missingCourses ??
        [],
    }
  }, [progress])

  /** 2022학번(입학 2022)부터 균형교양(균필) 요건 적용 */
  const showBalancedLiberal = (progress?.admissionYear ?? student?.admissionYear ?? 0) >= 2022

  const balancedLiberal = useMemo(() => {
    const fromCredits = progress?.balancedLiberalCredits
    const fromSummary = progress?.categorySummaries?.find(
      (c) =>
        c.category.includes('균형교양') ||
        c.category.includes('균필') ||
        c.category === '균필',
    )
    const areas = progress?.balancedLiberalAreaProgresses ?? []
    const completedFromAreas = areas.flatMap((a) => a.courses ?? [])
    const details = progress?.missingBalancedLiberalAreaDetails ?? []

    // 영역명 목록 (카드 우측 미리보기)
    const remainingAreas =
      details.length > 0
        ? details.map((d) => {
            const hit = areas.find((a) => a.area === d.area)
            return {
              name: d.area,
              credits: toNumber(hit?.earnedCredits),
              code: d.area,
            }
          })
        : (progress?.missingBalancedLiberalAreas ?? [])
            .map((name) => name?.trim())
            .filter((name): name is string => !!name)
            .map((name) => {
              const hit = areas.find((a) => a.area === name)
              return {
                name,
                credits: toNumber(hit?.earnedCredits),
                code: name,
              }
            })

    const unsatisfiedAreas = areas
      .filter((a) => a.satisfied !== true)
      .map((a) => ({
        name: a.area,
        credits: toNumber(a.earnedCredits),
        code: a.area,
      }))

    const fallbackRemaining = toUiCourses(
      fromCredits?.remainingCourses ??
        fromCredits?.missingCourses ??
        fromSummary?.remainingCourses ??
        fromSummary?.missingCourses ??
        [],
      codeByName,
    )

    // 모달용: 영역별 추천 과목
    const remainingGroups = details
      .filter((d) => d.area?.trim())
      .map((d) => ({
        title: d.area,
        courses: toUiCourses(d.candidateCourses ?? [], codeByName),
      }))

    return {
      earned: toNumber(fromCredits?.earnedCredits ?? fromSummary?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits ?? fromSummary?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent ?? fromSummary?.progressPercent),
      courses: toUiCourses(
        fromCredits?.completedCourses ?? fromSummary?.courses ?? completedFromAreas,
        codeByName,
      ),
      remaining:
        remainingAreas.length > 0
          ? remainingAreas
          : unsatisfiedAreas.length > 0
            ? unsatisfiedAreas
            : fallbackRemaining,
      remainingGroups,
      requiredAreas: progress?.balancedLiberalRequiredAreaCount ?? 0,
      completedAreas: progress?.balancedLiberalCompletedAreaCount ?? 0,
      areas,
    }
  }, [progress, codeByName])

  const displayName = student?.name || '학생'
  const totalEarned = toNumber(progress?.totalCredits?.earnedCredits)
  const totalRequired = toNumber(progress?.totalCredits?.requiredCredits)
  const totalPct = toPercent(progress?.totalCredits?.progressPercent)

  const majorPct = toPercent(
    activeTrack?.totalCredits?.progressPercent ??
      progress?.majorCredits?.majorCreditsProgressPercent,
  )
  const majorReqPct = toPercent(
    activeTrack?.requiredCredits?.progressPercent ??
      progress?.majorCredits?.majorRequiredProgressPercent,
  )
  const majorElecPct = toPercent(
    activeTrack?.electiveCredits?.progressPercent ??
      progress?.majorCredits?.majorElectiveProgressPercent,
  )

  const majorEarned = toNumber(
    activeTrack?.totalCredits?.earnedCredits ??
      progress?.majorCredits?.earnedMajorCredits,
  )
  const majorNeed = toNumber(
    activeTrack?.totalCredits?.requiredCredits ??
      progress?.majorCredits?.requiredMajorCredits,
  )

  const majorRequiredLabel = toNumber(
    activeTrack?.requiredCredits?.earnedCredits ??
      progress?.majorCredits?.earnedMajorRequiredCredits,
  )
  const majorRequiredNeed = toNumber(
    activeTrack?.requiredCredits?.requiredCredits ??
      progress?.majorCredits?.requiredMajorRequiredCredits,
  )
  const majorElectiveEarned = toNumber(
    activeTrack?.electiveCredits?.earnedCredits ??
      progress?.majorCredits?.earnedMajorElectiveCredits,
  )
  const majorElectiveNeed = toNumber(
    activeTrack?.electiveCredits?.requiredCredits ??
      progress?.majorCredits?.requiredMajorElectiveCredits,
  )

  const readingStatus = progress?.readingStatus ?? student?.readingStatus
  const hasReadingApi = readingStatus != null
  const readingAreas = useMemo(() => {
    if (readingStatus?.areas?.length) {
      return readingStatus.areas.map((area) => ({
        category: area.name,
        current: area.certifiedCount ?? area.completedCount ?? 0,
        required: area.requiredCount ?? 0,
        satisfied: area.satisfied === true,
      }))
    }
    // API 데이터 없으면 기존 기준(영역·필요 권수)만 표시
    return classicReading.map((item) => ({
      category: item.category,
      current: 0,
      required: item.required,
      satisfied: false,
    }))
  }, [readingStatus])
  const classicReadingCert = progress?.classicReadingCertification
  const readingCompleted =
    classicReadingCert != null
      ? classicReadingCert.satisfied === true
      : hasReadingApi && readingStatus?.completed === true
  const readingCompletedBySubstitute =
    classicReadingCert?.satisfied === true && classicReadingCert.status === 'COMPLETED'
  const readingExempted =
    classicReadingCert?.satisfied === true &&
    (classicReadingCert.status === 'EXEMPTED' ||
      classicReadingCert.status === 'NOT_APPLICABLE')

  const englishCert = progress?.englishCertification
  const swCert = progress?.swCodingCertification
  const englishSatisfied = englishCert?.satisfied === true
  const swSatisfied = swCert?.satisfied === true
  const englishApplicable = englishCert == null || englishCert.applicable !== false
  const swApplicable = swCert == null || swCert.applicable !== false
  const englishAdmissionYear = progress?.admissionYear ?? student?.admissionYear
  const englishMajorName = progress?.major ?? student?.major
  const englishRequirements = englishRequirementsFromCert(
    englishCert?.primaryRequirement,
    englishAdmissionYear,
    englishMajorName,
  )
  const englishPreview = englishRequirementPreviewFromCert(
    englishCert?.primaryRequirement,
    englishAdmissionYear,
    englishMajorName,
  )
  const englishProgress = englishProgressLine(englishCert?.detail)

  const totalGpa = toNumber(progress?.averageGradePoint)
  const majorGpa = toNumber(progress?.majorGradePoint)
  const liberalGpa = toNumber(progress?.liberalGradePoint)

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-muted">졸업요건을 불러오는 중...</div>
  }

  if (error || !progress) {
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

  const majorTitle = active
    ? `${trackTypeLabel(active.trackType)} (${active.label})`
    : progress.major ?? '전공'

  const analysisTermLabel = (() => {
    const now = new Date()
    const month = now.getMonth() + 1
    const semester = month >= 8 || month <= 1 ? 2 : 1
    const year = semester === 2 && month <= 1 ? now.getFullYear() - 1 : now.getFullYear()
    return `${year}- ${semester}학기 기준 분석 현황`
  })()

  const requiredCourseProgress = isSecondaryTrack ? activeTrack?.requiredCourseProgress : undefined
  const graduationRequirement = isSecondaryTrack ? activeTrack?.graduationRequirement : undefined
  const trackDetail = activeTrack?.detail || graduationRequirement?.detail
  const showGraduationRequirement =
    Boolean(graduationRequirement) &&
    (graduationRequirement?.status || '').toUpperCase() !== 'NOT_REQUIRED'

  return (
    <div className="space-y-5 pt-1">
      <div>
        <h2 className="text-xl font-bold leading-tight text-ink md:text-[22px]">{displayName}님 졸업요건 현황</h2>
        <p className="mt-1.5 text-sm text-ink-muted">{analysisTermLabel}</p>
      </div>

      {isSecondaryTrack && (
        <section className="rounded-[20px] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center gap-2">
            {activeTrack?.status && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${trackStatusClass(activeTrack.status)}`}
              >
                {trackStatusLabel(activeTrack.status)}
              </span>
            )}
            <h3 className="text-base font-bold text-ink">{majorTitle} 진행 현황</h3>
          </div>
          {trackDetail && (
            <p
              className={`mt-2 text-sm leading-relaxed ${
                isGuidanceStatus(activeTrack?.status) ||
                isGuidanceStatus(graduationRequirement?.status)
                  ? 'text-amber-800'
                  : 'text-ink-muted'
              }`}
            >
              {trackDetail}
            </p>
          )}
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">성적 현황</h3>
          <p className="text-xs text-ink-muted">4.5 만점 기준</p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <GradeStatCard label="총 성적" value={totalGpa} />
          <GradeStatCard label="전공 성적" value={majorGpa} />
          <GradeStatCard label="교양 성적" value={liberalGpa} />
        </div>
      </section>

      <section className="grid items-stretch gap-4 xl:grid-cols-[2fr_1fr_1fr]">
        <article className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:px-5">
          <h3 className="mb-3 text-base font-bold text-ink">
            현재 {totalEarned}/{totalRequired || '-'}학점 이수 완료!
          </h3>

          <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-2">
            <SummaryGauge
              title="전체 학점"
              percent={totalPct}
              earned={totalEarned}
              required={totalRequired}
              size={176}
              stroke={18}
              fill
            />
            <SummaryGauge
              title="전공 학점"
              percent={majorPct}
              earned={majorEarned}
              required={majorNeed}
              size={176}
              stroke={18}
              fill
            />
            <div className="col-span-2 flex justify-center gap-8 md:col-span-1 md:flex-col md:items-center md:gap-2.5 md:pl-0.5">
              <SummaryGauge
                title="전공 필수"
                percent={majorReqPct}
                earned={majorRequiredLabel}
                required={majorRequiredNeed}
                size={92}
                stroke={11}
                compact
              />
              <SummaryGauge
                title="전공 선택"
                percent={majorElecPct}
                earned={majorElectiveEarned}
                required={majorElectiveNeed}
                size={92}
                stroke={11}
                compact
              />
            </div>
          </div>
        </article>

        <article className="flex flex-col rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-base font-bold text-ink">
            {readingExempted
              ? '고전독서인증 면제'
              : readingCompleted
              ? readingStatus?.title || '현재 고전독서인증 완료!'
              : readingStatus?.title || '고전독서인증 현황'}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {readingCompletedBySubstitute
              ? classicReadingCert?.substituteRequirement || '고전특강 이수'
              : readingStatus?.subtitle || '고전독서인증 현황'}
            {!hasReadingApi && classicReadingCert == null ? ' · 기준 안내' : ''}
          </p>
          {readingCompletedBySubstitute || readingExempted ? (
            <div className="mt-3 rounded-lg border border-sejong/20 bg-sejong/5 px-3 py-3 text-center">
              <p className="text-sm font-bold text-sejong">
                {readingExempted ? '고전독서인증 면제' : '대체과목 이수 완료'}
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb]">
              <ul>
                {readingAreas.map((item, index) => (
                  <li
                    key={item.category}
                    className={`flex items-center justify-between px-3 py-2 text-[13px] ${
                      index < readingAreas.length - 1 ? 'border-b border-[#e5e7eb]' : ''
                    }`}
                  >
                    <span className="text-ink">{item.category}</span>
                    <span
                      className={`font-bold ${
                        item.current >= item.required ? 'text-sejong' : 'text-ink-muted'
                      }`}
                    >
                      {item.current}/{item.required}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {readingCompleted ? (
            <CertDetailText
              detail={
                classicReadingCert?.detail ||
                readingStatus?.message ||
                '고전독서인증을 모두 완료하였습니다.'
              }
              className="mt-auto pt-3 text-center text-xs font-bold leading-relaxed text-sejong"
            />
          ) : (
            <CertDetailText
              detail={
                classicReadingCert?.detail ||
                readingStatus?.message ||
                '영역별 필요 권수를 충족하면 인증이 완료됩니다.'
              }
              className="mt-auto pt-3 text-center text-xs font-semibold leading-relaxed text-ink-muted"
            />
          )}
        </article>

        <article className="flex flex-col rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-3 text-base font-bold text-ink">
            {englishSatisfied && swSatisfied ? '인증 완료' : '미완료된 인증'}
          </h3>

          {englishApplicable && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-bold text-ink">영어졸업인증</p>
              {englishSatisfied ? (
                <div className="rounded-lg border border-sejong/20 bg-sejong/5 px-3 py-3 text-center">
                  <p className="text-sm font-bold text-sejong">영어졸업인증 이수 완료</p>
                  <CertDetailText detail={englishCert?.detail} />
                </div>
              ) : (
                <>
                  {englishProgress && (
                    <p className="mb-1.5 text-[11px] leading-relaxed text-ink-muted">{englishProgress}</p>
                  )}
                  <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
                    {englishPreview.map((item, index) => (
                      <div
                        key={item.label}
                        className={`flex items-center justify-between gap-1.5 px-2 py-1.5 ${
                          index < englishPreview.length - 1 ? 'border-b border-[#e5e7eb]' : ''
                        }`}
                      >
                        <span className="whitespace-nowrap rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[11px] font-medium text-ink">
                          {item.label}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-ink">
                          {item.value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnglishOpen(true)}
                    className="mt-1 w-full text-right text-[11px] text-ink-muted hover:text-sejong"
                  >
                    더보기
                  </button>
                </>
              )}
            </div>
          )}

          {swApplicable && (
            <div>
              <p className="mb-1.5 text-xs font-bold text-ink">SW코딩졸업인증</p>
              {swSatisfied ? (
                <div className="rounded-lg border border-sejong/20 bg-sejong/5 px-3 py-3 text-center">
                  <p className="text-sm font-bold leading-snug text-sejong">SW코딩졸업인증 이수 완료</p>
                  <CertDetailText detail={swCert?.detail} />
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
                    {[
                      {
                        name: 'TOSC (SW역량테스트)',
                        value: swCert?.primaryRequirement || 'Level 5 이상',
                      },
                      {
                        name: '대체이수',
                        value: swCert?.substituteRequirement || 'K-MOOC:코딩과스토리텔링 P 이상',
                      },
                    ].map((item, index) => (
                      <div
                        key={item.name}
                        className={`flex items-center justify-between gap-1.5 overflow-x-auto px-2 py-1.5 ${
                          index === 0 ? 'border-b border-[#e5e7eb]' : ''
                        }`}
                      >
                        <span className="whitespace-nowrap rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[10px] font-medium leading-none text-ink">
                          {item.name}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-ink">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSwOpen(true)}
                    className="mt-1 w-full text-right text-[11px] text-ink-muted hover:text-sejong"
                  >
                    더보기
                  </button>
                </>
              )}
            </div>
          )}
        </article>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">학점 현황 자세히 보기</h2>
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <DetailCreditCard
            title={`${displayName}님 ${majorTitle} 필수 현황`}
            remainingTitle="남은 필수 과목"
            percent={majorReqPct}
            earned={majorRequiredLabel}
            required={majorRequiredNeed}
            completed={mapCourses(majorRequired.courses)}
            remaining={mapCourses(majorRequired.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: `${majorTitle} 필수 이수 과목`,
                subtitle: `${majorRequiredLabel}학점 이수 완료`,
                courses: mapCourses(majorRequired.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: `${majorTitle} 남은 필수 과목`,
                subtitle: `${majorRequired.remaining.length}과목`,
                courses: mapCourses(majorRequired.remaining),
              })
            }
          />
          <DetailCreditCard
            title={`${displayName}님 ${majorTitle} 선택 현황`}
            remainingTitle="남은 선택 과목"
            percent={majorElecPct}
            earned={majorElectiveEarned}
            required={majorElectiveNeed}
            completed={mapCourses(majorElective.courses)}
            remaining={mapCourses(majorElective.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: `${majorTitle} 선택 이수 과목`,
                subtitle: `${majorElectiveEarned}학점 이수 완료`,
                courses: mapCourses(majorElective.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: `${majorTitle} 남은 선택 과목`,
                subtitle: `${majorElective.remaining.length}과목`,
                courses: mapCourses(majorElective.remaining),
              })
            }
          />
          {isSecondaryTrack && requiredCourseProgress && (
            requiredCourseProgress.policyApplied === false ? (
              <article className="flex h-full flex-col rounded-2xl bg-white px-5 pb-5 pt-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <h3 className="mb-3 text-base font-bold leading-snug text-ink">지정 필수과목</h3>
                <p className="text-sm text-ink-muted">해당 학과는 지정 필수과목 요건이 없습니다.</p>
              </article>
            ) : (
              <DetailCreditCard
                title={`${displayName}님 ${majorTitle} 지정 필수`}
                remainingTitle="미이수 지정 필수"
                percent={
                  (requiredCourseProgress.requiredCourseCount ?? 0) > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((requiredCourseProgress.completedCourseCount ?? 0) /
                            (requiredCourseProgress.requiredCourseCount ?? 1)) *
                            100,
                        ),
                      )
                    : requiredCourseProgress.satisfied
                      ? 100
                      : 0
                }
                earned={requiredCourseProgress.completedCourseCount ?? 0}
                required={requiredCourseProgress.requiredCourseCount ?? 0}
                completed={mapCourses(requiredCourseProgress.completedCourses)}
                remaining={mapCourses(requiredCourseProgress.missingCourses)}
                areaHint={
                  requiredCourseProgress.requiredCourseCount != null
                    ? `${requiredCourseProgress.completedCourseCount ?? 0}/${requiredCourseProgress.requiredCourseCount}과목`
                    : undefined
                }
                countUnit="과목"
                onOpenCompleted={() =>
                  setListModal({
                    title: `${majorTitle} 지정 필수 이수`,
                    subtitle: `${requiredCourseProgress.completedCourseCount ?? 0}과목 이수`,
                    courses: mapCourses(requiredCourseProgress.completedCourses),
                  })
                }
                onOpenRemaining={() =>
                  setListModal({
                    title: `${majorTitle} 미이수 지정 필수`,
                    subtitle: `${(requiredCourseProgress.missingCourses ?? []).length}항목`,
                    courses: mapCourses(requiredCourseProgress.missingCourses),
                  })
                }
              />
            )
          )}
          {isSecondaryTrack && showGraduationRequirement && (
            <article className="flex h-full flex-col rounded-2xl bg-white px-5 pb-5 pt-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {graduationRequirement?.status && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${trackStatusClass(graduationRequirement.status)}`}
                  >
                    {trackStatusLabel(graduationRequirement.status)}
                  </span>
                )}
                <h3 className="text-base font-bold leading-snug text-ink">추가 요건</h3>
              </div>
              <p
                className={`text-sm leading-relaxed ${
                  isGuidanceStatus(graduationRequirement?.status)
                    ? 'text-amber-800'
                    : 'text-ink-muted'
                }`}
              >
                {graduationRequirement?.detail ||
                  (graduationRequirement?.satisfied
                    ? '추가 요건을 충족했습니다.'
                    : '추가 요건을 확인하세요.')}
              </p>
            </article>
          )}
          <DetailCreditCard
            title={`${displayName}님 교양 필수 현황`}
            remainingTitle="남은 필수 과목"
            percent={liberalRequired.percent}
            earned={liberalRequired.earned}
            required={liberalRequired.required}
            completed={mapCourses(liberalRequired.courses)}
            remaining={mapCourses(liberalRequired.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: '교양 필수 이수 과목',
                subtitle: `${liberalRequired.earned}학점 이수 완료`,
                courses: mapCourses(liberalRequired.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: '남은 교양 필수 과목',
                subtitle: `${liberalRequired.remaining.length}과목`,
                courses: mapCourses(liberalRequired.remaining),
              })
            }
          />
          {showBalancedLiberal && (
            <DetailCreditCard
              title={`${displayName}님 균필(균형교양) 현황`}
              remainingTitle="미충족 영역"
              percent={balancedLiberal.percent}
              earned={balancedLiberal.earned}
              required={balancedLiberal.required}
              completed={balancedLiberal.courses}
              remaining={balancedLiberal.remaining}
              areaHint={
                balancedLiberal.requiredAreas > 0
                  ? `영역 ${balancedLiberal.completedAreas}/${balancedLiberal.requiredAreas} 충족`
                  : undefined
              }
              onOpenCompleted={() =>
                setListModal({
                  title: '균필(균형교양) 이수 과목',
                  subtitle: `${balancedLiberal.earned}학점 이수`,
                  courses: balancedLiberal.courses,
                })
              }
              onOpenRemaining={() =>
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
          <DetailCreditCard
            title={`${displayName}님 교양 선택 현황`}
            remainingTitle="남은 선택 과목"
            earned={liberalElective.earned}
            completed={mapCourses(liberalElective.courses)}
            remaining={mapCourses(liberalElective.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: '교양 선택 이수 과목',
                subtitle: `취득 ${liberalElective.earned}학점`,
                courses: mapCourses(liberalElective.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: '남은 교양 선택 과목',
                subtitle: `${liberalElective.remaining.length}과목`,
                courses: mapCourses(liberalElective.remaining),
              })
            }
            earnedOnly
            hideRemaining
          />
        </div>
      </section>

      <EnglishCertModal
        open={englishOpen}
        onClose={() => setEnglishOpen(false)}
        satisfied={englishSatisfied}
        detail={englishCert?.detail}
        primaryRequirement={englishCert?.primaryRequirement}
        policyType={englishCert?.policyType}
        status={englishCert?.status}
        requirements={englishRequirements}
      />
      <SWCodingCertModal
        open={swOpen}
        onClose={() => setSwOpen(false)}
        satisfied={swSatisfied}
        detail={swCert?.detail}
        primaryRequirement={swCert?.primaryRequirement}
        substituteRequirement={swCert?.substituteRequirement}
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
  )
}

function CreditStatusSummary({
  earned,
  required,
  unit = '학점',
}: {
  earned: number
  required?: number
  unit?: string
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
            <span className="ml-0.5 text-[10px] font-bold text-ink-muted">{unit}</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-[11px] font-semibold text-ink-muted">필요</span>
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            {hasRequirement ? need : '-'}
            {hasRequirement && (
              <span className="ml-0.5 text-[10px] font-bold text-ink-muted">{unit}</span>
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
          {satisfied ? '요건 충족' : `${shortfall}${unit} 부족`}
        </p>
      )}
    </div>
  )
}

function formatGpa(gpa: number) {
  return gpa > 0 ? gpa.toFixed(2) : '-'
}

function SummaryGauge({
  title,
  percent,
  earned,
  required,
  size,
  stroke,
  compact = false,
  fill = false,
}: {
  title: string
  percent: number
  earned: number
  required: number
  size: number
  stroke: number
  compact?: boolean
  fill?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center ${fill ? 'w-full min-w-0' : ''}`}
      style={fill ? undefined : { width: size + 4 }}
    >
      <p
        className={`mb-1 w-full text-center font-bold text-ink ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {title}
      </p>
      <ChartLegend
        secondaryLabel="총 학점"
        activeColor="#c8012e"
        className={`mb-1 justify-center ${compact ? 'scale-[0.78]' : 'scale-[0.85]'}`}
      />
      <DonutChart
        percent={percent}
        size={size}
        stroke={stroke}
        trackColor="#eef0f3"
        label={formatPercentLabel(percent)}
      />
      <p
        className={`mt-1 text-center font-bold tracking-tight text-ink ${
          compact ? 'text-[11px]' : 'text-sm'
        }`}
      >
        <span className="text-sejong">{earned}</span>
        <span className="text-ink-muted">/{required > 0 ? required : '-'}</span>
        <span className={`ml-0.5 font-semibold text-ink-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
          학점
        </span>
      </p>
    </div>
  )
}

function GradeStatCard({ label, value }: { label: string; value: number }) {
  const barWidth = value > 0 ? Math.min(100, Math.max(0, (value / 4.5) * 100)) : 0

  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <div className="mt-1.5 flex items-end gap-1">
        <span className="text-2xl font-extrabold tracking-tight text-ink">{formatGpa(value)}</span>
        <span className="mb-0.5 text-xs font-semibold text-ink-muted">/ 4.5</span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-panel">
        <div className="h-full rounded-full bg-sejong" style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  )
}

function DetailCreditCard({
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
  earnedOnly = false,
  hideRemaining = false,
  countUnit = '학점',
}: {
  title: string
  remainingTitle: string
  percent?: number
  earned: number
  required?: number
  completed: ReturnType<typeof toUiCourses>
  remaining?: ReturnType<typeof toUiCourses>
  areaHint?: string
  onOpenCompleted: () => void
  onOpenRemaining: () => void
  earnedOnly?: boolean
  hideRemaining?: boolean
  countUnit?: string
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white px-5 pb-5 pt-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <h3 className="mb-3 text-base font-bold leading-snug text-ink">{title}</h3>
      {areaHint && <p className="mb-3 text-xs font-semibold text-ink-muted">{areaHint}</p>}
      {!earnedOnly && (
        <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-4" />
      )}

      {earnedOnly ? (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-2 border-b border-[#eee] pb-2.5">
            <span className="text-sm font-semibold text-ink-muted">취득 학점</span>
            <span className="text-2xl font-extrabold tracking-tight text-ink">{earned}</span>
            <span className="text-sm font-semibold text-ink-muted">{countUnit}</span>
          </div>
          <CourseMiniList
            title="이수한 과목"
            courses={completed}
            previewCount={4}
            showMoreLink
            totalValue={earned}
            emptyText="이수한 과목이 없습니다."
            onMoreClick={onOpenCompleted}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-1 self-center pt-1 sm:self-start sm:pt-2">
            <DonutChart
              percent={percent}
              size={100}
              stroke={11}
              label={formatPercentLabel(percent)}
            />
            <CreditStatusSummary earned={earned} required={required} unit={countUnit} />
          </div>

          <div
            className={`grid min-w-0 flex-1 gap-5 ${
              hideRemaining ? 'grid-cols-1' : 'sm:grid-cols-2'
            }`}
          >
            <CourseMiniList
              title="이수한 과목"
              courses={completed}
              previewCount={4}
              showMoreLink
              totalValue={earned}
              emptyText="이수한 과목이 없습니다."
              onMoreClick={onOpenCompleted}
            />
            {!hideRemaining && (
              <CourseMiniList
                title={remainingTitle}
                courses={remaining}
                previewCount={4}
                showMoreLink
                emptyText="남은 항목이 없습니다."
                onMoreClick={onOpenRemaining}
              />
            )}
          </div>
        </div>
      )}
    </article>
  )
}
