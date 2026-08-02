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
  trackColor = '#eef0f3',
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
  // 270° 아크라 하단이 비어 있어 보이는 높이만 줄임
  const visibleHeight = Math.round(size * 0.78)

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: visibleHeight }}
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
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center text-center"
          style={{
            height: size,
            transform: `translateY(-${size * 0.04}px)`,
          }}
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
