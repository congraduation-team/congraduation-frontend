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
import { classicReading } from '../data/mockData'
import { formatPercentLabel, toNumber, toPercent } from '../utils/number'

function toUiCourses(courses?: CategoryCourse[]) {
  return (courses ?? []).map((c) => ({
    name: c.courseName,
    credits: toNumber(c.credit),
    code: c.courseCode,
  }))
}

export function GraduationPage() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const [progress, setProgress] = useState<GraduationProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [englishOpen, setEnglishOpen] = useState(false)
  const [swOpen, setSwOpen] = useState(false)
  const [requiredOpen, setRequiredOpen] = useState(false)
  const [electiveOpen, setElectiveOpen] = useState(false)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getGraduationProgress(student.id)
        if (!cancelled) setProgress(data)
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
  }, [student])

  const majorRequired = useMemo(() => {
    const found = progress?.categorySummaries?.find((c) => c.category.includes('전공필수') || c.category === '전필')
    return found
  }, [progress])

  const majorElective = useMemo(() => {
    const found = progress?.categorySummaries?.find((c) => c.category.includes('전공선택') || c.category === '전선')
    return found
  }, [progress])

  const displayName = student?.name || '학생'
  const totalEarned = toNumber(progress?.totalCredits?.earnedCredits)
  const totalRequired = toNumber(progress?.totalCredits?.requiredCredits)
  const totalPct = toPercent(progress?.totalCredits?.progressPercent)
  const majorPct = toPercent(progress?.majorCredits?.majorCreditsProgressPercent)
  const majorReqPct = toPercent(progress?.majorCredits?.majorRequiredProgressPercent)
  const majorElecPct = toPercent(progress?.majorCredits?.majorElectiveProgressPercent)

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">{displayName}님 졸업요건 현황</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {progress.admissionYear ? `${progress.admissionYear}학번` : ''}
          {progress.major ? ` · ${progress.major}` : ''}
        </p>
      </div>

      <section className="grid items-start gap-5 xl:grid-cols-[1.7fr_1fr_1fr]">
        <article className="rounded-2xl bg-white px-7 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-lg font-bold text-ink">
            현재 {totalEarned}/{totalRequired || '-'}학점 이수 완료!
          </h3>

          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-5">
            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-left text-sm font-bold text-ink">전체 학점</p>
              <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-2 w-full justify-start" />
              <DonutChart percent={totalPct} size={150} stroke={16} label={formatPercentLabel(totalPct)} />
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-left text-sm font-bold text-ink">전공 학점</p>
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
          <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="mb-2 text-lg font-bold text-ink">{displayName}님 전공 필수 현황</h3>
            <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-5" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3">
                <DonutChart percent={majorReqPct} size={160} stroke={16} label={formatPercentLabel(majorReqPct)} />
                <div className="space-y-1 text-center text-sm text-ink-muted">
                  <p>필요 학점 {toNumber(progress.majorCredits?.requiredMajorRequiredCredits)}학점</p>
                  <p>이수 학점 {toNumber(progress.majorCredits?.earnedMajorRequiredCredits)}학점</p>
                </div>
              </div>
              <div className="flex flex-1 gap-10">
                <CourseMiniList
                  title="이수한 과목"
                  courses={toUiCourses(majorRequired?.courses).slice(0, 6)}
                  totalValue={toNumber(progress.majorCredits?.earnedMajorRequiredCredits)}
                  onTitleClick={() => setRequiredOpen(true)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/curriculum')}
                className="rounded-full bg-sejong px-5 py-2 text-sm font-semibold text-white hover:bg-sejong-dark"
              >
                이수체계도 확인
              </button>
            </div>
          </article>

          <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="mb-2 text-lg font-bold text-ink">{displayName}님 전공 선택 현황</h3>
            <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-5" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3">
                <DonutChart percent={majorElecPct} size={160} stroke={16} label={formatPercentLabel(majorElecPct)} />
                <div className="space-y-1 text-center text-sm text-ink-muted">
                  <p>필요 학점 {toNumber(progress.majorCredits?.requiredMajorElectiveCredits)}학점</p>
                  <p>이수 학점 {toNumber(progress.majorCredits?.earnedMajorElectiveCredits)}학점</p>
                </div>
              </div>
              <div className="flex flex-1 gap-10">
                <CourseMiniList
                  title="이수한 과목"
                  courses={toUiCourses(majorElective?.courses).slice(0, 6)}
                  totalValue={toNumber(progress.majorCredits?.earnedMajorElectiveCredits)}
                  onTitleClick={() => setElectiveOpen(true)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/curriculum')}
                className="rounded-full bg-sejong px-5 py-2 text-sm font-semibold text-white hover:bg-sejong-dark"
              >
                이수체계도 확인
              </button>
            </div>
          </article>
        </div>
      </section>

      <EnglishCertModal open={englishOpen} onClose={() => setEnglishOpen(false)} />
      <SWCodingCertModal open={swOpen} onClose={() => setSwOpen(false)} />
      <CourseListModal
        open={requiredOpen}
        onClose={() => setRequiredOpen(false)}
        title="전공 필수 이수 과목"
        subtitle={`${toNumber(progress.majorCredits?.earnedMajorRequiredCredits)}학점 이수 완료`}
        courses={toUiCourses(majorRequired?.courses)}
      />
      <CourseListModal
        open={electiveOpen}
        onClose={() => setElectiveOpen(false)}
        title="전공 선택 이수 과목"
        subtitle={`${toNumber(progress.majorCredits?.earnedMajorElectiveCredits)}학점 이수 완료`}
        courses={toUiCourses(majorElective?.courses)}
      />
    </div>
  )
}
