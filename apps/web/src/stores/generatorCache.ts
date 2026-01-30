import { reactive, ref, watch } from 'vue'
/**
 * 图片生成器表单缓存
 * 仅使用 localStorage 持久化，避免大 payload（含 base64 图）打爆远程 API（413/超时）
 * 切换页面和导出时自动保存/读取，不依赖 store.reactive 的远程引擎
 */
import { addPrefix } from '@/utils'

export interface CardGeneratorState {
  name: string
  nickname: string
  contactInfo: string
  affiliation: string
  nameSize: number
  nicknameSize: number
  contactInfoSize: number
  affiliationSize: number
  avatarDataUrl: string
}

export interface CoverGeneratorState {
  leftTitle1: string
  leftTitle2: string
  rightTitle1: string
  rightTitle2: string
  leftTitleSize1: number
  leftTitleSize2: number
  rightTitleSize1: number
  rightTitleSize2: number
  leftLineGap: number
  rightLineGap: number
  overlayHeight: number
  overlayOpacity: number
  leftBgDataUrl: string
  rightBgDataUrl: string
}

export interface PosterGeneratorState {
  topTitle: string
  mainTitle1: string
  mainTitle2: string
  subtitle: string
  subtitleHighlight: string
  credits: string
  topTitleSize: number
  mainTitleSize: number
  subtitleSize: number
  creditsSize: number
  spacingTop: number
  spacingTitleGap: number
  spacingMainToImage: number
  spacingImageToSub: number
  spacingSubToCredits: number
  imageDataUrl: string
  headBgDataUrl: string
}

const defaultCard: CardGeneratorState = {
  name: 'Larrtroffen',
  nickname: '回归不归',
  contactInfo: 'Email: Larrtroffen.gl@gmail.com\nWechat: Larr_1029',
  affiliation: 'XXXX大学XXXX专业本科生',
  nameSize: 52,
  nicknameSize: 24,
  contactInfoSize: 16,
  affiliationSize: 16,
  avatarDataUrl: '',
}

const defaultCover: CoverGeneratorState = {
  leftTitle1: '专题回顾',
  leftTitle2: '人机交互的未来？人的角色与"它"们的角色',
  rightTitle1: '回归不归',
  rightTitle2: '专题回顾',
  leftTitleSize1: 60,
  leftTitleSize2: 45,
  rightTitleSize1: 38,
  rightTitleSize2: 38,
  leftLineGap: 15,
  rightLineGap: 10,
  overlayHeight: 45,
  overlayOpacity: 65,
  leftBgDataUrl: '',
  rightBgDataUrl: '',
}

const defaultPoster: PosterGeneratorState = {
  topTitle: '不归声',
  mainTitle1: 'For Social Science 的社会模拟：',
  mainTitle2: '我们需要的究竟是什么？',
  subtitle: '一个极具潜力的强大方法，\n却因其未能与该领域的核心提问者建立有效对话，\n而始终徘徊在当下研究的边缘地带。',
  subtitleHighlight: '边缘地带',
  credits: '编者：Larrtroffen\n审校：XXXX、XXXX',
  topTitleSize: 24,
  mainTitleSize: 28,
  subtitleSize: 18,
  creditsSize: 16,
  spacingTop: 5,
  spacingTitleGap: 3,
  spacingMainToImage: 5,
  spacingImageToSub: 5,
  spacingSubToCredits: 5,
  imageDataUrl: '',
  headBgDataUrl: '',
}

export const CACHE_KEYS = {
  card: addPrefix('generator_card'),
  cover: addPrefix('generator_cover'),
  poster: addPrefix('generator_poster'),
} as const

const DATA_URL_KEYS = [
  'avatarDataUrl',
  'leftBgDataUrl',
  'rightBgDataUrl',
  'imageDataUrl',
  'headBgDataUrl',
] as const

function stripDataUrls<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj }
  for (const k of DATA_URL_KEYS) {
    if (k in out)
      (out as Record<string, unknown>)[k] = ''
  }
  return out
}

function loadFromLocal<T extends Record<string, unknown>>(key: string, defaultVal: T): T {
  if (typeof localStorage === 'undefined')
    return defaultVal
  try {
    const raw = localStorage.getItem(key)
    if (!raw)
      return defaultVal
    const parsed = JSON.parse(raw) as Partial<T>
    const merged = { ...defaultVal, ...parsed }
    for (const k of Object.keys(defaultVal) as (keyof T)[]) {
      if (merged[k] === undefined)
        merged[k] = defaultVal[k]
    }
    return merged
  }
  catch {
    return defaultVal
  }
}

function saveToLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    try {
      const withoutImages = stripDataUrls(value as Record<string, unknown>)
      localStorage.setItem(key, JSON.stringify(withoutImages))
    }
    catch (e2) {
      console.error('[generatorCache] save failed:', key, e2)
    }
  }
}

// 单例 ref(reactive(...))：保证深层属性变更触发 watch，切换 tab 不丢状态
const cardState = ref(reactive(loadFromLocal(CACHE_KEYS.card, defaultCard)) as CardGeneratorState)
const coverState = ref(reactive(loadFromLocal(CACHE_KEYS.cover, defaultCover)) as CoverGeneratorState)
const posterState = ref(reactive(loadFromLocal(CACHE_KEYS.poster, defaultPoster)) as PosterGeneratorState)

watch(cardState, v => saveToLocal(CACHE_KEYS.card, v), { deep: true })
watch(coverState, v => saveToLocal(CACHE_KEYS.cover, v), { deep: true })
watch(posterState, v => saveToLocal(CACHE_KEYS.poster, v), { deep: true })

export function useGeneratorCache() {
  return {
    cardState,
    coverState,
    posterState,
    defaultCard,
    defaultCover,
    defaultPoster,
  }
}
