import { z } from 'zod';
import { repositorySchema } from './repository';

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
  'phone',
  'mail',
  'globe',
  'github',
  'calendar',
  'flag',
  'contact',
  'clock',
  'map',
] as const;
export const kinds = ['text', 'experience', 'projects', 'education'] as const;
export type IconId = (typeof icons)[number];
/** 基本信息字段是可编辑列表，这里只提供预设：标签与图标都随文档保存。 */
export const infoFieldPresets = [
  { key: 'phone', label: '联系电话', icon: 'phone' },
  { key: 'email', label: '电子邮箱', icon: 'mail' },
  { key: 'gender', label: '性别', icon: 'user' },
  { key: 'github', label: 'GitHub', icon: 'github' },
  { key: 'website', label: '个人网站', icon: 'globe' },
  { key: 'ethnicity', label: '民族', icon: 'contact' },
  { key: 'birthDate', label: '出生日期', icon: 'calendar' },
  { key: 'politicalStatus', label: '政治面貌', icon: 'flag' },
  { key: 'hometown', label: '籍贯', icon: 'map' },
  { key: 'residence', label: '户籍', icon: 'map' },
  { key: 'location', label: '所在城市', icon: 'map' },
  { key: 'experienceYears', label: '工作年限', icon: 'clock' },
] as const satisfies readonly { key: string; label: string; icon: IconId }[];
const short = z.string().max(200);
const image = z
  .string()
  .max(6_000_000)
  .refine(
    (v) => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    '仅接受本地 PNG / JPEG / WebP 图片',
  );
