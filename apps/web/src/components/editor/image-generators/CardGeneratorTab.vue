<script setup lang="ts">
import { toPng } from 'html-to-image'
import { useEditorStore } from '@/stores/editor'
import { useGeneratorCache } from '@/stores/generatorCache'
import { dataUrlToFile, fileUpload } from '@/utils/file'

const { cardState } = useGeneratorCache()
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
    const dataUrl = await toPng(cardRef.value, {
      pixelRatio: 2,
      backgroundColor: undefined,
      skipFonts: false,
    })
    const file = await dataUrlToFile(dataUrl, 'business-card.png')
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const url = await fileUpload(base64, file)
    editorStore.insertAtStart(`\n![](${url})\n`)
    toast.success('名片已生成并插入文档开头')
  }
  catch (err) {
    console.error('名片生成失败:', err)
    const msg = (err as Error)?.message ?? ''
    toast.error(msg.includes('fetch') || msg.includes('CORS') ? '上传失败：请确认腾讯云 COS 存储桶已配置 CORS 允许当前站点来源' : '名片生成失败，请查看控制台')
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
              <i class="fa-solid fa-globe shrink-0 mt-1 text-[18px]" style="margin-top: 4px;" />
              <p :style="{ fontSize: `${cardState.contactInfoSize}px`, lineHeight: '1.6', fontFamily: cardFontFamily, fontWeight: 900 }" class="m-0" v-html="contactInfoHtml" />
            </div>
            <div class="flex items-start gap-[15px]">
              <i class="fa-solid fa-map-marker-alt shrink-0 mt-1 text-[18px]" style="margin-top: 4px;" />
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
