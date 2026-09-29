# Folio · 纯前端简历工作室

一个本地优先的简历编辑器。React + TypeScript + Vite，不需要服务器、账户、API Key 或数据库服务。全部数据留在浏览器 IndexedDB，部署产物为纯静态文件。

## 启动

需要 Node.js 22.12+ 与 pnpm 12.6.0（项目 `packageManager` 固定版本）。

```sh
pnpm install
pnpm dev
# http://127.0.0.1:5173
```

```sh
pnpm test                 # 协议、安全 Markdown、字体分片、GitHub 卡片、分页与布局测试
pnpm format:check         # 检查统一代码格式
pnpm snapshot:github      # 预取 github-repos.json 中的公开仓库（可选，需要外网）
pnpm build                # 严格 TypeScript 检查 + 生产打包
pnpm exec playwright install chromium
pnpm test:e2e             # Chromium 浏览器集成与导出测试
pnpm preview              # 本地检查 dist 部署产物
```

若测试浏览器下载不可用，可使用本机 Chrome：PowerShell 执行 `$env:PLAYWRIGHT_CHANNEL='chrome'; pnpm test:e2e`；POSIX Shell 使用 `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`。该方式启动独立无头实例。仓库固定间接依赖 browserslist 4.28.0，避免最初安装时刚发布版本触发 pnpm 发布时间保护；升级时保留正常发布时间策略并重新验证。

## 功能

- 工作台品牌与浏览器标签使用 `public/folio.svg`。新建简历默认显示 `public/avatar.webp`；「基本信息 → 使用默认头像」可恢复，替换或移除后刷新会保留选择。默认头像首次使用时转为本地 PNG data URL，导出文件无需访问图片路径。
- 基本信息支持电话、邮箱、性别、GitHub、网站、民族、出生日期、政治面貌、籍贯、户籍、城市和工作年限等**预设字段**；字段可改名（例如把「出生日期」改成「生日」）、换图标、上下移动、删除，也可插入预设或空白字段。非空字段带图标，可选 1–3 列及信息区域宽度，长内容自动换行。
- 头像与二维码独立于章节：在「头像与二维码」设置页码、尺寸和坐标，或直接在预览中自由拖动（支持跨已有页面）、用方向键微调。Shift + 拖动锁定水平或垂直方向（轴向由起始移动量决定），Shift + 方向键移动 10 px。头像保留圆形/方形裁切与取景缩放；二维码完整显示白边。
- 文本、工作经历、项目经历、教育背景四类模块。经历以独立条目填写单位/学校/项目、角色/学历、专业、时间、地点与 Markdown 详情；分别使用「添加工作经历」「添加项目」「添加教育背景」。可增删、上下移动条目，选择左右或左中右紧凑布局，日期与地点同行呈现，空间不足自然换行。
- 项目条目可附加 GitHub 仓库卡片（作者头像、名称、作者、简介、语言、Star / Fork）。默认离线：可用构建时预取的公开仓库快照，或手动填写；需要关键词搜索或刷新 Star 时打开联网开关（GitHub API 需要外网），并可填写自建 HTTPS 代理加速。作者头像在查询时抓取一次并转成本地图片存档，之后卡片、备份与导出都不再联网；简历上不显示快照日期。
- Markdown 支持加粗、斜体、高亮 `==内容==`、行内代码及格式嵌套。工具栏、Ctrl/Cmd+B / I、Tab 列表缩进。为简历安全和可移植性，禁用任意 HTML 样式、脚本、外部图片和嵌入内容。
- 拖动模块排序；上移/下移按钮支持键盘操作。整行/半行布局、显示隐藏、模块前换页。相邻半行模块组成一行。浮动图片不占正文空间，请主动留白；指向尚不存在的页会新增空白页。
- 「样式 → 页眉与页脚」可编辑或独立关闭页眉、页脚标识 / ID、页码；页码格式支持 `{page}`、`{pages}`。工作台主要控件字号提升至 14px，辅助文字至少 12px；预览缩放独立于简历纸张排版。
- 颜色分层设置：姓名、每个模块的标题（含标题图标）与正文都能单独取色，「样式 → 主题色」是全局默认值；未单独设置的元素跟随主题色，取色器旁的「跟随全局」把元素退回继承状态。
- 三套模板：青序、书简、构筑。模板切换不修改正文、图片、标题及字体；会重设模块初始栏宽。
- 侧栏底部提供仓库与作者入口：GitHub 图标指向 `sun2ot/folio`（标注作者 sun2ot），地球图标指向作者博客 abdc.net.cn。
- 220ms 防抖实时预览，也可手动更新；500ms 防抖自动保存；40 步会话内撤销重做（连续输入合并）。
- PDF、可离线查看的独立 HTML、完整 JSON 数据导出及校验导入。

