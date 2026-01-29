<script setup lang="ts">
import { toPng } from 'html-to-image'
import { useEditorStore } from '@/stores/editor'
import { useGeneratorCache } from '@/stores/generatorCache'
import { CARD_COVER_POSTER_FONT_CSS_URL, getGoogleFontEmbedCSS } from '@/utils/export-fonts'
import { dataUrlToFile, fileUpload } from '@/utils/file'

const { posterState } = useGeneratorCache()
const editorStore = useEditorStore()
const posterRef = ref<HTMLElement | null>(null)
const isExporting = ref(false)
const exportBtnText = ref('生成并插入 (1242×1660)')
const posterFontFamily = '\'Noto Serif SC\', serif'

const subtitleHtml = computed(() => {
  const raw = posterState.value.subtitle ?? ''
  let safeText = raw
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  const highlight = posterState.value.subtitleHighlight ?? ''
  if (highlight) {
    const safeHighlight = highlight
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const re = new RegExp(safeHighlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')
    safeText = safeText.replace(re, `<span class="text-with-gradient-excerpt">${safeHighlight}</span>`)
  }
  return safeText
})

const creditsHtml = computed(() => {
  const text = posterState.value.credits ?? ''
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
})

const posterDefaultImageUrl = `${import.meta.env.BASE_URL}assets/generators/default-image.png`
const posterDefaultHeadBgUrl = `${import.meta.env.BASE_URL}assets/generators/head_background.png`

const posterBgStyle = computed(() => ({
  backgroundImage: `url('${posterDefaultHeadBgUrl}')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}))

const posterImageSrc = computed(() => posterState.value.imageDataUrl || posterDefaultImageUrl)

function onImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      posterState.value.imageDataUrl = (ev.target?.result as string) || ''
    }
    reader.readAsDataURL(file)
  }
}

async function onExport() {
  if (!posterRef.value)
    return
  isExporting.value = true
  exportBtnText.value = '生成中...'
  try {
    const fontEmbedCSS = await getGoogleFontEmbedCSS(CARD_COVER_POSTER_FONT_CSS_URL)
    const dataUrl = await toPng(posterRef.value, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      fontEmbedCSS,
    })
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('生成图片失败')
    }
    const file = await dataUrlToFile(dataUrl, 'poster-export.png')
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const url = await fileUpload(base64, file)
    editorStore.insertAtStart(`\n![](${url})\n`)
    toast.success('海报已生成并插入文档开头')
  }
  catch (err) {
    console.error('海报生成失败:', err)
    const msg = (err as Error)?.message ?? ''
    const isCors = msg.includes('fetch') || msg.includes('CORS')
    const isStyle = msg.includes('cross-origin') || msg.includes('cssRules') || msg.includes('trim')
    toast.error(isCors ? '上传失败：请确认腾讯云 COS 存储桶已配置 CORS 允许当前站点来源' : isStyle ? '生成失败：当前页面外部样式/字体无法参与导出，请重试' : '海报生成失败，请查看控制台')
  }
  finally {
    isExporting.value = false
    exportBtnText.value = '生成并插入 (1242×1660)'
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-6 p-2">
    <div class="generator-controls min-w-72 flex-1 space-y-4 rounded-lg border bg-muted/30 p-4">
      <h3 class="text-lg font-semibold text-center border-b border-border pb-4 mb-5">
        内容与字号
      </h3>
      <div class="space-y-2">
        <label class="text-sm font-medium">栏目名</label>
        <input v-model="posterState.topTitle" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.topTitleSize" type="range" min="10" max="50" class="flex-1">
          <span class="text-xs">{{ posterState.topTitleSize }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">主标题</label>
        <input v-model="posterState.mainTitle1" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <input v-model="posterState.mainTitle2" type="text" class="mt-1 w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.mainTitleSize" type="range" min="10" max="60" class="flex-1">
          <span class="text-xs">{{ posterState.mainTitleSize }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">上传主体图片</label>
        <input type="file" accept="image/*" class="block w-full text-sm" @change="onImageChange">
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">文字摘录</label>
        <textarea v-model="posterState.subtitle" rows="4" class="w-full rounded border px-2 py-1.5 text-sm" />
        <label class="mt-2 block text-sm font-medium">摘录高亮文字</label>
        <input v-model="posterState.subtitleHighlight" type="text" class="mt-2 w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.subtitleSize" type="range" min="10" max="40" class="flex-1">
          <span class="text-xs">{{ posterState.subtitleSize }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">人物信息 (双行)</label>
        <textarea v-model="posterState.credits" rows="2" class="w-full rounded border px-2 py-1.5 text-sm" />
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.creditsSize" type="range" min="10" max="40" class="flex-1">
          <span class="text-xs">{{ posterState.creditsSize }}px</span>
        </div>
      </div>
      <h4 class="mt-8 text-[22px] font-semibold text-center border-b border-border pb-4 mb-5" style="color: #001f3f;">
        间距调整
      </h4>
      <div class="space-y-2">
        <label class="text-sm font-medium">顶部留白</label>
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.spacingTop" type="range" min="0" max="20" step="0.1" class="flex-1">
          <span class="text-xs">{{ posterState.spacingTop }}%</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">栏目名 → 主标题</label>
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.spacingTitleGap" type="range" min="0" max="15" step="0.1" class="flex-1">
          <span class="text-xs">{{ posterState.spacingTitleGap }}%</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">主标题 → 图片</label>
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.spacingMainToImage" type="range" min="0" max="20" step="0.1" class="flex-1">
          <span class="text-xs">{{ posterState.spacingMainToImage }}%</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">图片 → 文字摘录</label>
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.spacingImageToSub" type="range" min="0" max="20" step="0.1" class="flex-1">
          <span class="text-xs">{{ posterState.spacingImageToSub }}%</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">文字摘录 → 人物信息</label>
        <div class="flex items-center gap-2">
          <input v-model.number="posterState.spacingSubToCredits" type="range" min="0" max="15" step="0.1" class="flex-1">
          <span class="text-xs">{{ posterState.spacingSubToCredits }}%</span>
        </div>
      </div>
      <Button class="mt-4 w-full" :disabled="isExporting" @click="onExport">
        {{ exportBtnText }}
      </Button>
    </div>
    <div class="generator-preview flex shrink-0 items-start justify-center overflow-auto">
      <div
        ref="posterRef"
        class="poster-preview flex shrink-0 flex-col overflow-hidden rounded-xl border shadow-lg"
        :style="{
          width: '621px',
          height: '830px',
          minWidth: '621px',
          minHeight: '830px',
          backgroundColor: '#ffffff',
          fontFamily: posterFontFamily,
          ...posterBgStyle,
        }"
      >
        <div
          class="content-top shrink-0 px-[7%] box-border"
          :style="{
            paddingTop: `${posterState.spacingTop}%`,
            marginBottom: `${posterState.spacingMainToImage}%`,
          }"
        >
          <h1 class="top-title m-0 text-[#0f3b83]" :style="{ fontSize: `${posterState.topTitleSize}px`, fontFamily: posterFontFamily, fontWeight: 900, letterSpacing: '2px' }">
            「<span class="text-with-gradient">{{ posterState.topTitle }}</span>」
          </h1>
          <h2
            class="main-title m-0 text-[#4b596f]"
            :style="{ fontSize: `${posterState.mainTitleSize}px`, marginTop: `${posterState.spacingTitleGap}%`, fontFamily: posterFontFamily, fontWeight: 700, lineHeight: 1.4 }"
          >
            {{ posterState.mainTitle1 }}<br>{{ posterState.mainTitle2 }}
          </h2>
        </div>
        <div class="image-container w-full shrink-0 overflow-hidden" style="aspect-ratio: 16/9;">
          <img
            :src="posterImageSrc"
            alt="主体图片"
            class="block h-full w-full object-cover object-center"
            style="object-fit: cover; object-position: center;"
          >
        </div>
        <div
          class="content-bottom flex flex-1 flex-col px-[7%] pb-[5%] box-border min-h-0"
          :style="{
            paddingTop: `${posterState.spacingImageToSub}%`,
          }"
        >
          <p
            class="subtitle m-0 text-right text-black"
            :style="{ fontSize: `${posterState.subtitleSize}px`, marginBottom: `${posterState.spacingSubToCredits}%`, fontFamily: posterFontFamily, fontWeight: 900, lineHeight: 1.8 }"
            v-html="subtitleHtml"
          />
          <div
            class="credits mt-auto text-[#0f3b83]"
            :style="{ fontSize: `${posterState.creditsSize}px`, fontFamily: posterFontFamily, fontWeight: 700, lineHeight: 1.7 }"
            v-html="creditsHtml"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-with-gradient,
.text-with-gradient-excerpt {
  position: relative;
  display: inline-block;
  isolation: isolate;
}
.text-with-gradient::after,
.text-with-gradient-excerpt::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  background-image: linear-gradient(to right, #90f0c2, #a3d8f5);
  z-index: -1;
  opacity: 0.8;
}
.text-with-gradient::after {
  bottom: 5%;
  height: 30%;
}
.text-with-gradient-excerpt::after {
  bottom: 0;
  height: 40%;
}
.poster-preview :deep(p),
.poster-preview :deep(span) {
  margin: 0;
}
</style>
