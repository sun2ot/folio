import { Marked } from 'marked';
import DOMPurify from 'dompurify';

// Inline extension delegates nested formatting to Marked (including code spans).
const parser = new Marked({
  gfm: true,
  breaks: true,
  extensions: [
    {
      name: 'highlight',
      level: 'inline',
      start: (src: string) => src.indexOf('=='),
      tokenizer(src) {
        const match = /^==([^\n]+?)==/.exec(src);
        if (match)
          return { type: 'highlight', raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`;
      },
    },
  ],
});
export function markdown(source: string): string {
  return DOMPurify.sanitize(parser.parse(source, { async: false }), {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'del',
      'mark',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'h3',
      'h4',
      'blockquote',
      'a',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOW_DATA_ATTR: false,
  });
}

export type MarkdownUnit = {
  before: string;
  html: string;
  list?: { group: number; tag: 'ul' | 'ol'; start: number };
};

/** 从唯一的已清洗 HTML 入口划分分页单位，不重新解释正文或扩大白名单。 */
export function markdownUnits(source: string): MarkdownUnit[] {
  const root = document.createElement('template');
  root.innerHTML = markdown(source);
  const units: MarkdownUnit[] = [];
  let before = '';
  let group = 0;
  for (const node of [...root.content.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) continue;
      const paragraph = document.createElement('p');
      paragraph.textContent = node.textContent;
      units.push({ before, html: paragraph.outerHTML });
      before = '';
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    if (node.matches('h3, h4')) {
      before += node.outerHTML;
      continue;
    }
    if (node.matches('ul, ol') && node.children.length) {
      const start = Number(node.getAttribute('start') ?? 1);
      const first = Number.isSafeInteger(start) ? start : 1;
      const tag = node.tagName.toLowerCase() as 'ul' | 'ol';
      group++;
      [...node.children].forEach((item, index) => {
        units.push({ before, html: item.outerHTML, list: { group, tag, start: first + index } });
        before = '';
      });
    } else {
      units.push({ before, html: node.outerHTML });
      before = '';
    }
  }
  if (before) units.push({ before: '', html: before });
  return units;
}

/** 只组合同一清洗结果的节点；有序列表续页保留编号，嵌套列表随父项完整保留。 */
export function markdownFragment(
  units: readonly MarkdownUnit[],
  from = 0,
  to = units.length,
): string {
  let html = '';
  let active: MarkdownUnit['list'];
  for (const unit of units.slice(from, to)) {
    if (active && (unit.before || unit.list?.group !== active.group)) {
      html += `</${active.tag}>`;
      active = undefined;
    }
    html += unit.before;
    if (unit.list && !active) {
      active = unit.list;
      html += `<${active.tag}${active.tag === 'ol' && active.start !== 1 ? ` start="${active.start}"` : ''}>`;
    }
    html += unit.html;
  }
  if (active) html += `</${active.tag}>`;
  // 分页生成的标签也由唯一入口交付，调用方无法绕开原有安全白名单。
  return markdown(html);
}
