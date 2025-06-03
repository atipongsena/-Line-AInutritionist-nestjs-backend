# 🔗 LIFF URLs สำหรับ LINE Rich Menu

## 📋 ข้อมูลพื้นฐาน

**LIFF ID:** `2007487958-0W2jaran`  
**Base URL (Development):** `https://liff.line.me/2007487958-0W2jaran`  
**Production URL:** `https://3b67-2001-fb1-5d-f7ba-44b7-91b3-44d3-a0e.ngrok-free.app`

## 🎯 URLs สำหรับ Rich Menu

### 1. **หน้าหลัก (Profile & ตั้งค่า)**

```
https://liff.line.me/2007487958-0W2jaran/
```

- ✨ **ฟีเจอร์:** การตั้งค่าโปรไฟล์ผู้ใช้
- 📝 **รายละเอียด:** น้ำหนัก, ส่วนสูง, เป้าหมาย, กิจกรรม
- 🎨 **ใช้สำหรับปุ่ม:** "โปรไฟล์" หรือ "ตั้งค่า"

### 2. **บันทึกอาหาร (Food Logging)**

```
https://liff.line.me/2007487958-0W2jaran/liff-food-log/demo
```

- ✨ **ฟีเจอร์:** บันทึกและแก้ไขข้อมูลอาหาร
- 📝 **รายละเอียด:** ดูรายละเอียดอาหาร, แก้ไขข้อมูลโภชนาการ
- 🎨 **ใช้สำหรับปุ่ม:** "บันทึกอาหาร" หรือ "แก้ไขมื้อ"

### 3. **รายงานโภชนาการรายวัน**

```
https://liff.line.me/2007487958-0W2jaran/nutrition-report/daily
```

- ✨ **ฟีเจอร์:** รายงานโภชนาการประจำวัน
- 📝 **รายละเอียด:** กราฟแคลอรี่, สารอาหารหลัก, เป้าหมาย
- 🎨 **ใช้สำหรับปุ่ม:** "รายงานวันนี้" หรือ "สรุปวันนี้"

### 4. **รายงานโภชนาการรายสัปดาห์**

```
https://liff.line.me/2007487958-0W2jaran/nutrition-report/weekly
```

- ✨ **ฟีเจอร์:** รายงานโภชนาการรายสัปดาห์
- 📝 **รายละเอียด:** แนวโน้มแคลอรี่, ค่าเฉลี่ยสารอาหาร
- 🎨 **ใช้สำหรับปุ่ม:** "รายงานสัปดาห์" หรือ "สรุป 7 วัน"

### 5. **รายงานโภชนาการรายเดือน**

```
https://liff.line.me/2007487958-0W2jaran/nutrition-report/monthly
```

- ✨ **ฟีเจอร์:** รายงานโภชนาการรายเดือน
- 📝 **รายละเอียด:** แนวโน้มระยะยาว, สถิติเดือน, ข้อเสนะแนะ
- 🎨 **ใช้สำหรับปุ่ม:** "รายงานเดือน" หรือ "สรุปเดือน"

## 🎨 ตัวอย่าง Rich Menu Configuration

### Option 1: Rich Menu แบบ 6 ปุ่ม

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": false,
  "name": "Nutrition Rich Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/"
      }
    },
    {
      "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/liff-food-log/demo"
      }
    },
    {
      "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/nutrition-report/daily"
      }
    },
    {
      "bounds": { "x": 0, "y": 843, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/nutrition-report/weekly"
      }
    },
    {
      "bounds": { "x": 833, "y": 843, "width": 834, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/nutrition-report/monthly"
      }
    },
    {
      "bounds": { "x": 1667, "y": 843, "width": 833, "height": 843 },
      "action": {
        "type": "message",
        "text": "ขอคำแนะนำ"
      }
    }
  ]
}
```

### Option 2: Rich Menu แบบ 4 ปุ่ม

```json
{
  "size": {
    "width": 2500,
    "height": 843
  },
  "selected": false,
  "name": "Nutrition Simple Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 625, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/"
      }
    },
    {
      "bounds": { "x": 625, "y": 0, "width": 625, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/liff-food-log/demo"
      }
    },
    {
      "bounds": { "x": 1250, "y": 0, "width": 625, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/nutrition-report/daily"
      }
    },
    {
      "bounds": { "x": 1875, "y": 0, "width": 625, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007487958-0W2jaran/nutrition-report/weekly"
      }
    }
  ]
}
```

## 🔍 การทดสอบ URLs

### ใน Development:

```bash
# Test หน้าหลัก
curl "https://liff.line.me/2007487958-0W2jaran/"

# Test Food Log
curl "https://liff.line.me/2007487958-0W2jaran/liff-food-log/demo"

# Test Daily Report
curl "https://liff.line.me/2007487958-0W2jaran/nutrition-report/daily"
```

### URL สำหรับการพัฒนาภายในเครื่อง:

```
http://localhost:3001/
http://localhost:3001/liff-food-log/demo
http://localhost:3001/nutrition-report/daily
http://localhost:3001/nutrition-report/weekly
http://localhost:3001/nutrition-report/monthly
```

---

## 📝 หมายเหตุ

1. **LIFF URLs ทั้งหมดต้องใช้ HTTPS** เท่านั้น
2. **Rich Menu รูปภาพ** ต้องมีขนาดตรงตาม `size` ที่กำหนด
3. **การทดสอบ** ควรทำใน LINE app จริงเพื่อความแม่นยำ
4. **Demo Mode** (`/liff-food-log/demo`) ใช้สำหรับทดสอบโดยไม่ต้องมีข้อมูลจริง

🚀 **พร้อมใช้งานใน Rich Menu แล้ว!**
