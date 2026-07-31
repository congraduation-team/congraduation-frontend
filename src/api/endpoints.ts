import { apiForm, apiJson } from './client'
import type {
  AbeekEvaluationResponse,
  AbeekTranscriptEvaluationResponse,
  AdminUploadResponse,
  AddPlannedCourseRequest,
  CurriculumCourse,
  ExpectedGrade,
  FullRoadmapResponse,
  GraduationProgressResponse,
  OfferedCurriculumResponse,
  StudentRoadmapResponse,
  PlannedCoursesResponse,
  StudentLoginResponse,
  TranscriptStatusResponse,
  TranscriptUploadResponse,
  TranscriptMajorCreditSummary,
  MajorOption,
  StudentMajorTracksResponse,
  StudentMajorTrackUpdateRequest,
} from './types'

export function login(userId: string, password: string) {
  return apiJson<StudentLoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
  })
}

export function getTranscriptStatus(studentId: number) {
  return apiJson<TranscriptStatusResponse>(`/api/transcripts/status/${studentId}`)
}

export function uploadTranscript(studentId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiForm<TranscriptUploadResponse>(`/api/transcripts/upload/${studentId}`, form)
}

/** 기이수성적 엑셀로 ABEEK 학생 등록 + 공학인증 평가 */
export function evaluateAbeekFromTranscript(
  file: File,
  options: {
    studentId?: string
    name?: string
    entranceYear?: number
    graduationAbeekYear?: number
    departmentCode?: string
  } = {},
) {
  const params = new URLSearchParams()
  if (options.studentId) params.set('studentId', options.studentId)
  if (options.name) params.set('name', options.name)
  if (options.entranceYear != null) params.set('entranceYear', String(options.entranceYear))
  if (options.graduationAbeekYear != null) {
    params.set('graduationAbeekYear', String(options.graduationAbeekYear))
  }
  if (options.departmentCode) params.set('departmentCode', options.departmentCode)

  const form = new FormData()
  form.append('file', file)
  const query = params.toString()
  return apiForm<AbeekTranscriptEvaluationResponse>(
    `/api/abeek/evaluate-from-transcript${query ? `?${query}` : ''}`,
    form,
  )
}

/**
 * 기이수 성적 1회 업로드로 졸업요건 + 공학인증(ABEEK)을 모두 반영.
 * 둘 중 하나라도 실패하면 에러를 던진다.
 */
export async function uploadAcademicRecord(
  student: Pick<
    StudentLoginResponse,
    'id' | 'studentNo' | 'name' | 'admissionYear' | 'tracks'
  >,
  file: File,
) {
  const abeekStudentId = student.studentNo || String(student.id)
  const departmentCode = student.tracks?.[0]?.departmentCode || 'CSE'
  const entranceYear = student.admissionYear

  let transcript: TranscriptUploadResponse
  try {
    transcript = await uploadTranscript(student.id, file)
  } catch (err) {
    const detail = err instanceof Error ? err.message : '알 수 없는 오류'
    throw new Error(`기이수 성적 저장 실패: ${detail}`)
  }

  try {
    const abeek = await evaluateAbeekFromTranscript(file, {
      studentId: abeekStudentId,
      name: student.name,
      entranceYear,
      graduationAbeekYear: entranceYear,
      departmentCode,
    })
    return { transcript, abeek }
  } catch (err) {
    const detail =
      err instanceof Error && err.message
        ? err.message
        : '공학인증(ABEEK) 연동에 실패했습니다.'
    throw new Error(
      `졸업요건 저장은 됐지만 공학인증 연동에 실패했습니다. (${detail}) 같은 파일로 다시 업로드해 주세요.`,
    )
  }
}

export function getGraduationProgress(studentId: number) {
  return apiJson<GraduationProgressResponse>(`/api/evaluate/graduation-progress/${studentId}`)
}

export function getStudentMajorTracks(studentId: number) {
  return apiJson<StudentMajorTracksResponse>(`/api/students/${studentId}/major-tracks`)
}

