import { describe, expect, it } from 'vitest';
import { markdown } from './markdown';

describe('安全 Markdown 与组合格式', () => {
  it('保留嵌套的加粗、斜体、高亮与行内代码', () => {
    expect(markdown('**==*成果*==**')).toContain('<strong><mark><em>成果</em></mark></strong>');
    expect(markdown('**`React`**')).toContain('<strong><code>React</code></strong>');
    expect(markdown('`==literal==`')).toContain('<code>==literal==</code>');
  });
  it('移除脚本、事件属性、远程图片和危险链接', () => {
    const html = markdown(
      '<script>alert(1)</script><img src="https://evil.test/a" onerror="alert(1)"><a href="javascript:alert(1)" style="color:red">link</a>',
    );
    expect(html).not.toMatch(/script|onerror|<img|style=/);
    expect(html).toContain('<a>link</a>');
  });
  it('多层有序和无序列表', () => {
    const html = markdown('1. 工作\n   - 子项\n   - 子项二\n2. 教育');
    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)).toHaveLength(4);
  });
});
