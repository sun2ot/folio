# 模板与组件协议 v2

## 数据与版本

可执行约定为 `src/model.ts` 的 `documentSchema`。开发阶段仅接受 version: 2，不迁移 v1；旧 JSON 被拒绝。IndexedDB 使用独立键 `folio.resume.v2`，旧键不会读取或覆盖。所有未知 JSON 经 schema 校验后才能进入应用。

顶层字段：

| 字段           | 内容                                         |
| -------------- | -------------------------------------------- |
| version / name | 固定版本 2；文件名，不参与正文               |
| profile        | 个人信息、头像数据与取景、信息网格配置       |
| media          | 头像与二维码的自由定位、二维码图片与替代文本 |
| pageDecoration | 页眉、页脚标识、页码内容及各自开关           |
| theme          | 模板、强调色、全局字体、模块间距             |
| modules        | 按阅读顺序排列的文本或结构化经历模块         |

## 个人信息

姓名 name 与求职意向 role 独立显示。其余字段由 `profileFields` 注册固定标签和显示顺序，`ResumeView` 为每项提供本地图标：phone、email、gender、github、website、ethnicity、birthDate、politicalStatus、hometown、residence、location、experienceYears。每项最多 200 字，留空隐藏，显示时保留标签。

columns 为 1–3 列；infoWidth 为 280–678 CSS px。网格列使用 minmax(0, 1fr)，图标不缩小，长字段自然换行。缩窄信息区域可为自由定位图片留白。姓名与意向也支持换行。

photo 是空字符串或 PNG/JPEG/WebP base64 data URL。shape 为 square/circle；x/y 为 0–100 的取景百分比，zoom 为 1–3。取景与纸张上的图片位置是两套独立状态。

新建文档在读取不到已存文档时加载同源 `public/avatar.webp`，通过 readImage 标准化后写入 photo，单次会话缓存转换结果。已有文档不自动补头像，明确移除后的空字符串仍然保留；用户可通过「使用默认头像」重新应用。`public/folio.svg` 仅用于工作台品牌与 favicon，不进入简历内容或图片导出协议。

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
- title / icon：标题与本地 Lucide 图标。图标 ID 为 none / user / briefcase / graduation / code / award / link / star。
- titleStyle / bodyStyle：font（sans/serif/inter/source）、size（9–30 px）。
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
