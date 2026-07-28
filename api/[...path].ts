import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(req: VercelRequest): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const parts = req.query.path
    const subpath = Array.isArray(parts) ? parts.join('/') : String(parts ?? '')
    const searchIndex = req.url?.indexOf('?') ?? -1
    const search = searchIndex >= 0 ? req.url!.slice(searchIndex) : ''
    const targetUrl = `http://3.36.38.242/api/${subpath}${search}`

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue
      const lower = key.toLowerCase()
      if (
        lower === 'host' ||
        lower === 'origin' ||
        lower === 'referer' ||
        lower === 'connection' ||
        lower === 'content-length'
      ) {
        continue
      }
      headers[key] = Array.isArray(value) ? value.join(',') : value
    }

    const method = req.method ?? 'GET'
    const body =
      method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(req)

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (
        lower === 'content-encoding' ||
        lower === 'transfer-encoding' ||
        lower === 'content-length' ||
        lower === 'connection'
      ) {
        return
      }
      res.setHeader(key, value)
    })

    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.send(buffer)
  } catch (error) {
    console.error(error)
    res.status(502).json({
      message: '백엔드 서버에 연결하지 못했습니다.',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
