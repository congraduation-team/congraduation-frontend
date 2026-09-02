/** API가 KST(+09:00) 또는 타임존 없는 KST wall time을 내려줄 때 한국 시간으로 표시 */
export function formatKstDateTime(value?: string | null): string {
  if (!value) return '—'
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+09:00`
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return value.replace('T', ' ').slice(0, 16)

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
