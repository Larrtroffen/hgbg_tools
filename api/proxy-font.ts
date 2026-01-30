import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function setCors(res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
}

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && ALLOWED_ORIGINS.includes(u.origin)
  }
  catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const url = req.query.url
  if (typeof url !== 'string' || !url) {
    return res.status(400).json({ error: 'Missing url query' })
  }
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: 'URL not allowed' })
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FontProxy/1.0)',
      },
    })
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Upstream ${resp.status}` })
    }
    const contentType = resp.headers.get('content-type') || 'text/plain'
    res.setHeader('Content-Type', contentType)
    const buf = await resp.arrayBuffer()
    return res.status(200).send(Buffer.from(buf))
  }
  catch (e) {
    console.error('[proxy-font]', e)
    return res.status(502).json({ error: 'Proxy fetch failed' })
  }
}
