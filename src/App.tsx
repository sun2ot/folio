import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  GripVertical,
  LayoutTemplate,
  Plus,
  Redo2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Undo2,
  Upload,
  UserRound,
  X,
  Eye,
  EyeOff,
  Trash2,
  Minus,
  PanelLeftClose,
  Github,
  Globe,
} from 'lucide-react';
import {
  applyTemplate,
  componentRegistry,
  createModule,
  moveModule,
  type Resume,
  type Module,
  type Placement,
} from './model';
import { useResume } from './useResume';
import { download, parseImport } from './storage';
import { ResumeView, SectionIcon } from './ResumeView';
import { FontSelect, MediaEditor, ModuleEditor, ProfileEditor } from './Editor';

type Tab = 'content' | 'templates' | 'design';
export default function App() {
  const { doc, update, undo, redo, loaded, status, canUndo, canRedo } = useResume();
  const [selected, setSelected] = useState('profile'),
    [tab, setTab] = useState<Tab>('content');
  const [toast, setToast] = useState(''),
    [adding, setAdding] = useState(false),
    [exporting, setExporting] = useState(false),
    [busy, setBusy] = useState('');
  const [manual, setManual] = useState(false),
    [preview, setPreview] = useState(doc),
    [zoom, setZoom] = useState(0.78);
  const [count, setCount] = useState(1),
    [overflow, setOverflow] = useState<string[]>([]),
    [showEditor, setShowEditor] = useState(true);
  const importRef = useRef<HTMLInputElement>(null),
    drag = useRef<string | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const notify = useCallback((s: string) => setToast(s), []);
  const onReady = useCallback((n: number, over: string[]) => {
    setCount(n);
    setOverflow(over);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (manual) return;
    const timer = setTimeout(() => setPreview(doc), 220);
    return () => clearTimeout(timer);
  }, [doc, manual]);
  useEffect(() => {
    if (exporting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [exporting]);
  const item = doc.modules.find((m) => m.id === selected);
  const changeModule = (m: Module, groupTyping = false) =>
    update(
      (p) => ({ ...p, modules: p.modules.map((old) => (old.id === m.id ? m : old)) }),
      groupTyping,
    );
  const patchTheme = (theme: Partial<Resume['theme']>) =>
    update((p) => ({ ...p, theme: { ...p.theme, ...theme } }));
  const moveMedia = (kind: 'photo' | 'qr', placement: Placement) => {
    update((p) => {
      const next = { ...p, media: { ...p.media, [kind]: { ...p.media[kind], ...placement } } };
      setPreview(next);
      return next;
    });
  };
  const patchDecoration = (values: Partial<Resume['pageDecoration']>) =>
    update((p) => ({ ...p, pageDecoration: { ...p.pageDecoration, ...values } }), true);
  const select = (id: string) => {
    setSelected(id);
    setTab('content');
    setShowEditor(true);
  };
  const add = (kind: Module['kind']) => {
    if (doc.modules.length >= 80) return notify('最多支持 80 个模块');
    const next = createModule(kind);
    update((p) => ({ ...p, modules: [...p.modules, next] }));
    select(next.id);
    setAdding(false);
  };
  const reorder = (id: string, direction: number) => {
    const i = doc.modules.findIndex((m) => m.id === id),
      target = doc.modules[i + direction];
    if (target) update((p) => ({ ...p, modules: moveModule(p.modules, id, target.id) }));
  };
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30_000_000) throw new Error('数据文件不能超过 30 MB');
      const next = parseImport(await file.text());
      update(next);
      setSelected('profile');
      setPreview(next);
      notify('已导入简历；可撤销恢复上一个版本');
    } catch (err) {
      notify(
        `导入失败：${err instanceof SyntaxError ? '不是有效的 JSON 文件' : (err as Error).message.slice(0, 180)}`,
      );
    }
  }
  async function exportFile(kind: 'pdf' | 'html' | 'print' | 'json') {
    if (busy) return;
    if (kind === 'json') {
      download(
        new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
        'folio-resume.json',
      );
      notify('已导出可编辑数据备份');
      return;
    }
    if (preview !== doc) {
      setPreview(doc);
      notify('预览已更新，请确认排版后再次导出');
      return;
    }
    if (overflow.length) return notify('有模块超出一页，请拆分内容或减小字号后导出');
    setBusy('正在准备字体和图片…');
    try {
      const api = await import('./export');
      if (kind === 'pdf') await api.exportPDF(doc.name, setBusy);
      if (kind === 'html') await api.exportHTML(doc.name);
      if (kind === 'print') await api.printResume();
      if (kind !== 'print') notify('导出完成');
      setExporting(false);
    } catch (err) {
      notify(`导出失败：${(err as Error).message}`);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="./" aria-label="Folio 首页">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}folio.svg`} alt="" />
          Folio<span className="brand-dot">.</span>
        </a>
        <span className="header-divider" />
        <div className="document-name">
          <input
            aria-label="简历文件名"
            maxLength={200}
            value={doc.name}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }), true)}
          />
          <span className="save-state">
            <span className={status.includes('失败') ? 'status-dot error' : 'status-dot'} />
            {status}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            title="撤销"
            aria-label="撤销"
            disabled={!canUndo || !!busy}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            title="重做"
            aria-label="重做"
            disabled={!canRedo || !!busy}
            onClick={redo}
          >
            <Redo2 size={18} />
          </button>
          <span className="header-divider" />
          <button
            className="quiet-button import-button"
            disabled={!loaded || !!busy}
            onClick={() => importRef.current?.click()}
          >
            <Upload size={16} />
            导入数据
          </button>
          <button
            className="primary-button"
            disabled={!loaded || !!busy}
            onClick={() => {
              setPreview(doc);
              setExporting(true);
            }}
          >
            <ArrowDownToLine size={16} />
            导出简历
            <ChevronDown size={14} />
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void importData(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </header>
      <main
        className={`workspace ${showEditor ? '' : 'editor-hidden'}`}
        aria-busy={!loaded || !!busy}
        inert={!loaded || !!busy}
      >
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span>简历工作台</span>
            <span className="version-tag">本地版</span>
          </div>
          <nav className="main-tabs" aria-label="编辑模式">
            {(
              [
                { id: 'content', label: '内容', icon: FileText },
                { id: 'templates', label: '模板', icon: LayoutTemplate },
                { id: 'design', label: '样式', icon: Settings2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => {
                  setTab(id);
                  setShowEditor(true);
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <div className="section-label">
            <span>简历模块</span>
            <span>{doc.modules.length + 1}</span>
          </div>
          <button
            className={`module-item profile-item ${selected === 'profile' && tab === 'content' ? 'selected' : ''}`}
            onClick={() => select('profile')}
          >
            <UserRound size={17} />
            <span>基本信息</span>
            <Check size={13} />
          </button>
          <button
            className={`module-item profile-item ${selected === 'media' && tab === 'content' ? 'selected' : ''}`}
            onClick={() => select('media')}
          >
            <Settings2 size={17} />
            <span>头像与二维码</span>
          </button>
          <div className="module-list">
            {doc.modules.map((m, i) => (
              <div
                key={m.id}
                className={`module-item ${selected === m.id && tab === 'content' ? 'selected' : ''} ${!m.visible ? 'muted' : ''}`}
                draggable
                onDragStart={(e) => {
                  drag.current = m.id;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', m.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag.current)
                    update((p) => ({ ...p, modules: moveModule(p.modules, drag.current!, m.id) }));
                  drag.current = null;
                }}
                onDragEnd={() => {
                  drag.current = null;
                }}
              >
                <GripVertical size={13} className="grip" />
                <button className="module-select" onClick={() => select(m.id)}>
                  <SectionIcon name={m.icon} />
                  <span>{m.title || '未命名模块'}</span>
                </button>
                <div className="module-actions">
                  <button
                    aria-label={`上移${m.title}`}
                    disabled={i === 0}
                    onClick={() => reorder(m.id, -1)}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    aria-label={`下移${m.title}`}
                    disabled={i === doc.modules.length - 1}
                    onClick={() => reorder(m.id, 1)}
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    aria-label={`${m.visible ? '隐藏' : '显示'}${m.title}`}
                    onClick={() => changeModule({ ...m, visible: !m.visible })}
                  >
                    {m.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="add-area">
            <button className="add-module" onClick={() => setAdding(!adding)}>
              <Plus size={16} />
              添加模块
            </button>
            {adding && (
              <div className="component-menu">
                {Object.entries(componentRegistry).map(([kind, c]) => (
                  <button key={kind} onClick={() => add(kind as Module['kind'])}>
                    <Plus size={14} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="drag-hint">
            <GripVertical size={13} />
            拖动模块调整顺序
          </p>
          <div className="sidebar-bottom">
            <div className="author-links">
              <a
                href="https://github.com/sun2ot/folio"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub 仓库，作者 sun2ot"
              >
                <Github size={17} aria-hidden="true" />
                <span>sun2ot 作者</span>
              </a>
              <a
                href="https://abdc.net.cn"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="sun2ot 的博客 abdc.net.cn"
              >
                <Globe size={17} aria-hidden="true" />
                <span>博客</span>
              </a>
            </div>
            <div className="privacy-icon">
              <ShieldCheck size={19} />
            </div>
            <strong>你的数据，只属于你</strong>
            <p>
              简历仅保存在当前浏览器中。
              <br />
              建议定期导出 JSON 备份。
            </p>
            <button className="text-button" onClick={() => void exportFile('json')}>
              备份我的数据 <ArrowDownToLine size={12} />
            </button>
          </div>
        </aside>
        <section className="editor-panel">
          <div className="editor-panel-top">
            <span>
              <span className="small-dot" />
              编辑内容
            </span>
            <button
              className="icon-button"
              aria-label="收起编辑面板"
              onClick={() => setShowEditor(false)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          {tab === 'content' &&
            (selected === 'media' ? (
              <MediaEditor
                doc={doc}
                onChange={(media) => update((p) => ({ ...p, media }))}
                notify={notify}
              />
            ) : selected === 'profile' || !item ? (
              <ProfileEditor
                profile={doc.profile}
                onChange={(profile) => update((p) => ({ ...p, profile }), true)}
                notify={notify}
              />
            ) : (
              <>
                <ModuleEditor key={item.id} item={item} onChange={(m) => changeModule(m, true)} />
                <button
                  className="delete-button"
                  disabled={doc.modules.length <= 1}
                  onClick={() => {
                    update((p) => ({ ...p, modules: p.modules.filter((m) => m.id !== item.id) }));
                    select('profile');
                    notify('模块已删除，可点击撤销恢复');
                  }}
                >
                  <Trash2 size={14} />
                  删除此模块
                </button>
              </>
            ))}
          {tab === 'templates' && (
            <div className="editor-fields">
              <div className="panel-intro">
                <span className="eyebrow">A FRAME FOR YOUR STORY</span>
                <h2>选择你的风格</h2>
                <p>同一份经历，多一种表达。切换模板保留内容与字体。</p>
              </div>
              {(
                [
                  { id: 'editorial', name: '青序', desc: '清晰层次 · 现代留白', cls: '' },
                  { id: 'classic', name: '书简', desc: '居中抬头 · 经典沉稳', cls: 'center' },
                  { id: 'compact', name: '构筑', desc: '灵活双栏 · 高效呈现', cls: 'columns' },
                ] as const
              ).map((t) => (
                <button
                  className={`template-card ${doc.theme.template === t.id ? 'active' : ''}`}
                  key={t.id}
                  onClick={() => update((p) => applyTemplate(p, t.id))}
                >
                  <div className={`template-mini ${t.cls}`}>
                    <b />
                    <i />
                    <i />
                    <hr />
                    <strong />
                    <i />
                    <i />
                    <i />
                    <strong />
                    <i />
                    <i />
                  </div>
                  <div className="template-info">
                    <strong>{t.name}</strong>
                    <span>{t.desc}</span>
                  </div>
                  {doc.theme.template === t.id && (
                    <span className="template-check">
                      <Check size={14} />
                    </span>
                  )}
                </button>
              ))}
              <p className="hint">模板决定整体视觉与初始栏宽，模块宽度仍可单独调整。</p>
            </div>
          )}
          {tab === 'design' && (
            <div className="editor-fields">
              <div className="panel-intro">
                <span className="eyebrow">MAKE IT YOURS</span>
                <h2>细节，定义风格</h2>
                <p>A4 标准纸张 · 统一预览与导出排版</p>
              </div>
              <div className="field">
                <span>主题色（姓名、模块标题与正文的默认颜色）</span>
                <div className="swatches">
                  {[
                    '#25332f',
                    '#315b50',
                    '#2c466b',
                    '#343434',
                    '#7d4651',
                    '#866339',
                    '#61517c',
                  ].map((color) => (
                    <button
                      key={color}
                      aria-label={`主题色 ${color}`}
                      className={doc.theme.textColor === color ? 'active' : ''}
                      style={{ background: color }}
                      onClick={() => patchTheme({ textColor: color })}
                    >
                      {doc.theme.textColor === color && <Check size={15} />}
                    </button>
                  ))}
                  <input
                    aria-label="自定义主题色"
                    type="color"
                    value={doc.theme.textColor}
                    onChange={(e) => patchTheme({ textColor: e.target.value })}
                  />
                </div>
                <p className="hint">
                  模块与基本信息里的单独颜色会覆盖这里；未单独设置的元素跟随主题色。
                </p>
              </div>
              <label className="field">
                <span>姓名与个人信息字体</span>
                <FontSelect
                  label="全局字体"
                  value={doc.theme.font}
                  onChange={(font) => patchTheme({ font })}
                />
              </label>{' '}
              <label className="field">
                <span>模块间距 · {doc.theme.spacing} px</span>
                <input
                  type="range"
                  min="8"
                  max="28"
                  value={doc.theme.spacing}
                  onChange={(e) => patchTheme({ spacing: +e.target.value })}
                />
              </label>
              <details className="style-details" open>
                <summary>页眉与页脚</summary>
                {(
                  [
                    ['headerVisible', '显示页眉', 'headerText', '页眉内容', 200],
                    ['footerVisible', '显示页脚标识', 'footerText', '页脚标识 / ID', 100],
                    ['pageNumberVisible', '显示页码', 'pageNumberFormat', '页码格式', 60],
                  ] as const
                ).map(([visible, label, key, contentLabel, max]) => (
                  <div key={key}>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={doc.pageDecoration[visible]}
                        onChange={(e) => patchDecoration({ [visible]: e.target.checked })}
                      />
                      {label}
                    </label>
                    <label className="field">
                      <span>{contentLabel}</span>
                      <input
                        maxLength={max}
                        value={doc.pageDecoration[key]}
                        onChange={(e) => patchDecoration({ [key]: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
                <p className="hint">
                  页码格式可使用 {'{page}'} 表示当前页、{'{pages}'} 表示总页数，例如「第 {'{page}'}{' '}
                  页 / 共 {'{pages}'} 页」。
                </p>
              </details>
              <div className="tip-card">
                <Sparkles size={18} />
                <h3>让内容自然呼吸</h3>
                <p>保持简洁的段落，用数据凸显成果。适当的留白，让重要信息更容易被看见。</p>
              </div>
              <div className="font-note">
                <strong>开源字体，随项目部署</strong>
                <p>
                  中文：思源黑体、思源宋体
                  <br />
                  英文：Inter、Source Serif 4<br />
                  浏览器按 unicode-range 只取需要的分片；
                  <br />
                  离线 HTML
                  也只内嵌正文真正用到的分片与图片，不会打包整套字体。粗体及斜体由浏览器合成。
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="preview-panel">
          <div className="preview-toolbar">
            <div className="preview-title">
              {!showEditor && (
                <button
                  className="icon-button"
                  aria-label="展开编辑面板"
                  onClick={() => setShowEditor(true)}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <span>实时预览</span>
              <span className="paper-badge">A4</span>
            </div>
            <div className="preview-controls">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={!manual}
                  onChange={(e) => setManual(!e.target.checked)}
                />
                <span>自动更新</span>
              </label>
              {manual && (
                <button className="small-button" onClick={() => setPreview(doc)}>
                  更新预览{preview !== doc ? ' •' : ''}
                </button>
              )}
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                aria-label="缩小预览"
                onClick={() => setZoom((v) => Math.max(0.35, +(v - 0.1).toFixed(2)))}
              >
                <Minus size={14} />
              </button>
              <span className="zoom-value">{Math.round(zoom * 100)}%</span>
              <button
                className="icon-button"
                aria-label="放大预览"
                onClick={() => setZoom((v) => Math.min(1.2, +(v + 0.1).toFixed(2)))}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {overflow.length > 0 && (
            <div className="overflow-warning" role="alert">
              “{overflow.join('、')}”超出一页，请拆分模块或缩小字号后导出。
            </div>
          )}
          <div className="preview-scroll">
            <div className="preview-caption">
              <span className="small-dot" />
              {manual ? '手动预览' : '所见即所得'}
              <span>点击页面模块即可编辑</span>
            </div>
            <div className="preview-scale" style={{ zoom }}>
              <ResumeView
                doc={preview}
                onReady={onReady}
                onSelect={select}
                onMoveMedia={moveMedia}
              />
            </div>
            <div className="preview-bottom">
              <CheckCheck size={14} />
              每一段经历，都值得被认真呈现。
            </div>
          </div>
          <div className="preview-status">
            <span>
              <span className="small-dot" />
              {count} 页 · A4 210 × 297 mm
            </span>
            <span>
              本地存储 <ShieldCheck size={12} />
            </span>
          </div>
        </section>
      </main>
      <dialog
        ref={dialog}
        className="export-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setExporting(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) setExporting(false);
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">READY FOR YOUR NEXT CHAPTER</span>
            <h2>带上简历，迈向下一步</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭导出"
            disabled={!!busy}
            onClick={() => setExporting(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="dialog-desc">选择适合你的格式。所有导出都在本地完成。</p>
        <div className="export-options">
          {(
            [
              {
                kind: 'pdf',
                title: '保真 PDF',
                badge: '推荐',
                desc: '逐页高清生成，保持预览外观。文字不可选择。',
              },
              {
                kind: 'print',
                title: '打印 / 文字 PDF',
                badge: '可选择文字',
                desc: '浏览器另存为 PDF；请选择 A4、100%、无边距、开启背景、关闭页眉页脚。',
              },
              {
                kind: 'html',
                title: '独立 HTML',
                badge: '离线可用',
                desc: '内嵌字体和图片，无需网络即可浏览与打印。',
              },
              {
                kind: 'json',
                title: 'JSON 数据备份',
                badge: '可再次编辑',
                desc: '保存全部内容、图片和布局，可在其他浏览器导入。',
              },
            ] as const
          ).map((o) => (
            <button
              disabled={!!busy}
              className="export-option"
              key={o.kind}
              onClick={() => void exportFile(o.kind)}
            >
              <FileText size={23} />
              <div>
                <strong>
                  {o.title}
                  <span>{o.badge}</span>
                </strong>
                <p>{o.desc}</p>
              </div>
              <ArrowDownToLine size={17} />
            </button>
          ))}
        </div>
        {busy && (
          <p className="export-progress" role="status">
            {busy}
          </p>
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="关闭提示" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
