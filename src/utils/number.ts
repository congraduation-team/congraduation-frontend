export function toNumber(value?: string | number | null) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function toPercent(value?: string | number | null) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value))))
}

export function formatPercentLabel(value?: string | number | null) {
  return `${toPercent(value)}%`
}
