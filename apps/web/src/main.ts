import { initializeMermaid } from '@md/core/utils'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { addPrefix } from '@/utils'

import App from './App.vue'
import { setupComponents } from './utils/setup-components'
import { RestfulStorageEngine, store } from './utils/storage'

import 'vue-sonner/style.css'

/* 每个页面公共css */
import '@/assets/index.css'
import '@/assets/less/theme.less'

const useRemoteStorage = import.meta.env.VITE_USE_REMOTE_STORAGE === 'true'
if (useRemoteStorage) {
  store.setEngine(new RestfulStorageEngine(`${window.location.origin}/api`))
}

// 异步初始化 mermaid，避免初始化顺序问题
initializeMermaid().catch(console.error)

setupComponents()

const app = createApp(App)
app.use(createPinia())

async function bootstrap() {
  if (!useRemoteStorage) {
    app.mount(`#app`)
    return
  }
  const timeout = new Promise<void>(r => setTimeout(r, 8000))
  const load = Promise.all([
    store.getJSON(addPrefix('posts'), []),
    store.get(addPrefix('current_post_id')),
  ]).then(() => {})
  await Promise.race([load, timeout])
  app.mount(`#app`)

  // 页面关闭前强制保存，减少未上传编辑丢失
  window.addEventListener(`beforeunload`, () => {
    store.flushReactiveKeys([addPrefix(`posts`), addPrefix(`current_post_id`)])
  })

  // 多端同步：切回标签页且曾隐藏超过 2s 时拉取最新（参考 Remote Save 的可见性刷新，减少误覆盖本地未保存编辑）
  let hiddenAt: number | null = null
  document.addEventListener(`visibilitychange`, () => {
    if (document.visibilityState === `hidden`) {
      hiddenAt = Date.now()
      return
    }
    if (document.visibilityState !== `visible` || hiddenAt == null)
      return
    if (Date.now() - hiddenAt < 2000)
      return
    store.refreshKey(addPrefix(`posts`)).catch(console.error)
    store.refreshKey(addPrefix(`current_post_id`)).catch(console.error)
  })
}

bootstrap().catch(() => {
  app.mount(`#app`)
})
