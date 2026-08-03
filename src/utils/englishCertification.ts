export type EnglishRequirementRow = {
  label: string
  value: string
}

/** 일반 전공 · 2012~2022 입학 */
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
  return m.includes('영어영문')
}

/**
 * 세종대 영어졸업인증 공인시험 기준.
 * - 2012~2022 입학: TOEIC 700 / Speaking IL 등
 * - 2023 이후: TOEIC 800 / Speaking IM1 등
 */
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

/** 카드 미리보기용 핵심 3항목 (짧은 표기) */
export function englishRequirementPreview(
  admissionYear?: number | null,
  major?: string | null,
): EnglishRequirementRow[] {
  const year = admissionYear && admissionYear > 0 ? admissionYear : 9999
  const from2023 = year >= 2023
  const englishMajor = isEnglishMajor(major)

  if (englishMajor) {
    return from2023
      ? [
          { label: 'TOEIC', value: '900점 이상' },
          { label: 'TOEFL iBT', value: '91점 이상' },
          { label: 'TOEIC Speaking', value: 'IM 2 이상' },
        ]
      : [
          { label: 'TOEIC', value: '800점 이상' },
          { label: 'TOEFL iBT', value: '91점 이상' },
          { label: 'TOEIC Speaking', value: 'IM 1 이상' },
        ]
  }

  return from2023
    ? [
        { label: 'TOEIC', value: '800점 이상' },
        { label: 'TOEFL iBT', value: '80점 이상' },
        { label: 'TOEIC Speaking', value: 'IM 1 이상' },
      ]
    : [
        { label: 'TOEIC', value: '700점 이상' },
        { label: 'TOEFL iBT', value: '80점 이상' },
        { label: 'TOEIC Speaking', value: 'IL 이상' },
      ]
}
