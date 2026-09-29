import { useRef, useState, type ChangeEvent } from 'react';
import {
  Bold,
  Italic,
  Highlighter,
  Code,
  List,
  ListOrdered,
  Plus,
  Upload,
  ImagePlus,
} from 'lucide-react';
import {
  componentRegistry,
  fonts,
  infoFieldPresets,
  createInfoField,
  entryFields,
  createEntry,
  fitPlacement,
  type Placement,
  type Entry,
  type InfoField,
  type Resume,
  type Module,
  type FontId,
} from './model';
import { IconPicker } from './IconPicker';
import { Avatar, SectionIcon } from './ResumeView';
import { RepositoryEditor } from './RepositoryEditor';
import { readImage, loadDefaultAvatar } from './storage';

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
      <p className="hint">支持 **加粗**、==高亮== 和多层列表；列表内 Tab 缩进，Shift+Tab 离开。</p>
    </div>
  );
}

export function MediaEditor({
  doc,
  onChange,
  notify,
}: {
  doc: Resume;
  onChange: (media: Resume['media']) => void;
  notify: (s: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const patchQR = (value: Partial<Resume['media']['qr']>) =>
    onChange({ ...doc.media, qr: { ...doc.media.qr, ...value } });
  return (
    <div className="editor-fields">
      <div className="panel-intro">
        <h2>图片自由布局</h2>
        <p>
          Shift + 拖动锁定水平或垂直方向。方向键移动 1 px，Shift + 方向键移动 10
          px。也可填写页码和坐标。
        </p>
      </div>
      <div className="qr-upload">
        {doc.media.qr.image && <img src={doc.media.qr.image} alt="已上传的二维码" />}
        <button className="small-button" onClick={() => file.current?.click()}>
          <Upload size={16} />
          {doc.media.qr.image ? '更换二维码' : '上传二维码'}
        </button>
        {doc.media.qr.image && (
          <button className="text-button danger" onClick={() => patchQR({ image: '' })}>
            移除二维码
          </button>
        )}
        <input
          ref={file}
          hidden
          type="file"
          aria-label="二维码图片"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              patchQR({ image: await readImage(f, true) });
            } catch (err) {
              notify((err as Error).message);
            }
          }}
        />
        <p className="hint">
          二维码完整保留白边。头像上传与圆形 /
          方形取景位于「基本信息」。浮动图片不占正文流，请为图片留白。
        </p>
      </div>
      <label className="field">
        <span>二维码替代文本</span>
        <input
          maxLength={200}
          value={doc.media.qr.label}
          onChange={(e) => patchQR({ label: e.target.value })}
        />
      </label>
      {(['photo', 'qr'] as const).map((key) => {
        const p = doc.media[key],
          name = key === 'photo' ? '头像' : '二维码';
        const patch = (value: Partial<Placement>) =>
          onChange({ ...doc.media, [key]: { ...p, ...fitPlacement({ ...p, ...value }) } });
        return (
          <fieldset className="entry-editor" key={key}>
            <legend>{name}位置</legend>
            <label className="check-field">
              <input
                type="checkbox"
                checked={p.visible}
                onChange={(e) => patch({ visible: e.target.checked })}
              />
              显示{name}
            </label>
            {(
              [
                ['page', '页码', 1, 80],
                ['size', '尺寸', 40, 300],
                ['left', '横坐标', 0, 794 - p.size],
                ['top', '纵坐标', 0, 1122 - p.size],
              ] as const
            ).map(([field, label, min, max]) => (
              <label className="field" key={field}>
                <span>
                  {name}
                  {label}
                  {field === 'page' ? '' : '（px）'}
                </span>
                <input
                  type="number"
                  aria-label={`${name}${label}`}
                  min={min}
                  max={max}
                  value={p[field]}
                  onChange={(e) => {
                    if (e.target.value !== '')
                      patch({ [field]: Math.max(min, Math.min(max, Math.round(+e.target.value))) });
                  }}
                />
              </label>
            ))}
          </fieldset>
        );
      })}
      <p className="hint">
        坐标相对于 A4 左上角。指定尚不存在的页会新增空白页；图片位置随模板、备份和导出保留。
      </p>
    </div>
  );
}

