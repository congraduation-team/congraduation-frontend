/** 인증 상세 문구를 읽기 좋은 줄로 나눔 */
export function splitCertDetail(detail?: string | null): string[] {
  const text = (detail ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return []

  const patterns = [
    /^(.*?이수해)\s+(.+)$/u,
    /^(.*?이수로)\s+(.+)$/u,
    /^(.*?기준으로)\s+(.+)$/u,
    /^(.*?대상이라)\s+(.+)$/u,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1] && m?.[2]) return [m[1], m[2]]
  }

  // API 상세: 문장 단위로 분리
  if (text.includes('. ')) {
    return text
      .split(/\.\s+/u)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i, arr) => (i < arr.length - 1 && !/[.。!?]$/u.test(s) ? `${s}.` : s))
  }

  return [text]
}

export function CertDetailText({
  detail,
  className = 'mt-1.5 text-[11px] leading-relaxed text-ink-muted',
}: {
  detail?: string | null
  className?: string
}) {
  const lines = splitCertDetail(detail)
  if (lines.length === 0) return null

  return (
    <div className={`${className} break-keep text-pretty`}>
      {lines.map((line) => (
        <p key={line} className="block">
          {line}
        </p>
      ))}
    </div>
  )
}
