#preparation here
# ส่วนนี้รันครั้งเดียวตอนกด Start -> ตัวแปรด้านล่างจำค่าข้ามเฟรมได้
import math, time, json, threading, urllib.request
from collections import Counter, deque
import cv2

# ---- ส่งข้อมูลไป Next.js dashboard ----
SERVER = "http://127.0.0.1:3000"
EVENT_EVERY = 5.0               # ส่งผลพฤติกรรมทุกกี่วินาที (บันทึกลงฐานข้อมูล)
DETECT_FPS = 5                  # ส่งกล่องตรวจจับกี่ครั้ง/วินาที (วาดทับภาพสดที่ cira_raw_video.py ส่ง)
last_event = 0.0
last_detect = 0.0
busy = {"event": False, "detect": False}   # ถ้ายังส่งอันก่อนไม่เสร็จ ข้ามไปเลย ไม่ให้ค้าง
send_warned = False

# ---- บันทึกลง Google Sheet (ผ่าน Apps Script: google_sheet.gs) ----
# วาง URL ของ Web app (ลงท้าย /exec) และรหัสลับเดียวกับที่ตั้งใน Apps Script; เว้นว่าง = ไม่บันทึก
SHEET_URL = "https://script.google.com/macros/s/AKfycbwVHxbeS7s3Pk6bskdY2apj0VRTr0GpJVqtG0COEWA9FPrKNliLAtANecBsC3dmAYR6/exec"
SHEET_SECRET = "cat-2026-xyz789"
# หัวตาราง: ค่าพฤติกรรม = จำนวนแมวเฉลี่ยในนาทีนั้น (เช่น sleep 1.5 = นอนเฉลี่ย 1 ตัวครึ่ง)
SHEET_HEAD = ["minute_ts", "datetime", "monitored_s", "cat_count",
              "sleep", "walk", "play", "sit", "eat", "stand", "poop"]
sheet_acc = None                # ผลรวมของนาทีปัจจุบัน
sheet_pending = []              # แถวที่ยังส่งไม่สำเร็จ (ส่งใหม่รอบหน้า)
sheet_busy = False
sheet_warned = False

tracks = {}                     # id -> {"c": จุดกลาง, "hist": deque, "miss": จำนวนเฟรมที่หาย}
next_id = 0

# ชื่อคลาสจากโมเดลใหม่: แมว 1 กล่องบอกพฤติกรรมมาเลย (Cat_Sleep, Cat_Walk, ...)
# -> ไม่ต้องเดาพฤติกรรมจากการขยับ/สิ่งของรอบตัวแล้ว
CAT_CLASSES = {
    "cat_sleep": "sleep", "cat_walk": "walk", "cat_play": "play", "cat_sit": "sit",
    "cat_eat": "eat", "cat_stand": "stand", "cat_poop": "poop",
}
OBJECT_CLASSES = {"bed", "bowl", "poop", "sandbox", "toy"}   # สิ่งของ ส่งไปวาดบนภาพสด

CAT_CONF = 0.7                  # ตัดกล่องแมวมั่นใจต่ำ (ปรับได้ ถ้าเจอกล่องปลอมให้เพิ่ม)
DUP_IOU = 0.5                   # กล่องแมวซ้อนกันเกินนี้ถือว่าเป็นตัวเดียวกัน (แม้คลาสต่างกัน)
MATCH_PX = 150                  # ห่างจากเฟรมก่อนไม่เกินนี้ถือว่าเป็นตัวเดิม
MAX_MISS = 15                   # หายเกินกี่เฟรมจึงลบ track ทิ้ง
SMOOTH = 10                     # จำนวนเฟรมที่ใช้ majority vote กันพฤติกรรมกระพริบ


def to_box(o):
    """DeepDetect ให้ x,y เป็นจุดกึ่งกลางกล่อง -> แปลงเป็นมุมซ้ายบน"""
    w, h = o["w"], o["h"]
    name = str(o["name"]).strip()
    return {"name": name, "key": name.lower(), "conf": float(o["confidence"]),
            "x": o["x"] - w / 2, "y": o["y"] - h / 2, "w": w, "h": h}


