# 模板与组件协议 v4

## 数据与版本

可执行约定为 `src/model.ts` 的 `documentSchema`。开发阶段仅接受 version: 4，不迁移 v1–v3；旧 JSON 被拒绝。IndexedDB 使用独立键 `folio.resume.v4`，旧键不会读取或覆盖。所有未知 JSON 经 schema 校验后才能进入应用。

工作台显示的应用版本读取 `package.json.version`，与 `src/changelog.ts` 首条记录及 Release 的 `v<version>` 标签一致；它与本文的简历数据协议版本独立。更新日志只属于工作台，不写入简历文档、模板或导出内容。历史版本按提交补记并标明来源。新增日志无需修改协议或存储键。

顶层字段：

| 字段           | 内容                                         |
| -------------- | -------------------------------------------- |
| version / name | 固定版本 4；文件名，不参与正文               |
| profile        | 姓名与颜色、可编辑信息字段、头像数据与网格   |
| media          | 头像与二维码的自由定位、二维码图片与替代文本 |
| pageDecoration | 页眉、页脚标识、页码内容及各自开关           |
| theme          | 模板、全局标题色与正文色、全局字体、模块间距 |
| modules        | 按阅读顺序排列的文本或结构化经历模块         |

## 个人信息

姓名 name 与求职意向 role 独立显示，nameColor 可单独设色（空字符串表示跟随全局标题色）；roleColor 可单独设色（省略或空字符串表示跟随 theme.textColor）。

信息字段是**可编辑列表** `profile.fields`，每项为 `{ id, label, value, icon }`：id 为 1–80 位稳定标识，label 1–60 字，value 最多 200 字，icon 取图标集。`infoFieldPresets` 只提供初始预设（联系电话、电子邮箱、性别、GitHub、个人网站、民族、出生日期、政治面貌、籍贯、户籍、所在城市、工作年限），不参与校验：用户可改名（示例把「出生日期」改成「生日」）、换图标、删除、上下移动，或用 `createInfoField()` 插入预设字段或空白字段。schema 校验字段 ID 唯一、label 非空、value 长度与 icon 合法；最多 30 项。value 为空时该项不渲染。

columns 为 1–3 列；infoWidth 为 280–678 CSS px，表示信息区域的期望宽度，内容较长时允许撑开所需宽度，最大不超过纸张的 678px 正文区域。网格使用 minmax(0, max-content) 按各列实际内容分配宽度，剩余空间放在列间，列间距最小为 18px。缩窄信息区域先收紧列间留白，不把长字段强制压入等宽列；单栏同样保留字段所需宽度。整个区域受纸张宽度限制，真正超出的长标签、邮箱、网址与中文内容自然换行，不截断或省略，图标不缩小。缩窄区域可为浮动图片留白，最终可用留白取决于字段实际长度。姓名与意向也支持换行。测量、预览、HTML、PDF 与打印共用此规则，无新增协议字段。

每项信息字段另外支持可选的 `color`，同时作用于字段名称、内容和图标；省略或空字符串表示跟随全局正文色。颜色与稳定 ID 一起保存，改名和排序不会丢失。

字号为 v4 可选扩展：`profile.nameSize`（9–60，省略为 34px）、`profile.roleSize`（9–30，省略为 13px）、`profile.infoSize`（9–30，信息字段默认值，省略为 12px）与 `profile.fields[].size`（9–30，省略跟随 infoSize）。字段字号同时作用于标签和值；图标边长为实际字号 + 1px，保持原来的 12px 文字 / 13px 图标比例关系。单项覆盖按稳定 ID 保存，排序、导入、切换模板和撤销不丢失；「跟随默认」移除单项 size。姓名、意向和信息行都参与隐藏测量，改字号后重新分页，导出沿用相同 DOM 与 CSS。

## 本地图标目录

