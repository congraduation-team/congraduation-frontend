import type { PlannedCoursesResponse } from '../api/types'

export function parseTermKey(value?: string | null): { gradeYear: number; semester: number } | null {
  if (!value) return null
  const m = String(value).trim().match(/^(\d+)\s*[-_/]\s*([12])/)
  if (!m) return null
  return { gradeYear: Number(m[1]), semester: Number(m[2]) }
}

/** classic 포털 이수 학기 수 → 1-1, 1-2, 2-1 … */
export function standingTermFromCount(count?: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null
  const n = Math.floor(count)
  const gradeYear = Math.ceil(n / 2)
  const semester = n % 2 === 0 ? 2 : 1
  return `${gradeYear}-${semester}`
}

/**
 * 남은 학기/standing.
 * 계획학기 API lastCompletedSemester를 그대로 쓰고,
 * 없으면 로그인 completedSemesterCount. 기이수 year/semester로 재계산하지 않음.
 */
export function resolveLastStanding(
  planned?: PlannedCoursesResponse | null,
  completedSemesterCount?: number | null,
): string | null {
  const fromApi = planned?.lastCompletedSemester?.trim() || null
  if (fromApi) return fromApi

  const count =
    completedSemesterCount ??
    planned?.completedSemesterCount ??
    null
  return standingTermFromCount(count)
}

export function formatStandingLabel(
  planned?: PlannedCoursesResponse | null,
  completedSemesterCount?: number | null,
): string | null {
  const standingKey = resolveLastStanding(planned, completedSemesterCount)
  const parsed = parseTermKey(standingKey)
  let label: string | null = parsed ? `${parsed.gradeYear}-${parsed.semester}학기` : standingKey
  if (!label) return null
  if (planned?.overStanding === true) return `${label} · 초과학년`
  return label
}

export function isPastMaxPlannableTerm(lastCompleted?: string | null) {
  const parsed = parseTermKey(lastCompleted)
  if (!parsed) return false
  return parsed.gradeYear > 8 || (parsed.gradeYear === 8 && parsed.semester >= 2)
}

export function isSemesterAfterLast(
  gradeYear: number | string | null | undefined,
  semester: number | string | null | undefined,
  lastCompleted?: string | null,
) {
  const last = parseTermKey(lastCompleted)
  if (!last) return true
  const gy = Number(gradeYear)
  const sem = Number(semester)
  if (!Number.isFinite(gy) || !Number.isFinite(sem)) return true
  return gy > last.gradeYear || (gy === last.gradeYear && sem > last.semester)
}
