"""สร้าง system_diagram.html (SVG) แล้วใช้ Edge headless แคปเป็น PNG"""
import html

W, H = 1600, 1120
INK, INK2, MUTED = "#1f1e1c", "#55544f", "#8a8880"
LINE = "#d6d4cc"
LIVE, HIST = "#eb6834", "#2a78d6"     # เส้นข้อมูลสด / ข้อมูลย้อนหลัง

out = []
def add(s): out.append(s)
def esc(s): return html.escape(s)

def group(x, y, w, h, title, sub, fill):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{fill}" stroke="{LINE}" stroke-width="1.5"/>')
    add(f'<text x="{x+22}" y="{y+34}" font-size="20" font-weight="700" fill="{INK}">{esc(title)}</text>')
    add(f'<text x="{x+22}" y="{y+58}" font-size="14" fill="{INK2}">{esc(sub)}</text>')

def box(x, y, w, h, title, lines=(), accent=None, mono=False, fill="#ffffff"):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{accent or LINE}" stroke-width="{2 if accent else 1.5}"/>')
    fam = ' font-family="Consolas, monospace"' if mono else ""
    add(f'<text x="{x+14}" y="{y+26}" font-size="16" font-weight="700" fill="{INK}"{fam}>{esc(title)}</text>')
    for i, t in enumerate(lines):
        add(f'<text x="{x+14}" y="{y+48+i*19}" font-size="13.5" fill="{INK2}">{esc(t)}</text>')

