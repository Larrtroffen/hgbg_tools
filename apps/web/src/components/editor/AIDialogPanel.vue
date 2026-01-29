<script setup lang="ts">
import { Bot, FileUp, ImageIcon, Loader2, Workflow } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import GeminiImageTab from '@/components/editor/image-generators/GeminiImageTab.vue'
import { defaultDifyServices, type DifyServiceOption } from '@/config/dify-services'
import { usePostStore } from '@/stores/post'
import { useUIStore } from '@/stores/ui'

type AIPageId = 'dify' | 'gemini-image'

defineOptions({
  name: 'AIDialogPanel',
})

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const uiStore = useUIStore()
const postStore = usePostStore()

const services = ref<DifyServiceOption[]>([...defaultDifyServices])
/** 当前选中的「页面」：Dify 工作流 / AI 生图（两个并列入口） */
const selectedPage = ref<AIPageId | null>(null)
/** 仅在 Dify 工作流页面内：当前选中的 Dify 服务 */
const selectedService = ref<DifyServiceOption | null>(null)
const editApiKey = ref(``)
const editBaseUrl = ref(``)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const errorMsg = ref(``)

function onUpdate(val: boolean) {
  emit('update:open', val)
  if (!val) {
    selectedPage.value = null
    selectedService.value = null
    errorMsg.value = ``
    selectedFile.value = null
  }
}

function goToDifyPage() {
  selectedPage.value = `dify`
  selectedService.value = null
  errorMsg.value = ``
}

function goToGeminiImagePage() {
  selectedPage.value = `gemini-image`
  errorMsg.value = ``
}

function selectDifyService(svc: DifyServiceOption) {
  selectedService.value = svc
  editApiKey.value = svc.apiKey
  editBaseUrl.value = svc.baseUrl
  errorMsg.value = ``
}

watch(selectedService, (svc) => {
  if (svc) {
    editApiKey.value = svc.apiKey
    editBaseUrl.value = svc.baseUrl
  }
}, { immediate: true })

function onFileChange(ev: Event) {
  const target = ev.target as HTMLInputElement
  const file = target.files?.[0]
  selectedFile.value = file ?? null
  errorMsg.value = ``
}

/** 规范化 baseUrl：去掉末尾斜杠，保证为 /v1 形式 */
function normalizeBaseUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, ``)
  return u || `https://api.dify.ai/v1`
}

const useDifyBackend = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_REMOTE_STORAGE === 'true'

/** 上传文件到 Dify，返回 upload_file_id（远程存储开启时走服务端代理，无需 API Key） */
async function uploadFile(baseUrl: string, apiKey: string, file: File): Promise<string> {
  if (useDifyBackend) {
    const form = new FormData()
    form.append(`file`, file)
    form.append(`user`, `md-editor`)
    const res = await fetch(`${window.location.origin}/api/dify/files/upload`, {
      method: `POST`,
      body: form,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `上传失败: ${res.status}`)
    }
    const data = await res.json()
    const id = data?.id ?? data?.file_id
    if (!id) {
      throw new Error(`上传响应中缺少文件 id`)
    }
    return id
  }
  const url = `${normalizeBaseUrl(baseUrl)}/files/upload`
  const form = new FormData()
  form.append(`file`, file)
  form.append(`user`, `md-editor`)
  const res = await fetch(url, {
    method: `POST`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `上传失败: ${res.status}`)
  }
  const data = await res.json()
  const id = data?.id ?? data?.file_id
  if (!id) {
    throw new Error(`上传响应中缺少文件 id`)
  }
  return id
}

