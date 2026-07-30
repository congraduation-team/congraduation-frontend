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
  majorTracks?: MajorTrackProgress[]
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

export type MajorTrackRequiredCourseProgress = {
  policyApplied?: boolean
  requiredCourseCount?: number
  completedCourseCount?: number
  satisfied?: boolean
  completedCourses?: CategoryCourse[]
  missingCourses?: CategoryCourse[]
}

export type MajorTrackProgress = {
  trackType?: MajorType
  department?: string
  totalCredits?: CreditProgress
  requiredCredits?: CreditProgress
  electiveCredits?: CreditProgress
  requiredCourseProgress?: MajorTrackRequiredCourseProgress
  categoryBasis?: string
  status?: string
}

export type StudentMajorTracksResponse = {
  studentId?: number
  primaryMajor?: string
  majorType?: MajorType
  secondaryMajor?: string
  tracks?: StudentMajorTrack[]
}

export type MajorOption = {
  name: string
}

export type StudentMajorTrackUpdateRequest = {
  majorType?: MajorType
  secondaryMajor?: string | null
  tracks?: Array<{
    trackType: MajorType
    departmentCode: string
    approvedAtSemester?: number
    teachingCert?: boolean
  }>
}

export type TranscriptStatusResponse = {
  studentId: number
  hasTranscript: boolean
}

/** GET /api/transcripts/{studentDbId}/major-credits */
export type TranscriptMajorCreditSummary = {
  requiredMajorCredits?: number
  electiveMajorCredits?: number
  totalMajorCredits?: number
  requiredMajorCourseCount?: number
  electiveMajorCourseCount?: number
  totalCourseCount?: number
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

export type AbeekCategoryProgress = {
  earnedCredits?: string
  requiredCredits?: string
  satisfied?: boolean
  progressPercent?: string
}

export type AbeekRequiredCourseStatus = {
  courseCode: string
  courseName: string
  completed: boolean
  waived?: boolean
  note?: string
}

export type AbeekDesignLevel = 'NONE' | 'BASIC' | 'ELEMENT' | 'COMPREHENSIVE'

export type AbeekDesignCourseResult = {
  courseCode: string
  courseName: string
  takenYear?: number
  takenSemester?: number
  designLevel?: AbeekDesignLevel
  rawDesignCredits?: number
  recognizedDesignCredits?: number
  recognized?: boolean
  reason?: string
}

export type AbeekDesignEvaluationResult = {
  recognizedDesignCredits?: number
  hasBasicDesign?: boolean
  hasElementDesign?: boolean
  hasComprehensiveDesign?: boolean
  sequenceSatisfied?: boolean
  courses?: AbeekDesignCourseResult[]
}

export type AbeekEvaluationResponse = {
  studentId?: string
  studentNo?: string
  studentName?: string
  entranceYear?: number
  graduationAbeekYear?: number
  overallSatisfied?: boolean
  general?: AbeekCategoryProgress
  bsm?: AbeekCategoryProgress
  major?: AbeekCategoryProgress
  design?: AbeekCategoryProgress
  designSequenceSatisfied?: boolean
  designDetail?: AbeekDesignEvaluationResult
  entranceRequiredCourses?: AbeekRequiredCourseStatus[]
  waivedGraduationOnlyCourses?: AbeekRequiredCourseStatus[]
  messages?: string[]
}

export type CurriculumCourseCategory = 'GENERAL' | 'BSM' | 'MAJOR'
export type CurriculumCourseRole = 'REQUIRED' | 'CERT_ELECTIVE' | 'ELECTIVE' | 'BSM_REQUIRED'

export type CurriculumCourse = {
  departmentCode?: string
  curriculumYear?: number
  courseCode: string
  courseName: string
  category: CurriculumCourseCategory
  role: CurriculumCourseRole
  credits: number
  designCredits?: number
  designLevel?: AbeekDesignLevel
  electiveArea?: string
  recommendedTerm?: string
  newlyIntroducedRequired?: boolean
}

export type RoadmapCourse = {
  abeekCourseCode: string
  courseName: string
  category: CurriculumCourseCategory
  categoryLabel?: string
  professionalLiberal?: boolean
  bsm?: boolean
  abeekMajor?: boolean
  role: CurriculumCourseRole
  roleLabel?: string
  credits: number
  designCredits?: number
  hasDesignCredits?: boolean
  designLevel?: AbeekDesignLevel
  recommendedTerm?: string
  newlyIntroducedRequired?: boolean
  completed?: boolean
  takenYear?: number | null
  takenSemester?: number | null
  prerequisiteCourseCodes?: string[]
}

export type TermRoadmap = {
  termKey: string
  gradeYear?: number
  semester?: number
  termIndex?: number
  categories?: Partial<Record<CurriculumCourseCategory, RoadmapCourse[]>>
}

export type RoadmapSummary = {
  totalCourses?: number
  completedCourses?: number
  professionalLiberalCount?: number
  bsmCount?: number
  majorCount?: number
  totalDesignCredits?: number
  completedDesignCredits?: number
}

export type FullRoadmapResponse = {
  departmentCode?: string
  departmentName?: string
  curriculumYear?: number
  studentId?: string
  studentName?: string
  terms?: TermRoadmap[]
  unscheduledCourses?: RoadmapCourse[]
  summary?: RoadmapSummary
}

export type AbeekTranscriptEvaluationResponse = {
  studentId?: string
  studentName?: string
  inferredSejongDepartmentCode?: string
  departmentCode?: string
  departmentName?: string
  entranceYear?: number
  graduationAbeekYear?: number
  totalCourses?: number
  matchedCourses?: number
  unmatchedCourses?: number
  evaluation?: AbeekEvaluationResponse
}

export function flattenRoadmapCourses(roadmap: FullRoadmapResponse | null | undefined): RoadmapCourse[] {
  if (!roadmap) return []
  const list: RoadmapCourse[] = []
  for (const term of roadmap.terms ?? []) {
    const categories = term.categories ?? {}
    for (const courses of Object.values(categories)) {
      if (Array.isArray(courses)) list.push(...courses)
    }
  }
  if (roadmap.unscheduledCourses?.length) list.push(...roadmap.unscheduledCourses)
  return list
}
