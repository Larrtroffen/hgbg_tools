<script setup lang="ts">
import { Download, Loader2, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { store } from '@/utils/storage'

const AIHUBMIX_BASE = `https://aihubmix.com/gemini/v1beta`
const MODEL_IMAGE = `gemini-3-pro-image-preview`

/** 触发浏览器下载：用 dataUrl 创建临时 a 标签并点击 */
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement(`a`)
  a.href = dataUrl
  a.download = filename
  a.style.display = `none`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const apiKey = ref(``)
const prompt = ref(``)
const aspectRatio = ref(`1:1`)
const imageSize = ref(`1k`)
const loading = ref(false)
const errorMsg = ref(``)

const aspectRatioOptions = [
  { value: `1:1`, label: `1:1` },
  { value: `16:9`, label: `16:9` },
  { value: `9:16`, label: `9:16` },
  { value: `4:3`, label: `4:3` },
  { value: `3:4`, label: `3:4` },
]

const imageSizeOptions = [
  { value: `1k`, label: `1k` },
  { value: `2k`, label: `2k` },
]

// 从 storage 恢复 API Key（不存明文，仅 session 内可考虑存；这里每次打开需填写或从配置读取）
onMounted(async () => {
  const saved = await store.get(`aihubmixApiKey`)
  if (saved && typeof saved === `string`)
    apiKey.value = saved
})

function saveApiKey() {
  if (apiKey.value.trim())
    store.set(`aihubmixApiKey`, apiKey.value.trim())
}

/** 从流式或一次性 JSON 响应中提取图片的 base64 与 mimeType */
function extractImageFromResponse(data: string): { data: string, mimeType: string } | null {
  const lines = data.trim().split(/\r?\n/)
  let lastInline: { data: string, mimeType: string } | null = null

  for (const line of lines) {
    const trimmed = line.replace(/^data:\s*/, ``).trim()
    if (!trimmed || trimmed === `[DONE]`)
      continue
    try {
      const obj = JSON.parse(trimmed) as any
      const candidates = obj?.candidates ?? obj?.data?.candidates
      if (!Array.isArray(candidates))
        continue
      for (const c of candidates) {
        const parts = c?.content?.parts ?? c?.parts
        if (!Array.isArray(parts))
          continue
        for (const p of parts) {
          const inline = p?.inlineData ?? p?.inline_data
          if (inline?.data) {
            lastInline = {
              data: inline.data,
              mimeType: inline.mimeType ?? inline.mime_type ?? `image/png`,
            }
          }
        }
      }
    }
    catch {
      // 整段可能是单个 JSON
      continue
    }
  }

  // 若按行解析没拿到，尝试整体解析
  if (!lastInline) {
    try {
      const obj = JSON.parse(data) as any
      const candidates = obj?.candidates ?? obj?.data?.candidates
      if (Array.isArray(candidates)) {
        for (const c of candidates) {
          const parts = c?.content?.parts ?? c?.parts
          if (!Array.isArray(parts))
            continue
          for (const p of parts) {
            const inline = p?.inlineData ?? p?.inline_data
            if (inline?.data) {
              lastInline = {
                data: inline.data,
                mimeType: inline.mimeType ?? inline.mime_type ?? `image/png`,
              }
            }
          }
        }
      }
    }
    catch {
      // ignore
    }
  }

  return lastInline
}

async function generateAndDownload() {
  const key = apiKey.value.trim()
  if (!key) {
    errorMsg.value = `请填写 AIHUBMIX API Key`
    return
  }
  const text = prompt.value.trim()
  if (!text) {
    errorMsg.value = `请填写生图描述`
    return
  }

  loading.value = true
  errorMsg.value = ``

  try {
    saveApiKey()

    const url = `${AIHUBMIX_BASE}/models/${MODEL_IMAGE}:streamGenerateContent`
    const body = {
      contents: [
        {
          role: `user`,
          parts: [{ text }],
        },
      ],
      generationConfig: {
        responseModalities: [`TEXT`, `IMAGE`],
        imageConfig: {
          aspectRatio: aspectRatio.value,
          imageSize: imageSize.value,
        },
      },
    }

    const res = await fetch(url, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`,
        'x-goog-api-key': key,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || `请求失败: ${res.status}`)
    }

    const contentType = res.headers.get(`content-type`) || ``
    let raw: string

    if (contentType.includes(`application/json`) && !res.body) {
      raw = await res.json().then((o: any) => JSON.stringify(o))
    }
    else {
      raw = await res.text()
    }

    const imageInfo = extractImageFromResponse(raw)
    if (!imageInfo) {
      throw new Error(`响应中未包含图片，请检查模型与参数。原始响应前 500 字符: ${raw.slice(0, 500)}`)
    }

    const dataUrl = `data:${imageInfo.mimeType};base64,${imageInfo.data}`
    const ext = imageInfo.mimeType === `image/jpeg` ? `jpg` : `png`
    downloadDataUrl(dataUrl, `gemini-generated.${ext}`)
    toast.success(`已生成图片，请查收下载`)
  }
  catch (e: any) {
    errorMsg.value = e?.message ?? String(e)
    toast.error(errorMsg.value)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-6 p-2">
    <div class="generator-controls min-w-72 flex-1 max-w-[400px] space-y-4 rounded-lg border bg-muted/30 p-4">
      <h3 class="text-lg font-semibold text-center border-b border-border pb-4 mb-5">
        <Sparkles class="inline-block mr-2 h-5 w-5" />
        Gemini 生图 (aihubmix)
      </h3>

      <div class="space-y-2">
        <label class="text-sm font-medium">API Key (x-goog-api-key)</label>
        <input
          v-model="apiKey"
          type="password"
          class="w-full rounded border px-2 py-1.5 text-sm bg-background"
          placeholder="AIHUBMIX_API_KEY"
        >
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">生图描述</label>
        <textarea
          v-model="prompt"
          class="w-full min-h-[80px] rounded border px-2 py-1.5 text-sm bg-background resize-y"
          placeholder="例如: draw a tree"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">宽高比</label>
        <select
          v-model="aspectRatio"
          class="w-full rounded border px-2 py-1.5 text-sm bg-background"
        >
          <option
            v-for="opt in aspectRatioOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">图片尺寸</label>
        <select
          v-model="imageSize"
          class="w-full rounded border px-2 py-1.5 text-sm bg-background"
        >
          <option
            v-for="opt in imageSizeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="errorMsg" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ errorMsg }}
      </div>

      <Button
        class="w-full"
        :disabled="loading"
        @click="generateAndDownload"
      >
        <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
        <Download v-else class="mr-2 h-4 w-4" />
        {{ loading ? '生成中…' : '生成并下载' }}
      </Button>

      <p class="text-xs text-muted-foreground">
        使用 aihubmix 的 Gemini 3 Pro 生图，生成后直接下载保存到本地。
      </p>
    </div>
  </div>
</template>
