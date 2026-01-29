import type { VercelRequest, VercelResponse } from '@vercel/node'
import process from 'node:process'

function getBaseUrl(): string {
  const u = (process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/+$/, '')
  return u || 'https://api.dify.ai/v1'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.DIFY_API_KEY
  if (!apiKey) {
    return res.status(501).json({
      error: 'Dify not configured',
      message: 'Set DIFY_API_KEY (and optionally DIFY_BASE_URL) in Vercel env',
    })
  }

  const runId = req.query.runId as string
  if (!runId) {
    return res.status(400).json({ error: 'Missing runId' })
  }

  const baseUrl = getBaseUrl()
  const url = `${baseUrl}/workflows/run/${runId}`

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      return res.status(upstream.status).send(text || upstream.statusText)
    }

    const data = await upstream.json()
    return res.status(200).json(data)
  }
  catch (e) {
    console.error('[dify/workflows/run/[runId]]', e)
    return res.status(500).json({ error: (e as Error).message })
  }
}
