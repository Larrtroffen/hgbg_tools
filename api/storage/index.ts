import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
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
