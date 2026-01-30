<script setup lang="ts">
import { toPng } from 'html-to-image'
import { useEditorStore } from '@/stores/editor'
import { useGeneratorCache } from '@/stores/generatorCache'
import { CARD_COVER_POSTER_FONT_CSS_URL, getGoogleFontEmbedCSS } from '@/utils/export-fonts'
import { dataUrlToFile, fileUpload } from '@/utils/file'

const { cardState } = useGeneratorCache()

const cardIconStyle = { display: 'inline-block', width: '1em', height: '1em', fontSize: '18px', verticalAlign: 'middle', marginTop: '4px', flexShrink: 0 }
const globeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" style="width:1em;height:1em"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm-89.6 128h-77.1c-26-24.5-45.6-54.4-57.4-87.8c-3.2-9-5.2-18.4-6.1-28H162c.9 9.6 2.9 19 6.1 28c11.8 33.4 31.4 63.3 57.4 87.8zm-117-320h77.1c26 24.5 45.6 54.4 57.4 87.8c3.2 9 5.2 18.4 6.1 28H162c-.9-9.6-2.9-19-6.1-28c-11.8-33.4-31.4-63.3-57.4-87.8zM64 256c0-22.2 1.2-43.6 3.3-64h185.4c2.2 20.4 3.3 41.8 3.3 64s-1.2 43.6-3.3 64H67.3c-2.2-20.4-3.3-41.8-3.3-64zm89.6-128h77.1c-26-24.5-45.6-54.4-57.4-87.8c-3.2-9-5.2-18.4-6.1-28H222c-.9 9.6-2.9 19-6.1 28c-11.8 33.4-31.4 63.3-57.4 87.8zM256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM32 256a224 224 0 1 0 448 0A224 224 0 1 0 32 256z"/></svg>'
const mapMarkerSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style="width:1em;height:1em"><path d="M215.7 499.2C73 371 0 304.7 0 192C0 86 86 0 192 0s192 86 192 192c0 112.7-73 179-215.7 307.2c-9.4 8.5-22.9 8.5-32.4 0zM192 272a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>'
const editorStore = useEditorStore()
const cardRef = ref<HTMLElement | null>(null)
const isExporting = ref(false)
const exportBtnText = ref('生成并插入 (1100×620)')
const cardFontFamily = '\'Noto Sans SC\', sans-serif'

const contactInfoHtml = computed(() => {
  const text = cardState.value.contactInfo ?? ''
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
})

function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      cardState.value.avatarDataUrl = (ev.target?.result as string) || ''
    }
    reader.readAsDataURL(file)
  }
}

