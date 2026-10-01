import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Github } from 'lucide-react';
import {
  fontFamilies,
  dividerLabels,
  defaultDivider,
  type DividerKey,
  fitPlacement,
  type Placement,
  type Resume,
  type DecorationStyle,
} from './model';
import { Avatar, SectionIcon } from './ResumePrimitives';
import { markdown, markdownUnits, markdownFragment } from './markdown';
import { repositoryURL } from './repository';
import { ResearchCard } from './ResearchCard';
import {
  rowsFor,
  paginate,
  pageGeometry,
  FOOTER_RESERVE,
  type Row,
  type PageModule,
  type ContentMeasure,
} from './pagination';

function decorationStyle(style?: DecorationStyle): CSSProperties {
  return {
    color: style?.color || undefined,
    fontFamily: style?.font ? fontFamilies[style.font] : undefined,
    fontSize: style?.size,
  };
}

function Footer({ doc, page, pages }: { doc: Resume; page: number; pages: number }) {
  const d = doc.pageDecoration;
  if (!d.footerVisible && !d.pageNumberVisible) return null;
  return (
    <footer className="resume-footer">
      {d.footerVisible && (
        <span className="resume-footer-text" style={decorationStyle(d.footerStyle)}>
          {d.footerText}
        </span>
      )}
      {d.pageNumberVisible && (
        <span className="resume-page-number" style={decorationStyle(d.pageNumberStyle)}>
          {d.pageNumberFormat
            .replaceAll('{page}', String(page))
            .replaceAll('{pages}', String(pages))}
        </span>
      )}
    </footer>
  );
}

