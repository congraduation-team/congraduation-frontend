export type MajorType =
  | 'SINGLE'
  | 'DOUBLE'
  | 'DOUBLE_MAJOR'
  | 'MINOR'
  | 'SECOND_MAJOR'
  | 'LINKED_FUSION'
  | 'SELF_DESIGNED'

export type StudentMajorTrack = {
  id?: number
  trackType: MajorType
  departmentCode: string
  approvedAtSemester?: number
  teachingCert?: boolean
}

export type UserRole = 'USER' | 'ADMIN' | 'ROLE_USER' | 'ROLE_ADMIN' | (string & {})

export type StudentLoginResponse = {
  id: number
  studentNo: string
  name: string
  major: string
  majorType: MajorType
  secondaryMajor?: string
  tracks?: StudentMajorTrack[]
  gradeLevel?: number
  admissionYear?: number
  status?: string
  /** 백엔드가 내려주는 역할. ADMIN / ROLE_ADMIN 이면 관리자 */
  role?: UserRole
  /** role 대신 boolean으로 주는 경우 */
  isAdmin?: boolean
}

export type AdminUploadResponse = {
  message?: string
  count?: number
}

export function isAdminUser(student: StudentLoginResponse | null | undefined): boolean {
  if (!student) return false
  if (student.isAdmin === true) return true
  const role = student.role?.toUpperCase()
  return role === 'ADMIN' || role === 'ROLE_ADMIN'
}

export type CategoryCourse = {
  courseCode: string
  courseName: string
  credit: string
}

export type CreditProgress = {
  earnedCredits: string
  requiredCredits: string
  satisfied: boolean
  progressPercent: string
}

export type CategorySummary = {
  category: string
  earnedCredits: string
  requiredCredits: string
  satisfied: boolean
  progressPercent: string
  courses: CategoryCourse[]
}

export type MajorCreditSummary = {
  earnedMajorCredits: string
  requiredMajorCredits: string
  majorCreditsSatisfied: boolean
  majorCreditsProgressPercent: string
  earnedMajorRequiredCredits: string
  requiredMajorRequiredCredits: string
  majorRequiredSatisfied: boolean
  majorRequiredProgressPercent: string
  earnedMajorElectiveCredits: string
  requiredMajorElectiveCredits: string
  majorElectiveSatisfied: boolean
  majorElectiveProgressPercent: string
  earnedMajorFoundationCredits?: string
}

export type GraduationProgressResponse = {
  studentId: number
  admissionYear?: number
  major?: string
  majorType?: MajorType
  secondaryMajor?: string
  totalCredits?: CreditProgress
  commonLiberalCredits?: CreditProgress
  electiveLiberalCredits?: CreditProgress
  balancedLiberalCredits?: CreditProgress
  academicFoundationCredits?: CreditProgress
  majorFoundationCredits?: CreditProgress
  averageGradePoint?: string
  majorGradePoint?: string
  majorCredits?: MajorCreditSummary
  categorySummaries?: CategorySummary[]
  balancedLiberalAreaProgresses?: Array<{
    area: string
    earnedCredits: string
    satisfied: boolean
    courses: CategoryCourse[]
  }>
  balancedLiberalRequiredAreaCount?: number
  balancedLiberalCompletedAreaCount?: number
  graduationWork?: {
    required: boolean
    satisfied: boolean
    status: string
    requirementType?: string
    detail?: string
  }
}

export type TranscriptStatusResponse = {
  studentId: number
  hasTranscript: boolean
}

export type TranscriptUploadResponse = {
  count: number
  summary?: {
    totalCredits?: string
    averageGradePoint?: string
    categorySummaries?: CategorySummary[]
  }
  courses?: Array<{
    year: string
    semester: string
    courseCode: string
    courseName: string
    category: string
    credit: string
    evaluationMethod?: string
    grade?: string
    gradePoint?: string
  }>
}