/** 空字符串表示沿用上一级颜色（模块继承全局，全局继承默认墨色）。 */
const color = z.union([z.literal(''), z.string().regex(/^#[0-9a-fA-F]{6}$/)]);
const typography = z.object({
  font: z.enum(fontIds),
  size: z.number().min(9).max(30),
  color,
});
// 省略属性时跟随全局颜色 / 字体；装饰文字的默认字号为 9px。
const decorationStyleSchema = typography.partial();
export type DecorationStyle = z.infer<typeof decorationStyleSchema>;
const dividerSchema = z.object({
  color: color.optional(),
  width: z.number().min(0).max(12).optional(),
});
export const dividerLabels = {
  header: '基本信息分割线',
  section: '模块标题分割线',
  content: '正文分割线',
  footer: '页脚分割线',
  stripe: '顶部色带',
};
export type DividerKey = keyof typeof dividerLabels;
export function defaultDivider(template: Resume['theme']['template'], key: DividerKey) {
  return {
    color:
      key === 'header' || key === 'stripe' || (key === 'section' && template === 'classic')
        ? '#315b50'
        : key === 'footer'
          ? '#e8ece9'
          : '#dce4df',
    width:
      key === 'stripe'
        ? 8
        : key === 'header' && template !== 'classic'
          ? 2
          : key === 'section' && template === 'compact'
            ? 0
            : 1,
  };
}
const identifier = z.string().regex(/^[\w-]{1,80}$/);
export const placementSchema = z
  .object({
    page: z.number().int().min(1).max(80),
    left: z.number().int().min(0).max(794),
    top: z.number().int().min(0).max(1122),
    size: z.number().int().min(40).max(300),
    visible: z.boolean(),
  })
  .refine((p) => p.left + p.size <= 794 && p.top + p.size <= 1122, '图片必须完整位于纸张内');
export type Placement = z.infer<typeof placementSchema>;
export function fitPlacement(p: Placement): Placement {
  const size = Math.round(Math.max(40, Math.min(300, p.size)));
  return {
    ...p,
    size,
    left: Math.round(Math.max(0, Math.min(794 - size, p.left))),
    top: Math.round(Math.max(0, Math.min(1122 - size, p.top))),
  };
}
const entrySchema = z.object({
  id: identifier,
  organization: short,
  role: short,
  location: short,
  degree: short,
  major: short,
  studyMode: short,
  start: short,
  end: short,
  body: z.string().max(30_000),
  github: z.object({ visible: z.boolean(), snapshot: repositorySchema.nullable() }),
});
export type Entry = z.infer<typeof entrySchema>;
export const entryFields = {
  experience: [
    ['organization', '公司 / 单位'],
    ['role', '职位 / 角色'],
    ['location', '工作地点'],
  ],
  projects: [
    ['organization', '项目名称'],
    ['role', '项目角色'],
    ['location', '项目地点'],
  ],
  education: [
    ['organization', '学校'],
    ['degree', '学历 / 学位'],
    ['studyMode', '培养方式'],
    ['major', '专业'],
    ['location', '学校地点'],
  ],
} as const;
export function createEntry(): Entry {
  return {
    id: crypto.randomUUID(),
    organization: '',
    role: '',
    location: '',
    degree: '',
    major: '',
    studyMode: '',
    start: '',
    end: '',
    body: '',
    github: { visible: false, snapshot: null },
  };
}
const infoFieldSchema = z.object({
  id: identifier,
  label: z.string().min(1).max(60),
  value: short,
  icon: z.enum(icons),
  color: color.optional(),
});
export type InfoField = z.infer<typeof infoFieldSchema>;
export function createInfoField(preset?: { label: string; icon: IconId }): InfoField {
  return {
    id: crypto.randomUUID(),
    label: preset?.label ?? '新字段',
    value: '',
    icon: preset?.icon ?? 'star',
    color: '',
  };
}
export const moduleSchema = z.object({
  id: identifier,
  field: z.string().regex(/^[\w.-]{1,80}$/),
  kind: z.enum(kinds),
  title: short,
  icon: z.enum(icons),
  body: z.string().max(30_000),
  titleStyle: typography,
  bodyStyle: typography,
  width: z.enum(['full', 'half']),
  entries: z.array(entrySchema).max(30),
  entryLayout: z.enum(['left-right', 'left-center-right']),
  visible: z.boolean(),
  pageBreak: z.boolean(),
});
export const documentSchema = z
  .object({
    version: z.literal(4),
    name: short,
    profile: z.object({
      name: short,
      nameColor: color,
      role: short,
      roleColor: color.optional(),
      fields: z.array(infoFieldSchema).max(30),
      columns: z.number().int().min(1).max(3),
      infoWidth: z.number().min(280).max(678),
      photo: image,
      shape: z.enum(['square', 'circle']),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      zoom: z.number().min(1).max(3),
    }),
    media: z.object({
      photo: placementSchema,
      qr: placementSchema.safeExtend({ image, label: short }),
    }),
    pageDecoration: z.object({
      headerVisible: z.boolean(),
      headerText: short,
      footerVisible: z.boolean(),
      footerText: z.string().max(100),
      pageNumberVisible: z.boolean(),
      pageNumberFormat: z.string().max(60),
      headerStyle: decorationStyleSchema.optional(),
      footerStyle: decorationStyleSchema.optional(),
      pageNumberStyle: decorationStyleSchema.optional(),
    }),
    theme: z.object({
      template: z.enum(['editorial', 'classic', 'compact']),
      textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      titleColor: color.optional(),
      dividers: z
        .object({
          header: dividerSchema.optional(),
          section: dividerSchema.optional(),
          content: dividerSchema.optional(),
          footer: dividerSchema.optional(),
          stripe: dividerSchema.optional(),
        })
        .optional(),
      font: z.enum(fontIds),
      spacing: z.number().min(8).max(28),
    }),
    modules: z.array(moduleSchema).min(1).max(80),
  })
  .superRefine((doc, ctx) => {
    if (new Set(doc.profile.fields.map((f) => f.id)).size !== doc.profile.fields.length)
      ctx.addIssue({
        code: 'custom',
        message: '信息字段 ID 不可重复',
        path: ['profile', 'fields'],
      });
    if (new Set(doc.modules.map((m) => m.id)).size !== doc.modules.length)
      ctx.addIssue({ code: 'custom', message: '模块 ID 不可重复', path: ['modules'] });
    if (new Set(doc.modules.map((m) => m.field)).size !== doc.modules.length)
      ctx.addIssue({ code: 'custom', message: '字段键不可重复', path: ['modules'] });
    for (const [i, m] of doc.modules.entries()) {
      if (new Set(m.entries.map((e) => e.id)).size !== m.entries.length)
        ctx.addIssue({
          code: 'custom',
          message: '经历条目 ID 不可重复',
          path: ['modules', i, 'entries'],
        });
      if (m.kind === 'text' ? m.entries.length > 0 : m.body !== '')
        ctx.addIssue({
          code: 'custom',
          message: '文本使用正文，经历使用结构化条目',
          path: ['modules', i],
        });
    }
  });
export type Resume = z.infer<typeof documentSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type FontId = (typeof fontIds)[number];
export const componentRegistry: Record<Module['kind'], { label: string; initial: string }> = {
  text: {
    label: '文本框',
    initial: '在这里介绍你的经历，支持 **加粗**、*斜体*、==高亮== 和 `行内代码`。',
  },
  experience: { label: '工作经历', initial: '' },
  projects: { label: '精选项目', initial: '' },
  education: { label: '教育背景', initial: '' },
};
export function createModule(kind: Module['kind'], id: string = crypto.randomUUID()): Module {
  return {
    id,
    field: `custom.${id}`,
    kind,
    title: componentRegistry[kind].label,
    body: componentRegistry[kind].initial,
    icon:
      kind === 'education'
        ? 'graduation'
        : kind === 'experience'
          ? 'briefcase'
          : kind === 'projects'
            ? 'code'
            : 'star',
    titleStyle: { font: 'sans', size: 15, color: '' },
    bodyStyle: { font: 'sans', size: 12, color: '' },
    width: 'full',
    visible: true,
    pageBreak: false,
    entries: kind === 'text' ? [] : [createEntry()],
    entryLayout: 'left-right',
  };
}
const section = (id: string, title: string, icon: Module['icon'], body: string): Module => ({
  ...createModule('text', id),
  field: id,
  title,
  icon,
  body,
});
/** 示例里的“生日”故意与预设标签「出生日期」不同，用来演示标签可自由改名。 */
const sampleInfo: Record<string, string> = {
  phone: '138 0000 0000',
  email: 'hello@example.com',
  birthDate: '1996.08',
  location: '上海',
  website: 'portfolio.example.com',
};
export const sample: Resume = {
  version: 4,
  name: '伊云程 · 产品设计师',
  profile: {
    name: '伊云程',
    nameColor: '',
    role: '产品设计师 / Product Designer',
    roleColor: '',
    fields: infoFieldPresets.map((preset) => ({
      id: preset.key,
      label: preset.key === 'birthDate' ? '生日' : preset.label,
      icon: preset.icon,
      value: sampleInfo[preset.key] ?? '',
      color: '',
    })),
    columns: 2,
    infoWidth: 530,
    photo: '',
    shape: 'circle',
    x: 50,
    y: 50,
    zoom: 1,
  },
  media: {
    photo: { page: 1, left: 636, top: 60, size: 96, visible: true },
    qr: { page: 1, left: 636, top: 900, size: 96, visible: true, image: '', label: '作品集二维码' },
  },
  pageDecoration: {
    headerVisible: true,
    headerText: 'PERSONAL RESUME',
    footerVisible: true,
    footerText: '伊云程 · 产品设计师',
    pageNumberVisible: true,
    pageNumberFormat: '{page} / {pages}',
  },
  theme: {
    template: 'editorial',
    titleColor: '#25332f',
    textColor: '#25332f',
    font: 'sans',
    spacing: 18,
  },
  modules: [
    section(
      'summary',
      '关于我',
      'user',
      '拥有 **5 年数字产品设计经验**，专注于将复杂问题转化为清晰、自然的用户体验。兼具设计思维与技术视角，持续探索有温度的数字产品。',
    ),
    {
      ...createModule('experience', 'experience'),
      field: 'experience',
      entries: [
        {
          ...createEntry(),
          id: 'job-1',
          organization: '山海科技',
          role: '高级产品设计师',
          location: '上海',
          start: '2022.06',
          end: '至今',
          body: '- 负责核心 SaaS 产品的体验设计，服务 **20,000+** 企业用户。\n- 从 0 到 1 搭建设计系统，交付效率提升 **35%**。\n- 核心流程转化率提升 **24%**。',
        },
        {
          ...createEntry(),
          id: 'job-2',
          organization: '灵感工作室',
          role: '产品设计师',
          location: '杭州',
          start: '2020.07',
          end: '2022.05',
          body: '- 参与 8 个移动端与 Web 产品的全流程设计。\n- 通过用户访谈与可用性测试，持续优化产品体验。',
        },
      ],
    },
    {
      ...createModule('projects', 'projects'),
      field: 'projects',
      title: '精选项目',
      entries: [
        {
          ...createEntry(),
          id: 'project-1',
          organization: 'Atlas · 团队协作平台',
          role: '体验设计负责人',
          start: '2023',
          end: '2024',
          body: '为分布式团队设计轻量、高效的协作体验。主导信息架构重构与交互设计，用户满意度达到 **4.8 / 5**。\n- 将新用户首次任务完成时间缩短 **40%**。',
        },
      ],
    },
    {
      ...createModule('education', 'education'),
      field: 'education',
      entries: [
        {
          ...createEntry(),
          id: 'school-1',
          organization: '浙江大学',
          degree: '本科',
          studyMode: '全日制',
          major: '工业设计',
          start: '2016.09',
          end: '2020.06',
          body: '- 主修课程：交互设计、设计研究、产品设计。',
        },
      ],
    },
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
