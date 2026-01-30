/**
 * 为 html-to-image 导出准备字体 CSS：通过同源代理拉取 Google Fonts CSS，并将字体 URL 内联为 data URL，
 * 避免跨域 CORS 导致请求被拦截，同时保留原字体显示。
 */

const fontEmbedCache: Record<string, string> = {}

const URL_IN_CSS_REGEX = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/g

/** 通过同源 API 代理请求，避免 Google Fonts / gstatic 的 CORS 限制 */
function proxyUrl(targetUrl: string): string {
  return `/api/proxy-font?url=${encodeURIComponent(targetUrl)}`
}

async function fetchAsDataUrl(url: string, cssBaseUrl: string): Promise<string> {
  const absoluteUrl = url.startsWith('http') ? url : new URL(url, cssBaseUrl).href
  const res = await fetch(proxyUrl(absoluteUrl))
  if (!res.ok)
    throw new Error(`Font fetch failed: ${absoluteUrl} ${res.status}`)
  const buf = await res.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  const contentType = res.headers.get('content-type') || 'font/woff2'
  return `data:${contentType};base64,${base64}`
}

/**
 * 拉取 Google Fonts CSS，并将其中所有字体 url() 替换为 data URL，返回可注入的 CSS 字符串。
 * 用于 toPng(..., { fontEmbedCSS: await getGoogleFontEmbedCSS(cssUrl) })
 * 通过同源 /api/proxy-font 代理，避免 CORS 拦截。
 */
export async function getGoogleFontEmbedCSS(cssUrl: string): Promise<string> {
  if (fontEmbedCache[cssUrl])
    return fontEmbedCache[cssUrl]
  const res = await fetch(proxyUrl(cssUrl))
  if (!res.ok)
    throw new Error(`Font CSS fetch failed: ${cssUrl} ${res.status}`)
  let css = await res.text()
  const urlMatches = [...css.matchAll(URL_IN_CSS_REGEX)]
  const uniqueUrls = [...new Set(urlMatches.map(m => m[1]))]
  for (const url of uniqueUrls) {
    try {
      const dataUrl = await fetchAsDataUrl(url, cssUrl)
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      css = css.replace(new RegExp(`url\\s*\\(\\s*['"]?${escaped}['"]?\\s*\\)`, 'g'), `url(${dataUrl})`)
    }
    catch {
      // 某条字体拉取失败则保留原 url
    }
  }
  fontEmbedCache[cssUrl] = css
  return css
}

/** 名片/封面/海报用的 Noto Sans SC 900 + Noto Serif SC 700,900 */
export const CARD_COVER_POSTER_FONT_CSS_URL
  = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@900&family=Noto+Serif+SC:wght@700;900&display=swap'
