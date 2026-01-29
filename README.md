# Markdown 编辑器

Markdown 编辑器核心，支持 Markdown 语法渲染。

## 开发

```sh
# 安装依赖
pnpm i

# 启动开发模式
pnpm start
# 或
pnpm web dev

# 访问 http://localhost:5173/md/

# 构建
pnpm web build
```

## 部署到 GitHub Pages

前端支持通过 GitHub Actions 部署到 GitHub Pages（项目站点：`https://<用户名>.github.io/<仓库名>/`）。

1. **启用 GitHub Pages**  
   仓库 → Settings → Pages → Source 选择 **GitHub Actions**。

2. **工作流**  
   已提供 `.github/workflows/deploy-github-pages.yml`：在向 `main` 分支推送或手动触发时，会使用 `BASE_PATH=/<仓库名>/` 构建前端，并将 `apps/web/dist` 部署到 GitHub Pages。

3. **自定义域名（可选）**  
   在仓库 Settings → Secrets and variables → Actions 中新增 Secret `CUSTOM_DOMAIN`，值为你的域名（如 `md.example.com`）。工作流会在构建产物中生成 `CNAME`，并在 GitHub Pages 设置里把自定义域名指向该仓库即可。

4. **本地预览与 base**  
   开发默认 base 为 `/md/`。部署到 GitHub Pages 时 base 由 CI 自动设为 `/<仓库名>/`；若需本地模拟，可执行：  
   `BASE_PATH=/你的仓库名/ pnpm web build`，再用任意静态服务器预览 `apps/web/dist`。

## 图片生成器

在「插入」菜单中提供「图片生成器」入口，以弹窗形式提供三种生成器（选项卡切换）：

- **名片生成器**：姓名、别称、联系方式、单位等，导出 1100×620 名片图
- **封面生成器**：公众号左右双封面标题与背景，导出 1283×383 封面图
- **海报生成器**：栏目名、主标题、摘录、人物信息等，导出 1242×1660 海报图

**缓存机制**：各生成器的表单数据（文本、字号、间距、上传图片的 Data URL 等）通过 `localStorage` 持久化（键前缀 `MD__generator_*`），关闭弹窗后再次打开会恢复上次编辑内容。

**图片上传**：生成后直接上传到默认图床（腾讯云 COS）并将 `![](url)` 插入当前文档开头，不触发浏览器下载。开发环境下通过 Vite 代理上传以规避 CORS；生产部署时需在腾讯云 COS 控制台为存储桶配置 CORS，允许站点来源（如 `https://你的域名`）。

## 项目结构

- `apps/web/` - Web 应用核心
- `packages/core/` - Markdown 渲染核心
- `packages/shared/` - 共享工具和配置
- `packages/config/` - TypeScript 配置
