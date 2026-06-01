// Apple-style SF Symbols-inspired transport/player icons (stroke + fill)
interface IconProps {
  size?: number;
  color?: string;
}

export const PlayIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M8 5.14v13.72c0 .83.91 1.34 1.62.9l10.79-6.86a1.06 1.06 0 0 0 0-1.8L9.62 4.24A1.06 1.06 0 0 0 8 5.14z" />
  </svg>
);

export const PauseIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="6" y="5" width="4" height="14" rx="1.4" />
    <rect x="14" y="5" width="4" height="14" rx="1.4" />
  </svg>
);

export const PrevIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="5" y="5" width="2.4" height="14" rx="1.2" />
    <path d="M19 6.05v11.9c0 .76-.83 1.22-1.47.82l-9.2-5.95a.98.98 0 0 1 0-1.64l9.2-5.95c.64-.4 1.47.06 1.47.82z" />
  </svg>
);

export const NextIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="16.6" y="5" width="2.4" height="14" rx="1.2" />
    <path d="M5 6.05v11.9c0 .76.83 1.22 1.47.82l9.2-5.95a.98.98 0 0 0 0-1.64l-9.2-5.95C5.83 4.83 5 5.29 5 6.05z" />
  </svg>
);

export const ShuffleIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5" />
    <path d="M4 20L21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);

export const LoopIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

export const VolumeIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4a1 1 0 0 0 1.6-.8V5.8A1 1 0 0 0 11 5z" />
    <path d="M16 8.5a4 4 0 0 1 0 7" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M18.5 6a7 7 0 0 1 0 12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const MuteIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4a1 1 0 0 0 1.6-.8V5.8A1 1 0 0 0 11 5z" />
    <path d="M16 9l5 5M21 9l-5 5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const QueueIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="14" y2="17" />
  </svg>
);

export const DownloadIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const DownloadedIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8.5 12.5l2.2 2.2 4.8-4.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrashIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
  </svg>
);
