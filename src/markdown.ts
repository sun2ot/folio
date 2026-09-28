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
