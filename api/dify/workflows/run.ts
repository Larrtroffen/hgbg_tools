import type { VercelRequest, VercelResponse } from '@vercel/node'
import process from 'node:process'

function getBaseUrl(): string {
  const u = (process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/+$/, '')
  return u || 'https://api.dify.ai/v1'
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

  const baseUrl = getBaseUrl()
  const url = `${baseUrl}/workflows/run`
  const body = typeof req.body === 'object' && req.body !== null
    ? req.body
    : {}

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      return res.status(upstream.status).send(text || upstream.statusText)
    }

    const contentType = upstream.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream') && upstream.body) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      const reader = upstream.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            res.end()
            return
          }
          res.write(value)
        }
      }
      await pump()
      return
    }

    const data = await upstream.json()
    return res.status(200).json(data)
  }
  catch (e) {
    console.error('[dify/workflows/run]', e)
    return res.status(500).json({ error: (e as Error).message })
  }
}
