// @ts-nocheck -- strict index checks relaxed for simulated trading screen
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة التداول — عروض الأسعار والرسوم البيانية" },
      { name: "description", content: "تطبيق تداول للموبايل بأسعار حية ورسوم بيانية وصفقات بحساب تجريبي." },
      { property: "og:title", content: "منصة التداول للموبايل" },
      { property: "og:description", content: "أسعار حية، رسوم شموع، فتح وإغلاق صفقات بحساب تجريبي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Sans+Arabic:wght@400;600&display=swap" }],
  }),
  component: App,
});

type Sym = { name: string; desc: string; digits: number; bid: number; spread: number; contract: number; prev: number; dir: 0 | 1 | -1; low: number; high: number };
type Candle = { o: number; h: number; l: number; c: number };
type Pos = { id: number; sym: string; type: "buy" | "sell"; vol: number; open: number; time: string; sl?: number; tp?: number };
type Deal = Pos & { close: number; profit: number; closeTime: string };

const INIT: [string, string, number, number, number, number][] = [
  ["EURUSD", "Euro vs US Dollar", 5, 1.08452, 0.00012, 100000],
  ["GBPUSD", "Great Britain Pound vs US Dollar", 5, 1.27311, 0.00015, 100000],
  ["USDJPY", "US Dollar vs Japanese Yen", 3, 149.512, 0.014, 100000],
  ["USDCHF", "US Dollar vs Swiss Franc", 5, 0.88213, 0.00016, 100000],
  ["AUDUSD", "Australian Dollar vs US Dollar", 5, 0.65874, 0.00013, 100000],
  ["USDCAD", "US Dollar vs Canadian Dollar", 5, 1.36122, 0.00018, 100000],
  ["XAUUSD", "Gold vs US Dollar", 2, 2365.42, 0.25, 100],
  ["BTCUSD", "Bitcoin vs US Dollar", 2, 67250.5, 15, 1],
];

const now = () => new Date().toLocaleString("en-GB", { hour12: false }).replace(",", "");
const fmt = (v: number, d: number) => v.toFixed(d);

function genCandles(p: number, digits: number): Candle[] {
  const vol = p * 0.0012;
  const arr: Candle[] = [];
  let c = p * (1 - 0.01);
  for (let i = 0; i < 80; i++) {
    const o = c;
    c = o + (Math.random() - 0.48) * vol;
    arr.push({ o, c, h: Math.max(o, c) + Math.random() * vol * 0.5, l: Math.min(o, c) - Math.random() * vol * 0.5 });
  }
  const shift = p - arr[arr.length - 1].c;
  return arr.map((k) => ({ o: +(k.o + shift).toFixed(digits), h: +(k.h + shift).toFixed(digits), l: +(k.l + shift).toFixed(digits), c: +(k.c + shift).toFixed(digits) }));
}

function profitOf(p: Pos, s: Sym) {
  const cur = p.type === "buy" ? s.bid : s.bid + s.spread;
  let pr = (p.type === "buy" ? cur - p.open : p.open - cur) * p.vol * s.contract;
  if (s.name.startsWith("USD") && s.name !== "USDUSD") pr = pr / cur;
  return pr;
}

