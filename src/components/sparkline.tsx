interface Props {
  data: number[];
  height?: number;
  width?: number;
}

export function Sparkline({ data, height = 80, width = 600 }: Props) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-amber-faint text-xs"
        style={{ height, width: "100%" }}
      >
        ─── 0 ticks recorded ───
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const first = data[0];
  const trend = last >= first ? "var(--green)" : "var(--red)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={trend} stopOpacity="0.25" />
          <stop offset="100%" stopColor={trend} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#spark-fill)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={trend}
        strokeWidth="1.5"
      />
    </svg>
  );
}