## 导出与兼容性

预览、分页、HTML、PDF 和打印共用 `src/resume.css` 与 `ResumeView`。纸张为 A4，内部画布固定 794 × 1122 CSS px，不随编辑器缩放改变排版。

**保真 PDF**：html2canvas 以 2 倍分辨率逐页绘制，jsPDF 写入 A4。复用预览 DOM，在无缩放、无滚动裁切的临时容器中生成，避免后续页坐标偏移。逐页释放画布避免超长 canvas 的浏览器尺寸限制。等待字体与图片解码，导出时冻结编辑器。输出为图片型 PDF，文字不可选择、不能保证 ATS 自动解析。高级 CSS 渲染受 html2canvas 支持范围限制；新增样式需做视觉回归。推荐招聘系统使用下述文字版。

**打印 / 文字 PDF**：浏览器原生打印保留可选择文字与链接。选择「另存为 PDF」、A4、缩放 100%、无边距、开启背景图形、关闭页眉页脚。不同浏览器和打印驱动可能产生细微差异，不声称所有平台像素一致。

**HTML**：只内嵌正文实际用到的字体分片和上传图片，不含应用 JavaScript、编辑器或网络依赖；保留多页布局、Markdown 链接和打印样式。文件约数百 KB 至数 MB，取决于字符数与图片。

**分页**：以整模块/双栏行分页，不切开二维码和段落。单模块高于一页时给出警告并阻止排版导出，请拆为两个模块或减小字号。JSON 备份仍可导出。不自动压缩到不可阅读的字号。

目标浏览器为现代 Chromium、Firefox、Safari，使用 IndexedDB、HTML dialog、CSS zoom、Font Loading API。自动化默认覆盖 Chromium；Firefox/Safari 需在发布前按 `docs/TESTING.md` 手动验证。手机可编辑与预览；大屏更适合完整排版。

## 数据与隐私

- 当前协议为 v4，IndexedDB 键 `folio.resume.v4`。开发阶段不兼容或迁移旧数据；旧 JSON 会拒绝导入，旧存储键不读取或覆盖。相同站点、相同浏览器保留数据；更换域名/浏览器、清理站点数据或隐私模式退出会影响保存。
- 等待顶栏显示「已保存在此浏览器」再关闭页面。保存失败时会明确显示错误，建议立即导出 JSON。
- 无统计追踪、上传 API、外部字体 CDN。上传图片转换为本地 PNG；只允许 PNG/JPEG/WebP，单文件最大 5 MB，解码后最大 4000 万像素。
- 唯一的外网请求是用户显式开启的 GitHub 仓库查询与作者头像抓取，只发送仓库标识或搜索关键词；头像一次抓取后存为本地图片。离线快照、手动卡片与所有导出都不联网。代理地址仅保存在当前会话内存中，不写入文档或备份。
- JSON 文件最大 30 MB，协议校验版本、类型、唯一 ID、唯一字段键、颜色、字号、图片 data URL 及图片坐标边界。最大 80 个模块，每个经历模块最多 30 个条目，每段 Markdown 最多 30,000 字符。导入失败不替换当前文档。
- 导入会替换当前文档，可立即撤销；跨设备迁移请导出后导入 JSON。备份含个人信息与图片，请自行妥善保管。暂不提供多文档库、多人协作、云同步和跨标签页冲突合并。

## 字体

中文：Noto Sans SC（思源黑体）、Noto Serif SC（思源宋体）；英文：Inter、Source Serif 4。通过 Fontsource 依赖本地打包，中文使用简体字集。罕见字和其他语言会回退到系统字体，需检查最终效果。为控制体积只装载 400 常规字重，粗体及斜体由浏览器合成。

