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
  /** DB students.admin 컬럼 매핑 (true / 1) */
  admin?: boolean | number
  /** 로그인 응답의 세종 고전독서 인증 현황 */
  readingStatus?: SejongReadingStatus
  /** 보호 API 호출에 사용하는 JWT */
  accessToken?: string
  tokenType?: string
  /** JWT 만료 시각(epoch seconds) */
  tokenExpiresAt?: number
}

export type SejongReadingAreaStatus = {
  name: string
  completedCount?: number
  certifiedCount?: number
  requiredCount?: number
  satisfied?: boolean
}

export type SejongReadingStatus = {
  completed?: boolean
  title?: string
  subtitle?: string
  message?: string
  areas?: SejongReadingAreaStatus[]
  totalCompletedCount?: number
  totalCertifiedCount?: number
  totalRequiredCount?: number
}

export type EnglishCertificationProgress = {
  applicable?: boolean
  satisfied?: boolean
  status?: string
  policyType?: string
  primaryRequirement?: string
  detail?: string
}

export type ClassicReadingCertificationProgress = {
  applicable?: boolean
  satisfied?: boolean
  status?: string
  policyType?: string
  primaryRequirement?: string
  substituteRequirement?: string
  detail?: string
}

export type SwCodingCertificationProgress = {
  applicable?: boolean
  satisfied?: boolean
  status?: string
  studentGroup?: string
  graduationRule?: string
  primaryRequirement?: string
  substituteRequirement?: string
  detail?: string
}

export type RequirementCourse = {
  courseCode: string
  courseName: string
  credit?: string
  recommendedTerm?: string
}

export type AdminUploadResponse = {
  message?: string
  count?: number
}

/** POST/GET feedbacks */
export type FeedbackType = 'BUG' | 'INQUIRY'
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

export type FeedbackItem = {
  id: number
  type: FeedbackType
  title: string
  content: string
  status: FeedbackStatus
  studentId: number | null
  studentNo: string | null
  studentName: string | null
  major: string | null
  createdAt: string
  updatedAt: string
  adminNote: string | null
}

export type CreateFeedbackRequest = {
  type: FeedbackType
  title: string
  content: string
  studentId?: number
  studentNo?: string
  studentName?: string
  major?: string
}

export type UpdateFeedbackRequest = {
  status?: FeedbackStatus
  adminNote?: string | null
}

/** GET /api/stats/summary */
export type SiteStatsSummary = {
  todayVisitors: number
  monthlyVisitors: number
  totalVisitors: number
  transcriptUsers: number
  timezone: string
  today: string
  monthStart: string
}

/** POST /api/stats/visit */
export type RecordVisitRequest = {
  visitorKey?: string
  studentId?: number
}

export type RecordVisitResponse = {
  visitorKey: string
  recorded: boolean
}

export function isAdminUser(student: StudentLoginResponse | null | undefined): boolean {
  if (!student) return false
  if (student.isAdmin === true) return true
  if (student.admin === true || student.admin === 1) return true
  const role = student.role?.toUpperCase()
  return role === 'ADMIN' || role === 'ROLE_ADMIN'
}

export type CategoryCourse = {
  courseCode: string
  courseName: string
  credit: string
}

/** 남은 공통교양 필수 (동등 이수 정보 포함) */
export type RemainingCommonLiberalRequiredCourse = {
  course: CategoryCourse
  equivalentCompletedCourses?: string[]
}

/** 균필 미충족 영역 + 추천 과목 */
export type MissingBalancedLiberalAreaDetail = {
  area: string
  candidateCourses?: CategoryCourse[]
}

export type CreditProgress = {
  category?: string
  earnedCredits?: string | number
  requiredCredits?: string | number
  satisfied?: boolean
  progressPercent?: string | number
  completedCourseCount?: number
  completedCourses?: Array<CategoryCourse & {
    credits?: number
    takenYear?: number | string | null
    takenSemester?: number | string | null
  }>
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
  /** 공통교양(공필/교필) 상세 과목 목록 */
  commonLiberalCourses?: CategoryCourse[]
  /** 남은 공통교양 필수 과목 */
  remainingCommonLiberalRequiredCourses?: RemainingCommonLiberalRequiredCourse[]
  electiveLiberalCredits?: CreditProgress
  balancedLiberalCredits?: CreditProgress
  academicFoundationCredits?: CreditProgress
  majorFoundationCredits?: CreditProgress
  averageGradePoint?: string
  majorGradePoint?: string
  liberalGradePoint?: string
  majorCredits?: MajorCreditSummary
  categorySummaries?: CategorySummary[]
  /** 주전공 필수 미이수 과목 */
  remainingMajorRequiredCourses?: RequirementCourse[]
  /** 주전공 선택 미이수 과목 (있으면 사용) */
  remainingMajorElectiveCourses?: RequirementCourse[]
  /** 균필 미충족 영역명 */
  missingBalancedLiberalAreas?: string[]
  /** 균필 미충족 영역별 추천 과목 */
  missingBalancedLiberalAreaDetails?: MissingBalancedLiberalAreaDetail[]
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
  englishCertification?: EnglishCertificationProgress
  classicReadingCertification?: ClassicReadingCertificationProgress
  swCodingCertification?: SwCodingCertificationProgress
  /** 일부 배포에서 graduation-progress에 포함될 수 있음 */
  readingStatus?: SejongReadingStatus
  /** 계획 과목 반영 후 졸업 가능 여부 (레거시·호환) */
  graduationEligible?: boolean
  /** 기이수 기준 실제 부족 요건 */
  graduationBlockers?: string[]
  /**
   * 화면 표시용 부족 요건 (레거시·호환).
   * 시뮬 페이지는 simulation.displayGraduationBlockers를 우선 사용.
   */
  displayGraduationBlockers?: string[]
  /**
   * 계획 과목 반영 시뮬레이션 결과.
   * top-level 학점/평점은 기이수 기준, simulation은 계획 반영 기준.
   */
  simulation?: GraduationSimulationResult
}

