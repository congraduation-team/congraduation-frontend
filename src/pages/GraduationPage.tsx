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
  const [listModal, setListModal] = useState<{
    title: string
    subtitle?: string
    courses: ReturnType<typeof toUiCourses>
  } | null>(null)

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
    if (activeTrack?.requiredCourseProgress) {
      return {
        category: '전공필수',
        courses:
          activeTrack.requiredCourseProgress.completedCourses ??
          progress?.categorySummaries?.find(
            (c) => c.category.includes('전공필수') || c.category === '전필',
          )?.courses ??
          [],
        remaining:
          activeTrack.requiredCourseProgress.missingCourses ??
          progress?.categorySummaries?.find(
            (c) => c.category.includes('전공필수') || c.category === '전필',
          )?.remainingCourses ??
          progress?.categorySummaries?.find(
            (c) => c.category.includes('전공필수') || c.category === '전필',
          )?.missingCourses ??
          [],
      }
    }
    const found = progress?.categorySummaries?.find(
      (c) => c.category.includes('전공필수') || c.category === '전필',
    )
    return {
      category: found?.category ?? '전공필수',
      courses: found?.courses ?? [],
      remaining: found?.remainingCourses ?? found?.missingCourses ?? [],
    }
  }, [progress, activeTrack])

  const majorElective = useMemo(() => {
    const found = progress?.categorySummaries?.find(
      (c) => c.category.includes('전공선택') || c.category === '전선',
    )
    return {
      category: found?.category ?? '전공선택',
      courses: found?.courses ?? [],
      remaining: found?.remainingCourses ?? found?.missingCourses ?? [],
    }
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
      remaining:
        fromCredits?.remainingCourses ??
        fromCredits?.missingCourses ??
        fromSummary?.remainingCourses ??
        fromSummary?.missingCourses ??
        [],
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
      remaining:
        fromCredits?.remainingCourses ??
        fromCredits?.missingCourses ??
        fromSummary?.remainingCourses ??
        fromSummary?.missingCourses ??
        [],
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">{displayName}님 졸업요건 현황</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {progress.admissionYear ? `${progress.admissionYear}학번` : ''}
          {active ? ` · ${majorTitle}` : progress.major ? ` · ${progress.major}` : ''}
        </p>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-bold text-ink">성적 현황</h3>
          <p className="text-xs text-ink-muted">4.5 만점 기준</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <GradeStatCard label="총 성적" value={totalGpa} />
          <GradeStatCard label="전공 성적" value={majorGpa} />
          <GradeStatCard label="교양 성적" value={liberalGpa} />
        </div>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-[1.7fr_1fr_1fr]">
        <article className="flex h-full flex-col rounded-2xl bg-white px-7 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-lg font-bold text-ink">
            현재 {totalEarned}/{totalRequired || '-'}학점 이수 완료!
          </h3>

          <div className="grid flex-1 grid-cols-[1fr_1fr_auto] items-center gap-5">
            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-left text-sm font-bold text-ink">전체 학점</p>
              <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-2 w-full justify-start" />
              <DonutChart percent={totalPct} size={150} stroke={16} label={formatPercentLabel(totalPct)} />
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-left text-sm font-bold text-ink">
                전공 학점{majorEarnedLabel > 0 ? ` (${majorEarnedLabel})` : ''}
              </p>
              <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-2 w-full justify-start" />
              <DonutChart percent={majorPct} size={150} stroke={16} label={formatPercentLabel(majorPct)} />
            </div>

            <div className="flex flex-col justify-center gap-3">
              <div className="flex flex-col items-center">
                <p className="mb-1 w-full text-left text-sm font-bold text-ink">전공 필수</p>
                <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-1.5 w-full justify-start" />
                <DonutChart percent={majorReqPct} size={88} stroke={11} label={formatPercentLabel(majorReqPct)} />
              </div>
              <div className="flex flex-col items-center">
                <p className="mb-1 w-full text-left text-sm font-bold text-ink">전공 선택</p>
                <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-1.5 w-full justify-start" />
                <DonutChart percent={majorElecPct} size={88} stroke={11} label={formatPercentLabel(majorElecPct)} />
              </div>
            </div>
          </div>
        </article>

        <article className="flex h-full flex-col rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
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

        <article className="flex h-full flex-col rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
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

          <div className="mt-auto">
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
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          <DetailCreditCard
            title={`${displayName}님 ${majorTitle} 필수 현황`}
            remainingTitle="남은 필수 과목"
            percent={majorReqPct}
            earned={majorRequiredLabel}
            required={majorRequiredNeed}
            completed={toUiCourses(majorRequired.courses)}
            remaining={toUiCourses(majorRequired.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: `${majorTitle} 필수 이수 과목`,
                subtitle: `${majorRequiredLabel}학점 이수 완료`,
                courses: toUiCourses(majorRequired.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: `${majorTitle} 남은 필수 과목`,
                subtitle: `${majorRequired.remaining.length}과목`,
                courses: toUiCourses(majorRequired.remaining),
              })
            }
          />
          <DetailCreditCard
            title={`${displayName}님 ${majorTitle} 선택 현황`}
            remainingTitle="남은 선택 과목"
            percent={majorElecPct}
            earned={majorElectiveEarned}
            required={majorElectiveNeed}
            completed={toUiCourses(majorElective.courses)}
            remaining={toUiCourses(majorElective.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: `${majorTitle} 선택 이수 과목`,
                subtitle: `${majorElectiveEarned}학점 이수 완료`,
                courses: toUiCourses(majorElective.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: `${majorTitle} 남은 선택 과목`,
                subtitle: `${majorElective.remaining.length}과목`,
                courses: toUiCourses(majorElective.remaining),
              })
            }
          />
          <DetailCreditCard
            title={`${displayName}님 교양 필수 현황`}
            remainingTitle="남은 필수 과목"
            percent={liberalRequired.percent}
            earned={liberalRequired.earned}
            required={liberalRequired.required}
            completed={toUiCourses(liberalRequired.courses)}
            remaining={toUiCourses(liberalRequired.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: '교양 필수 이수 과목',
                subtitle: `${liberalRequired.earned}학점 이수 완료`,
                courses: toUiCourses(liberalRequired.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: '남은 교양 필수 과목',
                subtitle: `${liberalRequired.remaining.length}과목`,
                courses: toUiCourses(liberalRequired.remaining),
              })
            }
          />
          <DetailCreditCard
            title={`${displayName}님 교양 선택 현황`}
            remainingTitle="남은 선택 과목"
            earned={liberalElective.earned}
            completed={toUiCourses(liberalElective.courses)}
            remaining={toUiCourses(liberalElective.remaining)}
            onOpenCompleted={() =>
              setListModal({
                title: '교양 선택 이수 과목',
                subtitle: `취득 ${liberalElective.earned}학점`,
                courses: toUiCourses(liberalElective.courses),
              })
            }
            onOpenRemaining={() =>
              setListModal({
                title: '남은 교양 선택 과목',
                subtitle: `${liberalElective.remaining.length}과목`,
                courses: toUiCourses(liberalElective.remaining),
              })
            }
            earnedOnly
            hideRemaining
          />
        </div>
      </section>

      <EnglishCertModal open={englishOpen} onClose={() => setEnglishOpen(false)} />
      <SWCodingCertModal open={swOpen} onClose={() => setSwOpen(false)} />
      <CourseListModal
        open={listModal != null}
        onClose={() => setListModal(null)}
        title={listModal?.title ?? '과목 목록'}
        subtitle={listModal?.subtitle}
        courses={listModal?.courses ?? []}
      />
    </div>
  )
}

