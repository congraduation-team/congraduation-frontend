type DonutChartProps = {
  percent: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  label?: string
  labelColor?: string
  subLabel?: string
}

/** 하단이 열린 270° 아크 게이지 (피그마 스타일) */
export function DonutChart({
  percent,
  size = 120,
  stroke = 14,
  color = '#c8012e',
  trackColor = '#e8e8ec',
  label,
  labelColor,
  subLabel,
}: DonutChartProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const arcRatio = 0.75 // 270°
  const arcLength = circumference * arcRatio
  const progressLength = arcLength * (Math.min(Math.max(percent, 0), 100) / 100)
  const center = size / 2
  // 열린 하단을 잘라 시각 중심이 레이아웃 중앙에 오도록
  const visualHeight = Math.round(size * 0.78)

  return (
    <div
      className="relative inline-flex shrink-0 items-start justify-center overflow-hidden"
      style={{ width: size, height: visualHeight }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute left-0 top-0"
      >
        <g transform={`rotate(135 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            className="transition-all duration-700"
          />
        </g>
      </svg>

      {(label || subLabel) && (
        <div
          className="pointer-events-none absolute left-0 right-0 flex flex-col items-center justify-center text-center"
          style={{ top: size * 0.22, height: size * 0.36 }}
        >
          {label && (
            <span
              className="font-bold leading-none"
              style={{
                fontSize: Math.max(12, size * 0.13),
                color: labelColor ?? color,
              }}
            >
              {label}
            </span>
          )}
          {subLabel && <span className="mt-1 text-xs text-ink-muted">{subLabel}</span>}
        </div>
      )}
    </div>
  )
}
