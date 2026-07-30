import type { Course } from '../../data/mockData'

type CourseMiniListProps = {
  title?: string
  courses: Course[]
  totalLabel?: string
  totalValue?: string | number
  showSemester?: boolean
  /** 미리보기 개수. 미지정 시 전체 표시 */
  previewCount?: number
  onMoreClick?: () => void
  onTitleClick?: () => void
  className?: string
}

export function CourseMiniList({
  title,
  courses,
  totalLabel = '총',
  totalValue,
  showSemester,
  previewCount,
  onMoreClick,
  onTitleClick,
  className = '',
}: CourseMiniListProps) {
  const limited = previewCount != null
  const visible = limited ? courses.slice(0, previewCount) : courses
  const moreCount = limited ? Math.max(0, courses.length - previewCount) : 0

  return (
    <div className={`w-[200px] shrink-0 ${className}`}>
      {title && (
        <button
          type="button"
          onClick={onTitleClick ?? onMoreClick}
          className={`mb-2.5 text-left text-sm font-bold text-ink ${
            onTitleClick || onMoreClick ? 'hover:text-sejong' : ''
          }`}
        >
          {title}
        </button>
      )}
      <ul className="space-y-2">
        {visible.map((course) => (
          <li
            key={`${course.code}-${course.name}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="min-w-0 truncate text-ink">{course.name}</span>
            {showSemester && course.semester ? (
              <span className="shrink-0 font-semibold text-sejong">{course.semester}학기</span>
            ) : (
              <span className="w-6 shrink-0 text-right font-medium text-ink">{course.credits}</span>
            )}
          </li>
        ))}
        {courses.length === 0 && (
          <li className="text-sm text-ink-muted">이수한 과목이 없습니다.</li>
        )}
      </ul>
      {moreCount > 0 && onMoreClick && (
        <button
          type="button"
          onClick={onMoreClick}
          className="mt-2 text-xs font-semibold text-sejong hover:underline"
        >
          외 {moreCount}개 더보기
        </button>
      )}
      {totalValue !== undefined && (
        <p className="mt-3 flex items-center justify-between text-sm font-bold">
          <span className="text-ink">{totalLabel}</span>
          <span className="text-sejong">{totalValue}</span>
        </p>
      )}
    </div>
  )
}