def find_objects(dd):
    return [to_box(o) for o in dd.get("objects", [])]


def center(o):
    return (o["x"] + o["w"] / 2, o["y"] + o["h"] / 2)


def iou(a, b):
    ix = max(0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    iy = max(0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
    inter = ix * iy
    return inter / (a["w"] * a["h"] + b["w"] * b["h"] - inter)


def dedupe(cats):
    """ตัดกล่องซ้ำของแมวตัวเดียวกัน เก็บกล่องที่มั่นใจกว่า"""
    keep = []
    for c in sorted(cats, key=lambda o: -o["conf"]):
        if all(iou(c, k) < DUP_IOU for k in keep):
            keep.append(c)
    return keep

def match(cats):
    """จับคู่กล่องแมวกับ track เฟรมก่อน โดยเลือกคู่ที่ใกล้สุดก่อน (greedy)
    คืน list ของ (track_id, ระยะที่ขยับ หรือ None ถ้าเป็นตัวใหม่) ตามลำดับ cats"""
    global next_id
    centers = [center(c) for c in cats]
    pairs = sorted((math.dist(centers[i], t["c"]), tid, i)
                   for tid, t in tracks.items() for i in range(len(cats)))
    assigned, used = {}, set()
    for d, tid, i in pairs:
        if d > MATCH_PX:
            break
        if i in assigned or tid in used:
            continue
        assigned[i] = (tid, d)
        used.add(tid)

    for tid in list(tracks):    # track ที่ไม่เจอในเฟรมนี้
        if tid not in used:
            tracks[tid]["miss"] += 1
            if tracks[tid]["miss"] > MAX_MISS:
                del tracks[tid]

    result = []
    for i, c in enumerate(centers):
        if i in assigned:
            tid, d = assigned[i]
        else:                   # ตัวใหม่
            tid, d = next_id, None
            next_id += 1
            tracks[tid] = {"hist": deque(maxlen=SMOOTH)}
        tracks[tid]["c"] = c
        tracks[tid]["miss"] = 0
        result.append((tid, d))
    return result


def infer(objs):
    cats = dedupe([o for o in objs if o["key"] in CAT_CLASSES and o["conf"] >= CAT_CONF])

    out = []
    for box, (tid, _) in zip(cats, match(cats)):
        hist = tracks[tid]["hist"]
        hist.append(CAT_CLASSES[box["key"]])
        out.append({
            "id": tid,
            "behavior": Counter(hist).most_common(1)[0][0],     # majority vote ต่อตัว
            "conf": round(box["conf"], 3),
            "x": round(box["x"]), "y": round(box["y"]), "w": box["w"], "h": box["h"],
        })

    return {
        "ts": int(time.time() * 1000),                  # เวลาเครื่อง ไม่ต้องแปลงเลขไทย
        "cat_count": len(out),
        "counts": dict(Counter(c["behavior"] for c in out)),
        "cats": out,
    }


def post_async(kind, path, data):
    """POST JSON ใน thread แยก ไม่ให้ flow ของ CiRA ช้าลง"""
    if busy[kind]:
        return
    busy[kind] = True

    def run():
        global send_warned
        try:
            req = urllib.request.Request(SERVER + path, data=json.dumps(data).encode(),
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=2).read()
            send_warned = False
        except Exception as e:
            if not send_warned:  # เตือนครั้งเดียว ไม่ให้ console รก ตอน dashboard ยังไม่เปิด
                print("send to dashboard failed:", repr(e))
                send_warned = True
        finally:
            busy[kind] = False

    threading.Thread(target=run, daemon=True).start()


def send_to_dashboard(result, objs, dd, img):
    global last_event, last_detect
    now = time.time()
    if now - last_event >= EVENT_EVERY:
        last_event = now
        post_async("event", "/api/events", result)

    if now - last_detect >= 1 / DETECT_FPS:
        last_detect = now
        # พิกัดกล่องอิงขนาดภาพเต็มที่ DeepDetect ใช้
        w = dd.get("im_w") or (img.shape[1] if img is not None else 0)
        h = dd.get("im_h") or (img.shape[0] if img is not None else 0)
        others = [{"name": o["name"], "conf": round(o["conf"], 3), "x": round(o["x"]),
                   "y": round(o["y"]), "w": o["w"], "h": o["h"]}
                  for o in objs if o["key"] in OBJECT_CLASSES]
        post_async("detect", "/api/detections", {"ts": result["ts"], "w": w, "h": h,
                                                  "objects": others, "cats": result["cats"]})


def sheet_record(result):
    """เก็บผลทุกเฟรมไว้รวมเป็นรายนาที พอขึ้นนาทีใหม่ค่อยส่งแถวของนาทีก่อนขึ้น Sheet (1 แถว/นาที)"""
    global sheet_acc
    if not SHEET_URL:
        return
    now = time.time()
    minute = int(now // 60) * 60
    if sheet_acc and sheet_acc["minute"] != minute:
        a = sheet_acc
        n = a["frames"]
        data = []
        for key in SHEET_HEAD:
            if key == "minute_ts":
                data.append(a["minute"] * 1000)
            elif key == "datetime":
                data.append(time.strftime("%Y-%m-%d %H:%M", time.localtime(a["minute"])))
            elif key == "monitored_s":
                data.append(len(a["seconds"]))          # มีข้อมูลกี่วินาทีในนาทีนี้
            else:
                data.append(round(a["sum"].get(key, 0) / n, 3))
        sheet_pending.append(data)
        del sheet_pending[:-1440]                       # เก็บค้างได้ไม่เกิน 1 วัน กันหน่วยความจำบวม
        sheet_acc = None
        sheet_send()
    if sheet_acc is None:
        sheet_acc = {"minute": minute, "frames": 0, "seconds": set(), "sum": Counter()}
    sheet_acc["frames"] += 1
    sheet_acc["seconds"].add(int(now))
    sheet_acc["sum"]["cat_count"] += result["cat_count"]
    sheet_acc["sum"].update(result["counts"])


def sheet_send():
    """ส่งแถวที่ค้างทั้งหมดใน thread แยก (Apps Script ตอบช้า 1-3 วิ ไม่ให้ flow ของ CiRA ค้าง)"""
    global sheet_busy
    if sheet_busy or not sheet_pending:
        return
    sheet_busy = True
    rows = list(sheet_pending)

    def run():
        global sheet_busy, sheet_warned
        try:
            body = json.dumps({"secret": SHEET_SECRET, "rows": rows}).encode()
            req = urllib.request.Request(SHEET_URL, data=body, headers={"Content-Type": "text/plain"})
            res = json.loads(urllib.request.urlopen(req, timeout=30).read())
            if res.get("error"):
                raise RuntimeError(res["error"])
            del sheet_pending[:len(rows)]               # ส่งสำเร็จ ลบออกจากคิว
            sheet_warned = False
        except Exception as e:
            if not sheet_warned:
                print("send to Google Sheet failed (retry next minute):", repr(e))   # ภาษาอังกฤษ: console บางเครื่องพิมพ์ไทยไม่ได้
                sheet_warned = True
        finally:
            sheet_busy = False

    threading.Thread(target=run, daemon=True).start()


def handle_request(req):
    payload, img = getReqData(req)

    try:
        # payload อาจเป็น {"DeepDetect": ...} หรือ {"payload": {"DeepDetect": ...}}
        root = payload.get("payload", payload)
        dd = root.get("DeepDetect", {})

        objs = find_objects(dd)
        result = infer(objs)
        root["CatBehavior"] = result                    # ส่งต่อให้โหนดถัดไป
        send_to_dashboard(result, objs, dd, img)
        sheet_record(result)

        if img is not None:     # เขียนพฤติกรรมลงภาพ ไว้ดูใน Debug
            for c in result["cats"]:
                cv2.putText(img, f'#{c["id"]} {c["behavior"]}', (c["x"], c["y"] + c["h"] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
            summary = ", ".join(f"{k}:{v}" for k, v in result["counts"].items()) or "no cat"
            cv2.putText(img, summary, (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 4)
    except Exception as e:
        print("CatBehavior error:", repr(e))

    resp = makeRespData(payload, img)
    return resp
