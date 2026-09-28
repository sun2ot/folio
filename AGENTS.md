# Agent / 开发者入口

## 项目目标与边界

Folio 是纯前端、本地优先的简历平台。禁止未经明确产品需求引入后台、账户、上传接口、远程字体或分析埋点。包管理统一 pnpm；保持 lockfile 可重现。界面语言为简体中文。

## 快速了解

先读 README 与 docs/TEMPLATE_SPEC.md。执行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm build`。

| 文件                      | 职责                                            |
| ------------------------- | ----------------------------------------------- |
| src/model.ts              | Zod v1 协议、字段模型、组件注册、示例、模板映射 |
| src/useResume.ts          | 异步加载、自动保存、有限会话撤销历史            |
| src/storage.ts            | IndexedDB、导入校验、图片标准化、下载           |
| src/markdown.ts           | 唯一 Markdown 解析入口与 DOMPurify 白名单       |
| src/pagination.ts         | 纯布局算法：相邻半宽组行、整行分页、溢出报告    |
| src/ResumeView.tsx        | 隐藏测量、资源等待、A4 DOM、页面内容与图标      |
| src/resume.css            | 预览与所有导出共用的样式、纸张尺寸、打印规则    |
| src/Editor.tsx            | 个人信息、可访问头像取景、模块与 Markdown 编辑  |
| src/IconPicker.tsx        | 带 SVG 预览与键盘导航的图标选择菜单             |
| src/App.tsx               | 工作台组合、布局交互、模板切换、导出入口        |
| src/styles.css            | 仅工作台界面样式，不得影响简历 DOM              |
| src/fonts.ts              | 同源字体 URL 与自包含 HTML 字体嵌入             |
| src/export.ts             | 按需加载 PDF 引擎、HTML 打包与打印              |
| src/core.test.ts / tests/ | 单元测试 / Playwright 集成与下载检查            |

## 不可破坏的约束

1. 所有未知 JSON 必须经过 documentSchema 校验；新字段应有迁移方案。禁止 `as Resume` 绕过校验。
2. 模板不能复制或改写正文。布局调整按稳定 field 键映射，实例 ID 在拖动、保存、导入导出间保持稳定。
3. HTML 内容只从 markdown() 进入 dangerouslySetInnerHTML。禁止放宽脚本、远程图片、style、iframe 白名单。
4. 图片只能来自用户上传并标准化的 raster data URL。禁止允许 SVG 或远程 URL 穿透导出。
5. 所有简历视觉规则置于 resume.css，不能给 PDF 单独做「近似排版」。不能在保真 PDF 使用跨页长画布截取。
6. 改纸张内边距必须同步 CONTENT_HEIGHT、PAGE_WIDTH、PAGE_HEIGHT 与測量容器。隐形测量与可见内容宽度必须一致。
7. 导出必须等待 document.fonts.ready、图片 decode 与当前文档分页完成；溢出不得静默截断。
   保真 PDF 必须使用相同 DOM 的无缩放临时容器；不要直接截取位于预览滚动区域中的页面，后续页会出现坐标偏移。
8. 长文档操作保持防抖，PDF 按页串行处理；不得无上限持有 canvas 或历史。字体与图片不得为每次键入重复转码。
9. 每项鼠标交互提供键盘替代（布局上/下按钮、头像滑块）；保留输入 label、焦点样式、dialog 和状态反馈。
   工作台 Grid 行必须使用 minmax(0, 1fr)，滚动区域及其 Grid/Flex 父级保留 min-height: 0，防止长内容撑开行高后被外层裁切。桌面与窄屏布局修改后使用真实滚轮回归。
10. 读取存储失败不自动覆盖旧值。可提示导出备份；版本迁移应先保留原始数据。

## 修改流程

- 小改动直接修改对应模块，不为简单 UI 新建抽象层。
- 修改数据结构/分页/Markdown 后添加具有实际边界意义的单元测试。
- 修改排版或导出后运行浏览器测试，并视觉检查截图、保真 PDF、HTML 与原生打印。
- 完成 `pnpm test`、`pnpm build`、`pnpm test:e2e`；如环境不能运行某项，明确说明不能验证的项，不声称通过。
- 不提交 node_modules、dist、测试下载或截图；CI 失败工件单独上传。
- 更新 README、模板协议和新增字段说明，保持注释解释「为什么」，避免复述代码。
- 不在自动测试中访问外部站点或使用真实个人简历数据。

## 已知权衡

PDF 默认是 2× PNG 页面以换取视觉稳定，不适合依赖文字提取的 ATS；原生打印用于文字版。超长模块需要用户拆分。排版按行流动而非任意重叠坐标。中文简体字体不覆盖所有语言。当前只承诺已运行环境的验证结果，Safari/Firefox 按发布清单检查。浏览器多标签编辑采用最后写入，不做协作合并。
