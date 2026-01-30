import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redis } from './redis.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

function setCors(res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
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
      const ifMatch = req.body?.ifMatch as number | undefined
      const versionKey = `${key}__v`
      const currentVersion = Number.parseInt(String(await redis.get(versionKey) ?? 0), 10) || 0
      if (ifMatch !== undefined && ifMatch !== null && currentVersion !== ifMatch) {
        return res.status(409).json({ error: 'Conflict', version: currentVersion })
      }
      await redis.set(key, value)
      const newVersion = currentVersion + 1
      await redis.set(versionKey, String(newVersion))
      return res.status(200).json({ ok: true, version: newVersion })
    }

    if (req.method !== 'DELETE') {
      res.setHeader('Allow', 'POST, DELETE')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const keys = await redis.keys('*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return res.status(200).json({ ok: true })
  }
  catch (error) {
    console.error('[storage]', error)
    return res.status(500).json({ error: 'Storage error' })
  }
}
