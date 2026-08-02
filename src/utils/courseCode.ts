/** 학수번호 여부 (MAJ_NETWORK, CSE_operating_system 등 내부 코드 제외) */
export function isAcademicCourseCode(code?: string | null): boolean {
  if (!code) return false
  const trimmed = code.trim()
  if (!trimmed) return false
  if (/^[A-Z][A-Z0-9_]*$/.test(trimmed) && trimmed.includes('_')) return false
  if (/^[A-Z]{2,}_/.test(trimmed)) return false
  return true
}

export function displayCourseCode(code?: string | null): string {
  return isAcademicCourseCode(code) ? String(code).trim() : ''
}

export function normalizeCourseNameKey(name?: string | null): string {
  if (!name) return ''
  return name
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]【】·・:：\-_/]/g, '')
    .toUpperCase()
}

/** 과목명 → 학수번호 맵에서 조회 (정확 일치 → 부분 포함) */
export function lookupAcademicCodeByName(
  courseName: string,
  codeByName: Map<string, string>,
): string {
  const key = normalizeCourseNameKey(courseName)
  if (!key) return ''
  const exact = codeByName.get(key)
  if (exact && isAcademicCourseCode(exact)) return exact

  for (const [nameKey, code] of codeByName) {
    if (!isAcademicCourseCode(code)) continue
    if (nameKey.includes(key) || key.includes(nameKey)) return code
  }
  return ''
}
