import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import busboy from 'busboy'

export const config = {
  api: {
    bodyParser: false,
  },
}

function getDateFilename(filename: string): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const dir = `${year}/${month}/${day}`
  const ts = Date.now()
  const ext = filename.includes('.') ? filename.split('.').pop()! : 'bin'
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  return `${dir}/${ts}-${id}.${ext}`
}

function parseMultipartFile(req: VercelRequest): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    let resolved = false
    const chunks: Buffer[] = []
    let filename = 'upload'
    let mimeType = 'application/octet-stream'
    const bb = busboy({ headers: (req as any).headers })
    bb.on('file', (_field: string, file: NodeJS.ReadableStream, info: { filename?: string; mimeType?: string }) => {
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
      file.on('error', err => {
        if (!resolved) {
          resolved = true
          reject(err)
        }
      })
    })
    bb.on('error', err => {
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

  const secretId = process.env.TENCENT_COS_SECRET_ID
  const secretKey = process.env.TENCENT_COS_SECRET_KEY
  const bucket = process.env.TENCENT_COS_BUCKET
  const region = process.env.TENCENT_COS_REGION

  if (!secretId || !secretKey || !bucket || !region) {
    return res.status(501).json({
      error: 'COS not configured',
      message: 'Set TENCENT_COS_SECRET_ID, TENCENT_COS_SECRET_KEY, TENCENT_COS_BUCKET, TENCENT_COS_REGION in Vercel env',
    })
  }

  try {
    const { buffer, filename, mimeType } = await parseMultipartFile(req)
    const pathPrefix = process.env.TENCENT_COS_PATH || ''
    const key = pathPrefix ? `${pathPrefix}/${getDateFilename(filename)}` : getDateFilename(filename)

    const endpoint = `https://cos.${region}.myqcloud.com`
    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: secretId,
        secretAccessKey: secretKey,
      },
      endpoint,
      forcePathStyle: false,
    })

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    )

    const cdnHost = process.env.TENCENT_COS_CDN_HOST || ''
    if (cdnHost) {
      const url = cdnHost.replace(/\/$/, '') + '/' + key
      return res.status(200).json({ url })
    }
    const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`
    return res.status(200).json({ url })
  }
  catch (e) {
    console.error('[upload/cos]', e)
    return res.status(500).json({ error: (e as Error).message })
  }
}