export function FontSelect({
  value,
  onChange,
  label,
}: {
  value: FontId;
  onChange: (v: FontId) => void;
  label: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as FontId)}>
      {Object.entries(fonts).map(([id, name]) => (
        <option value={id} key={id}>
          {name}
        </option>
      ))}
    </select>
  );
}
/** 空值表示继承上一级颜色；“跟随全局”按钮把颜色清回继承状态。 */
export function ColorField({
  label,
  value,
  onChange,
  fallback,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallback?: string;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="color-field">
        <input
          type="color"
          aria-label={`${label}取色`}
          value={value || fallback || '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="color-value">{value || '跟随全局'}</span>
        {value && (
          <button
            className="text-button"
            aria-label={`${label}恢复跟随全局`}
            onClick={() => onChange('')}
          >
            跟随全局
          </button>
        )}
      </div>
    </div>
  );
}
export function ProfileEditor({
  profile,
  onChange,
  notify,
}: {
  profile: Resume['profile'];
  onChange: (p: Resume['profile']) => void;
  notify: (s: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null),
    drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const patch = (p: Partial<Resume['profile']>) => onChange({ ...profile, ...p });
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      patch({ photo: await readImage(f), x: 50, y: 50, zoom: 1 });
    } catch (err) {
      notify((err as Error).message);
    }
  };
  return (
    <div className="editor-fields">
      <div className="panel-intro">
        <span className="eyebrow">THE FIRST IMPRESSION</span>
        <h2>基本信息</h2>
        <p>让下一次机会，从认识你开始。</p>
      </div>
      <div className="photo-editor">
        <div
          className={`photo-crop ${profile.photo ? 'has-photo' : ''}`}
          aria-label="拖动调整头像位置"
          onPointerDown={(e) => {
            if (!profile.photo) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: profile.x, py: profile.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            patch({
              x: Math.max(0, Math.min(100, drag.current.px - (e.clientX - drag.current.x))),
              y: Math.max(0, Math.min(100, drag.current.py - (e.clientY - drag.current.y))),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {profile.photo ? <Avatar profile={profile} /> : <ImagePlus size={26} />}
        </div>
        <div>
          <button className="small-button" onClick={() => file.current?.click()}>
            <Upload size={14} /> 上传头像
          </button>
          <p className="hint">JPG / PNG / WebP · 最大 5 MB</p>
          <div className="photo-actions">
            <button
              className="text-button"
              onClick={async () => {
                try {
                  patch({ photo: await loadDefaultAvatar(), x: 50, y: 50, zoom: 1 });
                } catch (err) {
                  notify((err as Error).message);
                }
              }}
            >
              使用默认头像
            </button>
            {profile.photo && (
              <button className="text-button danger" onClick={() => patch({ photo: '' })}>
                移除头像
              </button>
            )}
          </div>
        </div>
        <input
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp"
          ref={file}
          onChange={(e) => void upload(e)}
        />
      </div>
      {profile.photo && (
        <div className="crop-controls">
          <div className="segmented">
            <button
              className={profile.shape === 'circle' ? 'active' : ''}
              onClick={() => patch({ shape: 'circle' })}
            >
              圆形
            </button>
            <button
              className={profile.shape === 'square' ? 'active' : ''}
              onClick={() => patch({ shape: 'square' })}
            >
              方形
            </button>
          </div>
          <label>
            缩放{' '}
            <input
              aria-label="头像缩放"
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={profile.zoom}
              onChange={(e) => patch({ zoom: +e.target.value })}
            />
          </label>
          <label>
            水平位置{' '}
            <input
              aria-label="头像水平位置"
              type="range"
              min="0"
              max="100"
              value={profile.x}
              onChange={(e) => patch({ x: +e.target.value })}
            />
          </label>
          <label>
            垂直位置{' '}
            <input
              aria-label="头像垂直位置"
              type="range"
              min="0"
              max="100"
              value={profile.y}
              onChange={(e) => patch({ y: +e.target.value })}
            />
          </label>
          <p className="hint">拖动头像或使用滑块调整取景。</p>
        </div>
      )}
      <div className="field-row">
        <label className="field">
          <span>姓名</span>
          <input
            maxLength={200}
            value={profile.name}
            placeholder="你的姓名"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <ColorField
          label="姓名颜色"
          value={profile.nameColor}
          onChange={(nameColor) => patch({ nameColor })}
        />{' '}
      </div>
      <label className="field">
        <span>求职意向</span>
        <input
          maxLength={200}
          value={profile.role}
          placeholder="职位 / 职业方向"
          onChange={(e) => patch({ role: e.target.value })}
        />
      </label>
      <div className="info-fields">
        <div className="label-line">
          <span>信息字段</span>
          <span className="tag">{profile.fields.length} 项</span>
        </div>
        {profile.fields.map((field, i) => {
          const change = (values: Partial<InfoField>) =>
            patch({
              fields: profile.fields.map((f) => (f.id === field.id ? { ...f, ...values } : f)),
            });
          const move = (direction: number) => {
            const fields = [...profile.fields];
            [fields[i], fields[i + direction]] = [fields[i + direction], fields[i]];
            patch({ fields });
          };
          return (
            <fieldset className="info-field" key={field.id}>
              <legend>第 {i + 1} 项</legend>
              <div className="info-field-head">
                <label className="field">
                  <span>字段名称</span>
                  <input
                    maxLength={60}
                    aria-label={`第 ${i + 1} 项字段名称`}
                    value={field.label}
                    onChange={(e) => change({ label: e.target.value })}
                  />
                </label>
                <div className="field">
                  <span>字段图标</span>
                  <IconPicker
                    label={`第 ${i + 1} 项图标`}
                    value={field.icon}
                    onChange={(icon) => change({ icon })}
                  />
                </div>
              </div>
              <label className="field">
                <span>字段内容</span>
                <input
                  maxLength={200}
                  aria-label={`第 ${i + 1} 项字段内容`}
                  value={field.value}
                  placeholder="留空则不显示"
                  onChange={(e) => change({ value: e.target.value })}
                />
              </label>
              <div className="entry-actions">
                <button
                  className="small-button"
                  disabled={i === 0}
                  aria-label={`上移第 ${i + 1} 项信息字段`}
                  onClick={() => move(-1)}
                >
                  上移
                </button>
                <button
                  className="small-button"
                  disabled={i === profile.fields.length - 1}
                  aria-label={`下移第 ${i + 1} 项信息字段`}
                  onClick={() => move(1)}
                >
                  下移
                </button>
                <button
                  className="small-button danger"
                  aria-label={`删除第 ${i + 1} 项信息字段`}
                  onClick={() => patch({ fields: profile.fields.filter((f) => f.id !== field.id) })}
                >
                  删除
                </button>
              </div>
            </fieldset>
          );
        })}
        <div className="add-area">
          <button className="add-module" onClick={() => setAdding(!adding)}>
            <Plus size={16} />
            插入信息字段
          </button>
          {adding && (
            <div className="component-menu">
              {infoFieldPresets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => {
                    patch({ fields: [...profile.fields, createInfoField(preset)] });
                    setAdding(false);
                  }}
                >
                  <SectionIcon name={preset.icon} size={14} />
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  patch({ fields: [...profile.fields, createInfoField()] });
                  setAdding(false);
                }}
              >
                <Plus size={14} />
                空白字段
              </button>
            </div>
          )}
        </div>
      </div>
      <label className="field">
        <span>信息列数</span>
        <select value={profile.columns} onChange={(e) => patch({ columns: +e.target.value })}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n} 列
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>信息区域宽度 · {profile.infoWidth} px</span>
        <input
          type="range"
          min="280"
          max="678"
          value={profile.infoWidth}
          onChange={(e) => patch({ infoWidth: +e.target.value })}
        />
      </label>
      <p className="hint">
        预设字段可改名、换图标、删除或插入；留空的信息不会出现在简历上。缩窄信息区域可为浮动图片留白。
      </p>
    </div>
  );
}
export function ModuleEditor({ item, onChange }: { item: Module; onChange: (m: Module) => void }) {
  const patch = (p: Partial<Module>) => onChange({ ...item, ...p });
  const entryName = { text: '', experience: '工作经历', projects: '项目', education: '教育背景' }[
    item.kind
  ];
  const fields = item.kind === 'text' ? [] : entryFields[item.kind];
  return (
    <div className="editor-fields">
      <div className="panel-intro">
        <span className="eyebrow">TELL YOUR STORY</span>
        <h2>{item.title || '未命名模块'}</h2>
        <p>{componentRegistry[item.kind].label} · 所有修改自动保存</p>
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
            <span>经历标题布局</span>
            <select
              value={item.entryLayout}
              onChange={(e) => patch({ entryLayout: e.target.value as Module['entryLayout'] })}
            >
              <option value="left-right">左右：单位与角色 / 时间地点</option>
              <option value="left-center-right">左中右：单位 / 角色或学历 / 时间地点</option>
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
              <select
                aria-label={`${i === 0 ? '标题' : '正文'}字号`}
                value={item[key].size}
                onChange={(e) => patch({ [key]: { ...item[key], size: +e.target.value } })}
              >
                {Array.from({ length: 22 }, (_, j) => j + 9).map((n) => (
                  <option value={n} key={n}>
                    {n} px
                  </option>
                ))}
              </select>
            </div>
            <ColorField
              label={`${i === 0 ? '标题' : '正文'}颜色`}
              value={item[key].color}
              onChange={(color) => patch({ [key]: { ...item[key], color } })}
            />
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
