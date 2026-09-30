import { useEffect, useId, useState } from 'react';
import { BookOpen } from 'lucide-react';
import {
  createResearch,
  researchKinds,
  researchLevels,
  researchStatuses,
  researchURL,
  type Research,
} from '../research';

export function ResearchEditor({
  value,
  onChange,
}: {
  value?: Research;
  onChange: (value: Research) => void;
}) {
  const card = value ?? createResearch();
  const listId = useId();
  // 无效地址仅停留在输入框，避免半成品链接进入保存与导出；撤销 / 导入时跟随已保存值。
  const [link, setLink] = useState(card.link);
  useEffect(() => setLink(card.link), [card.link]);
  const invalidLink = link !== '' && researchURL(link) === null;
  const patch = (p: Partial<Research>) => onChange({ ...card, ...p });
  return (
    <details className="research-editor" open={card.visible}>
      <summary>
        <BookOpen size={16} /> 科研卡片
      </summary>
      <label className="check-field">
        <input
          type="checkbox"
          checked={card.visible}
          onChange={(e) => patch({ visible: e.target.checked })}
        />
        显示科研卡片
      </label>
      {card.visible && (
        <>
          <p className="hint">填写成果名称后显示卡片。作者排序、级别、状态与链接可留空。</p>
          <label className="field">
            <span>成果类别</span>
            <select
              value={card.kind}
              onChange={(e) => patch({ kind: e.target.value as Research['kind'] })}
            >
              {Object.entries(researchKinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>论文 / 基金 / 专利名称</span>
            <textarea
              rows={2}
              maxLength={500}
              value={card.title}
              placeholder="支持中文、英文或双语名称"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="field">
            <span>
              {card.kind === 'fund'
                ? '资助机构 / 计划'
                : card.kind === 'patent'
                  ? '授予机构'
                  : '期刊 / 会议名称'}
            </span>
            <input
              maxLength={200}
              value={card.venue}
              onChange={(e) => patch({ venue: e.target.value })}
            />
          </label>
          <label className="field">
            <span>作者排序</span>
            <input
              maxLength={200}
              value={card.authorOrder}
              placeholder="如：第一作者（1/5）、共同第一作者、通讯作者"
              onChange={(e) => patch({ authorOrder: e.target.value })}
            />
          </label>
          <label className="field">
            <span>级别 / 类型标签</span>
            <input
              list={listId}
              maxLength={100}
              value={card.level}
              placeholder={researchLevels[card.kind].join(' / ')}
              onChange={(e) => patch({ level: e.target.value })}
            />
            <datalist id={listId}>
              {researchLevels[card.kind].map((level) => (
                <option key={level} value={level} />
              ))}
            </datalist>
            <span className="hint">可选择建议或自定义标签，如 SCI Q1（JCR）、CCF-A · EI。</span>
          </label>
          <div className="field-row">
            <label className="field">
              <span>当前状态</span>
              <select
                value={card.status}
                onChange={(e) => patch({ status: e.target.value as Research['status'] })}
              >
                <option value="">不显示</option>
                {Object.entries(researchStatuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>是否开源（可选）</span>
              <select
                value={card.openSource}
                onChange={(e) => patch({ openSource: e.target.value as Research['openSource'] })}
              >
                <option value="">不显示</option>
                <option value="open">已开源</option>
                <option value="closed">未开源</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>DOI / 链接地址（可选）</span>
            <input
              maxLength={2000}
              value={link}
              placeholder="10.xxxx/… 或 https://…"
              aria-invalid={invalidLink}
              aria-describedby={`${listId}-link-help`}
              onChange={(e) => {
                const text = e.target.value;
                setLink(text);
                if (text === '' || researchURL(text)) {
                  patch({ link: text });
                }
              }}
            />
          </label>
          <p className="hint" id={`${listId}-link-help`} role="status">
            {invalidLink
              ? '链接尚未保存：请输入 DOI 或不含凭据的完整 HTTP / HTTPS 地址。原链接保留，清空可移除。'
              : '简历仅显示链接图标，留空隐藏。无需联网查询，点击图标才会打开地址。'}
          </p>
        </>
      )}
    </details>
  );
}