图标来自现有依赖 `lucide-react` 的成熟 SVG 组件，目录定义于 `src/icons.ts`，没有远程 SVG、图标字体或自定义 HTML。原有 none / user / briefcase / graduation / code / award / link / star / phone / mail / globe / github / calendar / flag / contact / clock / map 键保持对应图形；新增 pencil / trend / gear 分别映射 Pencil / TrendingUp / Settings。完整库使用 `lucide:<导出名称>`，例如 `lucide:Microscope`。名称直接使用库的英文 key，原有中文名称保留，常用中文关键词单独索引，不要求翻译全库。

`iconSchema` 在 `documentSchema` 中验证键确实属于本地目录（最多 80 字），拒绝未知键、原型属性、任意 URL 等输入。此为 v4 的非破坏性扩展，已有键继续有效，不改存储键。更新图标依赖时须核对已开放键，不可静默删除旧键。

`IconPicker` 使用原生 dialog 的顶层小窗，避免被滚动编辑器裁切，支持搜索、60 项分页、方向键网格导航、Home / End、Enter 与 Escape。中文覆盖常用主题，英文 key 与名称完整可搜；无匹配时明确提示，不自动替换图标。模块与信息字段通过同一 `SectionIcon` 同步渲染，导出保留内联 SVG；图标组件同步可用，分页与导出不需要等待远程加载。完整图标库增大应用脚本体积，但不增加独立 HTML / PDF 中未使用图标的体积。

photo 是空字符串或 PNG/JPEG/WebP base64 data URL。shape 为 square/circle；x/y 为 0–100 的取景百分比，zoom 为 1–3。取景与纸张上的图片位置是两套独立状态。

新建文档在读取不到已存文档时加载同源 `public/avatar.webp`，通过 readImage 标准化后写入 photo，单次会话缓存转换结果。已有文档不自动补头像，明确移除后的空字符串仍然保留；用户可通过「使用默认头像」重新应用。`public/folio.svg` 仅用于工作台品牌与 favicon，不进入简历内容或图片导出协议。

## 文字颜色

默认墨色只在 CSS 中作为兜底，实际颜色沿继承链生效：

1. `theme.textColor` 由「样式 → 全局正文颜色」设置，通过内联 `--text-color` 作用于正文、求职意向与信息字段；
2. 可选的 `theme.titleColor` 由「样式 → 全局标题颜色」设置，通过 `--title-color` 作用于姓名与模块标题；省略或空串时取 `theme.textColor`，编辑全局正文色时保留原来的标题色；
3. `module.titleStyle.color` 覆盖模块标题（含标题图标），`module.bodyStyle.color` 覆盖模块正文；
4. `profile.nameColor`、可选的 `profile.roleColor` 和 `profile.fields[].color` 分别覆盖姓名、求职意向和每条信息字段。

局部颜色允许空字符串，表示继承对应全局色；全局正文色必须是六位十六进制颜色。新增字段为 v4 可选扩展，不改变存储键或已有内容；省略字段直接使用上述继承链，无版本迁移。所有颜色仍经 schema 校验。

编辑器里的 ColorField 使用固定大小的圆形取色按钮，显示实际生效颜色，不在旁边展示颜色代码。「跟随全局」始终显示，继承时禁用并置灰，恢复继承清回空串。修改后必须确认行高、分页与导出未变：颜色不影响几何尺寸。

全局标题色预设为顺圣、拓黄、苍黄、官绿、青雘、蓝采和、凝夜紫；全局正文色预设为黑色、帝释青、瑾瑜、京元、青骊、螺子黛、油紫。每项保存色值及名称，悬停与可访问名称显示传统色名称。模块字体、字号、颜色同排，恢复继承使用带可访问名称和悬停提示的重置图标。仓库名称和回退 GitHub 图标继承所在模块正文颜色，模块未覆盖时使用全局正文色。

## 页眉、页脚与页码

`pageDecoration` 保留各自的内容、格式与可见开关，新增可选的 `headerStyle`、`footerStyle`、`pageNumberStyle`，均为 `{ color?, font?, size? }`。省略 / 空串颜色继承 `theme.textColor`，省略字体继承 `theme.font`；字号范围 9–30 CSS px，省略时为 9px。重置清空样式，单独恢复颜色不会改变字体与字号。此为 v4 可选扩展，已有文档不迁移，保存、备份、模板切换与所有导出保留覆盖。