/** graduation-progress.simulation — 계획 과목 반영 결과 */
export type GraduationSimulationResult = {
  averageGradePoint?: string
  majorGradePoint?: string
  liberalGradePoint?: string
  totalCredits?: CreditProgress
  majorCredits?: MajorCreditSummary
  commonLiberalCredits?: CreditProgress
  electiveLiberalCredits?: CreditProgress
  balancedLiberalCredits?: CreditProgress
  /** 계획 반영 후 남은 공통교양 필수 */
  remainingCommonLiberalRequiredCourses?: RemainingCommonLiberalRequiredCourse[]
  graduationEligible?: boolean
  graduationBlockers?: string[]
  /** 화면 표시용 부족 요건 (계획 반영) */
  displayGraduationBlockers?: string[]
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
  retake?: boolean
  previousGrade?: string
  previousGradePoint?: string | number
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
  /** 기이수 순번 (예: 4-1). 초과학년 판단에 캘린더 연도 쓰지 말 것 */
  lastCompletedSemester?: string
  /** 실제 수강 연도 (예: 2026) */
  lastCompletedTakenYear?: number | string | null
  /** 실제 수강 학기 (예: 1학기) */
  lastCompletedTakenSemester?: number | string | null
  /** 기이수 순번 기준 학년(1~4). 신규 API */
  standingGradeYear?: number | null
  /** true일 때만 초과학년 표시. 순번 4학년 이하면 false */
  overStanding?: boolean
  totalPlannedCredits?: string | number
  semesters?: PlannedSemester[]
}

export type AddPlannedCourseRequest = {
  plannedSemesterId: number
  gradeYear?: number
  semester?: number
  courseCode: string
  courseName: string
  category?: string
  credit?: string
  expectedGrade?: ExpectedGrade | string
}

export type PlannableCourse = {
  courseCodes?: string[]
  courseName: string
  category?: string
  departments?: string[]
  targetGrades?: string[]
  credits?: string[]
  offeredTerms?: string[]
}

export type PlannableCourseCatalogResponse = {
  count?: number
  courses?: PlannableCourse[]
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
  /** 전필+전선 전공 과목 수 (totalCourseCount와 다름) */
  totalMajorCourseCount?: number
  /** 전체 이수 과목 수 */
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
  /** 평가에 반영된 이수 과목 (전문교양 등) */
  completedCourses?: Array<{
    courseCode: string
    courseName: string
    credits?: number | string
    credit?: string
  }>
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

/** GET .../abeek-evaluation/detail 의 과목 행 */
export type AbeekDetailCourse = {
  courseCode: string
  /** 세종 학수번호 (예: 004310). 인증선택은 null */
  sejongCourseCode?: string | null
  courseName: string
  credits?: number | string
  credit?: string
  role?: string
  electiveArea?: string | null
  electiveAreaLabel?: string | null
}

export type AbeekRemainingArea = {
  area?: string
  areaLabel?: string
  remainingCourseCount?: number
  remainingCourses?: AbeekDetailCourse[]
}

export type AbeekEvaluationCategoryDetail = {
  categoryKey?: string
  categoryLabel?: string
  earnedCredits?: string | number
  requiredCredits?: string | number
  progressPercent?: string | number
  satisfied?: boolean
  completedCourses?: AbeekDetailCourse[]
  /** GENERAL 등: 필수 남은 과목만 */
  remainingCourses?: AbeekDetailCourse[]
  /** CERT_ELECTIVE: 미충족 영역 */
  remainingAreas?: AbeekRemainingArea[]
}

/** GET /api/abeek/students/{id}/abeek-evaluation/detail */
export type AbeekEvaluationDetailResponse = {
  studentId?: string
  studentNo?: string
  studentName?: string
  categories?: AbeekEvaluationCategoryDetail[]
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
  /** 실제 이수 순번 학기 */
  standingTermKey?: string | null
  prerequisiteCourseCodes?: string[]
  /** 성적 (있으면 F 경고에 사용) */
  grade?: string | null
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
  /** 실제 이수 순번 학기 (있으면 배치에 우선) */
  standingTermKey?: string | null
  completedTermKey?: string | null
  grade?: string | null
  sectionCount?: number
}

export type StudentRoadmapTerm = {
  termKey: string
  /** 이수 순번 학기 키 (있으면 termKey보다 우선) */
  standingTermKey?: string
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
