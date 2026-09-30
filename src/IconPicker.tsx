import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, CircleSlash } from 'lucide-react';
import { icons, type Module } from './model';
import { SectionIcon } from './ResumePrimitives';

const labels: Record<Module['icon'], string> = {
  none: '无图标',
  user: '个人',
  briefcase: '工作',
  graduation: '教育',
  code: '代码',
  award: '荣誉',
  link: '链接',
  star: '星标',
  phone: '电话',
  mail: '邮箱',
  globe: '网站',
  github: 'GitHub',
  calendar: '日期',
  flag: '政治面貌',
  contact: '联系',
  clock: '时间',
  map: '地点',
};
export const iconLabels = labels;

/** Native select options cannot reliably render SVG; keep the same icons as the resume. */
export function IconPicker({
  value,
  onChange,
  label = '标题图标',
}: {
  value: Module['icon'];
  onChange: (value: Module['icon']) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const options = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
    );
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % options.length
            : event.key === 'ArrowUp'
              ? (current - 1 + options.length) % options.length
              : -1;
    if (index >= 0) {
      event.preventDefault();
      options[index]?.focus();
    }
  }
  const preview = (icon: Module['icon']) =>
    icon === 'none' ? <CircleSlash size={16} aria-hidden="true" /> : <SectionIcon name={icon} />;
  return (
    <div
      ref={root}
      className="icon-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-picker-trigger"
        aria-label={`${label}：${labels[value]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {preview(value)}
        <span>{labels[value]}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label={`${label}选项`}
          className="icon-picker-menu"
          onKeyDown={navigate}
        >
          {icons.map((icon) => (
            <button
              key={icon}
              type="button"
              role="option"
              aria-selected={value === icon}
              tabIndex={-1}
              onClick={() => {
                onChange(icon);
                close();
              }}
            >
              {preview(icon)}
              <span>{labels[icon]}</span>
              {value === icon && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