function App() {
  const [tab, setTab] = useState<"quotes" | "chart" | "trade" | "history" | "settings">("quotes");
  const [syms, setSyms] = useState<Sym[]>(() =>
    INIT.map(([name, desc, digits, bid, spread, contract]) => ({ name, desc, digits, bid, spread, contract, prev: bid, dir: 0, low: bid * 0.995, high: bid * 1.004 })),
  );
  const [active, setActive] = useState("EURUSD");
  const [candles, setCandles] = useState<Record<string, Candle[]>>(() => Object.fromEntries(INIT.map((x) => [x[0], genCandles(x[3], x[2])])));
  const [positions, setPositions] = useState<Pos[]>([]);
  const [history, setHistory] = useState<Deal[]>([]);
  const [balance, setBalance] = useState(10000);
  const [orderOpen, setOrderOpen] = useState(false);
  const [menuSym, setMenuSym] = useState<string | null>(null);
  const [tf, setTf] = useState("M15");
  const idRef = useRef(5000001);

  useEffect(() => {
    const t = setInterval(() => {
      setSyms((prev) =>
        prev.map((s) => {
          if (Math.random() < 0.4) return { ...s, dir: 0 };
          const step = s.bid * 0.00015 * (Math.random() - 0.5) * 2;
          const bid = +(s.bid + step).toFixed(s.digits);
          return { ...s, prev: s.bid, bid, dir: bid > s.bid ? 1 : bid < s.bid ? -1 : 0, low: Math.min(s.low, bid), high: Math.max(s.high, bid) };
        }),
      );
    }, 700);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setCandles((prev) => {
      const next = { ...prev };
      for (const s of syms) {
        const arr = [...(next[s.name] || [])];
        const last = { ...arr[arr.length - 1] };
        last.c = s.bid; last.h = Math.max(last.h, s.bid); last.l = Math.min(last.l, s.bid);
        arr[arr.length - 1] = last;
        if (Math.random() < 0.02) { arr.push({ o: s.bid, h: s.bid, l: s.bid, c: s.bid }); arr.shift(); }
        next[s.name] = arr;
      }
      return next;
    });
  }, [syms]);

  const symMap = useMemo(() => Object.fromEntries(syms.map((s) => [s.name, s])), [syms]);
  const floating = positions.reduce((a, p) => a + profitOf(p, symMap[p.sym]), 0);
  const margin = positions.reduce((a, p) => a + (p.vol * symMap[p.sym].contract * (p.sym.startsWith("USD") ? 1 : symMap[p.sym].bid)) / 100, 0);
  const equity = balance + floating;

  const placeOrder = (type: "buy" | "sell", vol: number, sl?: number, tp?: number) => {
    const s = symMap[active];
    const open = type === "buy" ? s.bid + s.spread : s.bid;
    setPositions((p) => [...p, { id: idRef.current++, sym: active, type, vol, open: +open.toFixed(s.digits), time: now(), sl, tp }]);
    setOrderOpen(false);
    setTab("trade");
  };
  const closePos = (p: Pos) => {
    const s = symMap[p.sym];
    const pr = profitOf(p, s);
    setBalance((b) => b + pr);
    setHistory((h) => [{ ...p, close: p.type === "buy" ? s.bid : +(s.bid + s.spread).toFixed(s.digits), profit: pr, closeTime: now() }, ...h]);
    setPositions((ps) => ps.filter((x) => x.id !== p.id));
  };

  return (
    <div dir="rtl" className="mx-auto flex h-[100dvh] max-w-md flex-col bg-background text-[15px]">
      {tab === "quotes" && (
        <>
          <Header title="عروض الأسعار" />
          <div className="flex-1 overflow-y-auto">
            {syms.map((s) => (
              <button key={s.name} dir="ltr" onClick={() => setMenuSym(s.name)} className="flex w-full items-center border-b border-border px-4 py-2.5 text-left active:bg-muted">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{fmt(((s.bid - s.low) / s.low) * 100, 2)}% · {s.spread * 10 ** s.digits | 0}</div>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date().toLocaleTimeString("en-GB")}</div>
                </div>
                <Price v={s.bid} d={s.digits} dir={s.dir} sub={`L: ${fmt(s.low, s.digits)}`} />
                <Price v={s.bid + s.spread} d={s.digits} dir={s.dir} sub={`H: ${fmt(s.high, s.digits)}`} />
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "chart" && (
        <>
          <div dir="ltr" className="flex items-center gap-3 border-b border-border px-3 py-2">
            <select value={active} onChange={(e) => setActive(e.target.value)} className="bg-transparent font-bold outline-none">
              {syms.map((s) => <option key={s.name} className="bg-card">{s.name}</option>)}
            </select>
            {["M1", "M5", "M15", "H1", "H4", "D1"].map((t) => (
              <button key={t} onClick={() => setTf(t)} className={`text-xs ${tf === t ? "text-primary font-bold" : "text-muted-foreground"}`}>{t}</button>
            ))}
            <button onClick={() => setOrderOpen(true)} className="ml-auto rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">تداول</button>
          </div>
          <div className="relative flex-1">
            <div dir="ltr" className="absolute left-2 top-2 z-10 text-xs text-muted-foreground">{active}, {tf} · {symMap[active].desc}</div>
            <Chart candles={candles[active]} digits={symMap[active].digits} positions={positions.filter((p) => p.sym === active)} />
          </div>
          <div dir="ltr" className="grid grid-cols-2 gap-px bg-border">
            <button onClick={() => placeOrder("sell", 0.01)} className="bg-down py-2 font-bold text-primary-foreground">SELL {fmt(symMap[active].bid, symMap[active].digits)}</button>
            <button onClick={() => placeOrder("buy", 0.01)} className="bg-up py-2 font-bold text-primary-foreground">BUY {fmt(symMap[active].bid + symMap[active].spread, symMap[active].digits)}</button>
          </div>
        </>
      )}

      {tab === "trade" && (
        <>
          <Header title={`${floating >= 0 ? "" : "-"}${Math.abs(floating).toFixed(2)} USD`} tone={floating >= 0 ? "up" : "down"} onPlus={() => setOrderOpen(true)} />
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-1 border-b border-border px-4 py-2 text-sm">
              <Row k="الرصيد:" v={balance.toFixed(2)} />
              <Row k="الأسهم (Equity):" v={equity.toFixed(2)} />
              <Row k="الهامش:" v={margin.toFixed(2)} />
              <Row k="الهامش الحر:" v={(equity - margin).toFixed(2)} />
              <Row k="مستوى الهامش (%):" v={margin ? ((equity / margin) * 100).toFixed(2) : "—"} />
            </div>
            <div className="bg-muted px-4 py-1 text-xs text-muted-foreground">المراكز</div>
            {positions.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">لا توجد صفقات مفتوحة</p>}
            {positions.map((p) => {
              const s = symMap[p.sym]; const pr = profitOf(p, s);
              return (
                <div key={p.id} dir="ltr" className="flex items-center border-b border-border px-4 py-2">
                  <div className="flex-1">
                    <div><b>{p.sym}</b>, <span className={p.type === "buy" ? "text-up" : "text-down"}>{p.type} {p.vol.toFixed(2)}</span></div>
                    <div className="text-xs text-muted-foreground">{fmt(p.open, s.digits)} → {fmt(p.type === "buy" ? s.bid : s.bid + s.spread, s.digits)}</div>
                  </div>
                  <div className={`ml-2 font-bold ${pr >= 0 ? "text-up" : "text-down"}`}>{pr.toFixed(2)}</div>
                  <button onClick={() => closePos(p)} className="ml-3 rounded border border-border px-2 py-1 text-xs">✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "history" && (
        <>
          <Header title="السجل" />
          <div className="space-y-1 border-b border-border px-4 py-2 text-sm">
            <Row k="الربح:" v={history.reduce((a, d) => a + d.profit, 0).toFixed(2)} />
            <Row k="الإيداع:" v="10 000.00" />
            <Row k="الرصيد:" v={balance.toFixed(2)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">لا يوجد سجل بعد</p>}
            {history.map((d) => (
              <div key={d.id} dir="ltr" className="flex items-center border-b border-border px-4 py-2">
                <div className="flex-1">
                  <div><b>{d.sym}</b>, <span className={d.type === "buy" ? "text-up" : "text-down"}>{d.type} {d.vol.toFixed(2)}</span></div>
                  <div className="text-xs text-muted-foreground">{d.open} → {d.close}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">{d.closeTime}</div>
                  <div className={`font-bold ${d.profit >= 0 ? "text-up" : "text-down"}`}>{d.profit.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "settings" && (
        <>
          <Header title="الإعدادات" />
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary font-bold text-primary-foreground">D</div>
              <div><div className="font-bold">حساب تجريبي</div><div dir="ltr" className="text-xs text-muted-foreground text-right">51234567 — Demo-Server · 1:100</div></div>
            </div>
            {["حسابات جديدة", "صندوق البريد", "الأخبار", "التنبيهات", "مجلة الأحداث", "الرسوم البيانية", "حول"].map((x) => (
              <div key={x} className="border-b border-border px-4 py-3">{x}</div>
            ))}
            <button onClick={() => { setBalance(10000); setPositions([]); setHistory([]); }} className="w-full px-4 py-3 text-right text-down">إعادة تعيين الحساب التجريبي</button>
          </div>
        </>
      )}

      <nav className="grid grid-cols-5 border-t border-border bg-card">
        {([
          ["quotes", "الأسعار", "⇅"], ["chart", "الرسم", "📈"], ["trade", "تداول", "◉"], ["history", "السجل", "🕘"], ["settings", "الإعدادات", "⚙"],
        ] as const).map(([k, l, i]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center py-2 text-[11px] ${tab === k ? "text-primary" : "text-muted-foreground"}`}>
            <span className="text-lg leading-none">{i}</span>{l}
          </button>
        ))}
      </nav>

      {menuSym && (
        <Sheet onClose={() => setMenuSym(null)}>
          <div dir="ltr" className="px-4 pb-2 text-center font-bold">{menuSym}<div className="text-xs font-normal text-muted-foreground">{symMap[menuSym].desc}</div></div>
          {[["أمر جديد", () => { setActive(menuSym); setOrderOpen(true); }], ["الرسم البياني", () => { setActive(menuSym); setTab("chart"); }], ["المواصفات", () => {}]].map(([l, f]) => (
            <button key={l as string} onClick={() => { (f as () => void)(); setMenuSym(null); }} className="w-full border-t border-border px-4 py-3 text-right">{l as string}</button>
          ))}
        </Sheet>
      )}

      {orderOpen && <OrderSheet s={symMap[active]} onClose={() => setOrderOpen(false)} onPlace={placeOrder} />}
    </div>
  );
}

function Header({ title, tone, onPlus }: { title: string; tone?: "up" | "down"; onPlus?: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <span className="text-xl">☰</span>
      <h1 className={`font-bold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`} dir="ltr">{title}</h1>
      <button onClick={onPlus} className="text-xl">{onPlus ? "+" : "✎"}</button>
    </header>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span>{k}</span><span dir="ltr" className="font-medium">{v}</span></div>;
}

function Price({ v, d, dir, sub }: { v: number; d: number; dir: number; sub: string }) {
  const s = fmt(v, d);
  const big = s.slice(-3, -1), tail = s.slice(-1), head = s.slice(0, -3);
  return (
    <div className="w-28 text-right">
      <div className={`${dir > 0 ? "text-up" : dir < 0 ? "text-down" : ""}`}>
        <span className="text-sm">{head}</span><span className="text-2xl font-bold">{big}</span><sup className="text-xs">{tail}</sup>
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-xl bg-card pt-3 pb-4 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function OrderSheet({ s, onClose, onPlace }: { s: Sym; onClose: () => void; onPlace: (t: "buy" | "sell", v: number, sl?: number, tp?: number) => void }) {
  const [vol, setVol] = useState(0.01);
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button onClick={onClose}>→</button><b dir="ltr">{s.name}</b><span className="text-xs text-muted-foreground">تنفيذ فوري</span>
      </header>
      <div dir="ltr" className="flex items-center justify-center gap-2 p-4">
        {[-0.5, -0.1, -0.01].map((d) => <button key={d} onClick={() => setVol((v) => Math.max(0.01, +(v + d).toFixed(2)))} className="text-xs text-primary">{d}</button>)}
        <input value={vol} onChange={(e) => setVol(+e.target.value || 0.01)} className="w-20 border-b border-primary bg-transparent text-center text-xl font-bold outline-none" />
        {[0.01, 0.1, 0.5].map((d) => <button key={d} onClick={() => setVol((v) => +(v + d).toFixed(2))} className="text-xs text-primary">+{d}</button>)}
      </div>
      <div dir="ltr" className="flex justify-around py-4 text-3xl font-bold">
        <span className="text-down">{fmt(s.bid, s.digits)}</span><span className="text-up">{fmt(s.bid + s.spread, s.digits)}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 px-4">
        <input placeholder="وقف الخسارة" value={sl} onChange={(e) => setSl(e.target.value)} className="border-b border-border bg-transparent py-2 outline-none" />
        <input placeholder="جني الأرباح" value={tp} onChange={(e) => setTp(e.target.value)} className="border-b border-border bg-transparent py-2 outline-none" />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 p-4" dir="ltr">
        <button onClick={() => onPlace("sell", vol, +sl || undefined, +tp || undefined)} className="rounded bg-down py-3 font-bold text-primary-foreground">SELL by Market</button>
        <button onClick={() => onPlace("buy", vol, +sl || undefined, +tp || undefined)} className="rounded bg-up py-3 font-bold text-primary-foreground">BUY by Market</button>
      </div>
    </div>
  );
}

function Chart({ candles, digits, positions }: { candles: Candle[]; digits: number; positions: Pos[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const ctx = cv.getContext("2d")!; ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const up = css.getPropertyValue("--up"), down = css.getPropertyValue("--down"), grid = css.getPropertyValue("--border"), txt = css.getPropertyValue("--muted-foreground");
    const W = r.width - 64, H = r.height - 10;
    const hi = Math.max(...candles.map((c) => c.h)), lo = Math.min(...candles.map((c) => c.l));
    const y = (v: number) => 5 + ((hi - v) / (hi - lo || 1)) * H;
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.font = "10px Roboto"; ctx.fillStyle = txt; ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) { const v = lo + ((hi - lo) * i) / 6; const yy = y(v); ctx.beginPath(); ctx.setLineDash([2, 3]); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); ctx.fillText(v.toFixed(digits), W + 4, yy + 3); }
    ctx.setLineDash([]);
    const cw = W / candles.length;
    candles.forEach((c, i) => {
      const x = i * cw + cw / 2; const col = c.c >= c.o ? up : down;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x, y(c.h)); ctx.lineTo(x, y(c.l)); ctx.stroke();
      ctx.fillRect(x - cw * 0.35, Math.min(y(c.o), y(c.c)), cw * 0.7, Math.max(1, Math.abs(y(c.o) - y(c.c))));
    });
    const last = candles[candles.length - 1].c;
    ctx.strokeStyle = down; ctx.beginPath(); ctx.moveTo(0, y(last)); ctx.lineTo(W, y(last)); ctx.stroke();
    ctx.fillStyle = down; ctx.fillRect(W, y(last) - 7, 64, 14); ctx.fillStyle = "white"; ctx.fillText(last.toFixed(digits), W + 4, y(last) + 3);
    positions.forEach((p) => { ctx.strokeStyle = up; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(0, y(p.open)); ctx.lineTo(W, y(p.open)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = up; ctx.fillText(`#${p.id} ${p.type} ${p.vol}`, 4, y(p.open) - 3); });
  }, [candles, digits, positions]);
  return <canvas ref={ref} className="h-full w-full" />;
}
