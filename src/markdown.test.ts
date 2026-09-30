import { describe, expect, it } from 'vitest';
import { markdown, markdownUnits, markdownFragment } from './markdown';

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
  it('分页沿用安全白名单，保留嵌套格式与链接定义', () => {
    const parts = markdownUnits(
      '**==成果==**\n\n[链接][paper]\n\n[paper]: https://example.test/paper\n\n<script>alert(1)</script><img src="https://evil.test/a" style="color:red">',
    );
    const html = markdownFragment(parts);
    expect(html).toContain('<strong><mark>成果</mark></strong>');
    expect(html).toContain('href="https://example.test/paper"');
    expect(html).not.toMatch(/<script|<img|style=/);
  });
  it('列表按父项划分，续页保留有序编号与嵌套列表', () => {
    const parts = markdownUnits('3. 项目三\n   - 子项甲\n   - 子项乙\n4. 项目四\n5. 项目五');
    expect(parts).toHaveLength(3);
    expect(markdownFragment(parts, 0, 1)).toContain('<ul>');
    expect(markdownFragment(parts, 1, 3)).toMatch(/^<ol start="4">/);
    expect(markdownFragment(parts, 1, 3)).not.toContain('项目三');
    expect(markdownFragment(parts, 1, 3)).toContain('项目五');
  });
  it('小标题与紧随段落或第一条列表项保持同一分页单位', () => {
    const parts = markdownUnits('### 研究方法\n\n解释段落\n\n### 研究成果\n\n- 成果一\n- 成果二');
    expect(parts).toHaveLength(3);
    expect(markdownFragment(parts, 0, 1)).toContain('<h3>研究方法</h3>');
    expect(markdownFragment(parts, 0, 1)).toContain('解释段落');
    expect(markdownFragment(parts, 1, 2)).toContain('<h3>研究成果</h3>');
    expect(markdownFragment(parts, 1, 2)).toContain('成果一');
    expect(markdownFragment(parts, 2, 3)).not.toContain('研究成果');
  });
  it('分页组合的 HTML 仍经过唯一 Markdown 安全入口', () => {
    expect(
      markdownFragment([
        {
          before: '',
          html: '<p style="color:red" onclick="alert(1)">内容</p><script>alert(1)</script><img src="https://evil.test/a">',
        },
      ]),
    ).not.toMatch(/<script|<img|style=|onclick=/);
  });
});
