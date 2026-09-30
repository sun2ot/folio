import { useRef } from 'react';
import { Bold, Italic, Highlighter, Code, List, ListOrdered } from 'lucide-react';
import { entryFields, createEntry, type Entry, type Resume, type Module } from '../model';
import { IconPicker } from '../IconPicker';
import { RepositoryEditor } from '../RepositoryEditor';
import { ColorField, FontSelect } from './TypographyControls';

function MarkdownEditor({
  value,
  onChange,
  label = 'Markdown 正文',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  function format(start: string, end = start) {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = value.slice(a, b) || '文字';
    onChange(value.slice(0, a) + start + selected + end + value.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + start.length, a + start.length + selected.length);
    });
  }
  return (
    <div className="field">
      <div className="label-line">
        <span>{label}</span>
        <span className="tag">Markdown</span>
      </div>
      <div className="markdown-editor">
        <div className="format-toolbar">
          {[
            { label: '加粗', icon: Bold, start: '**' },
            { label: '斜体', icon: Italic, start: '*' },
            { label: '高亮', icon: Highlighter, start: '==' },
            { label: '行内代码', icon: Code, start: '`' },
            { label: '无序列表', icon: List, start: '\n- ', end: '' },
            { label: '有序列表', icon: ListOrdered, start: '\n1. ', end: '' },
          ].map(({ label, icon: Icon, start, end }) => (
            <button key={label} title={label} aria-label={label} onClick={() => format(start, end)}>
              <Icon size={16} />
            </button>
          ))}
        </div>
        <textarea
          ref={area}
          aria-label={label}
          maxLength={30000}
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key)) {
              e.preventDefault();
              format(e.key === 'b' ? '**' : '*');
            }
            // Tab only indents an actual list; elsewhere it remains available for keyboard navigation.
            if (e.key === 'Tab' && !e.shiftKey) {
              const el = e.currentTarget,
                pos = el.selectionStart;
              const line = value.slice(value.lastIndexOf('\n', pos - 1) + 1, pos);
              if (!/^\s*(?:[-*+] |\d+\. )/.test(line)) return;
              e.preventDefault();
              onChange(value.slice(0, pos) + '  ' + value.slice(el.selectionEnd));
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = pos + 2;
              });
            }
          }}
        />
        <div className="editor-counter">{value.length.toLocaleString()} / 30,000</div>
      </div>
      <p className="hint">列表内 Tab 缩进，Shift+Tab 离开。</p>
    </div>
  );
}

