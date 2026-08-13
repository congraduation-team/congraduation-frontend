import type { MajorType, StudentLoginResponse } from '../api/types'

export type TrackOption = {
  key: string
  label: string
  trackType: MajorType
  department: string
  isPrimary: boolean
}

export function trackStatusLabel(status?: string | null): string {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':
      return '충족'
    case 'IN_PROGRESS':
      return '진행중'
    case 'GUIDANCE':
      return '안내'
    case 'NOT_REQUIRED':
      return '해당 없음'
    case 'MANUAL_CHECK_REQUIRED':
      return '확인 필요'
    default:
      return status?.trim() || ''
  }
}

export function trackStatusClass(status?: string | null): string {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700'
    case 'IN_PROGRESS':
      return 'bg-[#fde8ec] text-sejong'
    case 'GUIDANCE':
    case 'MANUAL_CHECK_REQUIRED':
      return 'bg-amber-50 text-amber-800'
    case 'NOT_REQUIRED':
      return 'bg-panel text-ink-muted'
    default:
      return 'bg-panel text-ink-muted'
  }
}

export function isGuidanceStatus(status?: string | null): boolean {
  const value = (status || '').toUpperCase()
  return value === 'GUIDANCE' || value === 'MANUAL_CHECK_REQUIRED'
}

export function trackTypeLabel(type?: MajorType | string | null): string {
  switch (type) {
    case 'SINGLE':
      return '주전공'
    case 'DOUBLE':
    case 'DOUBLE_MAJOR':
      return '복수전공'
    case 'MINOR':
      return '부전공'
    case 'SECOND_MAJOR':
      return '제2전공'
    case 'LINKED_FUSION':
      return '연계·융합'
    case 'SELF_DESIGNED':
      return '자기설계'
    default:
      return '전공'
  }
}

export function buildTrackOptions(
  student: Pick<StudentLoginResponse, 'major' | 'majorType' | 'secondaryMajor' | 'tracks'> | null,
  extraTracks?: Array<{ department?: string; trackType?: MajorType }>,
): TrackOption[] {
  if (!student) return []
  const options: TrackOption[] = []
  const seen = new Set<string>()

  const push = (label: string, trackType: MajorType, isPrimary: boolean) => {
    const dept = label.trim()
    if (!dept || seen.has(dept)) return
    seen.add(dept)
    options.push({
      key: `${isPrimary ? 'primary' : 'track'}:${dept}`,
      label: dept,
      trackType,
      department: dept,
      isPrimary,
    })
  }

  if (student.major) {
    push(student.major, 'SINGLE', true)
  }

  if (student.secondaryMajor) {
    const secondaryType =
      student.majorType && student.majorType !== 'SINGLE' ? student.majorType : 'DOUBLE_MAJOR'
    push(student.secondaryMajor, secondaryType, false)
  }

  for (const track of student.tracks ?? []) {
    if (!track.departmentCode) continue
    const isPrimary = track.departmentCode === student.major || track.trackType === 'SINGLE'
    push(track.departmentCode, track.trackType, Boolean(isPrimary && track.departmentCode === student.major))
  }

  for (const track of extraTracks ?? []) {
    if (!track.department) continue
    const isPrimary = track.department === student.major
    push(track.department, track.trackType ?? 'DOUBLE_MAJOR', isPrimary)
  }

  return options
}
