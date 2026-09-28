import { useRef, type ChangeEvent } from 'react';
import {
  Bold,
  Italic,
  Highlighter,
  Code,
  List,
  ListOrdered,
  Upload,
  ImagePlus,
} from 'lucide-react';
import { componentRegistry, fonts, type Resume, type Module, type FontId } from './model';
import { IconPicker } from './IconPicker';
import { Avatar } from './ResumeView';
import { readImage } from './storage';

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
          {profile.photo && (
            <button className="text-button danger" onClick={() => patch({ photo: '' })}>
              移除头像
            </button>
          )}
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
      {(
        [
          ['name', '姓名', '你的姓名'],
          ['role', '求职意向', '职位 / 职业方向'],
          ['email', '电子邮箱', 'hello@example.com'],
          ['phone', '联系电话', '138 0000 0000'],
          ['location', '所在城市', '上海'],
          ['website', '个人网站', 'portfolio.example.com'],
        ] as const
      ).map(([key, label, placeholder]) => (
        <label className="field" key={key}>
          <span>{label}</span>
          <input
            maxLength={200}
            value={profile[key]}
            placeholder={placeholder}
            onChange={(e) => patch({ [key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
export function ModuleEditor({
  item,
  onChange,
  notify,
}: {
  item: Module;
  onChange: (m: Module) => void;
  notify: (s: string) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<Module>) => onChange({ ...item, ...p });
  function format(start: string, end = start) {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = item.body.slice(a, b) || '文字';
    patch({ body: item.body.slice(0, a) + start + selected + end + item.body.slice(b) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + start.length, a + start.length + selected.length);
    });
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      patch({ image: await readImage(f, true) });
    } catch (err) {
      notify((err as Error).message);
    }
  }
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
      {item.kind === 'qr' && (
        <div className="qr-upload">
          {item.image && <img src={item.image} alt="已上传的二维码" />}
          <button className="small-button" onClick={() => file.current?.click()}>
            <Upload size={15} />
            {item.image ? '更换二维码' : '上传二维码'}
          </button>
          <input
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            ref={file}
            onChange={(e) => void upload(e)}
          />
          <p className="hint">保留完整白边以便扫描；导出后请用手机验证。</p>
        </div>
      )}
      <div className="field">
        <div className="label-line">
          <span>{item.kind === 'qr' ? '图片说明' : '正文内容'}</span>
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
              <button
                key={label}
                title={label}
                aria-label={label}
                onClick={() => format(start, end)}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <textarea
            ref={area}
            aria-label="Markdown 正文"
            maxLength={30000}
            spellCheck={false}
            value={item.body}
            onChange={(e) => patch({ body: e.target.value })}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key)) {
                e.preventDefault();
                format(e.key === 'b' ? '**' : '*');
              }
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                const el = e.currentTarget,
                  pos = el.selectionStart;
                patch({ body: item.body.slice(0, pos) + '  ' + item.body.slice(el.selectionEnd) });
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = pos + 2;
                });
              }
            }}
          />
          <div className="editor-counter">{item.body.length.toLocaleString()} / 30,000</div>
        </div>
        <p className="hint">支持组合格式，例如 **==重点成果==**。Tab 缩进列表。</p>
      </div>
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
