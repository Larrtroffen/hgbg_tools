import { initializeMermaid } from '@md/core/utils'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

import { setupComponents } from './utils/setup-components'
import { RestfulStorageEngine, store } from './utils/storage'

import 'vue-sonner/style.css'

/* 每个页面公共css */
import '@/assets/index.css'
import '@/assets/less/theme.less'

// 使用远程存储时，所有访问者共享同一份数据（需在 Vercel 等环境配置 VITE_USE_REMOTE_STORAGE=true）
if (import.meta.env.VITE_USE_REMOTE_STORAGE === 'true') {
  store.setEngine(new RestfulStorageEngine(`${window.location.origin}/api`))
}

// 异步初始化 mermaid，避免初始化顺序问题
initializeMermaid().catch(console.error)

setupComponents()

const app = createApp(App)

app.use(createPinia())

app.mount(`#app`)
