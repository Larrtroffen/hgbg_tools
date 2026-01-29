import type { VercelRequest, VercelResponse } from '@vercel/node'
import process from 'node:process'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = req.query.key as string
  if (!key) {
    return res.status(400).json({ error: 'Missing key' })
  }

  switch (req.method) {
    case 'GET': {
      try {
        const value = await redis.get<string>(key)
        if (value === null || value === undefined) {
          return res.status(404).json({ error: 'Not found' })
        }
        return res.status(200).json({ value: typeof value === 'string' ? value : JSON.stringify(value) })
      }
      catch (error) {
        console.error('[storage/get]', error)
        return res.status(500).json({ error: 'Storage error' })
      }
    }

    case 'PUT':
    case 'POST': {
      const body = req.body
      const value = typeof body?.value === 'string' ? body.value : (body?.value != null ? JSON.stringify(body.value) : '')
      try {
        await redis.set(key, value)
        return res.status(200).json({ ok: true })
      }
      catch (error) {
        console.error('[storage/set]', error)
        return res.status(500).json({ error: 'Storage error' })
      }
    }

    case 'DELETE': {
      try {
        await redis.del(key)
        return res.status(200).json({ ok: true })
      }
      catch (error) {
        console.error('[storage/del]', error)
        return res.status(500).json({ error: 'Storage error' })
      }
    }

    case 'HEAD': {
      try {
        const value = await redis.get(key)
        return res.status(value != null ? 200 : 404).end()
      }
      catch (error) {
        console.error('[storage/head]', error)
        return res.status(500).end()
      }
    }

    default:
      res.setHeader('Allow', 'GET, PUT, POST, DELETE, HEAD')
      return res.status(405).json({ error: 'Method not allowed' })
  }
}
