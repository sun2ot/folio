# 模板与组件协议 v1

## 数据分层

文档格式的可执行约定为 `src/model.ts` 的 `documentSchema`，此文档解释设计意图。JSON 顶层：

```ts
type Document = {
  version: 1;
  name: string; // 文件名，不参与简历正文
  profile: Profile; // 跨模板个人信息
  theme: Theme; // 模板 ID、强调色、信息字体、模块间距
  modules: Module[]; // 顺序即阅读顺序
};
```

`profile`：name、role、email、phone、location、website、photo、shape（square/circle）、x/y（0–100 的取景百分比）、zoom（1–3）。photo 为空字符串或 PNG/JPEG/WebP base64 data URL。

`theme`：template（editorial/classic/compact）、accent（六位十六进制）、font（sans/serif/inter/source）、spacing（8–28 CSS px）。

```json
{
  "id": "experience",
  "field": "experience",
  "kind": "text",
  "title": "工作经历",
  "icon": "briefcase",
  "body": "### 工程师\n**2022 — 至今**\n- 主导产品开发",
  "titleStyle": { "font": "sans", "size": 15 },
  "bodyStyle": { "font": "sans", "size": 12 },
  "width": "full",
  "image": "",
  "visible": true,
  "pageBreak": false
}
```

- `id`：模块实例唯一标识，1–80 位字母数字下划线/连字符。不可随模板切换重新生成。
- `field`：跨模板语义唯一键，支持点号。内置 summary / experience / projects / education / skills。自定义组件为 `custom.<uuid>`。模板只读 field 决定布局。
- `kind`：text / ordered / unordered / nested / qr。前四类共用 Markdown 渲染器，区别在初始正文，用户之后仍可自由编辑。
- `body`：Markdown，最多 30,000 字符；链接仅保留安全协议。不接受任意富 HTML。
- `icon`：none / user / briefcase / graduation / code / award / link / star，映射到本地 Lucide SVG。
- `width`：full 占一行，两个相邻 half 组成双栏。一个孤立 half 保持半宽。pageBreak 会先断行再换页。
- `titleStyle` / `bodyStyle`：独立字体与 9–30 px 字号。中文与英文通过字体栈回退。CSS px 避免导出引擎的单位歧义。
- `image`：仅 qr 使用；二维码必须完整 contain，不裁切白边。与正文分开保存。
- `visible`：隐藏内容继续保存、备份和切换模板，仅从排版移除。
- `pageBreak`：模块前强制分页；分页以整行处理，不拆双栏中的组件。

## 增加模板

1. 在 theme.template schema 中添加 ID，并为 import 测试添加样本。
2. 在 applyTemplate() 中实现布局映射，仅修改 theme.template、module.width 等布局字段，保留 ID、field、body、image、typography。
3. 在 resume.css 增加 `.template-新ID` 样式。不要修改固定纸张与内容区域尺寸，不使用 html2canvas 不支持的复杂滤镜、混合模式或依赖外网资源。
4. App 的模板选择器增加名称和缩略图。
5. 用同一份样本数据验证字段共享、页面数量、PDF/HTML 输出和长内容边界。

用户可编辑标题、图标、正文、字体、颜色、间距、顺序和栏宽；不支持向平台上传执行任意模板 JavaScript。新增模板通过源码注册，便于审查和静态部署。

## 增加组件/字段

1. 新字段先更新 Zod，提供默认值与迁移；改变既有含义时递增 version，并增加 v1 → v2 纯函数迁移与测试。
2. 向 kinds / componentRegistry 注册组件的标签与初始值。当前 body 是可共享基础字段。
3. Editor 为组件增加专用控件，ResumeView.Block 增加呈现；共用字体、标题与布局能力。
4. 新图片遵循 readImage() 标准化管线；不得引入远程 iframe、任意 HTML 或不确定的脚本运行时。
5. 更新导入安全与导出回归。必要时增加可判别联合 schema，禁止随意在数据中放无校验的扩展对象。

## 分页合同

固定页面 794 × 1122，内边距上 54、左右 58、下 74；内容高度 994、宽 678。compact 的上边框 8px 抵扣上 padding，维持相同内容区域。Profile 仅首页出现，页码每页出现。隐藏测量容器加载同一字体与图片后，测得行高度，由 paginate 纯函数装入页面。单行高于内容区触发溢出，禁止排版导出。