/** 从 SSE 流中解析出 workflow_run_id（只读首几个事件即断开，用于长任务） */
async function startWorkflowAndGetRunId(
  baseUrl: string,
  apiKey: string,
  fileInputKey: string,
  uploadFileId: string,
  controller: AbortController,
): Promise<string> {
  const url = useDifyBackend
    ? `${window.location.origin}/api/dify/workflows/run`
    : `${normalizeBaseUrl(baseUrl)}/workflows/run`
  const body = {
    inputs: {
      [fileInputKey]: {
        type: `document`,
        transfer_method: `local_file`,
        upload_file_id: uploadFileId,
      },
    },
    response_mode: `streaming`,
    user: `md-editor`,
  }
  const res = await fetch(url, {
    method: `POST`,
    headers: {
      ...(useDifyBackend ? {} : { Authorization: `Bearer ${apiKey}` }),
      'Content-Type': `application/json`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `工作流启动失败: ${res.status}`)
  }
  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error(`无法读取响应流`)
  }
  const decoder = new TextDecoder()
  let buffer = ``
  let workflowRunId: string | null = null
  try {
    while (workflowRunId == null) {
      const { done, value } = await reader.read()
      if (done)
        break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ``
      for (const line of lines) {
        const dataMatch = line.match(/^data:\s*(.+)$/)
        if (!dataMatch)
          continue
        const raw = dataMatch[1].trim()
        if (raw === `[DONE]` || raw === ``)
          continue
        try {
          const data = JSON.parse(raw) as any
          const id = data?.workflow_run_id ?? data?.data?.workflow_run_id ?? data?.task_id
          if (id && typeof id === `string`) {
            workflowRunId = id
            controller.abort()
            break
          }
        }
        catch {
          // ignore parse error
        }
      }
    }
  }
  catch (e: any) {
    if (e?.name === `AbortError` && workflowRunId)
      return workflowRunId
    throw e
  }
  finally {
    reader.releaseLock()
  }
  if (!workflowRunId) {
    throw new Error(`未从流式响应中获取到 workflow_run_id，请确认 Dify 返回格式`)
  }
  return workflowRunId
}

/** 轮询工作流运行结果，直到成功或失败（适合 5–10 分钟无中间输出的长任务） */
async function pollWorkflowResult(
  baseUrl: string,
  apiKey: string,
  workflowRunId: string,
  outputKey: string,
  intervalMs: number = 10000,
  maxRetries: number = 90,
): Promise<string> {
  const base = useDifyBackend ? window.location.origin : normalizeBaseUrl(baseUrl)
  const url = useDifyBackend
    ? `${base}/api/dify/workflows/run/${workflowRunId}`
    : `${base}/workflows/run/${workflowRunId}`
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, {
      method: `GET`,
      headers: useDifyBackend ? {} : { Authorization: `Bearer ${apiKey}` },
    })
    if (res.status === 500) {
      await new Promise(r => setTimeout(r, intervalMs))
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `查询运行状态失败: ${res.status}`)
    }
    const data = await res.json() as any
    const status = data?.status ?? data?.data?.status
    if (status === `succeeded`) {
      const outputs = data?.outputs ?? data?.data?.outputs
      const output = outputs?.[outputKey]
      if (output == null) {
        throw new Error(`响应中未找到输出 "${outputKey}"`)
      }
      return typeof output === `string` ? output : JSON.stringify(output)
    }
    if (status === `failed` || status === `stopped`) {
      const err = data?.error ?? data?.message ?? data?.data?.error ?? `工作流 ${status}`
      throw new Error(typeof err === `string` ? err : JSON.stringify(err))
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`轮询超时（约 ${Math.round((maxRetries * intervalMs) / 60000)} 分钟），工作流可能仍在运行，请稍后在 Dify 后台查看结果`)
}

/** 运行 Dify 工作流：先 streaming 启动拿到 run_id，再轮询结果（避免长时间阻塞超时） */
async function runWorkflow(
  baseUrl: string,
  apiKey: string,
  fileInputKey: string,
  uploadFileId: string,
  outputKey: string,
): Promise<string> {
  const controller = new AbortController()
  const workflowRunId = await startWorkflowAndGetRunId(
    baseUrl,
    apiKey,
    fileInputKey,
    uploadFileId,
    controller,
  )
  return pollWorkflowResult(baseUrl, apiKey, workflowRunId, outputKey)
}

