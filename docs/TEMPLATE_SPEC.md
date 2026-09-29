# 模板与组件协议 v4

## 数据与版本

可执行约定为 `src/model.ts` 的 `documentSchema`。开发阶段仅接受 version: 4，不迁移 v1–v3；旧 JSON 被拒绝。IndexedDB 使用独立键 `folio.resume.v4`，旧键不会读取或覆盖。所有未知 JSON 经 schema 校验后才能进入应用。

顶层字段：

| 字段           | 内容                                         |
| -------------- | -------------------------------------------- |
| version / name | 固定版本 4；文件名，不参与正文               |
| profile        | 姓名与颜色、可编辑信息字段、头像数据与网格   |
| media          | 头像与二维码的自由定位、二维码图片与替代文本 |
| pageDecoration | 页眉、页脚标识、页码内容及各自开关           |
| theme          | 模板、全局文字色、全局字体、模块间距         |
| modules        | 按阅读顺序排列的文本或结构化经历模块         |

## 个人信息

姓名 name 与求职意向 role 独立显示，nameColor 可单独设色（空字符串表示跟随 theme.textColor）。

信息字段是**可编辑列表** `profile.fields`，每项为 `{ id, label, value, icon }`：id 为 1–80 位稳定标识，label 1–60 字，value 最多 200 字，icon 取图标集。`infoFieldPresets` 只提供初始预设（联系电话、电子邮箱、性别、GitHub、个人网站、民族、出生日期、政治面貌、籍贯、户籍、所在城市、工作年限），不参与校验：用户可改名（示例把「出生日期」改成「生日」）、换图标、删除、上下移动，或用 `createInfoField()` 插入预设字段或空白字段。schema 校验字段 ID 唯一、label 非空、value 长度与 icon 合法；最多 30 项。value 为空时该项不渲染。

columns 为 1–3 列；infoWidth 为 280–678 CSS px。网格列使用 minmax(0, 1fr)，图标不缩小，长字段自然换行。缩窄信息区域可为自由定位图片留白。姓名与意向也支持换行。

photo 是空字符串或 PNG/JPEG/WebP base64 data URL。shape 为 square/circle；x/y 为 0–100 的取景百分比，zoom 为 1–3。取景与纸张上的图片位置是两套独立状态。

新建文档在读取不到已存文档时加载同源 `public/avatar.webp`，通过 readImage 标准化后写入 photo，单次会话缓存转换结果。已有文档不自动补头像，明确移除后的空字符串仍然保留；用户可通过「使用默认头像」重新应用。`public/folio.svg` 仅用于工作台品牌与 favicon，不进入简历内容或图片导出协议。

## 文字颜色

默认墨色只在 CSS 中作为兜底，实际颜色沿继承链生效：

1. `theme.textColor` 由「样式 → 主题色」设置，通过内联 `--text-color` 变量作用于整个 `.resume-document`；
2. `module.titleStyle.color` 覆盖模块标题（含标题图标，图标用同一颜色）；
3. `module.bodyStyle.color` 覆盖模块正文容器 `.resume-body`；
4. `profile.nameColor` 覆盖简历上的姓名。

四个颜色都允许空字符串，表示继承上一级。编辑器里的 ColorField 提供取色器与「跟随全局」按钮，把颜色清回空串。修改格式后必须确认行高、分页与导出未变：颜色不影响几何尺寸。

## 浮动图片

头像与二维码从 modules 移除，保存于 media.photo / media.qr，不参与正文流。二维码无章节标题、无 Markdown 正文，始终完整显示并保留上传时补齐的白边；label 仅作为替代文本。

两者共享 page（1–80）、left/top（相对于 A4 左上角的 CSS px）、size（40–300，正方形外框）、visible。schema 拒绝超出纸张的坐标；交互通过 fitPlacement 限制边界。二维码另外保存 image 与 label，头像的图片和取景仍保存在 profile。

预览拖拽按实际纸张缩放换算坐标，释放时提交一次历史，可拖到另一张已有页面。方向键移动 1 px，Shift + 方向键移动 10 px；数值输入提供位置、尺寸、页码的键盘替代。指定不存在的页会补充空白页；隐藏或无图片的元素不会增加页数。取消拖拽不提交。

浮动图片允许用户自由叠放，不自动绕排正文；用户须调整位置或信息宽度留白。模板切换保留全部图片状态。预览、HTML、PDF、打印使用同一绝对坐标。

## 模块与经历

模块共享字段：

- id：1–80 位字母数字、下划线、连字符；实例唯一。
- field：跨模板唯一语义键，允许点号。内置 summary / experience / projects / education / skills；新增组件使用 custom.<uuid>。
- kind：仅 text / experience / projects / education。列表由 Markdown 支持，不再提供列表或二维码章节组件。
- title / icon：标题与本地 Lucide 图标。图标集同时供模块标题与基本信息字段使用，ID 为 none / user / briefcase / graduation / code / award / link / star / phone / mail / globe / github / calendar / flag / contact / clock / map。
- titleStyle / bodyStyle：font（sans/serif/inter/source）、size（9–30 px）、color（空串继承 theme.textColor）。
- width：full 或 half；两个相邻 half 组成一行。visible 决定是否排版，pageBreak 在模块前换页。
- body：仅 text 使用，最多 30,000 字；text 的 entries 必须为空。
- entries：经历组件使用，最多 30 条；经历组件的模块 body 必须为空。
- entryLayout：left-right 或 left-center-right。

每条经历保存稳定 id 与独立 Markdown body（最多 30,000 字），可新增、删除、上下移动。固定字段为纯文本（每项最多 200 字），不通过 Markdown 解析：

