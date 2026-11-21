// ลำดับคงที่ = ลำดับสี (ห้ามสลับ สีจะตามพฤติกรรมเสมอ)
export const BEHAVIORS = ["resting", "moving", "playing", "climbing", "idle"] as const;
export type Behavior = (typeof BEHAVIORS)[number];

export const LABEL: Record<Behavior, string> = {
  resting: "นอน/พัก",
  moving: "เคลื่อนไหว",
  playing: "เล่น",
  climbing: "ปีนคอนโด",
  idle: "นั่งนิ่ง",
};

// categorical palette (validated) — light / dark เป็นสเต็ปของ hue เดียวกัน
export const COLOR: Record<"light" | "dark", Record<Behavior, string>> = {
  light: { resting: "#2a78d6", moving: "#eb6834", playing: "#1baf7a", climbing: "#eda100", idle: "#e87ba4" },
  dark: { resting: "#3987e5", moving: "#d95926", playing: "#199e70", climbing: "#c98500", idle: "#d55181" },
};

export const RANGES = {
  "1h": { label: "1 ชม.", ms: 3_600_000, bucketMs: 2 * 60_000 },
  "6h": { label: "6 ชม.", ms: 6 * 3_600_000, bucketMs: 10 * 60_000 },
  "24h": { label: "24 ชม.", ms: 24 * 3_600_000, bucketMs: 30 * 60_000 },
  "7d": { label: "7 วัน", ms: 7 * 24 * 3_600_000, bucketMs: 4 * 3_600_000 },
} as const;
export type RangeKey = keyof typeof RANGES;