async function runService() {
  const svc = selectedService.value
  if (!svc) {
    errorMsg.value = `请先选择左侧服务`
    return
  }
  const apiKey = editApiKey.value.trim()
  if (!useDifyBackend && !apiKey) {
    errorMsg.value = `请填写 API Key`
    return
  }
  const file = selectedFile.value
  if (!file) {
    errorMsg.value = `请选择要上传的 PDF 文件`
    return
  }
  const baseUrl = normalizeBaseUrl(editBaseUrl.value)
  const fileInputKey = svc.fileInputKey ?? `paper`
  const outputKey = svc.outputKey ?? `oneOutput`
  const defaultTitle = svc.defaultTitle ?? `AI 结果`

  loading.value = true
  errorMsg.value = ``

  try {
    const fileId = await uploadFile(baseUrl, apiKey, file)
    const content = await runWorkflow(baseUrl, apiKey, fileInputKey, fileId, outputKey)
    postStore.addPostWithContent(defaultTitle, content)
    uiStore.toggleAIDialog(false)
  }
  catch (e: any) {
    errorMsg.value = e?.message ?? String(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="onUpdate">
    <DialogContent
      class="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      @pointer-down-outside="ev => ev.preventDefault()"
    >
      <DialogHeader class="shrink-0 border-b px-6 py-4">
        <DialogTitle class="flex items-center gap-2">
          <Bot class="h-5 w-5" />
          AI
        </DialogTitle>
        <DialogDescription>
          选择「Dify 工作流」或「AI 生图」进入对应页面
        </DialogDescription>
      </DialogHeader>

      <ResizablePanelGroup direction="horizontal" class="min-h-[360px] flex-1">
        <ResizablePanel :default-size="26" :min-size="20" class="border-r">
          <div class="flex flex-col gap-1 p-3">
            <div class="mb-1 text-sm font-medium text-muted-foreground">
              选择页面
            </div>
            <button
              type="button"
              class="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              :class="{ 'bg-accent': selectedPage === 'dify' }"
              @click="goToDifyPage"
            >
              <Workflow class="h-4 w-4 shrink-0" />
              Dify 工作流
            </button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              :class="{ 'bg-accent': selectedPage === 'gemini-image' }"
              @click="goToGeminiImagePage"
            >
              <ImageIcon class="h-4 w-4 shrink-0" />
              AI 生图
            </button>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel :default-size="74">
          <!-- AI 生图：独立页面，仅展示 Gemini 生图表单 -->
          <div v-if="selectedPage === 'gemini-image'" class="h-full overflow-auto p-4">
            <GeminiImageTab />
          </div>
          <!-- Dify 工作流：独立页面，内部分栏为「服务列表 + 表单」 -->
          <template v-else-if="selectedPage === 'dify'">
            <ResizablePanelGroup direction="horizontal" class="h-full min-h-[360px]">
              <ResizablePanel :default-size="32" :min-size="24" class="border-r">
                <div class="flex flex-col gap-1 p-3">
                  <div class="mb-1 text-sm font-medium text-muted-foreground">
                    选择服务
                  </div>
                  <button
                    v-for="svc in services"
                    :key="svc.id"
                    type="button"
                    class="rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    :class="{ 'bg-accent': selectedService?.id === svc.id }"
                    @click="selectDifyService(svc)"
                  >
                    {{ svc.name }}
                  </button>
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel :default-size="68">
                <div class="flex flex-col gap-4 p-4">
                  <template v-if="selectedService">
                    <div class="space-y-2">
                      <Label for="ai-base-url">Base URL</Label>
                      <Input
                        id="ai-base-url"
                        v-model="editBaseUrl"
                        placeholder="https://api.dify.ai/v1"
                      />
                    </div>
                    <div class="space-y-2">
                      <Label for="ai-api-key">API Key (Dify App Key)</Label>
                      <Input
                        id="ai-api-key"
                        v-model="editApiKey"
                        type="password"
                        placeholder="app-xxx"
                      />
                    </div>
                    <div class="space-y-2">
                      <Label>上传 PDF</Label>
                      <div class="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf,application/pdf"
                          class="cursor-pointer"
                          @change="onFileChange"
                        />
                        <FileUp class="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <p v-if="selectedFile" class="text-xs text-muted-foreground">
                        已选: {{ selectedFile.name }}
                      </p>
                    </div>
                    <div v-if="errorMsg" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {{ errorMsg }}
                    </div>
                    <Button
                      class="w-fit"
                      :disabled="loading"
                      @click="runService"
                    >
                      <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
                      {{ loading ? '调用中…' : '调用并写入内容' }}
                    </Button>
                  </template>
                  <div v-else class="flex flex-1 items-center justify-center py-8 text-muted-foreground">
                    请在左侧选择一项 Dify 服务
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </template>
          <div v-else class="flex flex-1 items-center justify-center text-muted-foreground">
            请在左侧选择「Dify 工作流」或「AI 生图」
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </DialogContent>
  </Dialog>
</template>
