import process from 'node:process'
import { Redis } from '@upstash/redis'

// Vercel 连接 Upstash 时注入的是 KV_REST_API_URL / KV_REST_API_TOKEN（需用可读写 TOKEN，不要用 READ_ONLY）
// 也兼容直接配 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
function createRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    return new Redis({ url, token })
  }
  return null
}

export const redis = createRedis()
