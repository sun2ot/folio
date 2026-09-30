import { iconMap } from './icons';
import type { IconId, Resume } from './model';
export function SectionIcon({
  name,
  size = 16,
  color,
}: {
  name: IconId;
  size?: number;
  color?: string;
}) {
  const Icon = iconMap[name];
  if (!Icon) return null;
  return (
    <Icon size={size} strokeWidth={1.7} aria-hidden="true" style={color ? { color } : undefined} />
  );
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
