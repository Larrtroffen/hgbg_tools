<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Toaster } from '@/components/ui/sonner'
import { useUIStore } from '@/stores/ui'
import { addPrefix } from '@/utils'
import { store } from '@/utils/storage'
import CodemirrorEditor from '@/views/CodemirrorEditor.vue'

defineOptions({ components: { Toaster } })
const uiStore = useUIStore()
const { isDark } = storeToRefs(uiStore)

// 远程存储：先触发 GET 拉取 posts/current_post_id，再渲染编辑器，保证刷新/他人访问时能拿到数据
const useRemoteStorage = import.meta.env.VITE_USE_REMOTE_STORAGE === 'true'
const storageReady = ref(!useRemoteStorage)

onMounted(async () => {
  if (!useRemoteStorage)
    return
  const timeout = new Promise<void>(r => setTimeout(r, 8000))
  const load = Promise.all([
    store.getJSON(addPrefix('posts'), []),
    store.get(addPrefix('current_post_id')),
  ]).then(() => {})
  await Promise.race([load, timeout])
  storageReady.value = true
})
</script>

<template>
  <AppSplash />
  <CodemirrorEditor v-if="storageReady" />
  <div v-else class="storage-loading">
    <p>正在从服务器加载数据…</p>
  </div>
  <Toaster
    rich-colors
    position="top-center"
    :theme="isDark ? 'dark' : 'light'"
  />
</template>

<style lang="less">
html,
body,
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
}

// 抵消下拉菜单开启时带来的样式
body {
  pointer-events: initial !important;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  background-color: rgba(243, 244, 247, 0.5);
}

::-webkit-scrollbar-track {
  border-radius: 6px;
  background-color: rgba(200, 200, 200, 0.3);
}

::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background-color: rgba(144, 146, 152, 0.5);
}

/* CSS-hints */
.CodeMirror-hints {
  position: absolute;
  z-index: 10;
  overflow-y: auto;
  margin: 0;
  padding: 2px;
  border-radius: 4px;
  max-height: 20em;
  min-width: 200px;
  font-size: 12px;
  font-family: monospace;

  color: #333333;
  background-color: #ffffff;
  box-shadow:
    0 4px 8px 0 rgba(0, 0, 0, 0.12),
    0 2px 4px 0 rgba(0, 0, 0, 0.08);
}

.CodeMirror-hint {
  margin-top: 10px;
  padding: 4px 6px;
  border-radius: 2px;
  white-space: pre;
  color: #000000;
  cursor: pointer;

  &:first-of-type {
    margin-top: 0;
  }
  &:hover {
    background: #f0f0f0;
  }
}
.search-match {
  background-color: #ffeb3b; /* 所有匹配项颜色 */
}
.current-match {
  background-color: #ff5722; /* 当前匹配项更鲜艳的颜色 */
}

.storage-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-secondary, #666);
  font-size: 14px;
}
</style>
