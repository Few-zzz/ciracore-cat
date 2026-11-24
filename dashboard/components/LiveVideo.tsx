"use client";
import { useEffect, useRef, useState } from "react";
import { COLOR, LABEL, objectLabel, type Behavior } from "@/lib/behaviors";
import { useTheme } from "./useTheme";

import type { Detections } from "@/lib/live";

const NO_FRAME_MS = 5000;
const FPS_WINDOW_MS = 3000;   // เฉลี่ย fps จาก 3 วินาทีล่าสุด (ตัวเลขไม่กระโดด)

export default function LiveVideo() {
  const theme = useTheme();
  const [src, setSrc] = useState<string | null>(null);
  const [meta, setMeta] = useState<Detections | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [lastAt, setLastAt] = useState(0);
  const [now, setNow] = useState(0);
  const [showDetect, setShowDetect] = useState(true);
  const urlRef = useRef<string | null>(null);
  const [fps, setFps] = useState({ frame: 0, detect: 0 });

  // ดึงเฟรมใหม่ต่อเนื่อง: server ถือคำขอไว้จนมีเฟรมใหม่ (long-poll) แล้วขอเฟรมถัดไปทันที
  // จึงได้ fps เท่าที่ CiRA ส่งมา ไม่ยิงซ้อน
  useEffect(() => {
    let alive = true;
    let seq = -1;
    // เวลาที่ได้เฟรมใหม่ / ได้กล่องตรวจจับชุดใหม่ (นับ fps จาก FPS_WINDOW_MS ล่าสุด)
    const frameTimes: number[] = [];
    const detectTimes: number[] = [];
    let lastMetaTs: number | null = null;
    async function loop() {
      while (alive) {
        try {
          const res = await fetch(`/api/frame?after=${seq}`, { cache: "no-store" });
          if (res.status !== 200) continue;   // 204 = รอครบ 1 วิแล้วยังไม่มีเฟรม ขอใหม่
          {
            seq = Number(res.headers.get("X-Seq"));
            // กล่องล่าสุดจาก cira_behavior.py (null = ไม่มี/เก่าเกิน)
            const m = JSON.parse(decodeURIComponent(res.headers.get("X-Meta") ?? "null")) as Detections | null;
            const url = URL.createObjectURL(await res.blob());
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            setSrc(url);
            setMeta(m);
            const t = Date.now();
            setLastAt(t);
            frameTimes.push(t);
            // กล่องชุดเดิมแนบมากับหลายเฟรมได้ นับเฉพาะตอน ts เปลี่ยน
            if (m && m.ts !== lastMetaTs) {
              lastMetaTs = m.ts;
              detectTimes.push(t);
            }
          }
        } catch {
          // เซิร์ฟเวอร์รีสตาร์ท พักก่อนลองใหม่ ไม่ยิงรัว
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    loop();
    const rate = (times: number[], t: number) => {
      while (times.length && times[0] < t - FPS_WINDOW_MS) times.shift();
      return (times.length * 1000) / FPS_WINDOW_MS;
    };
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setFps({ frame: rate(frameTimes, t), detect: rate(detectTimes, t) });
    }, 1000);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, []);

  const live = src !== null && now - lastAt < NO_FRAME_MS;
  const colors = COLOR[theme];

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">ภาพสด</h2>
          <span className="flex items-center gap-1.5 text-sm text-ink-2">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ background: live ? "var(--critical)" : "var(--muted)" }}
            />
            {live ? "LIVE" : src ? "ภาพหยุด" : "ยังไม่มีภาพ"}
          </span>
          {live && (
            <span className="tnum text-sm text-ink-2" title="เฉลี่ย 3 วินาทีล่าสุด ที่เบราว์เซอร์ได้รับจริง">
              · ภาพ {fps.frame.toFixed(1)} fps · ตรวจจับ {fps.detect.toFixed(1)} fps
            </span>
          )}
        </div>
        <div role="group" aria-label="โหมดแสดงผล" className="flex rounded-lg border border-line p-0.5 text-sm">
          {[
            { v: true, label: "แสดงการตรวจจับ" },
            { v: false, label: "วิดีโออย่างเดียว" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={showDetect === o.v}
              onClick={() => setShowDetect(o.v)}
              className={`rounded-md px-3 py-1 transition-colors ${
                showDetect === o.v ? "bg-ink text-surface" : "text-ink-2 hover:bg-hover"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: size ? `${size.w} / ${size.h}` : "16 / 9" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL ของเฟรมสด
          <img
            src={src}
            alt="ภาพสดจากกล้อง"
            className="absolute inset-0 size-full"
            style={{ opacity: live ? 1 : 0.5 }}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (!size || size.w !== w || size.h !== h) setSize({ w, h });
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/70">
            รอภาพจาก CiRA CORE… (ตรวจว่า Python+ กด Start แล้ว และ SERVER ชี้มาที่ dashboard นี้)
          </div>
        )}

        {showDetect && meta && (
          <svg className="absolute inset-0 size-full" viewBox={`0 0 ${meta.w} ${meta.h}`} preserveAspectRatio="none">
            {meta.objects.map((o, i) => (
              <g key={`o${i}`}>
                <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={meta.w / 640} />
                <Tag fs={meta.w / 64} x={o.x} y={o.y} text={`${objectLabel(o.name)} ${Math.round(o.conf * 100)}%`} bg="rgba(0,0,0,0.6)" fg="#ffffff" />
              </g>
            ))}
            {meta.cats.map((c) => {
              const col = colors[c.behavior as Behavior] ?? "#ffffff";
              return (
                <g key={`c${c.id}`}>
                  <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="none" stroke={col} strokeWidth={meta.w / 320} />
                  <Tag
                    fs={meta.w / 64}
                    x={c.x}
                    y={c.y}
                    text={`#${c.id} ${LABEL[c.behavior as Behavior] ?? c.behavior}`}
                    bg={col}
                    fg="#0b0b0b"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}

// ป้ายชื่อเหนือกรอบ (fs อิงความกว้างภาพ: 1920 px -> 30)
function Tag({ fs, x, y, text, bg, fg }: { fs: number; x: number; y: number; text: string; bg: string; fg: string }) {
  const w = text.length * fs * 0.62 + 16;
  const ty = Math.max(y - fs - 10, 0);
  return (
    <g>
      <rect x={x} y={ty} width={w} height={fs + 10} rx={6} fill={bg} />
      <text x={x + 8} y={ty + fs} fontSize={fs} fontWeight={600} fill={fg} fontFamily="system-ui, 'Leelawadee UI', Tahoma, sans-serif">
        {text}
      </text>
    </g>
  );
}
