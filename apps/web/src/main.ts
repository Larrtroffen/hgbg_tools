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

// 远程存储：在挂载前先发 GET 拉取数据，刷新时网络里一定能看到 GET
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
}

bootstrap()
