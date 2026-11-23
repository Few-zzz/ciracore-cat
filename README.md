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
| `dashboard/` | Next.js dashboard (ดู `dashboard/README.md`) |