export function ModuleEditor({
  item,
  theme,
  onChange,
}: {
  item: Module;
  theme: Resume['theme'];
  onChange: (m: Module) => void;
}) {
  const patch = (p: Partial<Module>) => onChange({ ...item, ...p });
  const entryName = { text: '', experience: '工作经历', projects: '项目', education: '教育背景' }[
    item.kind
  ];
  const fields = item.kind === 'text' ? [] : entryFields[item.kind];
  return (
    <div className="editor-fields">
      <div className="panel-intro">
        <h2>{item.title || '未命名模块'}</h2>
      </div>
      <label className="field">
        <span>模块标题</span>
        <input
          maxLength={200}
          value={item.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>
      <div className="field-row">
        <div className="field">
          <span>标题图标</span>
          <IconPicker value={item.icon} onChange={(icon) => patch({ icon })} />
        </div>
        <label className="field">
          <span>模块宽度</span>
          <select
            value={item.width}
            onChange={(e) => patch({ width: e.target.value as Module['width'] })}
          >
            <option value="full">整行</option>
            <option value="half">半行 / 双栏</option>
          </select>
        </label>
      </div>
      {item.kind === 'text' ? (
        <MarkdownEditor value={item.body} onChange={(body) => patch({ body })} />
      ) : (
        <>
          <label className="field">
            <span>{entryName}标题布局</span>
            <select
              aria-label={`${entryName}标题布局`}
              value={item.entryLayout}
              onChange={(e) => patch({ entryLayout: e.target.value as Module['entryLayout'] })}
            >
              <option value="left-right">左右布局</option>
              <option value="left-center-right">左中右布局</option>
            </select>
          </label>
          {item.entries.map((entry, i) => {
            const change = (values: Partial<Entry>) =>
              patch({
                entries: item.entries.map((e) => (e.id === entry.id ? { ...e, ...values } : e)),
              });
            const move = (direction: number) => {
              const entries = [...item.entries];
              [entries[i], entries[i + direction]] = [entries[i + direction], entries[i]];
              patch({ entries });
            };
            return (
              <fieldset className="entry-editor" key={entry.id}>
                <legend>
                  {entryName} {i + 1}
                </legend>
                {fields.map(([key, label]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input
                      maxLength={200}
                      value={entry[key]}
                      onChange={(e) => change({ [key]: e.target.value })}
                    />
                  </label>
                ))}
                <div className="field-row">
                  {(
                    [
                      ['start', '开始时间'],
                      ['end', '结束时间'],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="field" key={key}>
                      <span>{label}</span>
                      <input
                        maxLength={200}
                        placeholder={key === 'end' ? '至今 / 2026.06' : '2023.09'}
                        value={entry[key]}
                        onChange={(e) => change({ [key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
                <MarkdownEditor
                  label={`第 ${i + 1} 条${entryName}详情`}
                  value={entry.body}
                  onChange={(body) => change({ body })}
                />
                {item.kind === 'projects' && (
                  <RepositoryEditor
                    value={entry.github}
                    onChange={(github) => change({ github })}
                  />
                )}
                <div className="entry-actions">
                  <button
                    className="small-button"
                    disabled={i === 0}
                    onClick={() => move(-1)}
                    aria-label={`上移第 ${i + 1} 条${entryName}`}
                  >
                    上移
                  </button>
                  <button
                    className="small-button"
                    disabled={i === item.entries.length - 1}
                    onClick={() => move(1)}
                    aria-label={`下移第 ${i + 1} 条${entryName}`}
                  >
                    下移
                  </button>
                  <button
                    className="small-button danger"
                    onClick={() =>
                      patch({ entries: item.entries.filter((e) => e.id !== entry.id) })
                    }
                    aria-label={`删除第 ${i + 1} 条${entryName}`}
                  >
                    删除
                  </button>
                </div>
              </fieldset>
            );
          })}
          <button
            className="small-button"
            disabled={item.entries.length >= 30}
            onClick={() => patch({ entries: [...item.entries, createEntry()] })}
          >
            添加{entryName}
          </button>
        </>
      )}
      <details className="style-details" open>
        <summary>字体与排版</summary>
        {(['titleStyle', 'bodyStyle'] as const).map((key, i) => (
          <div className="field" key={key}>
            <span>{i === 0 ? '标题' : '正文'}</span>
            <div className="typography-row">
              <FontSelect
                label={`${i === 0 ? '标题' : '正文'}字体`}
                value={item[key].font}
                onChange={(font) => patch({ [key]: { ...item[key], font } })}
              />
              <div className="font-size-select">
                <select
                  aria-label={`${i === 0 ? '标题' : '正文'}字号`}
                  value={item[key].size}
                  onChange={(e) => patch({ [key]: { ...item[key], size: +e.target.value } })}
                >
                  {Array.from({ length: 22 }, (_, j) => j + 9).map((n) => (
                    <option value={n} key={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">px</span>
              </div>
              <ColorField
                compact
                label={`${i === 0 ? '标题' : '正文'}颜色`}
                value={item[key].color}
                fallback={i === 0 ? theme.titleColor || theme.textColor : theme.textColor}
                onChange={(color) => patch({ [key]: { ...item[key], color } })}
              />
            </div>
          </div>
        ))}
        <label className="check-field">
          <input
            type="checkbox"
            checked={item.pageBreak}
            onChange={(e) => patch({ pageBreak: e.target.checked })}
          />{' '}
          在此模块前换页
        </label>
      </details>
    </div>
  );
}
