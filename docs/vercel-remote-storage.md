# Vercel 免费部署与数据持久化指南

本文说明如何将本项目的前端与后端在 Vercel 上免费部署，并实现**所有数据的持久化存储**（使用 Upstash Redis）。

---

## 一、当前架构与数据持久化

### 1. 数据持久化已实现

- **后端**：`api/storage/` 目录下的 Vercel Serverless 函数，提供 REST 风格存储接口：
  - `GET /api/storage/keys`：列出所有 key
  - `GET /api/storage/[key]`：读取
  - `PUT /api/storage/[key]`：写入
  - `DELETE /api/storage/[key]`：删除
  - `DELETE /api/storage`：清空
- **存储介质**：Upstash Redis（REST API），数据按 Upstash 策略持久保存。
- **前端**：当 `VITE_USE_REMOTE_STORAGE=true` 时，使用 `RestfulStorageEngine`，请求同源的 `/api`，即所有 store 数据（文件、内容、主题等）都走远程存储，实现持久化。

### 2. 前端与后端在 Vercel 上的关系

- **一次部署**：Vercel 会同时部署「静态前端」和「`api/` 下的 Serverless 函数」。
- **同域**：前端和 API 都在同一域名下（如 `https://xxx.vercel.app`），前端用 `window.location.origin + '/api'` 访问 API，无需跨域。
- **路由**：`vercel.json` 中通过 `rewrites` 将非 `/api` 的请求落到 `index.html`（SPA），`/api/*` 不参与该重写，由 Serverless 函数处理。

---

## 二、Vercel 免费部署步骤

### 1. 准备仓库与 Vercel 项目

