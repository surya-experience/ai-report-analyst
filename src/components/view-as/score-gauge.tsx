// A simple semicircle gauge, drawn with SVG arcs sized by pathLength so
// the filled portion is exact percentage math instead of hand-computed
// arc lengths. `max` isn't a hard cap on the score (Search Rank Score is
// open-ended — real profiles score well past 100), just the gauge's
// full-scale reference point; the label always shows the real number.
export function ScoreGauge({ score, max = 100 }: { score: number; max?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
  const clamped = score;
  const angleDeg = 180 - (pct / 100) * 180;
  const rad = (angleDeg * Math.PI) / 180;
  const needleR = 62;
  const cx = 100;
  const cy = 100;
  const tickX = cx + needleR * Math.cos(rad);
  const tickY = cy - needleR * Math.sin(rad);
  const tickX2 = cx + (needleR + 14) * Math.cos(rad);
  const tickY2 = cy - (needleR + 14) * Math.sin(rad);

  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[220px]">
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="var(--border)"
        strokeWidth="14"
        strokeLinecap="round"
        pathLength={100}
      />
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="#4C5FDB"
        strokeWidth="14"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${pct} ${100 - pct}`}
      />
      <line x1={tickX} y1={tickY} x2={tickX2} y2={tickY2} stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
      <text x={cx} y={92} textAnchor="middle" className="fill-foreground" style={{ fontSize: 34, fontWeight: 800 }}>
        {clamped}
      </text>
      <text x={20} y={112} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
        0
      </text>
      <text x={180} y={112} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
        {max}
      </text>
    </svg>
  );
}