export function updateStudentMajorTrack(studentId: number, body: StudentMajorTrackUpdateRequest) {
  return apiJson<StudentLoginResponse>(`/api/students/${studentId}/major-track`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function getMajorOptions() {
  return apiJson<MajorOption[]>('/api/students/major-options')
}

/** 저장된 기이수성적 기준 전공필수/선택 학점 집계 */
export function getTranscriptMajorCredits(studentDbId: number) {
  return apiJson<TranscriptMajorCreditSummary>(`/api/transcripts/${studentDbId}/major-credits`)
}

/** 수강편람 업데이트 (관리자) — 백엔드 경로에 맞게 조정 가능 */
export function uploadCourseCatalog(file: File, year: number) {
  const form = new FormData()
  form.append('file', file)
  form.append('year', String(year))
  return apiForm<AdminUploadResponse>('/api/admin/course-catalogs', form)
}

/** 강의 시간표 업데이트 (관리자) — 백엔드 경로에 맞게 조정 가능 */
export function uploadClassSchedule(file: File, year: number, semester: number) {
  const form = new FormData()
  form.append('file', file)
  form.append('year', String(year))
  form.append('semester', String(semester))
  return apiForm<AdminUploadResponse>('/api/admin/class-schedules', form)
}

/** 공학인증(ABEEK) 평가 — studentId는 학번(string) 기준 */
export function getAbeekEvaluation(studentId: string | number) {
  return apiJson<AbeekEvaluationResponse>(`/api/abeek/students/${studentId}/abeek-evaluation`)
}

export function getCurriculumCourses(departmentCode: string, year: number) {
  return apiJson<CurriculumCourse[]>(
    `/api/curriculum/${encodeURIComponent(departmentCode)}/${year}/courses`,
  )
}

export function getDepartments() {
  return apiJson<string[]>('/api/departments')
}

/** 학과명 기준 시간표 로드맵 (모든 학과 공통) */
export function getStudentRoadmap(departmentName: string, studentDbId?: number) {
  const params = new URLSearchParams({ departmentName })
  if (studentDbId != null) params.set('studentDbId', String(studentDbId))
  return apiJson<StudentRoadmapResponse>(`/api/roadmap?${params}`)
}

/** 로그인한 학생 기준 시간표 로드맵 + 이수 표시 */
export function getStudentRoadmapByStudent(studentDbId: number) {
  return apiJson<StudentRoadmapResponse>(
    `/api/roadmap/by-student?studentDbId=${encodeURIComponent(String(studentDbId))}`,
  )
}

export function getAbeekFullRoadmap(options: {
  departmentCode: string
  curriculumYear: number
  studentId?: string
}) {
  const params = new URLSearchParams({
    departmentCode: options.departmentCode,
    curriculumYear: String(options.curriculumYear),
  })
  if (options.studentId) params.set('studentId', options.studentId)
  return apiJson<FullRoadmapResponse>(`/api/abeek/full-roadmap?${params}`)
}

export function getAbeekFullRoadmapByStudent(studentId: string) {
  return apiJson<FullRoadmapResponse>(
    `/api/abeek/full-roadmap/by-student?studentId=${encodeURIComponent(studentId)}`,
  )
}

export function getAbeekOfferedCourses(options: {
  departmentCode: string
  curriculumYear: number
  termYear?: number
  semester?: number
}) {
  const params = new URLSearchParams({
    departmentCode: options.departmentCode,
    curriculumYear: String(options.curriculumYear),
  })
  if (options.termYear != null) params.set('termYear', String(options.termYear))
  if (options.semester != null) params.set('semester', String(options.semester))
  return apiJson<OfferedCurriculumResponse>(`/api/abeek/offered-courses?${params}`)
}

export function getAbeekOfferedCoursesByStudent(options: {
  studentId: string
  termYear?: number
  semester?: number
}) {
  const params = new URLSearchParams({ studentId: options.studentId })
  if (options.termYear != null) params.set('termYear', String(options.termYear))
  if (options.semester != null) params.set('semester', String(options.semester))
  return apiJson<OfferedCurriculumResponse>(
    `/api/abeek/offered-courses/by-student?${params}`,
  )
}

export function getAbeekTimetableTerms() {
  return apiJson<Array<Record<string, unknown>>>('/api/abeek/timetable-terms')
}

/** 계획 학기/과목 조회 */
export function getPlannedCourses(studentId: number) {
  return apiJson<PlannedCoursesResponse>(`/api/students/${studentId}/planned-courses`)
}

/** 다음 학기(들) 순차 생성 */
export function addNextPlannedSemesters(studentId: number, count = 1) {
  return apiJson<PlannedCoursesResponse>(`/api/students/${studentId}/planned-semesters/next`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  })
}

/** 계획 학기에 과목 추가 */
export function addPlannedCourse(studentId: number, body: AddPlannedCourseRequest) {
  return apiJson<PlannedCoursesResponse>(`/api/students/${studentId}/planned-courses`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 계획 과목 예상 성적 변경 */
export function updatePlannedCourseExpectedGrade(
  studentId: number,
  plannedCourseId: number,
  expectedGrade: ExpectedGrade | string,
) {
  return apiJson<PlannedCoursesResponse>(
    `/api/students/${studentId}/planned-courses/${plannedCourseId}/expected-grade`,
    {
      method: 'PATCH',
      body: JSON.stringify({ expectedGrade }),
    },
  )
}

/** 계획 과목 삭제 */
export function deletePlannedCourse(studentId: number, plannedCourseId: number) {
  return apiJson<PlannedCoursesResponse>(
    `/api/students/${studentId}/planned-courses/${plannedCourseId}`,
    { method: 'DELETE' },
  )
}

/** 계획 학기 삭제 */
export function deletePlannedSemester(studentId: number, plannedSemesterId: number) {
  return apiJson<PlannedCoursesResponse>(
    `/api/students/${studentId}/planned-semesters/${plannedSemesterId}`,
    { method: 'DELETE' },
  )
}
