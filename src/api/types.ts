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
  category?: string
  earnedCredits?: string | number
  requiredCredits?: string | number
  satisfied?: boolean
  progressPercent?: string | number
  completedCourseCount?: number
  completedCourses?: CategoryCourse[]
  remainingCourses?: CategoryCourse[]
  missingCourses?: CategoryCourse[]
}

export type CategorySummary = {
  category: string
  earnedCredits: string
  requiredCredits: string
  satisfied: boolean
  progressPercent: string
  courses: CategoryCourse[]
  remainingCourses?: CategoryCourse[]
  missingCourses?: CategoryCourse[]
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
  liberalGradePoint?: string
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
  /** 계획 과목 반영 후 졸업 가능 여부 */
  graduationEligible?: boolean
  /** 아직 부족한 조건 목록 */
  graduationBlockers?: string[]
}

export type ExpectedGrade =
  | 'A+'
  | 'A0'
  | 'B+'
  | 'B0'
  | 'C+'
  | 'C0'
  | 'D+'
  | 'D0'
  | 'F'
  | 'P'
  | 'NP'

export type PlannedCourseItem = {
  id: number
  plannedSemesterId: number
  gradeYear?: number
  semester?: number
  courseCode: string
  courseName: string
  category?: string
  credit?: string | number
  expectedGrade?: ExpectedGrade | string
  expectedGradePoint?: string | number
}

export type PlannedSemester = {
  plannedSemesterId: number
  gradeYear: number
  semester: number
  totalCredits?: string | number
  empty?: boolean
  courses?: PlannedCourseItem[]
}

export type PlannedCoursesResponse = {
  studentId?: number
  lastCompletedSemester?: string
  totalPlannedCredits?: string | number
  semesters?: PlannedSemester[]
}

export type AddPlannedCourseRequest = {
  plannedSemesterId: number
  courseCode: string
  courseName: string
  category?: string
  credit?: string
  expectedGrade?: ExpectedGrade | string
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
  /** 공학인증 요건 계산용 적용 연도 (화면 표기용 아님) */
  graduationAbeekYear?: number
  /** 예: "2027년 졸업 예정 기준" */
  graduationAbeekBasisLabel?: string
  /** 인증선택 요건 적용 여부 (2021 이하는 false) */
  certElectiveApplicable?: boolean
  overallSatisfied?: boolean
  general?: AbeekCategoryProgress
  bsm?: AbeekCategoryProgress
  major?: AbeekCategoryProgress
  design?: AbeekCategoryProgress
  /** 2022학번 이후 인증선택 (적용 시에만) */
  certElective?: AbeekCategoryProgress
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

/** GET /api/roadmap — 시간표 기반 일반 학과 로드맵 */
export type StudentRoadmapCourse = {
  courseCode: string
  courseName: string
  /** 시간표 이수구분 원문 (예: 전공필수) */
  category?: string
  /** GENERAL | BSM | MAJOR | OTHER */
  abeekBucket?: string
  credits?: number
  completed?: boolean
  takenYear?: string | null
  takenSemester?: string | null
  grade?: string | null
  sectionCount?: number
}

export type StudentRoadmapTerm = {
  termKey: string
  gradeYear?: number
  semester?: number
  termIndex?: number
  courses?: StudentRoadmapCourse[]
  categories?: Record<string, StudentRoadmapCourse[]>
}

export type StudentRoadmapResponse = {
  studentDbId?: number | null
  studentNo?: string | null
  studentName?: string | null
  departmentName?: string
  /** 공학인증 대상 학과 여부 */
  abeekTarget?: boolean
  abeekDepartmentCode?: string
  sourceTerms?: Array<{
    termYear?: number
    semester?: number
    offeringCount?: number
  }>
  terms?: StudentRoadmapTerm[]
  summary?: RoadmapSummary
}

export type OfferedCourse = {
  abeekCourseCode: string
  courseName: string
  category?: CurriculumCourseCategory
  role?: CurriculumCourseRole
  credits?: number
  designCredits?: number
  designLevel?: AbeekDesignLevel
  recommendedTerm?: string
}

export type OfferedCurriculumResponse = {
  departmentCode?: string
  departmentName?: string
  curriculumYear?: number
  termYear?: number
  semester?: number
  curriculumCourseCount?: number
  offeredCourseCount?: number
  notOfferedCourseCount?: number
  offeredCourses?: OfferedCourse[]
  notOfferedCourses?: Array<{
    abeekCourseCode: string
    courseName: string
    category?: CurriculumCourseCategory
    role?: CurriculumCourseRole
    recommendedTerm?: string
  }>
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
