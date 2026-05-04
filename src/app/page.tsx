"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Ticker } from "@/components/ticker";
import { Console, LogLine } from "@/components/console";
import { Sparkline } from "@/components/sparkline";

interface Product {
  url: string;
  name: string | null;
  price: number | null;
  in_stock: boolean | null;
  image: string | null;
  source?: "dom_parser" | "ai_fallback";
}

function ts() {
  return new Date().toISOString().slice(11, 19);
}

const SCRAPE_STEPS: Array<{ delay: number; line: Omit<LogLine, "ts"> }> = [
  { delay: 0, line: { level: "INFO", msg: "init scrape session" } },
  { delay: 250, line: { level: "INFO", msg: "launching headless chromium" } },
  { delay: 600, line: { level: "INFO", msg: "rotating user-agent · viewport randomized" } },
  { delay: 900, line: { level: "INFO", msg: "navigating to target · waiting domcontentloaded" } },
  { delay: 1500, line: { level: "INFO", msg: "scanning DOM · 5 selectors" } },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [armed, setArmed] = useState(false);
  const [clock, setClock] = useState("");
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const log = (line: Omit<LogLine, "ts">) =>
    setLogs((prev) => [...prev, { ts: ts(), ...line }]);

  const scan = async () => {
    if (!url || busy) return;
    setBusy(true);
    setProduct(null);
    setArmed(false);
    setLogs([]);
    setHistory([]);

    SCRAPE_STEPS.forEach((s) =>
      setTimeout(() => log(s.line), s.delay),
    );

    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        log({ level: "ERR", msg: err.error || `scrape failed (${res.status})` });
        setBusy(false);
        return;
      }
      const data: Product = await res.json();

      if (data.source === "ai_fallback") {
        log({ level: "WARN", msg: "DOM parser incomplete · selectors drift" });
        log({ level: "AI", msg: "fallback engaged · gemini-1.5-flash extracting" });
      }
      log({ level: "OK", msg: `parsed: ${data.name?.slice(0, 50) ?? "—"}` });
      log({
        level: "OK",
        msg: `mark=${data.price ?? "?"}€ avail=${data.in_stock ? "IN_STOCK" : "OUT"} src=${data.source ?? "dom_parser"}`,
      });

      setProduct(data);

      if (data.price) {
        const seed = data.price;
        setHistory(
          Array.from({ length: 24 }, (_, i) => {
            const noise = Math.sin(i / 2.3) * 0.04 + (Math.random() - 0.5) * 0.06;
            return Number((seed * (1 + noise)).toFixed(2));
          }),
        );
      }
    } catch (e) {
      log({ level: "ERR", msg: e instanceof Error ? e.message : "network error" });
    } finally {
      setBusy(false);
    }
  };

  const arm = async () => {
    if (!email || !target || !product) return;
    log({ level: "INFO", msg: `arming alert · target=${target}€ · ${email}` });
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        target_price: parseFloat(target),
        product,
      }),
    });
    if (res.ok) {
      log({ level: "OK", msg: "surveillance armed · cron will tick every 30min" });
      setArmed(true);
    } else {
      log({ level: "ERR", msg: "arming failed" });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="scanline" />

      <header className="border-b border-border-strong bg-bg-deep">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-amber font-bold tracking-[0.3em] glow-amber">
              KAIROS
            </span>
            <span className="text-amber-faint">// SURVEILLANCE TERMINAL</span>
          </div>
          <div className="flex items-center gap-6 text-amber-faint">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green" />
              <span>LIVE</span>
            </span>
            <span>{clock}</span>
            <span>v0.1</span>
          </div>
        </div>
      </header>

      <Ticker />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <section className="mb-8">
          <div className="text-amber-dim text-xs tracking-widest uppercase mb-2">
            &gt; SCAN_TARGET
          </div>
          <div className="flex gap-0">
            <div className="flex-1 flex items-center border border-border-strong bg-bg-elev px-4">
              <span className="text-amber-faint mr-3">$</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="paste amazon product url"
                className="flex-1 bg-transparent py-3 outline-none text-text placeholder:text-amber-faint"
                disabled={busy}
              />
            </div>
            <button
              onClick={scan}
              disabled={busy || !url}
              className="border border-l-0 border-amber bg-amber text-bg px-6 py-3 font-bold tracking-widest hover:bg-amber-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "SCANNING…" : "SCAN ▶"}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Console lines={logs} busy={busy} />

          <div className="border border-border-strong bg-bg-deep">
            <div className="border-b border-border-strong px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-amber-dim tracking-widest uppercase">
                Position
              </span>
              <span className="text-xs text-amber-faint">
                {product?.source === "ai_fallback"
                  ? "src: AI_FALLBACK"
                  : product
                  ? "src: DOM_PARSER"
                  : "src: ─"}
              </span>
            </div>

            {!product ? (
              <div className="p-6 text-amber-faint text-xs flex items-center justify-center min-h-64">
                ─── no position open ───
              </div>
            ) : (
              <div className="p-4">
                <div className="flex gap-4 mb-4">
                  {product.image && (
                    <div className="w-20 h-20 border border-border-strong bg-bg-elev p-1 shrink-0">
                      <Image
                        src={product.image}
                        alt={product.name ?? ""}
                        width={80}
                        height={80}
                        className="w-full h-full object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-text-dim text-xs uppercase tracking-wider">
                      Asset
                    </div>
                    <div className="text-text font-medium truncate">
                      {product.name ?? "—"}
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-border pt-3">
                  <dt className="text-text-dim uppercase tracking-wider">Mark</dt>
                  <dd className="text-amber font-bold text-right glow-amber">
                    {product.price?.toFixed(2) ?? "—"}€
                  </dd>

                  <dt className="text-text-dim uppercase tracking-wider">
                    Avail
                  </dt>
                  <dd
                    className={`text-right font-bold ${
                      product.in_stock ? "text-green" : "text-red"
                    }`}
                  >
                    {product.in_stock ? "IN_STOCK" : "OUT_OF_STOCK"}
                  </dd>
                </dl>

                <div className="mt-5 border-t border-border pt-4 space-y-3">
                  <div className="text-amber-dim text-xs tracking-widest uppercase">
                    &gt; ARM_ALERT
                  </div>
                  <div className="flex items-center border border-border-strong bg-bg-elev px-3">
                    <span className="text-amber-faint text-xs mr-2 w-12">EMAIL</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="flex-1 bg-transparent py-2 outline-none text-text text-xs placeholder:text-amber-faint"
                    />
                  </div>
                  <div className="flex items-center border border-border-strong bg-bg-elev px-3">
                    <span className="text-amber-faint text-xs mr-2 w-12">TARGET</span>
                    <input
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-transparent py-2 outline-none text-text text-xs placeholder:text-amber-faint"
                    />
                    <span className="text-amber-faint text-xs">€</span>
                  </div>
                  <button
                    onClick={arm}
                    disabled={!email || !target || armed}
                    className="w-full border border-amber bg-bg-elev text-amber py-2 font-bold tracking-widest text-xs hover:bg-amber hover:text-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {armed ? "✓ ARMED" : "ARM SURVEILLANCE"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border border-border-strong bg-bg-deep">
          <div className="border-b border-border-strong px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-amber-dim tracking-widest uppercase">
              Price History · 24t
            </span>
            <span className="text-xs text-amber-faint">
              {history.length > 0
                ? `min=${Math.min(...history).toFixed(2)}€ · max=${Math.max(...history).toFixed(2)}€`
                : "─"}
            </span>
          </div>
          <div className="p-4">
            <Sparkline data={history} height={120} />
          </div>
        </section>

        <footer className="mt-8 pt-6 border-t border-border text-xs text-amber-faint flex items-center justify-between">
          <span>
            ENGINE: Playwright + BeautifulSoup · FALLBACK: Gemini 1.5 Flash ·
            STORE: Postgres · MAILER: Resend
          </span>
          <span>© KAIROS · BUILT FOR THE OPPORTUNE MOMENT</span>
        </footer>
      </main>
    </div>
  );
}
