import type { Course } from '../../data/mockData'

type CourseMiniListProps = {
  title?: string
  courses: Course[]
  totalLabel?: string
  totalValue?: string | number
  showSemester?: boolean
  onTitleClick?: () => void
}

export function CourseMiniList({
  title,
  courses,
  totalLabel = '총',
  totalValue,
  showSemester,
  onTitleClick,
}: CourseMiniListProps) {
  return (
    <div className="min-w-0 flex-1">
      {title && (
        <button
          type="button"
          onClick={onTitleClick}
          className={`mb-2.5 text-left text-sm font-bold text-ink ${onTitleClick ? 'hover:text-sejong' : ''}`}
        >
          {title}
        </button>
      )}
      <ul className="space-y-2">
        {courses.map((course) => (
          <li key={`${course.code}-${course.name}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-ink">{course.name}</span>
            {showSemester && course.semester ? (
              <span className="shrink-0 font-semibold text-sejong">{course.semester}학기</span>
            ) : (
              <span className="shrink-0 font-medium text-ink">{course.credits}</span>
            )}
          </li>
        ))}
      </ul>
      {totalValue !== undefined && (
        <p className="mt-3 flex items-center justify-between text-sm font-bold">
          <span className="text-ink">{totalLabel}</span>
          <span className="text-sejong">{totalValue}</span>
        </p>
      )}
    </div>
  )
}
