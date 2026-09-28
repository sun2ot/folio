import { z } from 'zod';

export const fontIds = ['sans', 'serif', 'inter', 'source'] as const;
export const fonts = {
  sans: '思源黑体',
  serif: '思源宋体',
  inter: 'Inter',
  source: 'Source Serif 4',
};
export const fontFamilies = {
  sans: '"Noto Sans SC", sans-serif',
  serif: '"Noto Serif SC", serif',
  inter: 'Inter, "Noto Sans SC", sans-serif',
  source: '"Source Serif 4", "Noto Serif SC", serif',
};
export const icons = [
  'none',
  'user',
  'briefcase',
  'graduation',
  'code',
  'award',
  'link',
  'star',
] as const;
export const kinds = ['text', 'ordered', 'unordered', 'nested', 'qr'] as const;
const short = z.string().max(200);
const image = z
  .string()
  .max(6_000_000)
  .refine(
    (v) => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    '仅接受本地 PNG / JPEG / WebP 图片',
  );
const typography = z.object({ font: z.enum(fontIds), size: z.number().min(9).max(30) });
export const moduleSchema = z.object({
  id: z.string().regex(/^[\w-]{1,80}$/),
  field: z.string().regex(/^[\w.-]{1,80}$/),
  kind: z.enum(kinds),
  title: short,
  icon: z.enum(icons),
  body: z.string().max(30_000),
  titleStyle: typography,
  bodyStyle: typography,
  width: z.enum(['full', 'half']),
  image,
  visible: z.boolean(),
  pageBreak: z.boolean(),
});
export const documentSchema = z
  .object({
    version: z.literal(1),
    name: short,
    profile: z.object({
      name: short,
      role: short,
      email: short,
      phone: short,
      location: short,
      website: short,
      photo: image,
      shape: z.enum(['square', 'circle']),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      zoom: z.number().min(1).max(3),
    }),
    theme: z.object({
      template: z.enum(['editorial', 'classic', 'compact']),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      font: z.enum(fontIds),
      spacing: z.number().min(8).max(28),
    }),
    modules: z.array(moduleSchema).min(1).max(80),
  })
  .superRefine((doc, ctx) => {
    if (new Set(doc.modules.map((m) => m.id)).size !== doc.modules.length)
      ctx.addIssue({ code: 'custom', message: '模块 ID 不可重复', path: ['modules'] });
    if (new Set(doc.modules.map((m) => m.field)).size !== doc.modules.length)
      ctx.addIssue({ code: 'custom', message: '字段键不可重复', path: ['modules'] });
  });
export type Resume = z.infer<typeof documentSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type FontId = (typeof fontIds)[number];
export const componentRegistry: Record<Module['kind'], { label: string; initial: string }> = {
  text: {
    label: '文本框',
    initial: '在这里介绍你的经历，支持 **加粗**、*斜体*、==高亮== 和 `行内代码`。',
  },
  ordered: { label: '有序列表', initial: '1. 描述工作目标\n2. 展示解决方案\n3. 用数据呈现成果' },
  unordered: { label: '无序列表', initial: '- 一项关键能力\n- 一个可量化的成果' },
  nested: {
    label: '多层列表',
    initial:
      '- 专业能力\n  - 产品设计与用户研究\n  - 跨团队协作\n- 技术能力\n  - React / TypeScript',
  },
  qr: { label: '二维码', initial: '扫码查看我的作品集' },
};
export function createModule(kind: Module['kind'], id: string = crypto.randomUUID()): Module {
  return {
    id,
    field: `custom.${id}`,
    kind,
    title: componentRegistry[kind].label,
    body: componentRegistry[kind].initial,
    icon: kind === 'qr' ? 'link' : 'star',
    titleStyle: { font: 'sans', size: 15 },
    bodyStyle: { font: 'sans', size: 12 },
    width: 'full',
    visible: true,
    pageBreak: false,
    image: '',
  };
}
const section = (id: string, title: string, icon: Module['icon'], body: string): Module => ({
  ...createModule('text', id),
  field: id,
  title,
  icon,
  body,
});
export const sample: Resume = {
  version: 1,
  name: '伊云程 · 产品设计师',
  profile: {
    name: '伊云程',
    role: '产品设计师 / Product Designer',
    email: 'hello@example.com',
    phone: '138 0000 0000',
    location: '上海',
    website: 'portfolio.example.com',
    photo: '',
    shape: 'circle',
    x: 50,
    y: 50,
    zoom: 1,
  },
  theme: { template: 'editorial', accent: '#315b50', font: 'sans', spacing: 18 },
  modules: [
    section(
      'summary',
      '关于我',
      'user',
      '拥有 **5 年数字产品设计经验**，专注于将复杂问题转化为清晰、自然的用户体验。兼具设计思维与技术视角，持续探索有温度的数字产品。',
    ),
    section(
      'experience',
      '工作经历',
      'briefcase',
      '### 高级产品设计师 · 山海科技\n**2022.06 — 至今** · 上海\n- 负责核心 SaaS 产品的体验设计，服务 **20,000+** 企业用户。\n- 从 0 到 1 搭建设计系统，交付效率提升 **35%**。\n- 与产品、研发团队紧密协作，核心流程转化率提升 **24%**。\n\n### 产品设计师 · 灵感工作室\n**2020.07 — 2022.05** · 杭州\n- 参与 8 个移动端与 Web 产品的全流程设计。\n- 通过用户访谈与可用性测试，持续优化产品体验。',
    ),
    section(
      'projects',
      '精选项目',
      'code',
      '### Atlas · 团队协作平台\n**体验设计负责人** · 2023\n为分布式团队设计轻量、高效的协作体验。主导信息架构重构与交互设计，上线后用户满意度达到 **4.8 / 5**。\n- 设计覆盖桌面与移动端的统一组件库。\n- 将新用户首次任务完成时间缩短 **40%**。',
    ),
    section(
      'education',
      '教育背景',
      'graduation',
      '**浙江大学** · 工业设计 · 本科\n\n2016.09 — 2020.06',
    ),
    section(
      'skills',
      '专业技能',
      'award',
      '- **设计**：用户研究 / 交互设计 / 视觉设计 / 设计系统\n- **工具**：Figma / Sketch / Adobe Creative Suite\n- **技术**：HTML & CSS / React 基础 / 数据可视化',
    ),
  ],
};
export function moveModule(modules: Module[], from: string, to: string): Module[] {
  const next = [...modules],
    start = next.findIndex((m) => m.id === from),
    end = next.findIndex((m) => m.id === to);
  if (start < 0 || end < 0) return modules;
  next.splice(end, 0, next.splice(start, 1)[0]);
  return next;
}
export function applyTemplate(doc: Resume, template: Resume['theme']['template']): Resume {
  return {
    ...doc,
    theme: { ...doc.theme, template },
    modules: doc.modules.map((m) => ({
      ...m,
      width:
        template === 'compact' && ['education', 'skills', 'summary'].includes(m.field)
          ? 'half'
          : 'full',
    })),
  };
}
