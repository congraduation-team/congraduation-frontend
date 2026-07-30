import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGraduationProgress } from '../api/endpoints'
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
import { trackTypeLabel } from '../utils/majorTrack'
import { formatPercentLabel, toNumber, toPercent } from '../utils/number'

function toUiCourses(courses?: CategoryCourse[] | Array<Record<string, unknown>>) {
  return (courses ?? []).map((c) => {
    const row = c as Record<string, unknown>
    return {
      name: String(row.courseName ?? ''),
      credits: toNumber((row.credit ?? row.credits) as string | number | undefined),
      code: String(row.courseCode ?? ''),
    }
  })
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
  const [requiredOpen, setRequiredOpen] = useState(false)
  const [electiveOpen, setElectiveOpen] = useState(false)
  const [liberalReqOpen, setLiberalReqOpen] = useState(false)
  const [liberalElecOpen, setLiberalElecOpen] = useState(false)

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

  const activeTrack = useMemo(() => {
    const tracks = progress?.majorTracks ?? []
    if (!active || tracks.length === 0) return null
    return (
      tracks.find((t) => t.department === active.department) ??
      tracks.find((t) => t.trackType === active.trackType) ??
      null
    )
  }, [progress?.majorTracks, active])

  const majorRequired = useMemo(() => {
    if (activeTrack?.requiredCourseProgress?.completedCourses) {
      return {
        category: '전공필수',
        courses: activeTrack.requiredCourseProgress.completedCourses,
      }
    }
    const found = progress?.categorySummaries?.find(
      (c) => c.category.includes('전공필수') || c.category === '전필',
    )
    return found
  }, [progress, activeTrack])

  const majorElective = useMemo(() => {
    const found = progress?.categorySummaries?.find(
      (c) => c.category.includes('전공선택') || c.category === '전선',
    )
    return found
  }, [progress])

  const liberalRequired = useMemo(() => {
    const fromCredits = progress?.commonLiberalCredits
    const fromSummary = progress?.categorySummaries?.find(
      (c) =>
        c.category.includes('교양필수') ||
        c.category.includes('공통교양') ||
        c.category === '교필',
    )
    return {
      earned: toNumber(fromCredits?.earnedCredits ?? fromSummary?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits ?? fromSummary?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent ?? fromSummary?.progressPercent),
      courses: fromCredits?.completedCourses ?? fromSummary?.courses ?? [],
    }
  }, [progress])

  const liberalElective = useMemo(() => {
    const fromCredits = progress?.electiveLiberalCredits
    const fromSummary = progress?.categorySummaries?.find(
      (c) =>
        c.category.includes('교양선택') ||
        c.category.includes('선택교양') ||
        c.category === '교선',
    )
    return {
      earned: toNumber(fromCredits?.earnedCredits ?? fromSummary?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits ?? fromSummary?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent ?? fromSummary?.progressPercent),
      courses: fromCredits?.completedCourses ?? fromSummary?.courses ?? [],
    }
  }, [progress])

  const balancedLiberal = useMemo(() => {
    const fromCredits = progress?.balancedLiberalCredits
    return {
      earned: toNumber(fromCredits?.earnedCredits),
      required: toNumber(fromCredits?.requiredCredits),
      percent: toPercent(fromCredits?.progressPercent),
    }
  }, [progress])

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

  const majorEarnedLabel = toNumber(
    activeTrack?.totalCredits?.earnedCredits ?? progress?.majorCredits?.earnedMajorCredits,
  )
  const majorNeedLabel = toNumber(
    activeTrack?.totalCredits?.requiredCredits ?? progress?.majorCredits?.requiredMajorCredits,
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

  const liberalEarned =
    liberalRequired.earned + liberalElective.earned + balancedLiberal.earned
  const liberalRequiredTotal =
    liberalRequired.required + liberalElective.required + balancedLiberal.required
  const liberalPct =
    liberalRequiredTotal > 0
      ? Math.max(0, Math.min(100, Math.round((liberalEarned / liberalRequiredTotal) * 100)))
      : 0

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">{displayName}님 졸업요건 현황</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {progress.admissionYear ? `${progress.admissionYear}학번` : ''}
          {active ? ` · ${majorTitle}` : progress.major ? ` · ${progress.major}` : ''}
        </p>
      </div>

      <section className="grid items-start gap-5 xl:grid-cols-[1.7fr_1fr_1fr]">
        <article className="rounded-2xl bg-white px-7 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-lg font-bold text-ink">
            현재 {totalEarned}/{totalRequired || '-'}학점 이수 완료!
          </h3>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-center text-sm font-bold text-ink">총 학점</p>
              <ChartLegend
                secondaryLabel="총 학점"
                activeColor="#c8012e"
                className="mb-2 justify-center"
              />
              <DonutChart percent={totalPct} size={130} stroke={14} label={formatPercentLabel(totalPct)} />
              <p className="mt-2 text-xs font-semibold text-ink-muted">
                {totalEarned}/{totalRequired || '-'}학점
              </p>
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-center text-sm font-bold text-ink">전공 학점</p>
              <ChartLegend
                secondaryLabel="총 학점"
                activeColor="#c8012e"
                className="mb-2 justify-center"
              />
              <DonutChart percent={majorPct} size={130} stroke={14} label={formatPercentLabel(majorPct)} />
              <p className="mt-2 text-xs font-semibold text-ink-muted">
                {majorEarnedLabel}/{majorNeedLabel || '-'}학점
              </p>
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-center text-sm font-bold text-ink">교양 학점</p>
              <ChartLegend
                secondaryLabel="총 학점"
                activeColor="#c8012e"
                className="mb-2 justify-center"
              />
              <DonutChart
                percent={liberalPct}
                size={130}
                stroke={14}
                label={formatPercentLabel(liberalPct)}
              />
              <p className="mt-2 text-xs font-semibold text-ink-muted">
                {liberalEarned}/{liberalRequiredTotal || '-'}학점
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-[#eee] pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniCreditGauge label="전공 필수" percent={majorReqPct} earned={majorRequiredLabel} required={majorRequiredNeed} />
            <MiniCreditGauge label="전공 선택" percent={majorElecPct} earned={majorElectiveEarned} required={majorElectiveNeed} />
            <MiniCreditGauge
              label="교양 필수"
              percent={liberalRequired.percent}
              earned={liberalRequired.earned}
              required={liberalRequired.required}
            />
            <MiniCreditGauge
              label="교양 선택"
              percent={liberalElective.percent}
              earned={liberalElective.earned}
              required={liberalElective.required}
            />
          </div>
          {balancedLiberal.required > 0 && (
            <p className="mt-3 text-center text-xs text-ink-muted">
              균형교양 {balancedLiberal.earned}/{balancedLiberal.required}학점
              {progress.balancedLiberalRequiredAreaCount != null
                ? ` · 영역 ${progress.balancedLiberalCompletedAreaCount ?? 0}/${progress.balancedLiberalRequiredAreaCount}`
                : ''}
            </p>
          )}
        </article>

        <article className="flex flex-col rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-lg font-bold text-ink">현재 고전독서인증 완료!</h3>
          <p className="mt-1 text-sm text-ink-muted">고전독서인증 현황</p>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#e5e7eb]">
            <ul>
              {classicReading.map((item, index) => (
                <li
                  key={item.category}
                  className={`flex items-center justify-between px-4 py-3.5 text-[15px] ${
                    index < classicReading.length - 1 ? 'border-b border-[#e5e7eb]' : ''
                  }`}
                >
                  <span className="text-ink">{item.category}</span>
                  <span className="font-bold text-sejong">
                    {item.current}/{item.required}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-auto pt-6 text-center text-sm font-bold text-sejong">
            고전독서인증을 모두 완료하였습니다.
          </p>
        </article>

        <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-5 text-lg font-bold text-ink">미완료된 인증</h3>
          <div className="mb-6">
            <p className="mb-3 text-[15px] font-bold text-ink">영어졸업인증(비전공자)</p>
            <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
              {[
                { name: 'TOEIC', value: '800점 이상' },
                { name: 'TOEFL iBT', value: '80점 이상' },
                { name: 'TOEIC Speaking', value: 'IM 1 이상' },
              ].map((item, index) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 ${
                    index < 2 ? 'border-b border-[#e5e7eb]' : ''
                  }`}
                >
                  <span className="whitespace-nowrap rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[13px] font-medium text-ink">
                    {item.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm text-ink">{item.value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEnglishOpen(true)}
              className="mt-2 w-full text-right text-xs text-ink-muted hover:text-sejong"
            >
              더 보기
            </button>
          </div>

          <div>
            <p className="mb-3 text-[15px] font-bold text-ink">SW코딩졸업인증(비전공자)</p>
            <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
              {[
                { name: 'TOSC (SW역량테스트)', value: 'Level 5 이상' },
                { name: 'K-MOOC:코딩과스토리텔링', value: 'P 이상' },
              ].map((item, index) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between gap-2 overflow-x-auto px-3 py-2.5 ${
                    index === 0 ? 'border-b border-[#e5e7eb]' : ''
                  }`}
                >
                  <span className="whitespace-nowrap rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[12px] font-medium leading-none text-ink">
                    {item.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm text-ink">{item.value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSwOpen(true)}
              className="mt-2 w-full text-right text-xs text-ink-muted hover:text-sejong"
            >
              더 보기
            </button>
          </div>
        </article>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-ink">학점 현황 자세히 보기</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <DetailCreditCard
            title={`${displayName}님 ${majorTitle} 필수 현황`}
            percent={majorReqPct}
            earned={majorRequiredLabel}
            required={majorRequiredNeed}
            courses={toUiCourses(majorRequired?.courses)}
            onTitleClick={() => setRequiredOpen(true)}
            onCurriculum={() => navigate('/curriculum')}
          />
          <DetailCreditCard
            title={`${displayName}님 ${majorTitle} 선택 현황`}
            percent={majorElecPct}
            earned={majorElectiveEarned}
            required={majorElectiveNeed}
            courses={toUiCourses(majorElective?.courses)}
            onTitleClick={() => setElectiveOpen(true)}
            onCurriculum={() => navigate('/curriculum')}
          />
          <DetailCreditCard
            title={`${displayName}님 교양 필수 현황`}
            percent={liberalRequired.percent}
            earned={liberalRequired.earned}
            required={liberalRequired.required}
            courses={toUiCourses(liberalRequired.courses)}
            onTitleClick={() => setLiberalReqOpen(true)}
            onCurriculum={() => navigate('/curriculum')}
          />
          <DetailCreditCard
            title={`${displayName}님 교양 선택 현황`}
            percent={liberalElective.percent}
            earned={liberalElective.earned}
            required={liberalElective.required}
            courses={toUiCourses(liberalElective.courses)}
            onTitleClick={() => setLiberalElecOpen(true)}
            onCurriculum={() => navigate('/curriculum')}
          />
        </div>
      </section>

      <EnglishCertModal open={englishOpen} onClose={() => setEnglishOpen(false)} />
      <SWCodingCertModal open={swOpen} onClose={() => setSwOpen(false)} />
      <CourseListModal
        open={requiredOpen}
        onClose={() => setRequiredOpen(false)}
        title={`${majorTitle} 필수 이수 과목`}
        subtitle={`${majorRequiredLabel}학점 이수 완료`}
        courses={toUiCourses(majorRequired?.courses)}
      />
      <CourseListModal
        open={electiveOpen}
        onClose={() => setElectiveOpen(false)}
        title={`${majorTitle} 선택 이수 과목`}
        subtitle={`${majorElectiveEarned}학점 이수 완료`}
        courses={toUiCourses(majorElective?.courses)}
      />
      <CourseListModal
        open={liberalReqOpen}
        onClose={() => setLiberalReqOpen(false)}
        title="교양 필수 이수 과목"
        subtitle={`${liberalRequired.earned}학점 이수 완료`}
        courses={toUiCourses(liberalRequired.courses)}
      />
      <CourseListModal
        open={liberalElecOpen}
        onClose={() => setLiberalElecOpen(false)}
        title="교양 선택 이수 과목"
        subtitle={`${liberalElective.earned}학점 이수 완료`}
        courses={toUiCourses(liberalElective.courses)}
      />
    </div>
  )
}

function MiniCreditGauge({
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
    <div className="flex flex-col items-center rounded-xl bg-panel/60 px-3 py-3">
      <p className="mb-1 text-xs font-bold text-ink">{label}</p>
      <DonutChart percent={percent} size={72} stroke={9} label={formatPercentLabel(percent)} />
      <p className="mt-1.5 text-[11px] font-semibold text-ink-muted">
        {earned}/{required || '-'}학점
      </p>
    </div>
  )
}

function DetailCreditCard({
  title,
  percent,
  earned,
  required,
  courses,
  onTitleClick,
  onCurriculum,
}: {
  title: string
  percent: number
  earned: number
  required: number
  courses: ReturnType<typeof toUiCourses>
  onTitleClick: () => void
  onCurriculum: () => void
}) {
  return (
    <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <h3 className="mb-2 text-lg font-bold text-ink">{title}</h3>
      <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-5" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3">
          <DonutChart percent={percent} size={140} stroke={15} label={formatPercentLabel(percent)} />
          <div className="space-y-1 text-center text-sm text-ink-muted">
            <p>필요 학점 {required || '-'}학점</p>
            <p>이수 학점 {earned}학점</p>
          </div>
        </div>
        <div className="flex flex-1 gap-10">
          <CourseMiniList
            title="이수한 과목"
            courses={courses.slice(0, 6)}
            totalValue={earned}
            onTitleClick={onTitleClick}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onCurriculum}
          className="rounded-full bg-sejong px-5 py-2 text-sm font-semibold text-white hover:bg-sejong-dark"
        >
          이수체계도 확인
        </button>
      </div>
    </article>
  )
}
