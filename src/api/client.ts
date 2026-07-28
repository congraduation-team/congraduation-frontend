const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function parseError(res: Response) {
  let body: unknown
  const text = await res.text().catch(() => '')
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  const message =
    typeof body === 'object' && body && 'message' in body
      ? String((body as { message: unknown }).message)
      : typeof body === 'string' && body.trim()
        ? body.trim()
        : `요청 실패 (${res.status})`
  throw new ApiError(res.status, message, body)
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!res.ok) await parseError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function apiForm<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    ...init,
    body: formData,
  })
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}