字体按 unicode-range 拆分为 300 多个分片。预览时浏览器只下载命中的分片；构建产物仍包含全部资源文件，但不会一次加载。HTML 导出不嵌入整套字体：`build/fonts.ts` 把 `@font-face` 规则编译成 `virtual:folio-fonts` 模块，导出时按文档实际字符筛选分片再内嵌，文件大小与正文字符数相关。切换字体后请重新导出以刷新嵌入内容。

字体许可均随上游包提供。`pnpm build` 的资源分发应同时保留本项目 `public/licenses/` 中的字体许可文件。第三方依赖许可见对应包；参考 `docs/THIRD_PARTY.md`。

## 静态部署

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

上传 **dist 目录内容** 到任何静态 Web 服务。Vite `base: './'` 支持域名根目录和子路径。无客户端路由，无需 SPA rewrite；不要直接双击 `dist/index.html`（开发产物的模块与字体需 HTTP 服务）。

- **Nginx**：将 dist 复制到站点 root，`index index.html;`。`/assets/` 可设置长期 immutable 缓存，`index.html` 设为 no-cache；启用 HTTPS 与 gzip/Brotli。
- **Cloudflare Pages / Netlify / Vercel**：安装命令 `pnpm install --frozen-lockfile`，构建命令 `pnpm build`，输出目录 `dist`。选择 Node 22，不配置 API 或环境变量。
- **GitHub Pages**：Actions 执行构建后通过 `actions/upload-pages-artifact` 上传 dist，再用 `actions/deploy-pages` 发布。当前仓库的 `.github/workflows/ci.yml` 只测试并发布 Release 压缩包，不部署 Pages。
- 内网环境可完全离线部署 dist，应用无运行时外部依赖。首次获取应用资源仍需访问静态服务器；未实现 Service Worker 离线启动缓存。

## 持续集成与发布

`.github/workflows/ci.yml`：推送 `main`、提交 PR 或手动触发。`check` 任务安装依赖后依次执行 `pnpm test`、`pnpm format:check`、`pnpm snapshot:github`（仅主分支；用内置 token 预取公开仓库，失败不阻断）、`pnpm build`、Playwright Chromium 端到端测试；失败时上传 `test-results/`。

主分支构建成功后，`release` 任务下载构建产物，打包为 `folio-dist.zip` 与 `folio-dist.tar.gz` 并生成 `SHA256SUMS`，然后以 `build-<run_number>-<run_attempt>` 为标签、`--target $GITHUB_SHA` 发布 GitHub Release（附带自动生成的变更说明）。PR 不发布 Release。发布的压缩包即静态站点内容，解压后按上述方式部署。

如配置 CSP，至少允许同源脚本与字体、`img-src 'self' data: blob:`、`font-src 'self' data:`，以及动态内联样式（本应用使用 React style 与字体注入）。不要盲目启用阻断内联样式的策略。

## 开发入口

- [AGENTS.md](AGENTS.md)：AI 与开发者工作约定、架构与验证步骤。
- [docs/TEMPLATE_SPEC.md](docs/TEMPLATE_SPEC.md)：模板协议、字段共享、组件扩展。
- [docs/TESTING.md](docs/TESTING.md)：测试范围、发布检查及限制。

官方参考：[Vite 静态部署](https://vite.dev/guide/static-deploy)、[html2canvas 配置](https://html2canvas.hertzen.com/configuration)。

## 已知权衡

PDF 默认是 2× PNG 页面以换取视觉稳定，不适合依赖文字提取的 ATS；原生打印用于文字版。超长模块需要用户拆分。浮动图片允许自由叠放，由用户留白，不自动绕排。中文简体字体不覆盖所有语言。仅承诺已运行环境的验证结果，Safari/Firefox 按发布清单检查。

GitHub 仓库查询需要能访问 `api.github.com`；无外网时请使用离线快照或手动填写，Star 会停留在快照时间。快照只在构建期刷新（CI 主分支构建或本地 `pnpm snapshot:github`），发布包内的快照可能落后于仓库现状。代理需使用者自行提供，本项目不内置也不推荐任何第三方镜像。