页眉参与基本信息高度测量；页脚和页码独立排版，字体加载与测量覆盖各自文本。任一页脚 / 页码开关开启时，底部留白为 74px（20px 边缘安全距离 + 54px 页脚预留）；两者都关闭后，只保留 20px 边缘安全距离，回收 54px 给正文并重新分页。页脚距底部 20px，显示时高度超过预留的 54px 会提示并阻止排版导出，JSON 备份不受影响。预览、测量、HTML、PDF 与打印共用动态尺寸、文字样式与边界检查。

## 分割线

`theme.dividers` 为可选的 v4 扩展，包含可选的 `header`（基本信息）、`section`（模块标题）、`content`（Markdown 横线）、`footer`（页脚）和 `stripe`（构筑顶部色带）。每项为 `{ color?, width? }`，颜色省略 / 空串、粗细省略时使用当前模板默认值；粗细为 0–12 CSS px，0 隐藏。

青序的基本信息线默认为 2px，书简为 1px；模块标题线默认 1px，构筑默认 0px；正文与页脚线默认 1px，构筑顶部色带默认 8px。颜色与模板默认样式保持一致。设置从统一 CSS 变量进入隐藏测量、预览、HTML、PDF 与打印。切换模板保留用户覆盖，重置移除该项覆盖；修改粗细后重新分页，不能沿用旧测量结果。

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
- title / icon：标题与本地 Lucide 图标。图标集同时供模块标题与基本信息字段使用，ID 约定见「本地图标目录」。
- titleStyle / bodyStyle：font（sans/serif/inter/source）、size（9–30 px）、color（空串分别继承全局标题色 / theme.textColor）。
- width：full 或 half；两个相邻 half 组成一行。visible 决定是否排版，pageBreak 在模块前换页。
- keepTogether：可选布尔值，省略 / false 使用智能分页，true 保持整个模块同页。仅影响排版，不改变正文或顺序；模板、保存与 JSON 备份保留设置。
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

avatar 是作者头像的本地副本：`repositoryAPI` 校验 `owner.id` 为正的安全整数，收敛为快照里的可选 `ownerId`。联网选择仓库或显式点击「获取作者头像」时，`avatarURL()` 生成 `https://avatars.githubusercontent.com/u/<ownerId>?s=256`，`fetchAvatar()` 抓取并缩放为 256 px 的 PNG data URL（最多 600 KB）。缺少 ownerId 时，仅在显式联网操作中先请求仓库元数据；失败保留原头像或回退图标。关闭联网、修改查询或隐藏卡片会取消未完成操作，防止旧响应覆盖当前卡片。

卡片为项目自有 React 实现，参考 GitHub 官方 REST 响应和社区 github-cards 的卡片用法，不使用在线 iframe。简历上只渲染本地头像或图标，绝不保存远程头像 URL，也不显示 fetchedAt 等编辑器元信息。

数据来源有三条，互不依赖：

1. **离线快照**：`scripts/snapshot-github.ts` 读取仓库根的 `github-repos.json`（公开仓库标识数组），构建前预取并写入 `public/github-repos.json`；应用通过 `bundledRepositories()` 读取，按仓库名与简介做本地过滤。CI 在主分支推送时先执行 `pnpm snapshot:github`，因此发布产物自带快照。
2. **手动填写**：只填 owner/name，简介、Star、语言完全由用户输入，`fetchedAt` 为 null；不自动联网，需要头像时显式打开联网开关并点击「获取作者头像」。
3. **联网读取**：显式打开开关后调用 GitHub REST API，可按关键词搜索（最多 5 条）。需要外网；可切换到用户自填的 HTTPS 代理根地址以加速。代理地址不得带凭据、查询或片段。

卡片一旦保存即为普通文档数据：预览、打印、PDF、HTML 与 JSON 备份都不再联网，Star 与头像都是写入时的快照值。API 响应经 `repositoryAPI` 校验后才转换，超过 500 KB 的响应被拒绝。

## 科研卡片

