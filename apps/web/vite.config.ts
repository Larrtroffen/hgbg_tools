import path from 'node:path'
import process from 'node:process'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePluginRadar } from 'vite-plugin-radar'
import vueDevTools from 'vite-plugin-vue-devtools'

const isNetlify = process.env.SERVER_ENV === `NETLIFY`
const isCfWorkers = process.env.CF_WORKERS === `1`
const isCfPages = process.env.CF_PAGES === `1`
// GitHub Pages 项目站点：BASE_PATH 由 CI 传入，如 /repo-name/
const basePath = process.env.BASE_PATH

const base = basePath !== undefined && basePath !== ''
  ? basePath
  : (isNetlify || isCfWorkers || isCfPages ? `/` : `/md/`)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    base,
    define: { process },
    envPrefix: [`VITE_`, `CF_`],
    plugins: [
      vue(),
      isCfWorkers && cloudflare(),
      tailwindcss(),
      vueDevTools({
        launchEditor: env.VITE_LAUNCH_EDITOR ?? `code`,
      }),
      !isCfWorkers && nodePolyfills({
        include: [`path`, `util`, `timers`, `stream`, `fs`],
        overrides: {
        // Since `fs` is not supported in browsers, we can use the `memfs` package to polyfill it.
        // fs: 'memfs',
        },
      }),
      VitePluginRadar({
        analytics: { id: `G-7NZL3PZ0NK` },
      }),
      ...(process.env.ANALYZE === `true` ? [visualizer({ emitFile: true, filename: `stats.html` }) as any] : []),
      AutoImport({
        imports: [`vue`, `pinia`, `@vueuse/core`],
        dirs: [`./src/stores`, `./src/utils/toast`, `./src/composables`],
      }),
      Components({
        resolvers: [],
      }),
      // 开发环境：代理 COS 上传，避免浏览器直连 COS 的 CORS 限制
      {
        name: 'cos-upload-proxy',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const path = req.url?.split('?')[0]
            if (req.method !== 'POST' || (path !== '/__cos_upload' && path !== '/md/__cos_upload'))
              return next()
            const presignedUrl = req.headers['x-presigned-url'] as string
            if (!presignedUrl?.startsWith('http')) {
              res.statusCode = 400
              res.end('Missing X-Presigned-Url')
              return
            }
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              const body = Buffer.concat(chunks)
              fetch(presignedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': (req.headers['content-type'] as string) || 'application/octet-stream' },
                body: new Uint8Array(body),
              })
                .then((proxyRes) => {
                  res.statusCode = proxyRes.status
                  if (!proxyRes.ok)
                    return proxyRes.text().then((t) => { res.end(t || proxyRes.statusText) })
                  return proxyRes.arrayBuffer().then((buf) => {
                    res.end(Buffer.from(buf))
                  })
                })
                .catch((err) => {
                  res.statusCode = 502
                  res.end(String((err as Error).message))
                })
            })
            req.on('error', next)
          })
        },
      },
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, `./src`) },
    },
    optimizeDeps: {
      include: ['source-map-js'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    css: { devSourcemap: true },
    build: {
      rollupOptions: {
        external: [`mermaid`],
        output: {
          chunkFileNames: `static/js/md-[name]-[hash].js`,
          entryFileNames: `static/js/md-[name]-[hash].js`,
          assetFileNames: `static/[ext]/md-[name]-[hash].[ext]`,
          globals: { mermaid: `mermaid` },
          manualChunks(id) {
            if (id.includes(`node_modules`)) {
              if (id.includes(`katex`))
                return `katex`
              if (id.includes(`codemirror`))
                return `codemirror`
              if (id.includes(`prettier`))
                return `prettier`
              const pkg = id
                .split(`node_modules/`)[1]
                .split(`/`)[0]
                .replace(`@`, `npm_`)
              return `vendor_${pkg}`
            }
          },
        },
      },
    },
  }
})
