# Agent / 开发者入口

## 项目目标与边界

Folio 是纯前端、本地优先的简历平台。禁止未经明确产品需求引入后台、账户、上传接口、远程字体或分析埋点。包管理统一 pnpm；保持 lockfile 可重现。界面语言为简体中文。

## 快速了解

先读 README 与 docs/TEMPLATE_SPEC.md。执行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm build`。

| 文件                       | 职责                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| src/model.ts               | Zod v4 协议、结构化经历、可编辑信息字段、分层颜色、浮动图片边界、组件注册、示例、模板映射 |
| src/useResume.ts           | 异步加载、自动保存、有限会话撤销历史                                                      |
| src/storage.ts             | IndexedDB、导入校验、图片标准化与头像抓取、下载                                           |
| src/markdown.ts            | 唯一 Markdown 解析入口与 DOMPurify 白名单                                                 |
| src/pagination.ts          | 纯布局算法：相邻半宽组行、整行分页、溢出报告                                              |
| src/ResumeView.tsx         | 隐藏测量、资源等待、A4 DOM、页面内容、图标与仓库卡片呈现                                  |
| src/resume.css             | 预览与所有导出共用的样式、纸张尺寸、文字色变量、打印规则                                  |
| src/Editor.tsx             | 可编辑信息字段、头像取景、模块与 Markdown 编辑、取色控件                                  |
| src/IconPicker.tsx         | 带 SVG 预览与键盘导航的图标选择菜单（模块标题与信息字段共用）                             |
| src/App.tsx                | 工作台组合、布局交互、模板切换、导出入口、作者入口                                        |
| src/styles.css             | 仅工作台界面样式，不得影响简历 DOM                                                        |
| src/fonts.ts               | 字体分片清单、unicode-range 判定与自包含 HTML 的按需嵌入                                  |
| src/repository.ts          | GitHub 仓库标识校验、API 响应收敛、代理地址校验、离线快照读取                             |
| src/RepositoryEditor.tsx   | 项目条目的仓库卡片编辑器（离线快照 / 手动填写 / 显式联网）                                |
| src/export.ts              | 按需加载 PDF 引擎、HTML 打包与打印                                                        |
| build/fonts.ts             | 构建期把 Fontsource 的 @font-face 编译为 virtual:folio-fonts                              |
| scripts/snapshot-github.ts | 构建前预取 github-repos.json 中的公开仓库到 public/github-repos.json                      |
| .github/workflows/ci.yml   | 质量检查与主分支 Release 发布                                                             |
| src/core.test.ts / tests/  | 单元测试 / Playwright 集成与下载检查                                                      |

## 不可破坏的约束

1. 所有未知 JSON 必须经过 documentSchema 校验。当前开发阶段仅接受 v4，不做旧数据兼容；破坏性修改同步协议与存储键。禁止 `as Resume` 绕过校验。
2. 模板不能复制或改写正文。布局调整按稳定 field 键映射，模块及经历条目 ID 在拖动、保存、导入导出间保持稳定。模板保留浮动图片、取景、结构化字段、字体与页眉页脚。
3. HTML 内容只从 markdown() 进入 dangerouslySetInnerHTML。禁止放宽脚本、远程图片、style、iframe 白名单。
4. 简历图片仅接受用户上传或仓库内置头像，经 readImage 标准化为 raster data URL。禁止允许 SVG 或远程 URL 穿透导出。public/folio.svg 仅用于品牌与 favicon；public/avatar.webp 仅在新建或明确恢复默认头像时加载，不能覆盖已存文档的头像或用户移除状态。
5. 所有简历视觉规则置于 resume.css，不能给 PDF 单独做「近似排版」。不能在保真 PDF 使用跨页长画布截取。
6. 改纸张内边距必须同步 CONTENT_HEIGHT、PAGE_WIDTH、PAGE_HEIGHT 与測量容器。隐形测量与可见内容宽度必须一致。
7. 导出必须等待 document.fonts.ready、图片 decode 与当前文档分页完成；溢出不得静默截断。
   保真 PDF 必须使用相同 DOM 的无缩放临时容器；不要直接截取位于预览滚动区域中的页面，后续页会出现坐标偏移。
8. 长文档操作保持防抖，PDF 按页串行处理；不得无上限持有 canvas 或历史。字体与图片不得为每次键入重复转码。
9. 每项鼠标交互提供键盘替代（模块/条目上下一项按钮、头像取景滑块、浮动图片方向键及坐标输入）；保留输入 label、焦点样式、dialog 和状态反馈。
   工作台 Grid 行必须使用 minmax(0, 1fr)，滚动区域及其 Grid/Flex 父级保留 min-height: 0，防止长内容撑开行高后被外层裁切。桌面与窄屏布局修改后使用真实滚轮回归。
10. 读取存储失败不自动覆盖旧值。可提示导出备份；版本更换使用独立键，当前为 folio.resume.v4。
11. 头像与二维码是浮动图片，禁止重新引入二维码章节或列表专用组件。坐标基于 A4 左上角，缩放拖动必须换算并限制边界，释放时一次提交历史，取消不写入；图片不占正文流，位置和有效页数必须进入所有导出。
12. 经历组件固定字段使用纯文本，详情统一走 Markdown；信息图标固定，长文本必须换行。日期与地点优先同行，不让地点强制占一整行；条目之间间距应大于标题与详情之间间距。添加按钮及条目控件按工作/项目/教育区分名称。UI 字号调整仅在 styles.css，不能改变纸张字体与测量尺寸。
    基本信息字段是可编辑列表（`profile.fields`），预设只是初始值：标签、图标、顺序与数量都由用户决定。不要退回固定字段，也不要把 label 当语义键使用——渲染与导出只读 label 与 icon。
13. 颜色必须能分层覆盖：theme.textColor 为全局默认，模块标题/正文与 profile.nameColor 可各自覆盖，空串表示继承。任何「给简历上色」的改动都要走这四处，不要在 resume.css 里写死具体墨色，否则用户设置会被样式表压掉。
14. 唯一允许的运行时外部请求是用户显式开启的 GitHub 仓库查询与作者头像抓取（`src/repository.ts`、`fetchAvatar`）。默认必须离线可用：手动填写与 `public/github-repos.json` 快照都不能依赖网络，卡片保存后进入文档，预览与所有导出不得发起请求。新增任何网络能力都要同时提供关闭开关、失败提示与离线退路。
15. 仓库标识与响应必须经 `repositoryKey` / `repositoryAPI` / `repositorySchema` 校验后才能入库或进 DOM；只接受 https 的 github.com 地址或 owner/name，禁止把未校验输入拼进 href。代理地址不得含凭据、查询或片段。卡片头像只能是抓取后转存的本地图片，简历 DOM 里禁止出现远程 URL，也不得渲染 fetchedAt 之类的编辑器元信息。
16. 字体只装载 400 常规字重，导出按 unicode-range 分片筛选后内嵌（`neededFontFaces` / `intersectsRange`）。不要改回「整套字体打进 HTML」，也不要为减少体积限制用户的字体或字号选择。

## 修改流程

- 小改动直接修改对应模块，不为简单 UI 新建抽象层。
- 修改数据结构/分页/Markdown 后添加具有实际边界意义的单元测试。
- 修改排版或导出后运行浏览器测试，并视觉检查截图、保真 PDF、HTML 与原生打印。
- 完成 `pnpm test`、`pnpm build`、`pnpm test:e2e`；如环境不能运行某项，明确说明不能验证的项，不声称通过。
- 不提交 node_modules、dist、测试下载或截图；CI 失败工件单独上传。
- 更新 README、模板协议和新增字段说明，保持注释解释「为什么」，避免复述代码。
- 不在自动测试中访问外部站点或使用真实个人简历数据。

## 已知权衡

PDF 默认是 2× PNG 页面以换取视觉稳定，不适合依赖文字提取的 ATS；原生打印用于文字版。超长模块需要用户拆分。正文按行流动，浮动图片允许自由叠放，由用户留白，不自动绕排。中文简体字体不覆盖所有语言。当前只承诺已运行环境的验证结果，Safari/Firefox 按发布清单检查。浏览器多标签编辑采用最后写入，不做协作合并。
