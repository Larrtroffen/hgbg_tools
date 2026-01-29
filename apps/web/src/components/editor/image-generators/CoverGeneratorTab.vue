<script setup lang="ts">
import { toPng } from 'html-to-image'
import { useEditorStore } from '@/stores/editor'
import { useGeneratorCache } from '@/stores/generatorCache'
import { dataUrlToFile, fileUpload } from '@/utils/file'

const { coverState } = useGeneratorCache()
const editorStore = useEditorStore()
const coverRef = ref<HTMLElement | null>(null)
const coverFontFamily = "'Noto Serif SC', serif"
const isExporting = ref(false)
const exportBtnText = ref('生成并插入 (1283×383)')

function onLeftBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      coverState.value.leftBgDataUrl = (ev.target?.result as string) || ''
    }
    reader.readAsDataURL(file)
  }
}

function onRightBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      coverState.value.rightBgDataUrl = (ev.target?.result as string) || ''
    }
    reader.readAsDataURL(file)
  }
}

async function onExport() {
  if (!coverRef.value) return
  isExporting.value = true
  exportBtnText.value = '生成中...'
  try {
    const dataUrl = await toPng(coverRef.value, {
      pixelRatio: 2,
      backgroundColor: null,
      skipFonts: false,
      fontFetchTimeout: 60000,
    })
    const file = await dataUrlToFile(dataUrl, 'wechat-cover-1283x383.png')
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const url = await fileUpload(base64, file)
    editorStore.insertAtStart(`\n![](${url})\n`)
    toast.success('封面已生成并插入文档开头')
  }
  catch (err) {
    console.error('封面生成失败:', err)
    const msg = (err as Error)?.message ?? ''
    toast.error(msg.includes('fetch') || msg.includes('CORS') ? '上传失败：请确认腾讯云 COS 存储桶已配置 CORS 允许当前站点来源' : '封面生成失败，请查看控制台')
  }
  finally {
    isExporting.value = false
    exportBtnText.value = '生成并插入 (1283×383)'
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-6 p-2">
    <div class="generator-controls min-w-72 flex-1 max-w-[400px] space-y-4 rounded-lg border bg-muted/30 p-4">
      <h3 class="text-lg font-semibold text-center border-b border-border pb-4 mb-5">
        封面内容设置
      </h3>
      <h4 class="text-base font-bold text-primary border-b border-border pb-2.5 mt-8 mb-4">
        左侧封面 (大图)
      </h4>
      <div class="space-y-2">
        <label class="text-sm font-medium">标题第一行</label>
        <input v-model="coverState.leftTitle1" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.leftTitleSize1" type="range" min="10" max="120" class="flex-1">
          <span class="text-xs">{{ coverState.leftTitleSize1 }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">标题第二行</label>
        <input v-model="coverState.leftTitle2" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.leftTitleSize2" type="range" min="10" max="120" class="flex-1">
          <span class="text-xs">{{ coverState.leftTitleSize2 }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">行间距</label>
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.leftLineGap" type="range" min="0" max="50" class="flex-1">
          <span class="text-xs">{{ coverState.leftLineGap }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">上传左侧背景图 (900x383)</label>
        <input type="file" accept="image/*" class="block w-full text-sm" @change="onLeftBgChange">
      </div>

      <h4 class="text-base font-bold text-primary border-b border-border pb-2.5 mt-8 mb-4">
        右侧封面 (小图)
      </h4>
      <div class="space-y-2">
        <label class="text-sm font-medium">标题第一行</label>
        <input v-model="coverState.rightTitle1" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.rightTitleSize1" type="range" min="10" max="80" class="flex-1">
          <span class="text-xs">{{ coverState.rightTitleSize1 }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">标题第二行</label>
        <input v-model="coverState.rightTitle2" type="text" class="w-full rounded border px-2 py-1.5 text-sm">
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.rightTitleSize2" type="range" min="10" max="80" class="flex-1">
          <span class="text-xs">{{ coverState.rightTitleSize2 }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">行间距</label>
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.rightLineGap" type="range" min="0" max="40" class="flex-1">
          <span class="text-xs">{{ coverState.rightLineGap }}px</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">上传右侧背景图 (383x383)</label>
        <input type="file" accept="image/*" class="block w-full text-sm" @change="onRightBgChange">
      </div>

      <h4 class="text-base font-bold text-primary border-b border-border pb-2.5 mt-8 mb-4">
        全局样式
      </h4>
      <div class="space-y-2">
        <label class="text-sm font-medium">中间遮罩高度</label>
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.overlayHeight" type="range" min="0" max="100" class="flex-1">
          <span class="text-xs">{{ coverState.overlayHeight }}%</span>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">遮罩透明度</label>
        <div class="flex items-center gap-2">
          <input v-model.number="coverState.overlayOpacity" type="range" min="0" max="100" class="flex-1">
          <span class="text-xs">{{ coverState.overlayOpacity }}%</span>
        </div>
      </div>
      <Button class="mt-4 w-full" :disabled="isExporting" @click="onExport">
        {{ exportBtnText }}
      </Button>
    </div>
    <div class="generator-preview flex shrink-0 items-start justify-center">
      <div
        ref="coverRef"
        class="cover-preview relative flex shrink-0 overflow-hidden rounded-lg border shadow-lg"
        :style="{
          width: '641.5px',
          height: '191.5px',
          minWidth: '641.5px',
          minHeight: '191.5px',
          backgroundColor: '#ccc',
          fontFamily: coverFontFamily,
          fontWeight: 900,
          '--overlay-height': coverState.overlayHeight + '%',
          '--overlay-opacity': coverState.overlayOpacity / 100,
          '--left-line-gap': coverState.leftLineGap + 'px',
          '--right-line-gap': coverState.rightLineGap + 'px',
        }"
      >
        <div
          class="relative h-full bg-cover bg-center bg-no-repeat"
          :style="{
            width: 'calc(900 / 1283 * 100%)',
            backgroundImage: coverState.leftBgDataUrl ? `url('${coverState.leftBgDataUrl}')` : undefined,
            backgroundColor: coverState.leftBgDataUrl ? undefined : '#666',
          }"
        >
          <div class="absolute inset-0 z-[2] flex flex-col justify-center px-5 text-center text-white box-border" :style="{ fontFamily: coverFontFamily, fontWeight: 900, lineHeight: 1.3 }">
            <span :style="{ fontSize: coverState.leftTitleSize1 + 'px', marginBottom: coverState.leftLineGap + 'px', display: 'block', fontFamily: coverFontFamily, fontWeight: 900 }">{{ coverState.leftTitle1 }}</span>
            <span :style="{ fontSize: coverState.leftTitleSize2 + 'px', display: 'block', fontFamily: coverFontFamily, fontWeight: 900 }">{{ coverState.leftTitle2 }}</span>
          </div>
        </div>
        <div
          class="relative h-full bg-cover bg-center bg-no-repeat"
          :style="{
            width: 'calc(383 / 1283 * 100%)',
            backgroundImage: coverState.rightBgDataUrl ? `url('${coverState.rightBgDataUrl}')` : undefined,
            backgroundColor: coverState.rightBgDataUrl ? undefined : '#666',
          }"
        >
          <div class="absolute inset-0 z-[2] flex flex-col justify-center px-5 text-center text-white box-border" :style="{ fontFamily: coverFontFamily, fontWeight: 900, lineHeight: 1.3 }">
            <span :style="{ fontSize: coverState.rightTitleSize1 + 'px', marginBottom: coverState.rightLineGap + 'px', display: 'block', fontFamily: coverFontFamily, fontWeight: 900 }">{{ coverState.rightTitle1 }}</span>
            <span :style="{ fontSize: coverState.rightTitleSize2 + 'px', display: 'block', fontFamily: coverFontFamily, fontWeight: 900 }">{{ coverState.rightTitle2 }}</span>
          </div>
        </div>
        <div
          class="absolute left-0 top-1/2 z-[1] w-full -translate-y-1/2 pointer-events-none"
          :style="{
            height: 'var(--overlay-height)',
            backgroundColor: 'rgba(0,0,0,var(--overlay-opacity))',
          }"
        />
      </div>
    </div>
  </div>
</template>
