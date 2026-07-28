import type { Course } from '../../data/mockData'
import { Modal } from './Modal'

type CourseListModalProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  courses: Course[]
}

export function CourseListModal({ open, onClose, title, subtitle, courses }: CourseListModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} wide>
      <div className="max-h-[420px] overflow-y-auto rounded-xl bg-panel px-5 py-4">
        <ul className="space-y-3.5">
          {courses.map((course) => (
            <li key={`${course.code}-${course.name}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
              <span className="truncate text-[15px] font-medium text-ink">{course.name}</span>
              <span className="w-14 text-right text-[15px] font-semibold text-ink">{course.credits}학점</span>
              <span className="w-20 text-right text-sm text-ink-faint">{course.code}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
