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

const envRemote = import.meta.env.VITE_USE_REMOTE_STORAGE
const useRemoteStorage = envRemote === 'true'
console.warn('[MD Storage] main.ts: VITE_USE_REMOTE_STORAGE =', JSON.stringify(envRemote), '→ useRemoteStorage =', useRemoteStorage)
if (useRemoteStorage) {
  store.setEngine(new RestfulStorageEngine(`${window.location.origin}/api`))
  console.warn('[MD Storage] main.ts: RestfulStorageEngine set, baseURL =', `${window.location.origin}/api`)
}

// 异步初始化 mermaid，避免初始化顺序问题
initializeMermaid().catch(console.error)

setupComponents()

const app = createApp(App)
app.use(createPinia())

async function bootstrap() {
  console.warn('[MD Storage] bootstrap() started, useRemoteStorage =', useRemoteStorage)
  if (!useRemoteStorage) {
    console.warn('[MD Storage] bootstrap: skip preload (not remote), mounting app')
    app.mount(`#app`)
    return
  }
  const postsKey = addPrefix('posts')
  const currentIdKey = addPrefix('current_post_id')
  console.warn('[MD Storage] bootstrap: preload GET for keys', postsKey, currentIdKey)
  const timeout = new Promise<void>(r => setTimeout(r, 8000))
  const load = Promise.all([
    store.getJSON(postsKey, []),
    store.get(currentIdKey),
  ]).then(() => {
    console.warn('[MD Storage] bootstrap: preload GET promises resolved')
  })
  await Promise.race([load, timeout])
  console.warn('[MD Storage] bootstrap: preload done, mounting app')
  app.mount(`#app`)
}

bootstrap().catch((err) => {
  console.error('[MD Storage] bootstrap failed:', err)
  app.mount(`#app`)
})