def arrow(pts, color, label=None, lx=None, ly=None, anchor="middle", dashed=False):
    d = "M" + " L".join(f"{x},{y}" for x, y in pts)
    dash = ' stroke-dasharray="7 5"' if dashed else ""
    mk = "live" if color == LIVE else ("hist" if color == HIST else "ink")
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.5"{dash} marker-end="url(#a-{mk})"/>')
    if label:
        add(f'<text x="{lx}" y="{ly}" font-size="13" fill="{INK2}" text-anchor="{anchor}" paint-order="stroke" stroke="#fbfaf7" stroke-width="5">{esc(label)}</text>')

# ---------- markers ----------
add("<defs>")
for name, c in (("live", LIVE), ("hist", HIST), ("ink", MUTED), ("line", "#06c755")):
    add(f'<marker id="a-{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>')
add("</defs>")

# ---------- title ----------
add(f'<text x="40" y="52" font-size="28" font-weight="700" fill="{INK}">System Diagram — ระบบดูพฤติกรรมแมว (CiRA CORE + Next.js)</text>')
add(f'<text x="40" y="80" font-size="15" fill="{INK2}">เวอร์ชันโมเดลใหม่ (branch new-behavior-classes): โมเดลบอกพฤติกรรมจากคลาส Cat_* โดยตรง</text>')

# ---------- groups ----------
group(30, 110, 480, 790, "เครื่อง CiRA CORE", "ตรวจจับ + คำนวณพฤติกรรม", "#f4f2ec")
group(560, 110, 700, 790, "Next.js dashboard server", "Node 24 · พอร์ต 3000 · เก็บ/สรุปข้อมูล ไม่คำนวณพฤติกรรม", "#eef3fb")
group(1310, 110, 260, 790, "เบราว์เซอร์", "แสดงผลอย่างเดียว", "#f4f2ec")

# ---------- CiRA pipeline ----------
bx, bw = 60, 420
box(bx, 180, bw, 60, "กล้อง", ["ภาพห้องแมว"])
arrow([(270, 240), (270, 262)], MUTED)
box(bx, 265, bw, 82, "Python+ #1 · cira_raw_video.py", ["ส่งภาพดิบ (ยังไม่มีกรอบ) ย่อขนาด → JPEG", "ตั้งไว้ 30 fps (ได้จริง ~12–15 fps ตามความเร็ว flow)"], accent=LIVE)
arrow([(270, 347), (270, 377)], MUTED)
box(bx, 380, bw, 120, "DeepDetect (โมเดลที่เทรนใหม่)",
    ["แมว 7 คลาส: Cat_Sleep, Cat_Walk, Cat_Play, Cat_Sit,",
     "  Cat_Eat, Cat_Stand, Cat_Poop",
     "สิ่งของ: Bed, Bowl, Poop, Sandbox, Toy",
     "ให้ name, confidence, x, y (จุดกลาง), w, h"])
arrow([(270, 500), (270, 530)], MUTED)
box(bx, 533, bw, 160, "Python+ #2 · cira_behavior.py",
    ["1. ตัดกล่องแมวที่ conf < 0.7",
     "2. กล่องซ้อนกัน (IoU ≥ 0.5) = ตัวเดียวกัน เก็บอันที่มั่นใจกว่า",
     "3. แปลงคลาส Cat_Sleep → sleep ฯลฯ",
     "4. tracking ให้ #id + โหวต 10 เฟรมกันกระพริบ",
     "5. นับจำนวนแมวต่อพฤติกรรม",
     "6. สรุปเฉลี่ยรายนาที → Google Sheet"], accent=HIST)
arrow([(160, 693), (160, 713)], MUTED)
arrow([(380, 693), (380, 713)], MUTED)
box(60, 716, 200, 80, "Debug (ใน CiRA)", ["ภาพที่เขียน #id", "+ พฤติกรรมทับ"])
box(280, 716, 200, 80, "LineBot (module)", ["ระบบแจ้งเตือน", "ที่เพื่อนทำแยกไว้"])

# ---------- cloud ----------
group(30, 930, 1540, 140, "อินเทอร์เน็ต", "ต้องต่อเน็ต", "#f1f7ee")
box(280, 960, 200, 80, "LINE", ["แจ้งเตือนเข้ามือถือ", "ผู้ใช้"], accent="#06c755")
add('<line x1="380" y1="796" x2="380" y2="955" stroke="#06c755" stroke-width="2.5" stroke-dasharray="7 5" marker-end="url(#a-line)"/>')
box(760, 960, 340, 90, "Google Sheet (Apps Script)", ["1 แถว/นาที: เวลา, จำนวนแมว,", "ค่าเฉลี่ย 7 พฤติกรรม · แท็บ cat_minutes"], accent=HIST)
arrow([(480, 662), (545, 662), (545, 1005), (758, 1005)], HIST, "ทุก 1 นาที", 650, 995)
arrow([(930, 958), (930, 694)], HIST, "ดึงนาทีที่ขาด (เปิดเว็บ)", 940, 810, "start")

# ---------- server: API + storage ----------
px, pw = 585, 210          # POST column
sx, sw = 850, 160          # storage column
gx, gw = 1068, 178         # GET column  (ต้องจบก่อน 1260)

box(px, 270, pw, 62, "POST /api/frame", ["รับภาพ JPEG ล่าสุด"], mono=True, accent=LIVE)
box(px, 360, pw, 62, "POST /api/detections", ["รับกล่องแมว + สิ่งของ"], mono=True, accent=LIVE)
box(px, 600, pw, 82, "POST /api/events", ["รับผลพฤติกรรม", "{ts, cat_count, counts, cats}"], mono=True, accent=HIST)

box(sx, 300, sw, 100, "หน่วยความจำ", ["เฟรมล่าสุด", "กล่องล่าสุด", "(ไม่บันทึกลงดิสก์)"], fill="#fff7f2", accent=LIVE)
box(sx, 590, sw, 100, "SQLite", ["data/cat.db", "ตาราง events", "(เก็บย้อนหลัง)"], fill="#f2f7fe", accent=HIST)

box(gx, 310, gw, 82, "GET /api/frame", ["ภาพ + กล่อง", "(header X-Meta)"], mono=True, accent=LIVE)
box(gx, 560, gw, 160, "GET /api/summary", ["?range=1h|6h|24h|7d", "สรุปเป็นช่วงเวลา:", "· แมวเฉลี่ยต่อพฤติกรรม", "· แมว·นาทีรวม", "· สถานะออนไลน์"], mono=True, accent=HIST)

# server internal arrows
arrow([(795, 301), (822, 301), (822, 330), (848, 330)], LIVE)
arrow([(795, 391), (822, 391), (822, 370), (848, 370)], LIVE)
arrow([(1010, 350), (1066, 350)], LIVE)
arrow([(795, 641), (848, 641)], HIST, "INSERT", 821, 628)
arrow([(1010, 640), (1066, 640)], HIST, "SELECT", 1038, 628)

# ---------- CiRA → server ----------
arrow([(480, 300), (583, 300)], LIVE, "ภาพ ≤30 fps", 534, 290)
arrow([(480, 570), (530, 570), (530, 395), (583, 395)], LIVE, "กล่อง 5 ครั้ง/วิ", 532, 440, "middle")
arrow([(480, 640), (583, 640)], HIST, "ทุก 5 วินาที", 534, 630)

# ---------- browser ----------
box(1330, 270, 220, 150, "ภาพสด (LiveVideo)",
    ["ดึงเฟรมต่อเนื่อง", "วาดกรอบแมวตามสี", "พฤติกรรม + ชื่อสิ่งของ", "สลับ: แสดงการตรวจจับ /", "วิดีโออย่างเดียว"], accent=LIVE)
box(1330, 520, 220, 230, "Dashboard",
    ["ดึงสรุปทุก 5 วินาที", "· จำนวนแมวตอนนี้", "· กราฟแท่งไทม์ไลน์", "· โดนัทเวลารวม", "· ตารางแมวที่เห็นตอนนี้", "· ตารางข้อมูลไทม์ไลน์", "· ปุ่มช่วง 1ชม./6ชม./", "  24ชม./7วัน"], accent=HIST)
arrow([(1246, 350), (1328, 350)], LIVE, "เฟรมใหม่มา", 1287, 340)
arrow([(1246, 640), (1328, 640)], HIST, "ทุก 5 วิ", 1287, 630)

# ---------- legend ----------
ly = 1100
add(f'<line x1="40" y1="{ly-5}" x2="80" y2="{ly-5}" stroke="{LIVE}" stroke-width="3"/>')
add(f'<text x="90" y="{ly}" font-size="14" fill="{INK2}">ข้อมูลสด (ภาพ + กล่อง) — อยู่ในหน่วยความจำ</text>')
add(f'<line x1="620" y1="{ly-5}" x2="660" y2="{ly-5}" stroke="{HIST}" stroke-width="3"/>')
add(f'<text x="670" y="{ly}" font-size="14" fill="{INK2}">ข้อมูลพฤติกรรม — SQLite + Google Sheet (กราฟย้อนหลัง)</text>')
add(f'<line x1="1130" y1="{ly-5}" x2="1170" y2="{ly-5}" stroke="#06c755" stroke-width="3" stroke-dasharray="7 5"/>')
add(f'<text x="1180" y="{ly}" font-size="14" fill="{INK2}">แจ้งเตือน LINE (ระบบของเพื่อน)</text>')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
       f'font-family="\'Leelawadee UI\', Tahoma, sans-serif">'
       f'<rect width="{W}" height="{H}" fill="#fbfaf7"/>' + "".join(out) + "</svg>")
page = f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:#fbfaf7}}</style></head><body>{svg}</body></html>'
import pathlib
here = pathlib.Path(__file__).parent
(here / "system_diagram.html").write_text(page, encoding="utf-8")
(here / "system_diagram.svg").write_text(svg, encoding="utf-8")
print("ok")
