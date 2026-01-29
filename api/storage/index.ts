import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redis } from './redis.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({
      error: 'Storage not configured',
      hint: 'Add KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*) to this environment in Vercel',
    })
  }
  if (req.method === 'POST') {
    const key = req.body?.key as string
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Missing key' })
    }
    const value = typeof req.body?.value === 'string' ? req.body.value : (req.body?.value != null ? JSON.stringify(req.body.value) : '')
    try {
      await redis.set(key, value)
      return res.status(200).json({ ok: true })
    }
    catch (error) {
      console.error('[storage/set]', error)
      return res.status(500).json({ error: 'Storage error' })
    }
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const keys = await redis.keys('*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return res.status(200).json({ ok: true })
  }
  catch (error) {
    console.error('[storage/clear]', error)
    return res.status(500).json({ error: 'Storage error' })
  }
}
