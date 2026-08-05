const STORAGE_KEY = 'congraduation.visitorKey'

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 브라우저당 고정 UUID (순 방문 집계용) */
export function getOrCreateVisitorKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim()
    if (existing) return existing
    const next = createUuid()
    localStorage.setItem(STORAGE_KEY, next)
    return next
  } catch {
    return createUuid()
  }
}
