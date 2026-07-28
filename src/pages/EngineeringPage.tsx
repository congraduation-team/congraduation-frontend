import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartLegend } from '../components/charts/ChartLegend'
import { DonutChart } from '../components/charts/DonutChart'
import { CourseMiniList } from '../components/common/CourseMiniList'
import { CourseListModal } from '../components/modals/CourseListModal'
import {
  bsmCompleted,
  bsmRemaining,
  designCompleted,
  designRemaining,
  engMajorCompleted,
  liberalArtsElective,
  liberalArtsRequired,
  userName,
} from '../data/mockData'

export function EngineeringPage() {
  const navigate = useNavigate()
  const [majorOpen, setMajorOpen] = useState(false)

  const remainingLeft = designRemaining.slice(0, Math.ceil(designRemaining.length / 2))
  const remainingRight = designRemaining.slice(Math.ceil(designRemaining.length / 2))

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-ink">{userName}님 공학인증 현황</h2>
        <p className="mt-1 text-sm text-ink-muted">2026-1학기 기준</p>
      </div>

      <div className="mx-auto max-w-[1080px] space-y-5">
        {/* 전문교양 */}
        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-5 text-base font-bold text-ink">
            {userName}님 전문교양 <span className="text-sejong">16/14</span>학점 이수
          </h3>

          <div className="grid gap-7 md:grid-cols-2">
            <section>
              <p className="mb-2 text-sm font-bold text-ink">인증필수</p>
              <ChartLegend secondaryLabel="최소 이수 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart percent={100} size={120} stroke={13} color="#5b6470" label="100%" />
                <CourseMiniList title="이수한 과목" courses={liberalArtsRequired} totalValue={10} />
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-bold text-ink">인증선택</p>
              <ChartLegend secondaryLabel="최소 이수 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart percent={100} size={120} stroke={13} color="#5b6470" label="100%" />
                <CourseMiniList title="이수한 과목" courses={liberalArtsElective} totalValue={6} />
              </div>
            </section>
          </div>

          <div className="mt-5 flex justify-end">
            <CurriculumButton onClick={() => navigate('/curriculum')} />
          </div>
        </article>

        {/* BSM */}
        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 text-base font-bold text-ink">
            BSM <span className="text-sejong">14/18</span>학점 이수
          </h3>
          <ChartLegend secondaryLabel="총 학점" className="mb-4" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <DonutChart percent={72} size={130} stroke={14} color="#5b6470" label="72%" />
            <div className="flex flex-1 gap-9">
              <CourseMiniList title="이수한 과목" courses={bsmCompleted} totalValue={13} />
              <CourseMiniList title="남은 과목" courses={bsmRemaining} />
            </div>
          </div>
        </article>

        {/* 전공 */}
        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-base font-bold text-ink">
            전공 <span className="text-sejong">35/45</span>학점 이수
          </h3>
          <p className="mb-5 mt-1 text-sm text-ink-muted">전공 23학점 설계 12학점 이수</p>

          <div className="grid gap-7 md:grid-cols-2">
            <section>
              <p className="mb-2 text-sm font-bold text-ink">전공교과목</p>
              <ChartLegend secondaryLabel="총 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart percent={78} size={120} stroke={13} color="#5b6470" label="78%" />
                <CourseMiniList
                  title="이수한 과목"
                  courses={engMajorCompleted.slice(0, 4)}
                  totalValue={23}
                  onTitleClick={() => setMajorOpen(true)}
                />
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-bold text-ink">설계</p>
              <ChartLegend secondaryLabel="총 학점" className="mb-3.5" />
              <div className="flex items-start gap-5">
                <DonutChart percent={60} size={120} stroke={13} color="#5b6470" label="60%" />
                <CourseMiniList title="이수한 과목" courses={designCompleted} totalValue="12.6" />
              </div>
            </section>
          </div>

          <div className="mt-5 flex justify-end">
            <CurriculumButton onClick={() => navigate('/curriculum')} />
          </div>
        </article>

        {/* 전공 설계 자세히 보기 */}
        <article className="rounded-2xl bg-white px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 text-base font-bold text-ink">전공 설계 자세히 보기</h3>
          <ChartLegend secondaryLabel="총 학점" className="mb-4" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <DonutChart percent={60} size={130} stroke={14} color="#5b6470" label="60%" />

            <div className="min-w-0 flex-[0.9]">
              <CourseMiniList title="이수한 과목" courses={designCompleted} totalValue="12.6" />
            </div>

            <div className="min-w-0 flex-[1.4]">
              <p className="mb-2.5 text-sm font-bold text-ink">남은 과목</p>
              <div className="grid gap-x-7 gap-y-2 sm:grid-cols-2">
                <ul className="space-y-2">
                  {remainingLeft.map((course) => (
                    <li key={course.code} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-ink">{course.name}</span>
                      <span className="shrink-0 font-semibold text-sejong">{course.semester}학기</span>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-2">
                  {remainingRight.map((course) => (
                    <li key={course.code} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-ink">{course.name}</span>
                      <span className="shrink-0 font-semibold text-sejong">{course.semester}학기</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </article>

        <CourseListModal
          open={majorOpen}
          onClose={() => setMajorOpen(false)}
          title="공학인증 요건 전공 이수 현황"
          courses={engMajorCompleted}
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
