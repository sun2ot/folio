import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  UserRound,
  BriefcaseBusiness,
  GraduationCap,
  CodeXml,
  Award,
  Link,
  Star,
} from 'lucide-react';
import { fontFamilies, type Resume, type Module } from './model';
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
      <div className="resume-identity">
        <div className="resume-eyebrow">
          {doc.theme.template === 'editorial' ? 'PERSONAL RESUME' : 'CURRICULUM VITAE'}
        </div>
        <h1>{p.name || '你的姓名'}</h1>
        <p className="resume-role">{p.role}</p>
        <div className="resume-contact">
          {[p.location, p.phone, p.email, p.website].filter(Boolean).map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>
      <Avatar profile={p} />
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
      {item.kind === 'qr' &&
        (item.image ? (
          <img className="resume-qr" src={item.image} alt={`${item.title}二维码`} />
        ) : (
          <div className="qr-placeholder">上传二维码</div>
        ))}
      <div
        className="markdown"
        style={{ fontFamily: fontFamilies[item.bodyStyle.font], fontSize: item.bodyStyle.size }}
        dangerouslySetInnerHTML={{ __html: markdown(item.body) }}
      />
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
export function ResumeView({
  doc,
  onReady,
  onSelect,
}: {
  doc: Resume;
  onReady: (count: number, overflow: string[]) => void;
  onSelect: (id: string) => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Row[][]>([rowsFor(doc.modules)]);
  const [ready, setReady] = useState(false);
  const [resourceError, setResourceError] = useState('');
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
        Array.from(root.querySelectorAll('img')).map((img) => img.decode().catch(() => {})),
      );
      if (!live) return;
      // offsetHeight stays in layout pixels even when the preview is zoomed.
      const heights = Array.from(root.querySelectorAll<HTMLElement>(':scope > .resume-row')).map(
        (e) => e.offsetHeight,
      );
      const header = root.querySelector<HTMLElement>('.resume-header')!.offsetHeight;
      const result = paginate(rowsFor(doc.modules), heights, header, doc.theme.spacing);
      if (header > 994) result.oversized.push('基本信息');
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
      </div>
      <div
        id="resume-pages"
        onClick={(e) => {
          const el = (e.target as HTMLElement).closest('[data-module]');
          if (el) onSelect(el.getAttribute('data-module')!);
        }}
      >
        {pages.map((rows, i) => (
          <article className="resume-page" key={i} aria-label={`简历第 ${i + 1} 页`}>
            <div className="resume-content">
              {i === 0 && <Profile doc={doc} />}
              {rows.map((row) => (
                <RenderRow key={row[0].id} row={row} />
              ))}
            </div>
            <footer className="resume-footer">
              <span>
                {doc.profile.name} · {doc.profile.role.split('/')[0]}
              </span>
              <span>
                {String(i + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
