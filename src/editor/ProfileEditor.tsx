import { useRef, useState, type ChangeEvent } from 'react';
import { Plus, Upload, ImagePlus } from 'lucide-react';
import { infoFieldPresets, createInfoField, type InfoField, type Resume } from '../model';
import { IconPicker } from '../IconPicker';
import { Avatar, SectionIcon } from '../ResumePrimitives';
import { readImage, loadDefaultAvatar } from '../storage';
import { ColorField } from './TypographyControls';

export function ProfileEditor({
  profile,
  theme,
  onChange,
  notify,
}: {
  profile: Resume['profile'];
  theme: Resume['theme'];
  onChange: (p: Resume['profile']) => void;
  notify: (s: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null),
    drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [adding, setAdding] = useState(false);
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
        <h2>基本信息</h2>
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
          <div className="photo-actions">
            <button
              className="text-button"
              onClick={async () => {
                try {
                  patch({ photo: await loadDefaultAvatar(), x: 50, y: 50, zoom: 1 });
                } catch (err) {
                  notify((err as Error).message);
                }
              }}
            >
              使用默认头像
            </button>
            {profile.photo && (
              <button className="text-button danger" onClick={() => patch({ photo: '' })}>
                移除头像
              </button>
            )}
          </div>
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
        </div>
      )}
      <div className="profile-text-row">
        <label className="field">
          <span>姓名</span>
          <input
            maxLength={200}
            value={profile.name}
            placeholder="你的姓名"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <ColorField
          label="姓名颜色"
          value={profile.nameColor}
          fallback={theme.titleColor || theme.textColor}
          onChange={(nameColor) => patch({ nameColor })}
        />{' '}
      </div>
      <div className="profile-text-row">
        <label className="field">
          <span>求职意向</span>
          <input
            maxLength={200}
            value={profile.role}
            placeholder="职位 / 职业方向"
            onChange={(e) => patch({ role: e.target.value })}
          />
        </label>
        <ColorField
          label="求职意向颜色"
          value={profile.roleColor || ''}
          fallback={theme.textColor}
          onChange={(roleColor) => patch({ roleColor })}
        />
      </div>
      <div className="info-fields">
        <div className="label-line">
          <span>信息字段</span>
          <span className="tag">{profile.fields.length} 项</span>
        </div>
        {profile.fields.map((field, i) => {
          const change = (values: Partial<InfoField>) =>
            patch({
              fields: profile.fields.map((f) => (f.id === field.id ? { ...f, ...values } : f)),
            });
          const move = (direction: number) => {
            const fields = [...profile.fields];
            [fields[i], fields[i + direction]] = [fields[i + direction], fields[i]];
            patch({ fields });
          };
          return (
            <fieldset className="info-field" key={field.id}>
              <legend>第 {i + 1} 项</legend>
              <div className="info-field-head">
                <label className="field">
                  <span>字段名称</span>
                  <input
                    maxLength={60}
                    aria-label={`第 ${i + 1} 项字段名称`}
                    value={field.label}
                    onChange={(e) => change({ label: e.target.value })}
                  />
                </label>
                <div className="field">
                  <span>字段图标</span>
                  <IconPicker
                    label={`第 ${i + 1} 项图标`}
                    value={field.icon}
                    onChange={(icon) => change({ icon })}
                  />
                </div>
              </div>
              <label className="field">
                <span>字段内容</span>
                <input
                  maxLength={200}
                  aria-label={`第 ${i + 1} 项字段内容`}
                  value={field.value}
                  placeholder="留空则不显示"
                  onChange={(e) => change({ value: e.target.value })}
                />
              </label>
              <ColorField
                label={`第 ${i + 1} 项颜色`}
                value={field.color || ''}
                fallback={theme.textColor}
                onChange={(color) => change({ color })}
              />
              <div className="entry-actions">
                <button
                  className="small-button"
                  disabled={i === 0}
                  aria-label={`上移第 ${i + 1} 项信息字段`}
                  onClick={() => move(-1)}
                >
                  上移
                </button>
                <button
                  className="small-button"
                  disabled={i === profile.fields.length - 1}
                  aria-label={`下移第 ${i + 1} 项信息字段`}
                  onClick={() => move(1)}
                >
                  下移
                </button>
                <button
                  className="small-button danger"
                  aria-label={`删除第 ${i + 1} 项信息字段`}
                  onClick={() => patch({ fields: profile.fields.filter((f) => f.id !== field.id) })}
                >
                  删除
                </button>
              </div>
            </fieldset>
          );
        })}
        <div className="add-area">
          <button className="add-module" onClick={() => setAdding(!adding)}>
            <Plus size={16} />
            插入信息字段
          </button>
          {adding && (
            <div className="component-menu">
              {infoFieldPresets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => {
                    patch({ fields: [...profile.fields, createInfoField(preset)] });
                    setAdding(false);
                  }}
                >
                  <SectionIcon name={preset.icon} size={14} />
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  patch({ fields: [...profile.fields, createInfoField()] });
                  setAdding(false);
                }}
              >
                <Plus size={14} />
                空白字段
              </button>
            </div>
          )}
        </div>
      </div>
      <label className="field">
        <span>信息列数</span>
        <select value={profile.columns} onChange={(e) => patch({ columns: +e.target.value })}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n} 列
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>信息区域宽度 · {profile.infoWidth} px</span>
        <input
          type="range"
          min="280"
          max="678"
          value={profile.infoWidth}
          onChange={(e) => patch({ infoWidth: +e.target.value })}
        />
      </label>
      <p className="hint">留空字段不显示；缩窄信息区域可为图片留白。</p>
    </div>
  );
}
