import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redis } from './redis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({
      error: 'Storage not configured',
      hint: 'Add KV_REST_API_URL and KV_REST_API_TOKEN to this environment in Vercel',
    })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const keys = await redis.keys('*')
    return res.status(200).json({ keys: keys as string[] })
  }
  catch (error) {
    console.error('[storage/keys]', error)
    return res.status(500).json({ error: 'Storage error' })
  }
}
