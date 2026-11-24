# CiRA CORE Cat Behavior

ใช้ CiRA CORE ตรวจจับแมวและสิ่งของในห้อง โดยโมเดลบอกพฤติกรรมจากคลาสโดยตรง (Cat_Sleep, Cat_Walk, Cat_Play, Cat_Sit, Cat_Eat, Cat_Stand, Cat_Poop) และสิ่งของ (Bed, Bowl, Poop, Sandbox, Toy) แล้วสรุปผลแสดงบน dashboard Next.js

```
กล้อง → [Python+ #1: cira_raw_video.py] → DeepDetect → [Python+ #2: cira_behavior.py] → Debug
             └─ POST /api/frame (ภาพดิบ)                     ├─ POST /api/detections (กล่อง)
                                                             └─ POST /api/events (พฤติกรรม ทุก 5 วิ)
```

| ไฟล์ | หน้าที่ |
|---|---|
| `cira_raw_video.py` | วางใน Python+ ก่อน DeepDetect ส่งภาพดิบไปแสดงสด |
| `cira_behavior.py` | วางใน Python+ หลัง DeepDetect แปลงคลาส Cat_* เป็นพฤติกรรม + tracking + ส่งผล |
| `google_sheet.gs` | Apps Script วางใน Google Sheet รับ/ส่งข้อมูลรายนาที |
| `dashboard/` | Next.js dashboard (ดู `dashboard/README.md`) |
| `docs/` | สไลด์นำเสนอ (`slides.pptx`), System Diagram (`system-diagram.png`, สร้างจาก `make_diagram.py`) |

## ติดตั้งบนเครื่องใหม่

1. ติดตั้ง [Node.js 24+](https://nodejs.org) (ใช้ `node:sqlite` ในตัว ไม่ต้องลงฐานข้อมูลเพิ่ม)
2. โหลด repo แล้วสลับไป branch นี้
   ```bash
   git clone https://github.com/Few-zzz/ciracore-cat.git
   cd ciracore-cat
   git checkout new-behavior-classes
   cd dashboard
   npm install
   npm run dev          # เปิด http://localhost:3000
   ```
3. ใน CiRA CORE วาง `cira_raw_video.py` ใน Python+ ก่อน DeepDetect และ `cira_behavior.py` ใน Python+ หลัง DeepDetect แล้วกด Start
   (ฝั่ง Python ใช้แค่ไลบรารีมาตรฐาน + `cv2` ที่ CiRA มีอยู่แล้ว ไม่ต้อง pip install เพิ่ม)
4. ถ้า dashboard อยู่คนละเครื่องกับ CiRA ให้แก้ `SERVER = "http://<IP เครื่อง dashboard>:3000"` ในไฟล์ Python ทั้งสอง
5. Google Sheet ตั้งค่าไว้แล้ว (`SHEET_URL` ใน `cira_behavior.py` และ `dashboard/.env.local`) ใช้ได้ทันที
   ฐานข้อมูล `dashboard/data/cat.db` ไม่ได้อยู่ใน git — เครื่องใหม่จะเริ่มว่าง แล้วดึงข้อมูล 7 วันล่าสุดจาก Google Sheet มาเติมเองตอนเปิดเว็บ

## บันทึกลง Google Sheet

`cira_behavior.py` บันทึกสรุปพฤติกรรม **1 แถวต่อนาที** (ค่าเฉลี่ยจำนวนแมวในนาทีนั้น) ลง Google Sheet ผ่าน Apps Script
ส่วน dashboard แค่ **ดึงกลับมา** เติมนาทีที่ในเครื่องไม่มี (ตอนเปิดเซิร์ฟเวอร์ และทุก 5 นาทีที่มีคนเปิดหน้าเว็บ)

1. สร้าง Google Sheet ใหม่ → เมนู **ส่วนขยาย > Apps Script** → ลบโค้ดเดิม วางโค้ดจาก `google_sheet.gs` → บันทึก
2. ใน Apps Script: **การตั้งค่าโปรเจ็กต์ (รูปเฟือง) > พร็อพเพอร์ตีของสคริปต์** → เพิ่ม `SECRET` = รหัสอะไรก็ได้ที่เดายาก
3. **การทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่** → ประเภท **เว็บแอป** → ดำเนินการในฐานะ **ฉัน**, ผู้ที่มีสิทธิ์เข้าถึง **ทุกคน** → อนุญาตสิทธิ์ → คัดลอก URL (ลงท้าย `/exec`)
4. ใน `cira_behavior.py` ใส่ `SHEET_URL` และ `SHEET_SECRET` แล้ววางโค้ดลง Python+ #2 ของ CiRA
5. สร้างไฟล์ `dashboard/.env.local` แล้วรัน `npm run dev` ใหม่
   ```
   SHEETS_URL=https://script.google.com/macros/s/.../exec
   SHEETS_SECRET=รหัสเดียวกับข้อ 2
   ```

> repo นี้ใส่ `SHEET_URL` / `SHEET_SECRET` และ `dashboard/.env.local` ไว้แล้วโดยตั้งใจ (โปรเจกต์ไม่ sensitive) — ใครได้ไปจะอ่าน/เขียน Sheet นี้ได้ ถ้าไม่ต้องการ ให้เปลี่ยน `SECRET` ใน Apps Script แล้วแก้ทั้ง 2 ที่
> ถ้าแก้ `google_sheet.gs` ต้อง Deploy เป็น **เวอร์ชันใหม่** (จัดการการทำให้ใช้งานได้ > แก้ไข > เวอร์ชันใหม่) URL เดิมจึงจะใช้โค้ดใหม่