function formatGpa(gpa: number) {
  return gpa > 0 ? gpa.toFixed(2) : '-'
}

function GradeStatCard({ label, value }: { label: string; value: number }) {
  const barWidth = value > 0 ? Math.min(100, Math.max(0, (value / 4.5) * 100)) : 0

  return (
    <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight text-ink">{formatGpa(value)}</span>
        <span className="mb-1 text-sm font-semibold text-ink-muted">/ 4.5</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel">
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
  onOpenCompleted,
  onOpenRemaining,
  earnedOnly = false,
  hideRemaining = false,
}: {
  title: string
  remainingTitle: string
  percent?: number
  earned: number
  required?: number
  completed: ReturnType<typeof toUiCourses>
  remaining?: ReturnType<typeof toUiCourses>
  onOpenCompleted: () => void
  onOpenRemaining: () => void
  earnedOnly?: boolean
  hideRemaining?: boolean
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <h3 className="mb-2 text-lg font-bold leading-snug text-ink">{title}</h3>
      {!earnedOnly && (
        <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-4" />
      )}

      <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2 self-center lg:self-start">
          {earnedOnly ? (
            <div className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-full bg-panel">
              <span className="text-3xl font-extrabold tracking-tight text-ink">{earned}</span>
              <span className="mt-1 text-xs font-semibold text-ink-muted">취득 학점</span>
            </div>
          ) : (
            <>
              <DonutChart
                percent={percent}
                size={120}
                stroke={13}
                label={formatPercentLabel(percent)}
              />
              <div className="space-y-0.5 text-center text-sm text-ink-muted">
                <p>필요 학점 {required || '-'}학점</p>
                <p>이수 학점 {earned}학점</p>
              </div>
            </>
          )}
        </div>

        <div
          className={`grid min-w-0 flex-1 gap-6 ${
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
              emptyText="남은 과목이 없습니다."
              onMoreClick={onOpenRemaining}
            />
          )}
        </div>
      </div>
    </article>
  )
}
