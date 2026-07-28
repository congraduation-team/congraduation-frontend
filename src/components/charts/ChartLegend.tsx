type ChartLegendProps = {
  secondaryLabel: '최소 이수 학점' | '총 학점'
  activeColor?: string
  trackColor?: string
  className?: string
}

export function ChartLegend({
  secondaryLabel,
  activeColor = '#5b6470',
  trackColor = '#e8e8ec',
  className = '',
}: ChartLegendProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`}>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: activeColor }} />
        <span style={{ color: activeColor }}>이수 학점</span>
      </span>
      <span className="flex items-center gap-1.5 text-ink">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: trackColor }} />
        {secondaryLabel}
      </span>
    </div>
  )
}
