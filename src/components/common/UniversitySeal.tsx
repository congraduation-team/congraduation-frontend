export function UniversitySeal({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#c8012e" strokeWidth="3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#c8012e" strokeWidth="1.5" />
      <text
        x="50"
        y="42"
        textAnchor="middle"
        fill="#c8012e"
        fontSize="11"
        fontWeight="700"
        fontFamily="Pretendard, sans-serif"
      >
        세종대학교
      </text>
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="#c8012e"
        fontSize="8"
        fontWeight="600"
        fontFamily="Pretendard, sans-serif"
      >
        SEJONG UNIV.
      </text>
      <path
        d="M35 68c5 6 25 6 30 0"
        fill="none"
        stroke="#c8012e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
