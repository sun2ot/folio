import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { fitPlacement, type Placement, type Resume } from '../model';
import { readImage } from '../storage';

export function MediaEditor({
  doc,
  onChange,
  notify,
}: {
  doc: Resume;
  onChange: (media: Resume['media']) => void;
  notify: (s: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const patchQR = (value: Partial<Resume['media']['qr']>) =>
    onChange({ ...doc.media, qr: { ...doc.media.qr, ...value } });
  return (
    <div className="editor-fields">
      <div className="panel-intro">
        <h2>图片自由布局</h2>
        <p>方向键移动，Shift 加速；Shift + 拖动锁定方向。</p>
      </div>
      <div className="qr-upload">
        {doc.media.qr.image && <img src={doc.media.qr.image} alt="已上传的二维码" />}
        <button className="small-button" onClick={() => file.current?.click()}>
          <Upload size={16} />
          {doc.media.qr.image ? '更换二维码' : '上传二维码'}
        </button>
        {doc.media.qr.image && (
          <button className="text-button danger" onClick={() => patchQR({ image: '' })}>
            移除二维码
          </button>
        )}
        <input
          ref={file}
          hidden
          type="file"
          aria-label="二维码图片"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              patchQR({ image: await readImage(f, true) });
            } catch (err) {
              notify((err as Error).message);
            }
          }}
        />
        <p className="hint">头像在「基本信息」上传。浮动图片不占正文流，请留白。</p>
      </div>
      <label className="field">
        <span>二维码替代文本</span>
        <input
          maxLength={200}
          value={doc.media.qr.label}
          onChange={(e) => patchQR({ label: e.target.value })}
        />
      </label>
      {(['photo', 'qr'] as const).map((key) => {
        const p = doc.media[key],
          name = key === 'photo' ? '头像' : '二维码';
        const patch = (value: Partial<Placement>) =>
          onChange({ ...doc.media, [key]: { ...p, ...fitPlacement({ ...p, ...value }) } });
        return (
          <fieldset className="entry-editor" key={key}>
            <legend>{name}位置</legend>
            <label className="check-field">
              <input
                type="checkbox"
                checked={p.visible}
                onChange={(e) => patch({ visible: e.target.checked })}
              />
              显示{name}
            </label>
            {(
              [
                ['page', '页码', 1, 80],
                ['size', '尺寸', 40, 300],
                ['left', '横坐标', 0, 794 - p.size],
                ['top', '纵坐标', 0, 1122 - p.size],
              ] as const
            ).map(([field, label, min, max]) => (
              <label className="field" key={field}>
                <span>
                  {name}
                  {label}
                  {field === 'page' ? '' : '（px）'}
                </span>
                <input
                  type="number"
                  aria-label={`${name}${label}`}
                  min={min}
                  max={max}
                  value={p[field]}
                  onChange={(e) => {
                    if (e.target.value !== '')
                      patch({ [field]: Math.max(min, Math.min(max, Math.round(+e.target.value))) });
                  }}
                />
              </label>
            ))}
          </fieldset>
        );
      })}
      <p className="hint">坐标从 A4 左上角计算；指定新页码会增加空白页。</p>
    </div>
  );
}
