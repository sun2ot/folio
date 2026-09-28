# 第三方与字体

依赖的精确版本见 pnpm-lock.yaml。React、Vite、TypeScript、Marked、DOMPurify、html2canvas、jsPDF、idb-keyval、Zod、Lucide 各自保留其发行许可；分发时遵循相应包的 LICENSE。

字体：Noto Sans SC / Noto Serif SC（Google/Adobe Noto 项目）、Inter（Rasmus Andersson）、Source Serif 4（Adobe）。从 Fontsource 包取得，采用 SIL Open Font License 1.1。对应许可副本在 public/licenses/，生产构建自动复制至 dist/licenses/。未修改原始字体文件，不对字体单独收费，不宣称拥有其名称。

简体中文字集为控制下载体积而选用上游已分发子集，粗斜体由浏览器合成。需要品牌指定字体时，自行核实许可、添加本地字体文件，并同步 fonts.ts、schema、选择器、嵌入导出与许可副本。
