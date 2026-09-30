import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, CircleSlash, X } from 'lucide-react';
import { findIcons, iconLabels, type IconId } from './icons';
import { SectionIcon } from './ResumePrimitives';
export { iconLabels } from './icons';

const PAGE_SIZE = 60;
export function IconPicker({
  value,
  onChange,
  label = '标题图标',
}: {
  value: IconId;
  onChange: (value: IconId) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const arrowOpened = useRef(false);
  const menuId = useId();
  const results = findIcons(query);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const shown = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    if (arrowOpened.current) {
      (
        menu.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ??
        menu.current?.querySelector<HTMLButtonElement>('[role="option"]')
      )?.focus();
    } else search.current?.focus();
  }, [open]);
  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  function launch(arrow = false) {
    arrowOpened.current = arrow;
    setQuery('');
    setPage(arrow ? Math.max(0, Math.floor(findIcons('').indexOf(value) / PAGE_SIZE)) : 0);
    setOpen(true);
  }
  function changePage(next: number) {
    setPage(next);
    if (menu.current) menu.current.scrollTop = 0;
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const options = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []),
    ];
    if (!options.length) return;
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const columns = getComputedStyle(menu.current!).gridTemplateColumns.split(' ').length;
    const step =
      event.key === 'ArrowDown'
        ? columns
        : event.key === 'ArrowUp'
          ? -columns
          : event.key === 'ArrowRight'
            ? 1
            : event.key === 'ArrowLeft'
              ? -1
              : 0;
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : step
            ? (current + step + options.length) % options.length
            : -1;
    if (index >= 0) {
      event.preventDefault();
      options[index].focus();
    }
  }
  const preview = (icon: IconId) =>
    icon === 'none' ? (
      <CircleSlash size={18} aria-hidden="true" />
    ) : (
      <SectionIcon name={icon} size={18} />
    );
  return (
    <div className="icon-picker">
      <button
        ref={trigger}
        type="button"
        className="icon-picker-trigger"
        aria-label={`${label}：${iconLabels[value]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${menuId}-dialog` : undefined}
        onClick={() => launch()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            launch(true);
          }
        }}
      >
        {preview(value)}
        <span>{iconLabels[value]}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <dialog
          ref={dialog}
          id={`${menuId}-dialog`}
          className="icon-dialog"
          aria-label={`${label}选择器`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              close();
          }}
        >
          <div className="icon-dialog-heading">
            <h2>选择图标</h2>
            <button type="button" aria-label="关闭图标选择器" onClick={close}>
              <X size={18} />
            </button>
          </div>
          <label className="field">
            <span>搜索图标</span>
            <input
              ref={search}
              value={query}
              placeholder="英文 key 或常用中文词：pencil、trend、齿轮"
              onChange={(event) => {
                setQuery(event.target.value);
                changePage(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  menu.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
                }
              }}
            />
          </label>
          <p className="hint">Lucide 本地图标 · 英文名称与 key 均可检索；中文覆盖常用关键词。</p>
          <div
            id={menuId}
            ref={menu}
            role="listbox"
            aria-label={`${label}选项`}
            className="icon-picker-menu"
            onKeyDown={navigate}
          >
            {shown.map((icon, index) => (
              <button
                key={icon}
                type="button"
                role="option"
                aria-label={iconLabels[icon]}
                aria-selected={value === icon}
                title={`${iconLabels[icon]} · ${icon}`}
                tabIndex={value === icon || (index === 0 && !shown.includes(value)) ? 0 : -1}
                onClick={() => {
                  onChange(icon);
                  close();
                }}
              >
                {preview(icon)}
                <span>{iconLabels[icon]}</span>
                {value === icon && <Check size={12} aria-hidden="true" />}
              </button>
            ))}
            {!shown.length && <p className="hint">未找到图标，试试其他英文 key 或中文关键词。</p>}
          </div>
          <div className="icon-pagination">
            <button
              type="button"
              className="small-button"
              disabled={page === 0}
              onClick={() => changePage(page - 1)}
            >
              上一页图标
            </button>
            <span aria-live="polite">
              {results.length} 个 · {page + 1} / {pages} 页
            </span>
            <button
              type="button"
              className="small-button"
              disabled={page >= pages - 1}
              onClick={() => changePage(page + 1)}
            >
              下一页图标
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
