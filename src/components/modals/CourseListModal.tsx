import type { Course } from '../../data/mockData'
import { displayCourseCode } from '../../utils/courseCode'
import { Modal } from './Modal'

export type CourseListGroup = {
  title: string
  courses: Course[]
}

type CourseListModalProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  courses?: Course[]
  /** 영역별 추천 과목 등 그룹 목록 (있으면 courses 대신 사용) */
  groups?: CourseListGroup[]
}

function CourseRow({ course }: { course: Course }) {
  const code = displayCourseCode(course.code)
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(5rem,auto)] items-center gap-3">
      <span className="truncate text-[15px] font-medium text-ink">{course.name}</span>
      <span className="w-14 shrink-0 text-right text-[15px] font-semibold text-ink">
        {course.credits}학점
      </span>
      <span className="truncate text-right text-sm text-ink-faint" title={code || undefined}>
        {code || '—'}
      </span>
    </li>
  )
}

export function CourseListModal({
  open,
  onClose,
  title,
  subtitle,
  courses = [],
  groups,
}: CourseListModalProps) {
  const hasGroups = (groups?.length ?? 0) > 0

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} wide>
      <div className="max-h-[420px] overflow-y-auto rounded-xl bg-panel px-5 py-4">
        {hasGroups ? (
          <div className="space-y-5">
            {groups!.map((group) => (
              <section key={group.title}>
                <h4 className="mb-2 text-sm font-bold text-ink">{group.title}</h4>
                {group.courses.length === 0 ? (
                  <p className="text-sm text-ink-muted">추천 과목 정보가 없습니다.</p>
                ) : (
                  <ul className="space-y-3">
                    {group.courses.map((course) => (
                      <CourseRow
                        key={`${group.title}-${course.code}-${course.name}`}
                        course={course}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">표시할 과목이 없습니다.</p>
        ) : (
          <ul className="space-y-3.5">
            {courses.map((course) => (
              <CourseRow key={`${course.code}-${course.name}`} course={course} />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
