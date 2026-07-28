import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartLegend } from '../components/charts/ChartLegend'
import { DonutChart } from '../components/charts/DonutChart'
import { CourseMiniList } from '../components/common/CourseMiniList'
import { CourseListModal } from '../components/modals/CourseListModal'
import { EnglishCertModal } from '../components/modals/EnglishCertModal'
import { SWCodingCertModal } from '../components/modals/SWCodingCertModal'
import {
  classicReading,
  majorElectiveCompleted,
  majorElectiveRemaining,
  majorRequiredCompleted,
  majorRequiredRemaining,
  userName,
} from '../data/mockData'

export function GraduationPage() {
  const navigate = useNavigate()
  const [englishOpen, setEnglishOpen] = useState(false)
  const [swOpen, setSwOpen] = useState(false)
  const [requiredOpen, setRequiredOpen] = useState(false)
  const [electiveOpen, setElectiveOpen] = useState(false)
  const [electiveRemainOpen, setElectiveRemainOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">{userName}님 졸업요건 현황</h2>
        <p className="mt-1 text-sm text-ink-muted">2026-1학기 기준</p>
      </div>

      {/* 상단 카드: 학점 카드가 더 넓게 */}
      <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr_1fr]">
        {/* 학점 현황 */}
        <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-5 text-lg font-bold text-ink">현재 91/130학점 이수 완료!</h3>

          <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-6">
            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-left text-sm font-bold text-ink">전체 학점</p>
              <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-3 w-full justify-start" />
              <DonutChart percent={70} size={150} stroke={16} label="70%" />
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-left text-sm font-bold text-ink">전공 학점</p>
              <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-3 w-full justify-start" />
              <DonutChart percent={48} size={150} stroke={16} label="48%" />
            </div>

            <div className="flex flex-col justify-between gap-5 self-stretch py-1">
              <div className="flex flex-col items-center">
                <p className="mb-1.5 w-full text-left text-sm font-bold text-ink">전공 필수</p>
                <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-2 w-full justify-start" />
                <DonutChart percent={71} size={92} stroke={11} label="71%" />
              </div>
              <div className="flex flex-col items-center">
                <p className="mb-1.5 w-full text-left text-sm font-bold text-ink">전공 선택</p>
                <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-2 w-full justify-start" />
                <DonutChart percent={41} size={92} stroke={11} label="41%" />
              </div>
            </div>
          </div>
        </article>

        {/* 고전독서인증 */}
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

        {/* 미완료된 인증 */}
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
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                    index < 2 ? 'border-b border-[#e5e7eb]' : ''
                  }`}
                >
                  <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-sm font-medium text-ink">
                    {item.name}
                  </span>
                  <span className="text-sm text-ink">{item.value}</span>
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
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                    index === 0 ? 'border-b border-[#e5e7eb]' : ''
                  }`}
                >
                  <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-sm font-medium text-ink">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-sm text-ink">{item.value}</span>
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

      {/* 하단 카드: 전체 너비 */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-ink">학점 현황 자세히 보기</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="mb-2 text-lg font-bold text-ink">{userName}님 전공 필수 현황</h3>
            <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-5" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3">
                <DonutChart percent={71} size={160} stroke={16} label="71%" />
                <div className="space-y-1 text-center text-sm text-ink-muted">
                  <p>필요 학점 14학점</p>
                  <p>이수 학점 10학점</p>
                </div>
              </div>
              <div className="flex flex-1 gap-10">
                <CourseMiniList
                  title="이수한 과목"
                  courses={majorRequiredCompleted}
                  totalValue={10}
                  onTitleClick={() => setRequiredOpen(true)}
                />
                <CourseMiniList title="남은 전필 과목" courses={majorRequiredRemaining} />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <CurriculumButton onClick={() => navigate('/curriculum')} />
            </div>
          </article>

          <article className="rounded-2xl bg-white px-7 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="mb-2 text-lg font-bold text-ink">{userName}님 전공 선택 현황</h3>
            <ChartLegend secondaryLabel="총 학점" activeColor="#c8012e" className="mb-5" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3">
                <DonutChart percent={41} size={160} stroke={16} label="41%" />
                <div className="space-y-1 text-center text-sm text-ink-muted">
                  <p>필요 학점 49학점</p>
                  <p>이수 학점 20학점</p>
                </div>
              </div>
              <div className="flex flex-1 gap-10">
                <CourseMiniList
                  title="이수한 과목"
                  courses={majorElectiveCompleted.slice(0, 4)}
                  totalValue={20}
                  onTitleClick={() => setElectiveOpen(true)}
                />
                <CourseMiniList
                  title="남은 전선 과목"
                  courses={majorElectiveRemaining.slice(0, 4)}
                  onTitleClick={() => setElectiveRemainOpen(true)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <CurriculumButton onClick={() => navigate('/curriculum')} />
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
        subtitle="10학점 이수 완료"
        courses={majorRequiredCompleted}
      />
      <CourseListModal
        open={electiveOpen}
        onClose={() => setElectiveOpen(false)}
        title="전공 선택 이수 과목"
        subtitle="20학점 이수 완료"
        courses={majorElectiveCompleted}
      />
      <CourseListModal
        open={electiveRemainOpen}
        onClose={() => setElectiveRemainOpen(false)}
        title="전공 선택 남은 과목"
        subtitle="24개 과목들 중 선택 이수하시면 요건을 충족할 수 있습니다."
        courses={majorElectiveRemaining}
      />
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
