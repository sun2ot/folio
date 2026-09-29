import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  UserRound,
  BriefcaseBusiness,
  GraduationCap,
  CodeXml,
  Award,
  Link,
  Star,
  Phone,
  Mail,
  MapPin,
  Globe,
  Github,
  CalendarDays,
  Flag,
  ContactRound,
  Clock,
} from 'lucide-react';
import {
  fontFamilies,
  profileFields,
  fitPlacement,
  type Placement,
  type Resume,
  type Module,
} from './model';
import { markdown } from './markdown';
import { rowsFor, paginate, type Row } from './pagination';

const iconMap = {
  user: UserRound,
  briefcase: BriefcaseBusiness,
  graduation: GraduationCap,
  code: CodeXml,
  award: Award,
  link: Link,
  star: Star,
};
const contactIcons = {
  phone: Phone,
  email: Mail,
  gender: UserRound,
  github: Github,
  website: Globe,
  ethnicity: ContactRound,
  birthDate: CalendarDays,
  politicalStatus: Flag,
  hometown: MapPin,
  residence: MapPin,
  location: MapPin,
  experienceYears: Clock,
};
export function SectionIcon({ name, size = 16 }: { name: Module['icon']; size?: number }) {
  if (name === 'none') return null;
  const Icon = iconMap[name];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
export function Avatar({ profile }: { profile: Resume['profile'] }) {
  if (!profile.photo) return null;
  // html2canvas supports background-size:cover more reliably than object-fit.
  return (
    <div className={`resume-avatar ${profile.shape}`}>
      <div
        className="avatar-picture"
        role="img"
        aria-label={`${profile.name}的头像`}
        style={{
          backgroundImage: `url("${profile.photo}")`,
          backgroundPosition: `${profile.x}% ${profile.y}%`,
          transform: `scale(${profile.zoom})`,
          transformOrigin: `${profile.x}% ${profile.y}%`,
        }}
      />
      <img className="avatar-resource" alt="" src={profile.photo} />
    </div>
  );
}
const Profile = memo(function Profile({ doc }: { doc: Resume }) {
  const p = doc.profile;
  return (
    <header className="resume-header">
      <div className="resume-identity" style={{ width: p.infoWidth }}>
        {doc.pageDecoration.headerVisible && (
          <div className="resume-eyebrow">{doc.pageDecoration.headerText}</div>
        )}
        <h1>{p.name || '你的姓名'}</h1>
        <p className="resume-role">{p.role}</p>
        <div
          className="resume-contact"
          style={{ gridTemplateColumns: `repeat(${p.columns}, minmax(0, 1fr))` }}
        >
          {profileFields
            .filter(([key]) => p[key])
            .map(([key, label]) => {
              const Icon = contactIcons[key];
              return (
                <div className="resume-contact-item" key={key}>
                  <Icon size={13} aria-hidden="true" />
                  <span>
                    {label}：{p[key]}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </header>
  );
});
const Block = memo(function Block({ item }: { item: Module }) {
  return (
    <section className="resume-section" data-module={item.id}>
      <h2
        style={{ fontFamily: fontFamilies[item.titleStyle.font], fontSize: item.titleStyle.size }}
      >
        <SectionIcon name={item.icon} />
        <span>{item.title}</span>
      </h2>
      <div style={{ fontFamily: fontFamilies[item.bodyStyle.font], fontSize: item.bodyStyle.size }}>
        {item.kind === 'text' ? (
          <div className="markdown" dangerouslySetInnerHTML={{ __html: markdown(item.body) }} />
        ) : (
          item.entries.map((entry) => {
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
  const drag = useRef<{ offsetX: number; offsetY: number; scale: number; next: Placement } | null>(
    null,
  );
  const name = kind === 'photo' ? '头像' : '二维码';
  const position = draft || p;
  return (
    <div
      className="resume-floating"
      data-media={kind}
      role="button"
      tabIndex={0}
      aria-label={`移动${name}`}
      title="拖动定位；方向键微调，Shift 加速"
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
        };
        onDragging(p.page);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const origin = e.currentTarget.closest('.resume-page')!.getBoundingClientRect();
        const relativeTo = (rect: DOMRect) => ({
          ...p,
          left: (e.clientX - rect.left) / d.scale - d.offsetX,
          top: (e.clientY - rect.top) / d.scale - d.offsetY,
        });
        setDraft(relativeTo(origin));
        const pages = Array.from(
          document.querySelectorAll<HTMLElement>('#resume-pages .resume-page'),
        );
        const target = pages.findIndex((page) => {
          const r = page.getBoundingClientRect();
          return (
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom
          );
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
      const families = new Set([
        doc.theme.font,
        ...doc.modules
          .filter((m) => m.visible)
          .flatMap((m) => [m.titleStyle.font, m.bodyStyle.font]),
      ]);
      await Promise.all(
        [...families].map((font) => document.fonts.load(`12px ${fontFamilies[font]}`)),
      );
      await document.fonts.ready;
      const root = measure.current;
      if (!root || !live) return;
      await Promise.all(
        Array.from(root.parentElement!.querySelectorAll('img')).map((img) => img.decode()),
      );
      if (!live) return;
      // offsetHeight stays in layout pixels even when the preview is zoomed.
      const heights = Array.from(root.querySelectorAll<HTMLElement>(':scope > .resume-row')).map(
        (e) => e.offsetHeight,
      );
      const header = root.querySelector<HTMLElement>('.resume-header')!.offsetHeight;
      const result = paginate(rowsFor(doc.modules), heights, header, doc.theme.spacing);
      if (header > 994) result.oversized.push('基本信息');
      const mediaPage = Math.max(
        1,
        doc.profile.photo && doc.media.photo.visible ? doc.media.photo.page : 1,
        doc.media.qr.image && doc.media.qr.visible ? doc.media.qr.page : 1,
      );
      while (result.pages.length < mediaPage) result.pages.push([]);
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
  const style = {
    '--accent': doc.theme.accent,
    '--section-gap': `${doc.theme.spacing}px`,
    fontFamily: fontFamilies[doc.theme.font],
  } as CSSProperties;
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
            {(doc.pageDecoration.footerVisible || doc.pageDecoration.pageNumberVisible) && (
              <footer className="resume-footer">
                <span>{doc.pageDecoration.footerVisible ? doc.pageDecoration.footerText : ''}</span>
                {doc.pageDecoration.pageNumberVisible && (
                  <span>
                    {doc.pageDecoration.pageNumberFormat
                      .replaceAll('{page}', String(i + 1))
                      .replaceAll('{pages}', String(pages.length))}
                  </span>
                )}
              </footer>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