项目条目支持可选的 `entry.research`，与 `entry.github` 独立，可同时显示。这是 v4 可选扩展，省略时不渲染，不改变存储键或旧文档。新卡片使用 `createResearch()`，由 `researchSchema` 随 `documentSchema` 校验。新建文档示例默认在项目条目中开启虚构 GitHub 卡片，并以独立条目展示指定论文的科研卡片；已有文档、用户隐藏后的卡片不自动补齐。默认值是本地常量，不查询 GitHub 或 DOI。

| 字段        | 约定                                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| visible     | 显示开关；关闭保留所有填写内容                                                                                                                                                         |
| kind        | paper-en（英文论文）/ paper-zh（中文论文）/ fund（基金）/ patent（专利）                                                                                                               |
| title       | 纯文本，最多 500 字，支持中英混排与双语换行；空白名称不渲染卡片                                                                                                                        |
| venue       | 纯文本，最多 200 字；期刊 / 会议名称，基金为资助机构 / 计划，专利为授予机构                                                                                                            |
| authorOrder | 纯文本，最多 200 字，可写第一作者（1/5）、共同第一作者、通讯作者或项目负责人                                                                                                           |
| level       | 自定义纯文本标签，最多 100 字；SCI 分区、CCF-A/B/C、EI、核心、基金级别与专利类型仅为建议，不据此推断或查询评级                                                                         |
| openSource  | 空串（隐藏）/ open（已开源）/ closed（未开源）                                                                                                                                         |
| status      | 空串（隐藏）/ published（出版）/ proofreading（校稿）/ revision（反修）/ review（外审）/ submitted（投稿）/ applied（申请 / 申报）/ funded（立项）/ completed（结项）/ granted（授权） |
| link        | 空串（隐藏）、DOI、`doi:10.…`、doi.org / dx.doi.org 解析器地址或完整 HTTP / HTTPS URL，最多 2000 字                                                                                    |

例如：`{ visible: true, kind: "paper-en", title: "Local-first Research · 本地研究", venue: "Example Research Conference", authorOrder: "共同第一作者（1/5）", level: "SCI Q1（JCR） · CCF-A", openSource: "open", status: "published", link: "10.1234/example" }`。原有项目名称、角色、日期与 Markdown 详情可继续填写，也可留空，仅展示科研卡片。

`researchURL()` 将 DOI 转为 HTTPS doi.org 地址；DOI 后缀按路径编码，避免问号或井号变成查询 / 片段。普通 URL 保留查询和片段，但拒绝凭据、脚本、data、file、协议相对地址和内部空白 / 控制字符。编辑中的无效地址仅保留在输入框并显示提示，不覆盖已保存链接；清空移除链接。固定字段通过 React 文本渲染，不解析 HTML / Markdown。

成果名称突出，期刊 / 会议在下一行，作者、级别与开源信息自然换行。级别使用浅底标签，状态使用细边框；全部文字与图标继承模块正文色（再继承全局正文色），不使用固定状态墨色。只有链接图标带超链接与可访问名称，纸面不出现 URL。预览、测量、HTML、PDF 和打印共用 `ResearchCard` 与 `resume.css`；半宽长文本不截断。不查询 DOI 或远程论文信息，所有保存与导出保持离线。

保真 PDF 在同一无缩放临时 DOM 上读取链接矩形，按页换算到 A4 毫米坐标并附加 URL 注释；科研图标、仓库和 Markdown 的 HTTP / HTTPS / mailto / tel 链接可点击，跨页坐标不从预览滚动区域读取。原生打印和 HTML 保留 DOM 中的链接。

## 页眉与页脚

pageDecoration 包含 headerVisible/headerText、footerVisible/footerText、pageNumberVisible/pageNumberFormat。三组独立开关。headerText 最多 200 字，仅首页显示；footerText 最多 100 字，每页显示；pageNumberFormat 最多 60 字，替换 {page} 为当前页、{pages} 为总页数。均为纯文本，不解释 HTML。模板不得覆盖这些设置。

## 模板与扩展

