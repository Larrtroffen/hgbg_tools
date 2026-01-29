import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import busboy from 'busboy'

export const config = {
  api: {
    bodyParser: false,
  },
}

function getBaseUrl(): string {
  const u = (process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/+$/, '')
  return u || 'https://api.dify.ai/v1'
}

function parseMultipartFile(req: VercelRequest): Promise<{ buffer: Buffer, filename: string, mimeType: string }> {
  return new Promise((resolve, reject) => {
    let resolved = false
    const chunks: Buffer[] = []
    let filename = 'upload'
    let mimeType = 'application/octet-stream'
    const bb = busboy({ headers: (req as any).headers })
    bb.on('file', (_field: string, file: NodeJS.ReadableStream, info: { filename?: string, mimeType?: string }) => {
      if (resolved)
        return
      filename = info.filename || filename
      mimeType = info.mimeType || mimeType
      file.on('data', (chunk: Buffer) => chunks.push(chunk))
      file.on('end', () => {
        if (resolved)
          return
        resolved = true
        resolve({
          buffer: Buffer.concat(chunks),
          filename,
          mimeType,
        })
      })
      file.on('error', (err) => {
        if (!resolved) {
          resolved = true
          reject(err)
        }
      })
    })
    bb.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })
    bb.on('finish', () => {
      if (!resolved) {
        resolved = true
        reject(new Error('No file in request'))
      }
    })
    ;(req as any).pipe(bb)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.DIFY_API_KEY
  if (!apiKey) {
    return res.status(501).json({
      error: 'Dify not configured',
      message: 'Set DIFY_API_KEY (and optionally DIFY_BASE_URL) in Vercel env',
    })
  }

  try {
    const { buffer, filename, mimeType } = await parseMultipartFile(req)
    const baseUrl = getBaseUrl()
    const url = `${baseUrl}/files/upload`

    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mimeType }), filename)
    form.append('user', 'md-editor')

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      return res.status(upstream.status).send(text || upstream.statusText)
    }

    const data = await upstream.json()
    const id = data?.id ?? data?.file_id
    if (id == null) {
      return res.status(502).json({ error: 'Dify response missing file id' })
    }
    return res.status(200).json({ id, file_id: id })
  }
  catch (e) {
    console.error('[dify/files/upload]', e)
    return res.status(500).json({ error: (e as Error).message })
  }
}