const Profile = memo(function Profile({ doc }: { doc: Resume }) {
  const p = doc.profile;
  return (
    <header className="resume-header">
      <div
        className="resume-identity"
        style={{ '--info-width': `${p.infoWidth}px` } as CSSProperties}
      >
        {doc.pageDecoration.headerVisible && (
          <div className="resume-eyebrow" style={decorationStyle(doc.pageDecoration.headerStyle)}>
            {doc.pageDecoration.headerText}
          </div>
        )}
        <h1 style={{ color: p.nameColor || undefined, fontSize: p.nameSize }}>
          {p.name || '你的姓名'}
        </h1>
        <p
          className="resume-role"
          style={{ color: p.roleColor || undefined, fontSize: p.roleSize }}
        >
          {p.role}
        </p>
        <div
          className="resume-contact"
          style={{
            gridTemplateColumns: `repeat(${p.columns}, minmax(0, max-content))`,
            fontSize: p.infoSize,
          }}
        >
          {p.fields
            .filter((field) => field.value)
            .map((field) => (
              <div
                className="resume-contact-item"
                key={field.id}
                style={{ color: field.color || undefined, fontSize: field.size }}
              >
                <SectionIcon name={field.icon} size={(field.size ?? p.infoSize ?? 12) + 1} />
                <span>
                  {field.label}：{field.value}
                </span>
              </div>
            ))}
        </div>
      </div>
    </header>
  );
});
const Block = memo(function Block({ item }: { item: PageModule }) {
  const title = item.titleStyle.color || undefined;
  const units = useMemo(
    () => (item.kind === 'text' ? markdownUnits(item.body) : []),
    [item.kind, item.body],
  );
  const fragment = item.fragment;
  const entries = fragment ? item.entries.slice(fragment.from, fragment.to) : item.entries;
  return (
    <section
      className="resume-section"
      data-module={item.id}
      data-continued={fragment?.continued || undefined}
      style={fragment ? { gridColumn: fragment.column + 1 } : undefined}
    >
      {!fragment?.continued && (
        <h2
          style={{
            fontFamily: fontFamilies[item.titleStyle.font],
            fontSize: item.titleStyle.size,
            color: title,
          }}
        >
          <SectionIcon name={item.icon} color={title} />
          <span>{item.title}</span>
        </h2>
      )}
      <div
        className="resume-body"
        style={{
          fontFamily: fontFamilies[item.bodyStyle.font],
          fontSize: item.bodyStyle.size,
          color: item.bodyStyle.color || undefined,
        }}
      >
        {item.kind === 'text' ? (
          <div
            className="markdown"
            dangerouslySetInnerHTML={{
              __html: markdownFragment(units, fragment?.from, fragment?.to),
            }}
          />
        ) : (
          entries.map((entry) => {
            const details =
              item.kind === 'education'
                ? [entry.degree + (entry.studyMode ? `（${entry.studyMode}）` : ''), entry.major]
                    .filter(Boolean)
                    .join(' · ')
                : entry.role;
            return (
              <div className="resume-entry" key={entry.id} data-entry={entry.id}>
                <div className={`entry-heading ${item.entryLayout}`}>
                  <strong className="entry-main">
                    {item.entryLayout === 'left-right'
                      ? [entry.organization, details].filter(Boolean).join(' · ')
                      : entry.organization}
                  </strong>
                  {item.entryLayout === 'left-center-right' && (
                    <strong className="entry-middle">{details}</strong>
                  )}
                  <div className="entry-meta">
                    {[entry.start, entry.end].filter(Boolean).join(' — ')}
                    {entry.location && (
                      <>
                        {(entry.start || entry.end) && ' · '}
                        <span className="entry-location">{entry.location}</span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="markdown"
                  dangerouslySetInnerHTML={{ __html: markdown(entry.body) }}
                />
                {item.kind === 'projects' && entry.research && (
                  <ResearchCard card={entry.research} />
                )}
                {item.kind === 'projects' && entry.github.visible && entry.github.snapshot && (
                  <a
                    className="resume-repository"
                    href={repositoryURL(entry.github.snapshot)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="repository-title">
                      {entry.github.snapshot.avatar ? (
                        <img
                          className="repository-avatar"
                          src={entry.github.snapshot.avatar}
                          alt=""
                          draggable={false}
                        />
                      ) : (
                        <Github size={16} aria-hidden="true" />
                      )}
                      <strong>{entry.github.snapshot.name}</strong>
                      <span>作者：{entry.github.snapshot.owner}</span>
                    </div>
                    {entry.github.snapshot.description && (
                      <p>{entry.github.snapshot.description}</p>
                    )}
                    <div className="repository-stats">
                      {entry.github.snapshot.language && (
                        <span>{entry.github.snapshot.language}</span>
                      )}
                      {entry.github.snapshot.stars !== null && (
                        <span>★ {entry.github.snapshot.stars.toLocaleString('en-US')} Star</span>
                      )}
                      {entry.github.snapshot.forks !== null && (
                        <span>{entry.github.snapshot.forks.toLocaleString('en-US')} Fork</span>
                      )}
                    </div>
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
});
function RenderRow({ row }: { row: Row }) {
  return (
    <div className={`resume-row ${row[0].width === 'half' ? 'split' : ''}`}>
      {row.map((m) => (
        <Block key={m.id} item={m} />
      ))}
    </div>
  );
}

function FloatingMedia({
  doc,
  kind,
  onMove,
  onDragging,
}: {
  doc: Resume;
  kind: 'photo' | 'qr';
  onMove: (kind: 'photo' | 'qr', placement: Placement) => void;
  onDragging: (page: number | null) => void;
}) {
  const p = doc.media[kind];
  const [draft, setDraft] = useState<Placement | null>(null);
  const drag = useRef<{
    offsetX: number;
    offsetY: number;
    scale: number;
    next: Placement;
    axis: 'x' | 'y' | null;
  } | null>(null);
  const name = kind === 'photo' ? '头像' : '二维码';
  const position = draft || p;
  return (
    <div
      className="resume-floating"
      data-media={kind}
      role="button"
      tabIndex={0}
      aria-label={`移动${name}`}
      title="Shift + 拖动锁定水平或垂直方向；方向键移动 1 px，Shift + 方向键移动 10 px"
      style={{ left: position.left, top: position.top, width: p.size, height: p.size }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const scale = rect.width / p.size;
        drag.current = {
          offsetX: (e.clientX - rect.left) / scale,
          offsetY: (e.clientY - rect.top) / scale,
          scale,
          next: p,
          axis: null,
        };
        onDragging(p.page);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const origin = e.currentTarget.closest('.resume-page')!.getBoundingClientRect();
        let clientX = e.clientX,
          clientY = e.clientY;
        const anchorX = origin.left + (p.left + d.offsetX) * d.scale;
        const anchorY = origin.top + (p.top + d.offsetY) * d.scale;
        if (e.shiftKey) {
          const dx = clientX - anchorX,
            dy = clientY - anchorY;
          if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 2)
            d.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          if (d.axis === 'x') clientY = anchorY;
          if (d.axis === 'y') clientX = anchorX;
        } else d.axis = null;
        const relativeTo = (rect: DOMRect) => ({
          ...p,
          left: (clientX - rect.left) / d.scale - d.offsetX,
          top: (clientY - rect.top) / d.scale - d.offsetY,
        });
        setDraft(relativeTo(origin));
        const pages = Array.from(
          document.querySelectorAll<HTMLElement>('#resume-pages .resume-page'),
        );
        const target = pages.findIndex((page) => {
          const r = page.getBoundingClientRect();
          return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        });
        if (target >= 0 && target + 1 !== p.page) {
          const rect = pages[target].getBoundingClientRect();
          d.next = fitPlacement({
            ...relativeTo(rect),
            page: target + 1,
          });
        } else d.next = fitPlacement(relativeTo(origin));
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (d) onMove(kind, d.next);
        drag.current = null;
        setDraft(null);
        onDragging(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDraft(null);
        onDragging(null);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setDraft(null);
        onDragging(null);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        if (delta[e.key]) {
          e.preventDefault();
          onMove(
            kind,
            fitPlacement({ ...p, left: p.left + delta[e.key][0], top: p.top + delta[e.key][1] }),
          );
        }
      }}
    >
      {kind === 'photo' ? (
        <Avatar profile={doc.profile} />
      ) : (
        <img
          className="resume-qr"
          src={doc.media.qr.image}
          alt={doc.media.qr.label || '二维码'}
          draggable={false}
        />
      )}
    </div>
  );
}
export function ResumeView({
  doc,
  onReady,
  onSelect,
  onMoveMedia,
}: {
  doc: Resume;
  onReady: (count: number, overflow: string[]) => void;
  onSelect: (id: string) => void;
  onMoveMedia: (kind: 'photo' | 'qr', placement: Placement) => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Row[][]>([rowsFor(doc.modules)]);
  const [ready, setReady] = useState(false);
  const [resourceError, setResourceError] = useState('');
  const [draggingPage, setDraggingPage] = useState<number | null>(null);
  useLayoutEffect(() => {
    let live = true;
    setReady(false);
    setResourceError('');
    const run = async () => {
      const root = measure.current;
      if (!root || !live) return;
      const families = new Set([
        doc.theme.font,
        ...(doc.pageDecoration.headerVisible && doc.pageDecoration.headerStyle?.font
          ? [doc.pageDecoration.headerStyle.font]
          : []),
        ...(doc.pageDecoration.footerVisible && doc.pageDecoration.footerStyle?.font
          ? [doc.pageDecoration.footerStyle.font]
          : []),
        ...(doc.pageDecoration.pageNumberVisible && doc.pageDecoration.pageNumberStyle?.font
          ? [doc.pageDecoration.pageNumberStyle.font]
          : []),
        ...doc.modules
          .filter((m) => m.visible)
          .flatMap((m) => [m.titleStyle.font, m.bodyStyle.font]),
      ]);
      await Promise.all(
        [...families].map((font) =>
          document.fonts.load(`12px ${fontFamilies[font]}`, root.parentElement!.textContent || ' '),
        ),
      );
      await document.fonts.ready;
      if (!live) return;
      await Promise.all(
        Array.from(root.parentElement!.querySelectorAll('img')).map((img) => img.decode()),
      );
      if (!live) return;
      const rows = rowsFor(doc.modules);
      const layoutHeight = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        // 去掉祖先预览缩放，保留小数；只向上取百分之一像素，避免整数累计造成过早换页。
        return Math.ceil(((rect.height * element.offsetWidth) / rect.width) * 100) / 100;
      };
      const renderedRows = [...root.querySelectorAll<HTMLElement>(':scope > .resume-row')];
      const measures: ContentMeasure[] = rows.map((row, index) => {
        const blocks = [
          ...renderedRows[index].querySelectorAll<HTMLElement>(':scope > .resume-section'),
        ];
        const parts = row.map((item) => (item.kind === 'text' ? markdownUnits(item.body) : []));
        const cache = new Map<string, number>();
        return {
          counts: row.map((item, column) =>
            item.kind === 'text' ? parts[column].length : item.entries.length,
          ),
          height: (column, from, to) => {
            const key = `${column}:${from}:${to}`;
            const cached = cache.get(key);
            if (cached !== undefined) return cached;
            // 在相同宽度、模板和字体下测量实际片段，避免列表边距与跨页片段估算误差。
            const holder = renderedRows[index].cloneNode(false) as HTMLElement;
            const block = blocks[column].cloneNode(true) as HTMLElement;
            block.style.gridColumn = String(column + 1);
            if (from > 0) block.querySelector('h2')!.remove();
            const body = block.querySelector<HTMLElement>('.resume-body')!;
            if (row[column].kind === 'text') {
              body.querySelector<HTMLElement>('.markdown')!.innerHTML = markdownFragment(
                parts[column],
                from,
                to,
              );
            } else {
              [...body.children].forEach((entry, entryIndex) => {
                if (entryIndex < from || entryIndex >= to) entry.remove();
              });
            }
            holder.append(block);
            root.append(holder);
            try {
              const height = layoutHeight(holder);
              cache.set(key, height);
              return height;
            } finally {
              holder.remove();
            }
          },
        };
      });
      const header = layoutHeight(root.querySelector<HTMLElement>('.resume-header')!);
      const geometry = pageGeometry(doc.pageDecoration);
      const result = paginate(rows, measures, header, doc.theme.spacing, geometry.contentHeight);
      if (header > geometry.contentHeight) result.oversized.push('基本信息');
      const mediaPage = Math.max(
        1,
        doc.profile.photo && doc.media.photo.visible ? doc.media.photo.page : 1,
        doc.media.qr.image && doc.media.qr.visible ? doc.media.qr.page : 1,
      );
      while (result.pages.length < mediaPage) result.pages.push([]);
      // 页脚独立于正文流，按实际页数测量，避免增大字号后覆盖正文。
      const footer = root.parentElement!.querySelector<HTMLElement>('.resume-footer');
      const number = footer?.querySelector('.resume-page-number');
      if (number)
        number.textContent = doc.pageDecoration.pageNumberFormat
          .replaceAll('{page}', String(result.pages.length))
          .replaceAll('{pages}', String(result.pages.length));
      if (footer && footer.offsetHeight > FOOTER_RESERVE) result.oversized.push('页脚 / 页码');
      setPages(result.pages);
      setReady(true);
      onReady(result.pages.length, result.oversized);
    };
    void run().catch(() => {
      if (live) setResourceError('字体或图片加载失败，请检查本地资源后刷新。排版完成前无法导出。');
    });
    return () => {
      live = false;
    };
  }, [doc, onReady]);
  const geometry = pageGeometry(doc.pageDecoration);
  const style = {
    '--text-color': doc.theme.textColor,
    '--title-color': doc.theme.titleColor || doc.theme.textColor,
    '--section-gap': `${doc.theme.spacing}px`,
    '--page-bottom-padding': `${geometry.paddingBottom}px`,
    '--content-height': `${geometry.contentHeight}px`,
    fontFamily: fontFamilies[doc.theme.font],
  } as CSSProperties;
  for (const key of Object.keys(dividerLabels) as DividerKey[]) {
    const preset = defaultDivider(doc.theme.template, key);
    const divider = doc.theme.dividers?.[key];
    Object.assign(style, {
      [`--${key}-line-color`]: divider?.color || preset.color,
      [`--${key}-line-width`]: `${divider?.width ?? preset.width}px`,
    });
  }
  return (
    <div
      className={`resume-document template-${doc.theme.template}`}
      style={style}
      data-ready={ready}
    >
      {resourceError && (
        <div className="overflow-warning" role="alert">
          {resourceError}
        </div>
      )}
      <div className="resume-measure" aria-hidden="true">
        <div className="resume-content" ref={measure}>
          <Profile doc={doc} />
          {rowsFor(doc.modules).map((row) => (
            <RenderRow key={row[0].id} row={row} />
          ))}
        </div>
        {doc.profile.photo && <img src={doc.profile.photo} alt="" />}
        {doc.media.qr.image && <img src={doc.media.qr.image} alt="" />}
        <Footer doc={doc} page={pages.length} pages={pages.length} />
      </div>
      <div
        id="resume-pages"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-media]')) return onSelect('media');
          const el = (e.target as HTMLElement).closest('[data-module]');
          if (el) onSelect(el.getAttribute('data-module')!);
        }}
        onKeyDown={(e) => {
          if (['Enter', ' '].includes(e.key) && (e.target as HTMLElement).closest('[data-media]')) {
            e.preventDefault();
            onSelect('media');
          }
        }}
      >
        {pages.map((rows, i) => (
          <article
            className={`resume-page${draggingPage === i + 1 ? ' media-dragging' : ''}`}
            key={i}
            aria-label={`简历第 ${i + 1} 页`}
          >
            <div className="resume-content">
              {i === 0 && <Profile doc={doc} />}
              {rows.map((row) => (
                <RenderRow key={row[0].id} row={row} />
              ))}
            </div>
            {(['photo', 'qr'] as const).map(
              (kind) =>
                doc.media[kind].visible &&
                doc.media[kind].page === i + 1 &&
                (kind === 'photo' ? doc.profile.photo : doc.media.qr.image) && (
                  <FloatingMedia
                    key={kind}
                    doc={doc}
                    kind={kind}
                    onMove={onMoveMedia}
                    onDragging={setDraggingPage}
                  />
                ),
            )}
            <Footer doc={doc} page={i + 1} pages={pages.length} />
          </article>
        ))}
      </div>
    </div>
  );
}
