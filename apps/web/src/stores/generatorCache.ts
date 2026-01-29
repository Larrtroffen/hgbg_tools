/**
 * 图片生成器表单缓存
 * 使用 localStorage 持久化三个生成器的表单状态，关闭弹窗后再次打开可恢复
 */
import { addPrefix } from '@/utils'
import { store } from '@/utils/storage'

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

export function useGeneratorCache() {
  const cardState = store.reactive<CardGeneratorState>(CACHE_KEYS.card, defaultCard)
  const coverState = store.reactive<CoverGeneratorState>(CACHE_KEYS.cover, defaultCover)
  const posterState = store.reactive<PosterGeneratorState>(CACHE_KEYS.poster, defaultPoster)

  return {
    cardState,
    coverState,
    posterState,
    defaultCard,
    defaultCover,
    defaultPoster,
  }
}
