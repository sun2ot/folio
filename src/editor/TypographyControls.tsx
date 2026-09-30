import { RotateCcw } from 'lucide-react';
import { fonts, type FontId } from '../model';

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
  inherit = true,
  compact = false,
  presets,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallback: string;
  inherit?: boolean;
  compact?: boolean;
  presets?: readonly { color: string; name: string }[];
}) {
  return (
    <div className={compact ? 'compact-color' : 'field'}>
      {!compact && <span>{label}</span>}
      <div className={`color-field${compact ? ' compact' : ''}`}>
        {presets?.map(({ color, name }) => (
          <button
            key={color}
            className="color-preset"
            style={{ backgroundColor: color }}
            aria-label={`${label}预设 ${name}`}
            aria-pressed={(value || fallback).toLowerCase() === color.toLowerCase()}
            title={name}
            onClick={() => onChange(color)}
          />
        ))}
        <input
          type="color"
          aria-label={`${label}取色`}
          value={value || fallback}
          title={value || fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        {inherit && (
          <button
            className="color-reset"
            aria-label={`${label}恢复跟随全局`}
            title="跟随全局"
            disabled={!value}
            onClick={() => onChange('')}
          >
            {compact ? <RotateCcw size={14} aria-hidden="true" /> : '跟随全局'}
          </button>
        )}
      </div>
    </div>
  );
}