async function onExport() {
  if (!cardRef.value)
    return
  isExporting.value = true
  exportBtnText.value = '生成中...'
  try {
    const fontEmbedCSS = await getGoogleFontEmbedCSS(CARD_COVER_POSTER_FONT_CSS_URL)
    const node = cardRef.value
    if (!node) {
      toast.error('页面已切换，请重试')
      return
    }
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: undefined,
      fontEmbedCSS,
    })
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('生成图片失败')
    }
    const file = await dataUrlToFile(dataUrl, 'business-card.png')
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const url = await fileUpload(base64, file)
    editorStore.insertAtStart(`\n![](${url})\n`)
    toast.success('名片已生成并插入文档开头')
  }
  catch (err) {
    console.error('名片生成失败:', err)
    const msg = (err as Error)?.message ?? ''
    const isCors = msg.includes('fetch') || msg.includes('CORS')
    const isStyle = msg.includes('cross-origin') || msg.includes('cssRules') || msg.includes('trim')
    toast.error(isCors ? '上传失败：请确认腾讯云 COS 存储桶已配置 CORS 允许当前站点来源' : isStyle ? '生成失败：当前页面外部样式/字体无法参与导出，请重试或简化页面' : '名片生成失败，请查看控制台')
  }
  finally {
    isExporting.value = false
    exportBtnText.value = '生成并插入 (1100×620)'
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-6 p-2">
    <div class="generator-controls min-w-72 flex-1 space-y-4 rounded-lg border bg-muted/30 p-4">
      <h3 class="text-lg font-semibold text-center border-b border-border pb-4 mb-5">
        名片内容编辑器
      </h3>
      <div class="space-y-2">
        <label class="text-sm font-medium">上传头像</label>
        <input
          type="file"
          accept="image/*"
          class="block w-full text-sm"
          @change="onAvatarChange"
        >
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">姓名 (英文/拼音)</label>
        <input v-model="cardState.name" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="cardState.nameSize" type="range" min="20" max="80" class="flex-1">
          <span class="text-xs">{{ cardState.nameSize }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">别称 (中文)</label>
        <input v-model="cardState.nickname" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="cardState.nicknameSize" type="range" min="10" max="50" class="flex-1">
          <span class="text-xs">{{ cardState.nicknameSize }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">联系方式 (支持多行)</label>
        <textarea v-model="cardState.contactInfo" rows="2" class="w-full rounded border px-2 py-1.5 text-sm" />
        <div class="flex items-center gap-2">
          <input v-model.number="cardState.contactInfoSize" type="range" min="10" max="30" class="flex-1">
          <span class="text-xs">{{ cardState.contactInfoSize }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">单位/身份</label>
        <input v-model="cardState.affiliation" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="cardState.affiliationSize" type="range" min="10" max="30" class="flex-1">
          <span class="text-xs">{{ cardState.affiliationSize }}px</span>
        </div>
      </div>
      <Button
        class="w-full"
        :disabled="isExporting"
        @click="onExport"
      >
        {{ exportBtnText }}
      </Button>
    </div>
    <div class="generator-preview flex shrink-0 items-start justify-center">
      <div
        ref="cardRef"
        class="card-preview rounded-[12px] border bg-[#fdfdfc] p-10 shadow-lg box-border shrink-0"
        :style="{ width: '550px', height: '310px', minWidth: '550px', minHeight: '310px', color: '#240082', fontFamily: cardFontFamily, fontWeight: 900 }"
      >
        <div class="flex flex-col justify-between h-full">
          <div class="flex items-center gap-[30px]">
            <div class="h-[120px] w-[120px] shrink-0 overflow-hidden rounded-full bg-[#240082]">
              <img
                v-if="cardState.avatarDataUrl"
                :src="cardState.avatarDataUrl"
                alt="头像"
                class="h-full w-full object-cover"
              >
            </div>
            <div class="flex-1 text-right" style="line-height: 1.1;">
              <h1 :style="{ fontSize: `${cardState.nameSize}px`, fontFamily: cardFontFamily, fontWeight: 900 }" class="m-0">
                {{ cardState.name }}
              </h1>
              <h2 :style="{ fontSize: `${cardState.nicknameSize}px`, fontFamily: cardFontFamily, fontWeight: 900, marginTop: '10px' }" class="m-0">
                {{ cardState.nickname }}
              </h2>
            </div>
          </div>
          <div class="flex flex-col gap-[15px]">
            <div class="flex items-start gap-[15px]">
              <span :style="cardIconStyle" v-html="globeSvg" />
              <p :style="{ fontSize: `${cardState.contactInfoSize}px`, lineHeight: '1.6', fontFamily: cardFontFamily, fontWeight: 900 }" class="m-0" v-html="contactInfoHtml" />
            </div>
            <div class="flex items-start gap-[15px]">
              <span :style="cardIconStyle" v-html="mapMarkerSvg" />
              <p :style="{ fontSize: `${cardState.affiliationSize}px`, lineHeight: '1.6', fontFamily: cardFontFamily, fontWeight: 900 }" class="m-0">
                {{ cardState.affiliation }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-preview :deep(p) {
  margin: 0;
}
</style>
