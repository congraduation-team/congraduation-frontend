import { apiForm, apiJson } from './client'
import type {
  AbeekEvaluationResponse,
  AbeekTranscriptEvaluationResponse,
  AdminUploadResponse,
  CurriculumCourse,
  FullRoadmapResponse,
  GraduationProgressResponse,
  StudentLoginResponse,
  TranscriptStatusResponse,
  TranscriptUploadResponse,
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

export function getGraduationProgress(studentId: number) {
  return apiJson<GraduationProgressResponse>(`/api/evaluate/graduation-progress/${studentId}`)
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
