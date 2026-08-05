type ShareDonutProps = {
  value: number
  total: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  centerLabel: string
  centerSub?: string
}

/** 비율용 원형 도넛 */
export function ShareDonut({
  value,
  total,
  size = 160,
  stroke = 16,
  color = '#c8012e',
  trackColor = '#eef0f3',
  centerLabel,
  centerSub,
}: ShareDonutProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0
  const progress = circumference * ratio
  const center = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-sejong">{centerLabel}</span>
        {centerSub && <span className="mt-1 text-xs text-ink-muted">{centerSub}</span>}
      </div>
    </div>
  )
}
