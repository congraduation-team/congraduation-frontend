import type { Course } from '../../data/mockData'

type CourseMiniListProps = {
  title?: string
  courses: Course[]
  totalLabel?: string
  totalValue?: string | number
  showSemester?: boolean
  /** 미리보기 개수. 미지정 시 전체 표시 */
  previewCount?: number
  emptyText?: string
  /** 헤더 오른쪽에 항상 더보기 표시 */
  showMoreLink?: boolean
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
  emptyText = '과목이 없습니다.',
  showMoreLink = false,
  onMoreClick,
  onTitleClick,
  className = '',
}: CourseMiniListProps) {
  const limited = previewCount != null
  const visible = limited ? courses.slice(0, previewCount) : courses
  const moreCount = limited ? Math.max(0, courses.length - previewCount) : 0
  const openAll = onMoreClick ?? onTitleClick
  const showHeaderMore = Boolean(openAll && (showMoreLink || moreCount > 0))

  return (
    <div className={`min-w-0 ${className}`}>
      {title && (
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={openAll}
            className={`min-w-0 text-left text-sm font-bold leading-snug break-keep text-ink ${
              openAll ? 'hover:text-sejong' : 'cursor-default'
            }`}
          >
            {title}
          </button>
          {showHeaderMore && (
            <button
              type="button"
              onClick={openAll}
              className="mt-0.5 shrink-0 text-xs font-medium text-ink-muted hover:text-sejong"
            >
              더보기
            </button>
          )}
        </div>
      )}
      <ul className="space-y-2.5">
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
          <li className="text-sm text-ink-muted">{emptyText}</li>
        )}
      </ul>
      {moreCount > 0 && openAll && !showHeaderMore && (
        <button
          type="button"
          onClick={openAll}
          className="mt-2 text-xs font-semibold text-sejong hover:underline"
        >
          외 {moreCount}개 더보기
        </button>
      )}
      {totalValue !== undefined && (
        <p className="mt-3 flex items-center justify-between border-t border-[#eee] pt-2.5 text-sm font-bold">
          <span className="text-ink">{totalLabel}</span>
          <span className="text-sejong">{totalValue}</span>
        </p>
      )}
    </div>
  )
}
