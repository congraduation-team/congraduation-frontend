import { engMajorCompleted, majorElectiveCompleted, majorRequiredCompleted } from '../data/mockData'

const sections = [
  { title: '전공 필수', courses: majorRequiredCompleted },
  { title: '전공 선택', courses: majorElectiveCompleted },
  { title: '공학인증 전공', courses: engMajorCompleted },
]

export function MyCoursesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">내 이수과목</h2>
        <p className="mt-1 text-sm text-ink-muted">2026-1학기 기준 이수한 과목 목록입니다.</p>
      </div>

      {sections.map((section) => (
        <article
          key={section.title}
          className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <h3 className="mb-4 text-base font-bold text-ink">{section.title}</h3>
          <div className="rounded-xl bg-panel px-5 py-4">
            <ul className="space-y-3.5">
              {section.courses.map((course) => (
                <li
                  key={`${section.title}-${course.code}-${course.name}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4"
                >
                  <span className="truncate text-[15px] font-medium text-ink">{course.name}</span>
                  <span className="w-14 text-right text-[15px] font-semibold text-ink">
                    {course.credits}학점
                  </span>
                  <span className="w-20 text-right text-sm text-ink-faint">{course.code}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  )
}
