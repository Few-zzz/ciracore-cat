# CiRA CORE Cat Behavior

ใช้ CiRA CORE ตรวจจับแมวและสิ่งของในห้อง แล้วคำนวณพฤติกรรม (นอน, เคลื่อนไหว, เล่น, ปีนคอนโด, นั่งนิ่ง) แสดงผลบน dashboard Next.js

```
กล้อง → [Python+ #1: cira_raw_video.py] → DeepDetect → [Python+ #2: cira_behavior.py] → Debug
             └─ POST /api/frame (ภาพดิบ)                     ├─ POST /api/detections (กล่อง)
                                                             └─ POST /api/events (พฤติกรรม ทุก 5 วิ)
```

| ไฟล์ | หน้าที่ |
|---|---|
| `cira_raw_video.py` | วางใน Python+ ก่อน DeepDetect ส่งภาพดิบไปแสดงสด |
| `cira_behavior.py` | วางใน Python+ หลัง DeepDetect คำนวณพฤติกรรม + ส่งผล |
| `dashboard/` | Next.js dashboard (ดู `dashboard/README.md`) |
