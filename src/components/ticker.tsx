interface Tick {
  symbol: string;
  price: number;
  delta: number;
}

const SAMPLE_TICKS: Tick[] = [
  { symbol: "AIRPODS-PRO-2", price: 249.0, delta: -3.2 },
  { symbol: "PS5-DIGITAL", price: 449.99, delta: 1.8 },
  { symbol: "DYSON-V15", price: 599.0, delta: -8.4 },
  { symbol: "NIKE-AF1-WHT", price: 119.99, delta: 0.0 },
  { symbol: "MACBOOK-AIR-M3", price: 1299.0, delta: -5.1 },
  { symbol: "KINDLE-PWR-12", price: 169.99, delta: 2.3 },
  { symbol: "LEGO-MILLNM-FCN", price: 174.99, delta: -12.6 },
  { symbol: "NESPRESSO-VTUO", price: 129.0, delta: -0.7 },
  { symbol: "BOSE-QC-ULTRA", price: 449.95, delta: 4.2 },
  { symbol: "LEVIS-501-32", price: 89.0, delta: -2.1 },
  { symbol: "HARIBO-DRGBR-1KG", price: 12.49, delta: 1.0 },
  { symbol: "GOPRO-HERO-12", price: 399.99, delta: -6.8 },
];

function formatDelta(delta: number) {
  if (delta === 0) return "▬ 0.0%";
  const arrow = delta > 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(delta).toFixed(1)}%`;
}

function deltaColor(delta: number) {
  if (delta === 0) return "text-text-dim";
  return delta > 0 ? "text-green" : "text-red";
}

export function Ticker() {
  const ticks = [...SAMPLE_TICKS, ...SAMPLE_TICKS];

  return (
    <div className="border-y border-border-strong bg-bg-deep overflow-hidden whitespace-nowrap py-2 text-xs">
      <div className="ticker-track inline-block">
        {ticks.map((t, i) => (
          <span key={i} className="inline-block px-6">
            <span className="text-amber-dim">{t.symbol}</span>
            <span className="text-text mx-2">{t.price.toFixed(2)}€</span>
            <span className={deltaColor(t.delta)}>{formatDelta(t.delta)}</span>
            <span className="text-amber-faint mx-3">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
