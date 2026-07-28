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

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
        <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center justify-end text-center">
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
