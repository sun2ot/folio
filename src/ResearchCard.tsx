import { ExternalLink } from 'lucide-react';
import { researchKinds, researchStatuses, researchURL, type Research } from './research';

export function ResearchCard({ card }: { card: Research }) {
  if (!card.visible || !card.title.trim()) return null;
  const href = researchURL(card.link);
  return (
    <article className="resume-research" aria-label={`${researchKinds[card.kind]}：${card.title}`}>
      <div className="research-topline">
        <span className="research-kind">{researchKinds[card.kind]}</span>
        {card.status && <span className="research-status">{researchStatuses[card.status]}</span>}
      </div>
      <div className="research-heading">
        <h3 className="research-title">{card.title}</h3>
        {href && (
          <a
            className="research-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`查看成果：${card.title}`}
            title="查看成果"
          >
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        )}
      </div>
      {card.venue && <p className="research-venue">{card.venue}</p>}
      {(card.authorOrder || card.level || card.openSource) && (
        <div className="research-meta">
          {card.authorOrder && (
            <span className="research-authors">
              <span className="research-label">作者排序：</span>
              {card.authorOrder}
            </span>
          )}
          {card.level && <span className="research-tag">{card.level}</span>}
          {card.openSource && (
            <span className="research-openness">
              {card.openSource === 'open' ? '已开源' : '未开源'}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
