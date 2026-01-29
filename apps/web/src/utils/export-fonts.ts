/**
 * 为 html-to-image 导出准备字体 CSS：拉取 Google Fonts CSS 并将字体 URL 内联为 data URL，
 * 避免跨域 stylesheet 导致 cssRules 报错，同时保留原字体显示。
 */

const fontEmbedCache: Record<string, string> = {}

const URL_IN_CSS_REGEX = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/g

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok)
    throw new Error(`Font fetch failed: ${url} ${res.status}`)
  const buf = await res.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  const contentType = res.headers.get('content-type') || 'font/woff2'
  return `data:${contentType};base64,${base64}`
}

/**
 * 拉取 Google Fonts CSS，并将其中所有字体 url() 替换为 data URL，返回可注入的 CSS 字符串。
 * 用于 toPng(..., { fontEmbedCSS: await getGoogleFontEmbedCSS(cssUrl) })
 */
export async function getGoogleFontEmbedCSS(cssUrl: string): Promise<string> {
  if (fontEmbedCache[cssUrl])
    return fontEmbedCache[cssUrl]
  const res = await fetch(cssUrl, {
    mode: 'cors',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0' },
  })
  if (!res.ok)
    throw new Error(`Font CSS fetch failed: ${cssUrl} ${res.status}`)
  let css = await res.text()
  const urlMatches = [...css.matchAll(URL_IN_CSS_REGEX)]
  const uniqueUrls = [...new Set(urlMatches.map(m => m[1]))]
  for (const url of uniqueUrls) {
    try {
      const dataUrl = await fetchAsDataUrl(url)
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
