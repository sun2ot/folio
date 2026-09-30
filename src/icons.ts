import { z } from 'zod';
import { icons as lucideIcons, type LucideIcon } from 'lucide-react';

// 保留已有文档的短键；完整图标使用库自身的名称，标识不依赖显示文案。
const legacy = {
  none: null,
  user: lucideIcons.UserRound,
  briefcase: lucideIcons.BriefcaseBusiness,
  graduation: lucideIcons.GraduationCap,
  code: lucideIcons.CodeXml,
  award: lucideIcons.Award,
  link: lucideIcons.Link,
  star: lucideIcons.Star,
  phone: lucideIcons.Phone,
  mail: lucideIcons.Mail,
  globe: lucideIcons.Globe,
  github: lucideIcons.Github,
  calendar: lucideIcons.CalendarDays,
  flag: lucideIcons.Flag,
  contact: lucideIcons.ContactRound,
  clock: lucideIcons.Clock,
  map: lucideIcons.MapPin,
  pencil: lucideIcons.Pencil,
  trend: lucideIcons.TrendingUp,
  gear: lucideIcons.Settings,
} as const;
export type IconId = keyof typeof legacy | `lucide:${keyof typeof lucideIcons}`;
export const iconMap: Record<IconId, LucideIcon | null> = {
  ...Object.fromEntries(Object.entries(lucideIcons).map(([key, icon]) => [`lucide:${key}`, icon])),
  ...legacy,
} as Record<IconId, LucideIcon | null>;
export const icons = [
  ...Object.keys(legacy),
  ...Object.keys(lucideIcons)
    .sort()
    .map((key) => `lucide:${key}`),
] as IconId[];
export const iconSchema = z.custom<IconId>(
  (value) => typeof value === 'string' && value.length <= 80 && Object.hasOwn(iconMap, value),
  '请选择本地图标库中的图标',
);
const legacyLabels: Record<keyof typeof legacy, string> = {
  none: '无图标',
  user: '个人',
  briefcase: '工作',
  graduation: '教育',
  code: '代码',
  award: '荣誉',
  link: '链接',
  star: '星标',
  phone: '电话',
  mail: '邮箱',
  globe: '网站',
  github: 'GitHub',
  calendar: '日期',
  flag: '政治面貌',
  contact: '联系',
  clock: '时间',
  map: '地点',
  pencil: '铅笔',
  trend: '趋势',
  gear: '齿轮',
};
export const iconLabels = Object.fromEntries(
  icons.map((id) => [
    id,
    id.startsWith('lucide:') ? id.slice(7) : legacyLabels[id as keyof typeof legacy],
  ]),
) as Record<IconId, string>;
const keywords = [
  ['pencil', '铅笔 编辑 写作'],
  ['pen', '笔 写作'],
  ['trend', '趋势 增长 数据'],
  ['setting', '齿轮 设置 gear'],
  ['gear', '设置 settings'],
  ['user', '个人 用户 人物'],
  ['briefcase', '工作 职业'],
  ['graduation', '教育 学历 学校'],
  ['code', '代码 编程'],
  ['award', '荣誉 奖项'],
  ['star', '星标 收藏'],
  ['link', '链接'],
  ['phone', '电话 手机'],
  ['mail', '邮箱 邮件'],
  ['globe', '网站 地球'],
  ['calendar', '日期 日历'],
  ['clock', '时间 时钟'],
  ['map', '地图 地点'],
  ['book', '书籍 阅读 论文'],
  ['file', '文件 文档 简历'],
  ['chart', '图表 统计 数据'],
  ['flask', '科研 实验'],
  ['atom', '科学 科研'],
  ['microscope', '科研 实验'],
  ['heart', '爱心 医疗'],
  ['lightbulb', '灯泡 创意'],
  ['shield', '安全 盾牌'],
  ['wrench', '工具 扳手'],
  ['laptop', '电脑'],
  ['camera', '相机 摄影'],
  ['music', '音乐'],
  ['languages', '语言 翻译'],
] as const;
const searchTerms = new Map(
  icons.map((id) => {
    const english = `${id} ${iconLabels[id]}`.toLowerCase();
    return [
      id,
      english +
        ' ' +
        keywords
          .filter(([key]) => english.includes(key))
          .map(([, words]) => words)
          .join(' '),
    ];
  }),
);
export function findIcons(query: string): IconId[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return icons.filter((id) => terms.every((term) => searchTerms.get(id)!.includes(term)));
}