1. 将代码推送到 **GitHub**（或 GitLab/Bitbucket）。
2. 登录 [Vercel](https://vercel.com)，点击 **Add New → Project**，导入该仓库。
3. 保持默认 **Root Directory** 为仓库根目录，**Framework Preset** 可留空（项目用 `vercel.json` 指定构建方式）。

### 2. 配置 Upstash Redis（数据持久化必备）

1. 打开 [Vercel 集成 - Upstash](https://vercel.com/integrations/upstash)。
2. 点击 **Add Integration**，选择**当前要部署的 Vercel 项目**。
3. 选择 **Create New Upstash Account**（或绑定已有账号），完成授权。
4. 在 Upstash 中创建一个 **Redis 数据库**，区域选免费可用区即可。
5. 集成完成后，Vercel 会为该项目自动注入环境变量：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

无需在代码或 `.env` 中写这两个变量，仅由 Vercel 在运行时提供给 `api/storage/*`。

### 3. 确认 / 检查项目配置

仓库中已具备：

| 项                     | 说明                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **vercel.json**        | `buildCommand`、`outputDirectory`、`installCommand`、`env.VITE_USE_REMOTE_STORAGE=true`、`rewrites`（已排除 `/api`，避免 API 被重写到 index.html） |
| **package.json**（根） | 含 `@upstash/redis`、`@vercel/node`                                                                                                                |
| **api/**               | Serverless 入口：`api/storage/index.ts`、`api/storage/keys.ts`、`api/storage/[key].ts`                                                             |
| **apps/web**           | 前端 SPA，构建输出到 `apps/web/dist`                                                                                                               |

无需修改即可部署；若你自定义了 `installCommand` 或 `buildCommand`，请确保能正确安装依赖并执行 `pnpm web run build:h5-netlify`。

### 4. 部署

- **方式一**：在 Vercel 项目里连接 Git 后，每次推送到对应分支会自动构建并部署。
- **方式二**：本地安装 Vercel CLI（`npm i -g vercel`），在项目根目录执行 `vercel`，按提示关联项目并部署。

部署完成后，访问分配的域名（如 `https://xxx.vercel.app`）。
此时前端会使用远程存储，所有数据持久化在 Upstash Redis 中，且同一项目下的访问者共享同一份数据。

---

## 三、开箱即用：图床（腾讯云 COS）与 Dify 工作流

当 `VITE_USE_REMOTE_STORAGE=true` 时，前端会**自动使用服务端代理**，访客无需自行配置密钥即可使用：

- **图床（腾讯云 COS）**：选择「腾讯云」图床时，上传请求会走 `/api/upload/cos`，由服务端用环境变量中的 COS 配置上传，返回图片地址。
- **Dify 工作流**：在 AI 面板选择「Dify 工作流」并选择「文章编译」等服务时，文件上传与工作流调用会走 `/api/dify/files/upload`、`/api/dify/workflows/run` 等接口，由服务端注入 Dify API Key，访客无需填写 Key。

在 Vercel 项目 **Settings → Environment Variables** 中配置以下变量后，所有访问该站点的人即可直接使用图床与 Dify 工作流：

| 变量名                   | 说明                                  | 必填                   |
| ------------------------ | ------------------------------------- | ---------------------- |
| **腾讯云 COS（图床）**   |                                       |                        |
| `TENCENT_COS_SECRET_ID`  | 腾讯云 SecretId                       | 使用图床时必填         |
| `TENCENT_COS_SECRET_KEY` | 腾讯云 SecretKey                      | 使用图床时必填         |
| `TENCENT_COS_BUCKET`     | 存储桶名称（如 `xxx-1257068422`）     | 使用图床时必填         |
| `TENCENT_COS_REGION`     | 地域（如 `ap-shanghai`）              | 使用图床时必填         |
| `TENCENT_COS_PATH`       | 可选，对象键前缀                      | 可选                   |
| `TENCENT_COS_CDN_HOST`   | 可选，CDN 域名，返回的 URL 将以此为准 | 可选                   |
| **Dify 工作流**          |                                       |                        |
| `DIFY_API_KEY`           | Dify 应用 API Key（App Key）          | 使用 Dify 工作流时必填 |
| `DIFY_BASE_URL`          | 可选，默认 `https://api.dify.ai/v1`   | 可选                   |

- 未配置 COS 时：访客若选择腾讯云图床，会收到「COS not configured」类提示，可在图床设置中自行填写 COS 或改用其他图床。
- 未配置 Dify 时：访客使用 Dify 工作流会收到「Dify not configured」类提示，可在 AI 面板中自行填写 API Key 使用（此时走前端直连，需自行保管 Key）。

---

## 四、环境变量与「仅生产启用远程存储」

- 当前 **vercel.json** 的 `env` 中已设置 `VITE_USE_REMOTE_STORAGE=true`，对所有通过该配置触发的构建生效（包括 Production 和部分 Preview）。
- 若你希望**仅在 Production 使用远程存储**：
  - 可删除 `vercel.json` 里的 `env.VITE_USE_REMOTE_STORAGE`；
  - 在 Vercel 后台 **Settings → Environment Variables** 中，仅给 **Production** 添加：
    - 名称：`VITE_USE_REMOTE_STORAGE`
    - 值：`true`
      这样 Preview/Development 不设该变量，前端会回退到 localStorage。

---

## 五、数据与安全

- **持久化**：数据保存在 Upstash Redis，按 Upstash 策略持久存储。
- **共享范围**：同一 Vercel 项目、同一 Upstash 数据库下的用户共享同一套 key-value（即所有走 store 的内容）。
- **访问控制**：当前 API 无鉴权，任何人知道站点地址即可读写。若需按用户隔离或限制写入，需在 `api/storage/*` 中自行增加鉴权（如 Cookie、JWT 等）。

---

## 六、未配置 Upstash 或本地开发

- **未在 Vercel 配置 Upstash**：`/api/storage/*` 会因缺少 `UPSTASH_REDIS_REST_*` 而报错。此时可在 Vercel 环境变量中不设置 `VITE_USE_REMOTE_STORAGE`（或设为非 `true`），仅部署前端，使用本地 localStorage。
- **本地**：不设置 `VITE_USE_REMOTE_STORAGE` 或设为非 `true` 时，前端使用 **localStorage**，与原有行为一致。

---

## 七、免费额度与费用

- **Vercel**：Hobby 计划下，个人项目在免费额度内即可部署前端 + Serverless API。
- **Upstash Redis**：免费档有每日请求与数据量限制，个人或小团队共享一份编辑数据一般够用；超出后可考虑 Upstash 付费计划。

按上述步骤即可在 Vercel 上免费完成前后端部署，并实现全部数据的持久化存储。
