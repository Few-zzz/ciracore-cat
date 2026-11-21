#preparation here
# Python+ ตัวที่ 1: วางระหว่าง กล้อง -> [ตัวนี้] -> DeepDetect
# ส่งภาพดิบ (ยังไม่มีกรอบ) ไปแสดงสดบน dashboard แล้วส่งภาพเดิมต่อให้ DeepDetect
import time, json, base64, threading, urllib.request
import cv2

SERVER = "http://127.0.0.1:3000"
FRAME_FPS = 5                   # ส่งภาพกี่เฟรม/วินาที
FRAME_W = 960                   # ย่อภาพก่อนส่ง ลดขนาด
last_frame = 0.0
busy = {"frame": False}         # ถ้ายังส่งเฟรมก่อนไม่เสร็จ ข้ามไปเลย ไม่ให้ค้าง
send_warned = False


def post_async(data):
    if busy["frame"]:
        return
    busy["frame"] = True

    def run():
        global send_warned
        try:
            req = urllib.request.Request(SERVER + "/api/frame", data=json.dumps(data).encode(),
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=2).read()
            send_warned = False
        except Exception as e:
            if not send_warned:
                print("send frame failed:", repr(e))
                send_warned = True
        finally:
            busy["frame"] = False

    threading.Thread(target=run, daemon=True).start()


def handle_request(req):
    global last_frame
    payload, img = getReqData(req)

    try:
        now = time.time()
        if img is not None and now - last_frame >= 1 / FRAME_FPS:
            last_frame = now
            h, w = img.shape[:2]
            small = cv2.resize(img, (FRAME_W, int(h * FRAME_W / w))) if w > FRAME_W else img
            ok, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ok:
                post_async({"ts": int(now * 1000), "w": w, "h": h,
                            "jpeg": base64.b64encode(buf).decode()})
    except Exception as e:
        print("raw video error:", repr(e))

    resp = makeRespData(payload, img)     # ส่งภาพเดิม (ไม่แก้ไข) ต่อให้ DeepDetect
    return resp
