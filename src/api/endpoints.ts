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
  TranscriptMajorCreditSummary,
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
