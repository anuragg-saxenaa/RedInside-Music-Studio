// Shimmer skeleton primitives — shown while data loads so the UI never flashes
// blank (Spotify/Apple-Music style perceived performance).
export function SkeletonBox({ w = '100%', h = 14, r = 6, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: r,
        background: `linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.11) 37%, rgba(255,255,255,0.05) 63%)`,
        backgroundSize: '400% 100%',
        animation: 'ris-shimmer 1.4s ease infinite',
        ...style,
      }}
    />
  );
}

// A list of track-row skeletons.
export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
      <style>{`@keyframes ris-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
          <SkeletonBox w={44} h={44} r={8} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <SkeletonBox w={`${55 + (i * 7) % 35}%`} h={13} />
            <SkeletonBox w={`${30 + (i * 5) % 25}%`} h={10} />
          </div>
          <SkeletonBox w={22} h={22} r={11} />
        </div>
      ))}
    </div>
  );
}

export default SkeletonBox;