基本信息、模块内容和浮动图片编辑组件位于 `src/editor/`，共享字体颜色控件位于同目录；头像与图标由 `src/ResumePrimitives.tsx` 提供。编辑器只组合这些组件，不依赖分页测量实现。可见简历仍由 `ResumeView` 渲染，并与测量和全部导出共用 `resume.css`。

1. 添加模板时修改 theme.template schema、applyTemplate、选择器与 resume.css。
2. 模板通过稳定 field 映射初始栏宽，仅修改布局和主题；不得修改 ID、条目、正文、字体、图片、页眉页脚。
3. 新字段更新 schema、示例、编辑和呈现，并加入导入与往返测试。开发阶段有破坏性修改时递增版本、更新存储键；不添加旧格式兼容分支。
4. 图片必须通过 readImage 标准化，禁止 SVG、远程地址、脚本或 iframe。
5. 所有 HTML 内容仅通过 markdown() 进入 dangerouslySetInnerHTML；共用安全白名单。

## 分页合同

页面固定 794 × 1122，内边距上 54、左右 58，内容宽 678。`pageGeometry()` 根据页脚 / 页码的显示开关统一计算底部空间：任一开启时下边距 74、内容高度 994；两者关闭时下边距 20、内容高度 1048。相同 CSS 变量作用于纸张与测量容器，分页使用对应内容高度，导出校验读取相同高度，不再固定比较 994。compact 顶部色带使用绝对定位装饰，不改变页面坐标或内容尺寸。

Profile 仅首页出现。默认在完整经历条目、Markdown 段落或顶层列表项之间分页，模块标题只在首次出现时显示，续页直接衔接正文，不添加续页标识，也不重复或漏掉正文。小标题与随后段落 / 第一条列表项组合为一块，嵌套列表随父项保留；有序列表续页保留起始编号。双栏各自续排，某栏结束后另一栏仍保持原列。pageBreak 只作用于模块开始，keepTogether 为 true 时整模块搬移；不可分内容块仍过高时明确报错并阻止排版导出，不静默裁切。已完成列可以留空，不把之后的模块提前穿插以填空。

`markdownUnits()` 从唯一 `markdown()` 入口已经通过 DOMPurify 白名单的 HTML 划分内容块，`markdownFragment()` 只组合这些已清洗节点并再次通过 `markdown()` 交付 HTML；不放宽标签或属性，不重新解析引用定义，也不修改文档中的原始 Markdown。经历条目包含完整详情和卡片，整体保留。分页片段仅是派生渲染状态，原模块 / 条目 ID、正文、排序与 JSON 均保持稳定；点击续页仍编辑原模块。

隐藏测量与可见内容使用同宽的实际片段和样式，续页测量同样移除模块标题；二分查找最大可容纳片段，单次排版缓存测量值并及时移除临时 DOM。去掉祖先预览缩放后保留亚像素高度，仅向上取到 0.01px，避免多行整数取整累计导致提前换页。等待全部字体和图片后再测量；预览、PDF、HTML 与原生打印复用同一分页结果与 DOM，保真 PDF 仍逐页捕获，不切长画布。

浮动图片不计入流式高度，但其最大有效 page 决定总页数下限。导出仍等待当前分页完成、字体就绪、图片 decode，并逐页串行生成 PDF。

## 字体嵌入

字体经 Fontsource 本地打包，`build/fonts.ts` 在构建时把各家 400 字重的 `@font-face` 规则转成 `virtual:folio-fonts` 模块：`{ name, range, url }` 列表，CSS 侧按 unicode-range 让浏览器只下载命中的分片。

HTML 导出调用 `embeddedFontCSS(root)`：遍历文档文本节点，按计算字体的家族名收集字符，再用 `intersectsRange` 过滤分片，只把命中的分片转成 data URL 内嵌，因此文件大小与正文实际用到的字符相关，而不是整套中文字体。字体栈中每个家族都作为候选（浏览器可能因缺字回退），未覆盖文档字符的家族自动被排除。请求按 6 个并发分批，单次失败的 URL 不写入缓存，重试仍会重新请求。