| 组件                | 独立填写字段                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| 工作经历 experience | organization 公司/单位、role 职位/角色、location 工作地点、start/end 时间                              |
| 项目经历 projects   | organization 项目名称、role 项目角色、location 项目地点、start/end 时间                                |
| 教育背景 education  | organization 学校、degree 学历/学位、studyMode 培养方式、major 专业、location 学校地点、start/end 时间 |

条目 schema 统一保存上述字段；各组件只编辑和呈现对应字段。时间允许“至今”等文本，空值不产生多余分隔符。开始/结束时间也可只填写一项。

左右布局：左侧单位及角色/学历，右侧时间与地点。左中右布局：单位、角色/学历、时间与地点各占一列。时间与地点以「 · 」相隔，同行呈现，不为地点强制新增一行；空字段不留分隔符。半宽模块下左中右收为两列，时间地点组另起一行，避免挤压。长字段自然换行，不省略。标题到详情间距 5px，条目之间 16px，保持清晰归属。

工作/项目/教育的添加操作分别命名为「添加工作经历」「添加项目」「添加教育背景」；条目标题、详情输入与排序/删除的可访问名称同步使用对应模块名称。

## GitHub 仓库卡片

项目经历条目可附带一张仓库卡片：`entry.github = { visible, snapshot }`，snapshot 为 `repositorySchema` 或 null，字段为 owner、name、description、stars、forks、language、avatar、fetchedAt。owner/name 使用 GitHub 命名规则正则校验，stars/forks 允许 null（留空则不显示），description 最多 1000 字，language 最多 100 字。

avatar 是作者头像的本地副本：查询成功后由 `avatarURL()` 推导 `https://github.com/<owner>.png?size=256`，`fetchAvatar()` 抓取并缩放为 256 px 的 PNG data URL（最多 600 KB）写入卡片；抓取失败时留空，界面回退为 GitHub 图标。简历上只渲染卡片内的头像或图标，绝不使用远程地址，也不显示快照日期等元信息——`fetchedAt` 只出现在编辑器里。

数据来源有三条，互不依赖：

1. **离线快照**：`scripts/snapshot-github.ts` 读取仓库根的 `github-repos.json`（公开仓库标识数组），构建前预取并写入 `public/github-repos.json`；应用通过 `bundledRepositories()` 读取，按仓库名与简介做本地过滤。CI 在主分支推送时先执行 `pnpm snapshot:github`，因此发布产物自带快照。
2. **手动填写**：只填 owner/name，简介、Star、语言完全由用户输入，`fetchedAt` 为 null；头像仍会尝试抓取一次。
3. **联网读取**：显式打开开关后调用 GitHub REST API，可按关键词搜索（最多 5 条）。需要外网；可切换到用户自填的 HTTPS 代理根地址以加速。代理地址不得带凭据、查询或片段。

卡片一旦保存即为普通文档数据：预览、打印、PDF、HTML 与 JSON 备份都不再联网，Star 与头像都是写入时的快照值。API 响应经 `repositoryAPI` 校验后才转换，超过 500 KB 的响应被拒绝。

## 页眉与页脚

pageDecoration 包含 headerVisible/headerText、footerVisible/footerText、pageNumberVisible/pageNumberFormat。三组独立开关。headerText 最多 200 字，仅首页显示；footerText 最多 100 字，每页显示；pageNumberFormat 最多 60 字，替换 {page} 为当前页、{pages} 为总页数。均为纯文本，不解释 HTML。模板不得覆盖这些设置。

## 模板与扩展

1. 添加模板时修改 theme.template schema、applyTemplate、选择器与 resume.css。
2. 模板通过稳定 field 映射初始栏宽，仅修改布局和主题；不得修改 ID、条目、正文、字体、图片、页眉页脚。
3. 新字段更新 schema、示例、编辑和呈现，并加入导入与往返测试。开发阶段有破坏性修改时递增版本、更新存储键；不添加旧格式兼容分支。
4. 图片必须通过 readImage 标准化，禁止 SVG、远程地址、脚本或 iframe。
5. 所有 HTML 内容仅通过 markdown() 进入 dangerouslySetInnerHTML；共用安全白名单。

## 分页合同

页面固定 794 × 1122，内边距上 54、左右 58、下 74；内容高度 994、宽 678。compact 顶部色带使用绝对定位装饰，不改变页面坐标或内容尺寸。

Profile 仅首页出现，章节以整模块/双栏行分页，不拆条目或长段落。超长模块需拆为多个模块。隐藏测量与可见内容使用相同样式与宽度，等待字体和图片后测量。超出内容区时阻止排版导出，不静默裁切。

浮动图片不计入流式高度，但其最大有效 page 决定总页数下限。导出仍等待当前分页完成、字体就绪、图片 decode，并逐页串行生成 PDF。

## 字体嵌入

字体经 Fontsource 本地打包，`build/fonts.ts` 在构建时把各家 400 字重的 `@font-face` 规则转成 `virtual:folio-fonts` 模块：`{ name, range, url }` 列表，CSS 侧按 unicode-range 让浏览器只下载命中的分片。

HTML 导出调用 `embeddedFontCSS(root)`：遍历文档文本节点，按计算字体的家族名收集字符，再用 `intersectsRange` 过滤分片，只把命中的分片转成 data URL 内嵌，因此文件大小与正文实际用到的字符相关，而不是整套中文字体。字体栈中每个家族都作为候选（浏览器可能因缺字回退），未覆盖文档字符的家族自动被排除。请求按 6 个并发分批，单次失败的 URL 不写入缓存，重试仍会重新请求。
