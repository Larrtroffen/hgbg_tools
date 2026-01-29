import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
