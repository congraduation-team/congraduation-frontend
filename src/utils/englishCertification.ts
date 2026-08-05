export type EnglishRequirementRow = {
  label: string
  value: string
}

/** 일반 전공 · 2012~2022 입학 (API 없을 때 fallback) */
const GENERAL_PRE_2023: EnglishRequirementRow[] = [
  { label: 'TOEIC', value: '700점 이상' },
  { label: 'TOEFL iBT', value: '80점 이상' },
  { label: 'TEPS', value: '556점(뉴텝스 301점) 이상' },
  { label: 'OPIc', value: 'Intermediate Low 이상' },
  { label: 'TOEIC Speaking', value: 'Intermediate Low 이상' },
  { label: 'G-TELP Level 2', value: '65점 이상' },
]

/** 일반 전공 · 2023 이후 입학 */
const GENERAL_FROM_2023: EnglishRequirementRow[] = [
  { label: 'TOEIC', value: '800점 이상' },
  { label: 'TOEFL iBT', value: '80점 이상' },
  { label: 'TEPS', value: '637점(뉴텝스 348점) 이상' },
  { label: 'OPIc', value: 'Intermediate Mid 1 이상' },
  { label: 'TOEIC Speaking', value: 'Intermediate Mid 1 이상' },
  { label: 'G-TELP Level 2', value: '77점 이상' },
  { label: 'G-TELP Speaking Level 4', value: '' },
]

/** 영어영문학 · 2012~2022 */
const ENGLISH_MAJOR_PRE_2023: EnglishRequirementRow[] = [
  { label: 'TOEIC', value: '800점 이상' },
  { label: 'TOEFL iBT', value: '91점 이상' },
  { label: 'TEPS', value: '637점(뉴텝스 348점) 이상' },
  { label: 'OPIc', value: 'Intermediate Mid 1 이상' },
  { label: 'TOEIC Speaking', value: 'Intermediate Mid 1 이상' },
  { label: 'G-TELP Level 2', value: '77점 이상' },
]

/** 영어영문학 · 2023 이후 */
const ENGLISH_MAJOR_FROM_2023: EnglishRequirementRow[] = [
  { label: 'TOEIC', value: '900점 이상' },
  { label: 'TOEFL iBT', value: '91점 이상' },
  { label: 'TEPS', value: '766점(뉴텝스 430점) 이상' },
  { label: 'OPIc', value: 'Intermediate Mid 2 이상' },
  { label: 'TOEIC Speaking', value: 'Intermediate Mid 2 이상' },
  { label: 'G-TELP Level 2', value: '90점 이상' },
  { label: 'G-TELP Speaking Level 3', value: '' },
]

function isEnglishMajor(major?: string | null) {
  const m = (major || '').replace(/\s+/g, '')
  return m.includes('영어영문') || m.includes('영어데이터융합')
}

/** API primaryRequirement 파싱 → 표 행 */
export function parseEnglishPrimaryRequirement(
  primaryRequirement?: string | null,
): EnglishRequirementRow[] {
  if (!primaryRequirement?.trim()) return []

  let text = primaryRequirement.trim()
  text = text.replace(/^[^:]*기준:\s*/u, '')

  const hasIntensive = /Intensive\s*English/i.test(text)
  text = text
    .replace(/\s*또는\s*Intensive\s*English.*$/iu, '')
    .replace(/,\s*$/u, '')
    .trim()

  const parts = text.split(/,\s*(?=TOEIC|TOEFL|TEPS|OPIc|G-TELP)/i).map((p) => p.trim()).filter(Boolean)
  const rows: EnglishRequirementRow[] = []

  for (const part of parts) {
    let m = part.match(/^(G-TELP Level\s*\d)\(([^)]+)\)(.*)$/i)
    if (m) {
      const suffix = (m[3] || '').trim()
      rows.push({ label: m[1].replace(/\s+/g, ' ').trim(), value: suffix ? `${m[2]}${suffix}` : m[2] })
      continue
    }
    m = part.match(/^(G-TELP Speaking Level\s*\d)\s*(.*)$/i)
    if (m) {
      rows.push({
        label: m[1].replace(/\s+/g, ' ').trim(),
        value: (m[2] || '').trim() || '—',
      })
      continue
    }
    m = part.match(/^(TOEFL iBT|TOEIC Speaking|TOEIC|TEPS|OPIc)\s+(.+)$/i)
    if (m) {
      rows.push({ label: m[1], value: m[2].trim() })
      continue
    }
    rows.push({ label: part, value: '' })
  }

  if (hasIntensive) {
    rows.push({ label: '대체과목', value: 'Intensive English 이수' })
  }

  return rows
}

/** API 없을 때 입학연도·전공 기준 fallback */
export function englishRequirementsForAdmission(
  admissionYear?: number | null,
  major?: string | null,
): EnglishRequirementRow[] {
  const year = admissionYear && admissionYear > 0 ? admissionYear : 9999
  const from2023 = year >= 2023
  if (isEnglishMajor(major)) {
    return from2023 ? ENGLISH_MAJOR_FROM_2023 : ENGLISH_MAJOR_PRE_2023
  }
  return from2023 ? GENERAL_FROM_2023 : GENERAL_PRE_2023
}

/** 카드/모달용: API primaryRequirement 우선, 없으면 fallback */
export function englishRequirementsFromCert(
  primaryRequirement?: string | null,
  admissionYear?: number | null,
  major?: string | null,
): EnglishRequirementRow[] {
  const parsed = parseEnglishPrimaryRequirement(primaryRequirement)
  if (parsed.length > 0) return parsed
  return englishRequirementsForAdmission(admissionYear, major)
}

/** 카드 미리보기: 시험 기준 상위 3개 (대체과목 제외) */
export function englishRequirementPreviewFromCert(
  primaryRequirement?: string | null,
  admissionYear?: number | null,
  major?: string | null,
): EnglishRequirementRow[] {
  return englishRequirementsFromCert(primaryRequirement, admissionYear, major)
    .filter((row) => row.label !== '대체과목')
    .slice(0, 3)
}

/** detail에서 학기 진행 한 줄 추출 */
export function englishProgressLine(detail?: string | null): string | null {
  const text = (detail ?? '').trim()
  if (!text) return null
  const m = text.match(/현재\s*기이수\s*정규학기\s*\d+\s*학기\s*\/\s*학기\s*면제\s*기준\s*\d+\s*학기/u)
  return m?.[0] ?? null
}
