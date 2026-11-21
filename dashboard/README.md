# Cat Behavior Dashboard

แสดงผลพฤติกรรมแมวที่คำนวณใน CiRA CORE (Python+ module `../cira_behavior.py`)

```
CiRA CORE: DeepDetect → Python+ (cira_behavior.py)
   ├─ POST /api/events  ทุก 5 วินาที  → บันทึกลง SQLite (data/cat.db)
   └─ POST /api/frame   ~5 fps        → เก็บเฉพาะเฟรมล่าสุดในหน่วยความจำ
Next.js:  GET /api/summary?range=1h|6h|24h|7d   สรุปสำหรับกราฟ
          GET /api/frame?after=<seq>             เฟรมสด + กล่องตรวจจับ
```

## รัน

```bash
npm install
npm run dev          # เปิด http://localhost:3000
```

- ต้องใช้ Node 24 ขึ้นไป (ใช้ `node:sqlite` ในตัว)
- `npm run seed` ใส่ข้อมูลจำลองย้อนหลัง 24 ชม. ไว้ทดสอบ ก่อนใช้จริงให้ลบไฟล์ `data/cat.db` ทิ้ง
- ถ้า dashboard อยู่คนละเครื่องกับ CiRA ให้แก้ `SERVER` ใน `cira_behavior.py`

## ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/db.ts` | เปิด SQLite + schema |
| `lib/behaviors.ts` | ชื่อพฤติกรรม สี ช่วงเวลา |
| `app/api/events/route.ts` | รับผล CatBehavior จาก CiRA |
| `app/api/frame/route.ts` | รับ/ส่งภาพสด |
| `app/api/summary/route.ts` | รวมข้อมูลตามช่วงเวลา |
| `components/Dashboard.tsx` | หน้า dashboard |
| `components/LiveVideo.tsx` | ภาพสด + ปุ่มสลับแสดงการตรวจจับ |
