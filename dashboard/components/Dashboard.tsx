"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BEHAVIORS, COLOR, LABEL, RANGES, type Behavior, type RangeKey } from "@/lib/behaviors";
import LiveVideo from "./LiveVideo";
import { useTheme } from "./useTheme";

type Summary = {
  now: number;
  bucketMs: number;
  latest: null | {
    ts: number;
    cat_count: number;
    counts: Record<string, number>;
    cats: { id: number; behavior: string; conf: number; x: number; y: number; w: number; h: number }[];
  };
  stale: boolean;
  buckets: ({ t: number } & Record<Behavior, number | null>)[];
  catMinutes: Record<Behavior, number>;
  monitoredMinutes: number;
  absentMinutes: number;
  samples: number;
};

const POLL_MS = 5000;

const fmtTime = (t: number, withDate: boolean) =>
  new Date(t).toLocaleString("th-TH", withDate
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" });

const fmtMin = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} ชม.` : `${Math.round(m)} นาที`);

export default function Dashboard() {
  const theme = useTheme();
  const colors = COLOR[theme];
  const [range, setRange] = useState<RangeKey>("1h");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/summary?range=${range}`, { cache: "no-store" });
        const json = (await res.json()) as Summary;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [range]);

  const latest = data?.latest;
  const multiDay = range === "7d";
  const totalCatMin = data ? BEHAVIORS.reduce((s, b) => s + data.catMinutes[b], 0) : 0;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      {/* ---------- header + ตัวกรองช่วงเวลา (คุมทุกกราฟ) ---------- */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">พฤติกรรมแมว</h1>
          <Status stale={data?.stale ?? true} error={error} lastTs={latest?.ts} />
        </div>
        <div role="group" aria-label="ช่วงเวลา" className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={range === k}
              onClick={() => setRange(k)}
              className={`rounded-md px-3 py-1 transition-colors ${
                range === k ? "bg-ink text-surface" : "text-ink-2 hover:bg-hover"
              }`}
            >
              {RANGES[k].label}
            </button>
          ))}
        </div>
      </header>

      {/* ---------- ภาพสด + สถานะตอนนี้ ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveVideo />
        </div>
        <section className="card flex flex-col gap-4">
          <div>
            <h2 className="text-sm text-ink-2">แมวในห้องตอนนี้</h2>
            <p className="text-5xl font-semibold">
              {latest ? latest.cat_count : "–"}
              <span className="ml-2 text-base font-normal text-ink-2">ตัว</span>
            </p>
          </div>
          <ul className="flex flex-col gap-1">
            {BEHAVIORS.map((b) => (
              <li key={b} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-hover">
                <span className="flex items-center gap-2 text-sm">
                  <Swatch color={colors[b]} />
                  {LABEL[b]}
                </span>
                <span className="tnum text-lg font-semibold">{latest?.counts[b] ?? 0}</span>
              </li>
            ))}
          </ul>
          {data && (
            <p className="mt-auto border-t border-line pt-3 text-sm text-ink-2">
              ช่วง {RANGES[range].label}: มีข้อมูล {fmtMin(data.monitoredMinutes)} · ไม่มีแมวในห้อง{" "}
              {fmtMin(data.absentMinutes)}
            </p>
          )}
        </section>
      </div>

      {/* ---------- ไทม์ไลน์ ---------- */}
      <section className="card" style={{ opacity: loading && !data ? 0.6 : 1 }}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">จำนวนแมวในแต่ละพฤติกรรม</h2>
            <p className="text-sm text-ink-2">
              ค่าเฉลี่ยทุก {Math.round((data?.bucketMs ?? RANGES[range].bucketMs) / 60000)} นาที
            </p>
          </div>
          <Legend colors={colors} />
        </div>
        <div className="h-72">
          {data && data.samples > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.buckets} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(t) => fmtTime(t, multiDay)}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--axis)" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--hover)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="card !p-3 text-sm shadow-md">
                        <p className="mb-1 font-semibold">{fmtTime(Number(label), multiDay)}</p>
                        {BEHAVIORS.map((b) => {
                          const v = payload[0].payload[b] as number | null;
                          return (
                            <p key={b} className="flex items-center justify-between gap-6">
                              <span className="flex items-center gap-2">
                                <Swatch color={colors[b]} /> {LABEL[b]}
                              </span>
                              <span className="tnum">{v ?? "–"}</span>
                            </p>
                          );
                        })}
                      </div>
                    ) : null
                  }
                />
                {BEHAVIORS.map((b) => (
                  <Bar
                    key={b}
                    dataKey={b}
                    stackId="a"
                    fill={colors[b]}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </div>
      </section>

      {/* ---------- เวลารวม + ตารางแมวตอนนี้ ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-base font-semibold">เวลารวมแต่ละพฤติกรรม</h2>
          <p className="mb-3 text-sm text-ink-2">หน่วย แมว·นาที (แมว 2 ตัวนอน 10 นาที = 20)</p>
          {totalCatMin > 0 ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              {/* donut: สัดส่วนเวลาของแต่ละพฤติกรรมในช่วงที่เลือก */}
              <div className="relative size-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={BEHAVIORS.map((b) => ({ key: b, value: data?.catMinutes[b] ?? 0 })).filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="key"
                      innerRadius="62%"
                      outerRadius="100%"
                      startAngle={90}
                      endAngle={-270}
                      stroke="var(--surface)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {BEHAVIORS.filter((b) => (data?.catMinutes[b] ?? 0) > 0).map((b) => (
                        <Cell key={b} fill={colors[b]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const b = payload[0].payload.key as Behavior;
                        const v = payload[0].payload.value as number;
                        return (
                          <div className="card !p-2 text-sm shadow-md">
                            <p className="flex items-center gap-2 font-semibold">
                              <Swatch color={colors[b]} /> {LABEL[b]}
                            </p>
                            <p className="tnum text-ink-2">
                              {Math.round(v).toLocaleString()} แมว·นาที · {Math.round((v / totalCatMin) * 100)}%
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <p>
                    <span className="tnum block text-xl font-semibold">{fmtMin(totalCatMin)}</span>
                    <span className="text-xs text-ink-2">แมว·เวลารวม</span>
                  </p>
                </div>
              </div>
              <ul className="flex w-full flex-col gap-1.5">
                {BEHAVIORS.map((b) => {
                  const v = data?.catMinutes[b] ?? 0;
                  const pct = (v / totalCatMin) * 100;
                  return (
                    <li key={b} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Swatch color={colors[b]} /> {LABEL[b]}
                      </span>
                      <span className="tnum whitespace-nowrap text-ink-2">
                        {Math.round(v).toLocaleString()} · {pct > 0 && pct < 1 ? "<1" : Math.round(pct)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-ink-2">ยังไม่มีข้อมูลในช่วงนี้</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-base font-semibold">แมวที่เห็นตอนนี้</h2>
          {latest && latest.cats.length ? (
            <table className="tnum w-full text-left text-sm">
              <thead className="text-ink-2">
                <tr className="border-b border-line">
                  <th className="py-1.5 font-normal">ID</th>
                  <th className="py-1.5 font-normal">พฤติกรรม</th>
                  <th className="py-1.5 text-right font-normal">ความมั่นใจ</th>
                  <th className="py-1.5 text-right font-normal">ตำแหน่ง (x, y)</th>
                </tr>
              </thead>
              <tbody>
                {latest.cats.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-1.5">#{c.id}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <Swatch color={colors[c.behavior as Behavior] ?? "var(--muted)"} />
                        {LABEL[c.behavior as Behavior] ?? c.behavior}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">{Math.round(c.conf * 100)}%</td>
                    <td className="py-1.5 text-right">
                      {c.x}, {c.y}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-2">ไม่มีแมวในภาพ</p>
          )}
        </section>
      </div>

      {/* ---------- ตารางข้อมูลของไทม์ไลน์ (table view) ---------- */}
      {data && data.samples > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold">ดูข้อมูลไทม์ไลน์เป็นตาราง</summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="tnum w-full text-right text-sm">
              <thead className="sticky top-0 bg-surface text-ink-2">
                <tr className="border-b border-line">
                  <th className="py-1.5 text-left font-normal">เวลา</th>
                  {BEHAVIORS.map((b) => (
                    <th key={b} className="py-1.5 font-normal">
                      {LABEL[b]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.buckets
                  .filter((r) => BEHAVIORS.some((b) => r[b] !== null))
                  .map((r) => (
                    <tr key={r.t} className="border-b border-line last:border-0">
                      <td className="py-1 text-left">{fmtTime(r.t, multiDay)}</td>
                      {BEHAVIORS.map((b) => (
                        <td key={b} className="py-1">
                          {r[b] ?? "–"}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </main>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
}

function Legend({ colors }: { colors: Record<Behavior, string> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      {BEHAVIORS.map((b) => (
        <li key={b} className="flex items-center gap-1.5">
          <Swatch color={colors[b]} /> {LABEL[b]}
        </li>
      ))}
    </ul>
  );
}

function Status({ stale, error, lastTs }: { stale: boolean; error: boolean; lastTs?: number }) {
  const ok = !stale && !error;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
      <span aria-hidden style={{ color: ok ? "var(--good)" : "var(--warning)" }}>
        {ok ? "●" : "▲"}
      </span>
      {error
        ? "เชื่อมต่อ dashboard ไม่ได้"
        : ok
          ? "รับข้อมูลจาก CiRA CORE อยู่"
          : lastTs
            ? `ไม่มีข้อมูลใหม่ตั้งแต่ ${fmtTime(lastTs, true)}`
            : "ยังไม่มีข้อมูลจาก CiRA CORE"}
    </p>
  );
}

function Empty() {
  return (
    <div className="grid h-full place-items-center text-center text-sm text-ink-2">
      <p>
        ยังไม่มีข้อมูลในช่วงนี้
        <br />
        ลองเปิด CiRA CORE หรือรัน <code className="rounded bg-hover px-1">npm run seed</code> เพื่อใส่ข้อมูลจำลอง
      </p>
    </div>
  );
}
