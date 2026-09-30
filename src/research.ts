import { z } from 'zod';

export const researchKinds = {
  'paper-en': '英文论文',
  'paper-zh': '中文论文',
  fund: '基金',
  patent: '专利',
} as const;
export const researchStatuses = {
  published: '出版',
  proofreading: '校稿',
  revision: '反修',
  review: '外审',
  submitted: '投稿',
  applied: '申请 / 申报',
  funded: '立项',
  completed: '结项',
  granted: '授权',
} as const;
export const researchLevels = {
  'paper-en': ['SCI 一区', 'SCI 二区', 'SCI 三区', 'SCI 四区', 'CCF-A', 'CCF-B', 'CCF-C', 'EI'],
  'paper-zh': ['CCF-A', 'CCF-B', 'CCF-C', 'EI', '核心', 'CSSCI', 'CSCD'],
  fund: ['国家级', '省部级', '市厅级', '校级'],
  patent: ['发明专利', '外观设计专利', '实用新型专利'],
} as const;

/** 只生成用户点击的链接，不解析远程元数据；DOI 后缀作为路径编码，避免变成查询或片段。 */
export function researchURL(input: string): string | null {
  const text = input.trim().replace(/^doi:\s*/i, '');
  if (!text || /[\s\u0000-\u001f\u007f]/.test(text)) return null;
  let doi = text;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.username || url.password) return null;
      if (!['doi.org', 'dx.doi.org'].includes(url.hostname.toLowerCase())) return url.href;
      if (url.search || url.hash || url.port) return null;
      doi = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return null;
    }
  }
  if (!/^10\.\d{4,9}\/[^\s\u0000-\u001f\u007f]+$/.test(doi)) return null;
  return `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`;
}

export const researchSchema = z.object({
  visible: z.boolean(),
  kind: z.enum(['paper-en', 'paper-zh', 'fund', 'patent']),
  title: z.string().max(500),
  venue: z.string().max(200),
  authorOrder: z.string().max(200),
  level: z.string().max(100),
  openSource: z.enum(['', 'open', 'closed']),
  status: z.enum(['', ...(Object.keys(researchStatuses) as (keyof typeof researchStatuses)[])]),
  link: z
    .string()
    .max(2000)
    .refine(
      (value) => value === '' || researchURL(value) !== null,
      '请输入 DOI 或不含凭据的完整 HTTP / HTTPS 地址',
    ),
});
export type Research = z.infer<typeof researchSchema>;
export function createResearch(): Research {
  return {
    visible: false,
    kind: 'paper-en',
    title: '',
    venue: '',
    authorOrder: '',
    level: '',
    openSource: '',
    status: '',
    link: '',
  };
}
