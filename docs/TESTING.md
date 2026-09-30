# 测试与发布检查

## 测试取舍

测试应保护具体的产品约束或已知故障，不以用例数量、文件行数或覆盖率百分比作为目标。协议校验和算法边界放在单元测试；用户操作、真实布局、资源加载与导出放在浏览器测试。一个用例只承担一种行为或完整的导出流程，前置数据通过导入合成文档准备，不串联无关编辑操作。

简历纸张的尺寸、颜色继承、分页和浮动图片坐标属于输出合同，可以精确检查。工作台控件检查可操作、同排、无溢出及真实滚轮，不锁定普通控件的像素宽高、禁用态灰色或图标库的内部 CSS 类名。

## 命令与运行对象

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm format:check
pnpm check:tests
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Node.js 22.13+，pnpm 12.6.0。Playwright 使用独立 Chromium 上下文，启动本次 dist 的两个 Vite preview 服务：4173 为根路径，4174 为 /folio/ 子路径；不复用开发服务。修改源码后先重新 build，避免测试旧产物。PowerShell 可使用 `$env:PLAYWRIGHT_CHANNEL='chrome'; pnpm test:e2e` 运行本机独立无头 Chrome。

定向运行直接在脚本后添加文件名，例如 `pnpm test:e2e tests/export.spec.ts`。类型检查独立覆盖 tests 与 Playwright 配置，因为 Playwright 转译 TypeScript 本身不进行类型检查。CI 禁止 test.only，并限制为两个浏览器 worker。

## 自动覆盖与文件职责

| 风险或行为                                                 | 验证位置                                    |
| ---------------------------------------------------------- | ------------------------------------------- |
| v4 导入、字段唯一性、颜色与图片边界、模板保留内容          | src/model.test.ts                           |
| 安全 Markdown、嵌套格式和列表                              | src/markdown.test.ts                        |
| 半宽组行、完整行分页、换页与超长模块                       | src/pagination.test.ts                      |
| 字体 unicode-range 与按需分片筛选                          | src/fonts.test.ts                           |
| GitHub 标识、响应、代理与离线快照失败重试                  | src/repository.test.ts                      |
| 读取失败不写回、保存失败可重试、40 步历史与输入合并        | src/useResume.test.ts                       |
| 编辑、保存、模板、模块排序与图标键盘导航                   | tests/editor.spec.ts                        |
| 信息字段、分层颜色与工作台控件行为                         | tests/profile.spec.ts、tests/design.spec.ts |
| 真实滚轮、日期地点同行、长链接及经历布局                   | tests/layout.spec.ts                        |
| 图片上传失败、取景、缩放拖动、取消、跨页与边界保存         | tests/media.spec.ts                         |
| 页眉页脚继承、重置、独立显示与溢出阻止导出                 | tests/decoration.spec.ts                    |
| 三模板分割线覆盖、隐藏、重置及离线 HTML 精确粗细           | tests/dividers.spec.ts                      |
| 离线卡片、作者头像与备份，解码中的旧头像取消后不覆盖新卡片 | tests/repository\*.spec.ts                  |
| 离线 HTML、JSON、保真 PDF 与原生打印 PDF                   | tests/export.spec.ts                        |
| 静态包许可文件、子路径图片字体与导出动态模块               | tests/deployment.spec.ts                    |

所有网络用例拦截 GitHub 与头像响应，只访问本地应用和本次导出文件。测试数据使用仓库示例、内置卡通头像或生成色块，不使用个人简历和真实二维码。

## PDF 与视觉验证

tests/pdf.ts 使用仅安装于开发环境的 PDF.js 和 @napi-rs/canvas 读取并逐页渲染真实 PDF：验证页数、A4（允许 Chromium 取整造成的 0.3mm 误差）、正文区域存在可见内容，以及三模板第二页图片指定坐标处的像素颜色。逐页释放画布并清理页面，渲染图写入 test-results。

保真 PDF 与原生打印 PDF 都执行上述检查。离线 HTML 断网打开，验证图片解码、内嵌字体实际加载、无脚本和输出样式。原生打印入口另验证临时 DOM 的页数与调用后清理。

页面截图与 PDF 渲染图供人工视觉检查，当前没有跨平台整页像素基线；关键坐标的自动像素检查也不能替代全部页面的人工复核。新增样式需检查三模板的文字、页边距、图标、分割线及浮动图片。可用 Poppler `pdfinfo` 和 `pdftoppm -scale-to 1200 -png` 独立核对。

## 发布检查

1. 完成上述本地命令；GitHub Actions 通过后才发布 Release，下载工件与源码归档均来自同一个 check 任务。
2. 静态包包含 LICENSE、SOURCE.txt、字体许可和运行时依赖许可索引。源码归档包含源码、构建文件、lockfile 与本次生成的离线快照。重新分发修改版本时提供修改版本的对应源码及修改说明。
3. 三模板分别检查无图片、头像形状与边缘取景、1/2/10 页、长 URL、四种字体、混合 Markdown、页脚溢出和第二页图片。
4. 窄屏与短窗口使用真实滚轮；检查 Tab、图标菜单、方向键移动图片、坐标输入、上移下移、焦点和 Escape。
5. Firefox、Safari 和实体打印机按上述输出检查单独验证；自动 Chromium 通过不能代替这些环境。真实二维码留作手机扫描检查。

## 验证记录

2026-09-30，本机 Windows / Node.js 24.18.0 / pnpm 12.6.0 / 无头 Chrome 154：冻结依赖安装、27 项单元测试、格式检查、浏览器测试类型检查和生产构建通过。设置 CI=true，以两个 worker 对本次 dist 执行 41 项浏览器测试，全部通过。

人工检查默认简历及三模板两页文档的保真 PDF 与原生打印 PDF 渲染图（共 14 页），以及桌面、390px 窄屏工作台截图。Poppler 独立确认书简样本的两类 PDF 均为两页 A4，并渲染复核原生打印第二页；本次样本未发现空白页、内容裁切或第二页图片错位。这些检查不等同于所有字体、文档长度和图片组合的完整视觉覆盖。

尚未运行本次 GitHub Actions、Firefox、Safari 或实体打印机检查。
