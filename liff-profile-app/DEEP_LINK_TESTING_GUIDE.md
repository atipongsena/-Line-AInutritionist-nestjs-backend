# คู่มือการทดสอบ Deep Link

## วิธีทดสอบ Deep Link ใน LIFF App

### ⚡ การปรับปรุงล่าสุด

- ✅ ป้องกันการแสดงหน้าหลักแวบก่อนนำทาง
- ✅ ตรวจสอบ URL parameters ก่อน component render
- ✅ แสดง loading screen พิเศษสำหรับ deep link
- ✅ ลดเวลา delay ในการนำทาง

### 🧪 URL สำหรับทดสอบ

#### 1. หน้าโปรไฟล์ (ปกติ)

```
https://liff.line.me/2007349762-AJ9J432d
```

#### 2. หน้ารายงานโภชนาการ (Deep Link)

```
https://liff.line.me/2007349762-AJ9J432d?targetPath=/nutrition-report
https://liff.line.me/2007349762-AJ9J432d?page=nutrition-report
```

#### 3. หน้ารายงานรายวัน (Deep Link)

```
https://liff.line.me/2007349762-AJ9J432d?page=daily-report
```

#### 4. หน้ารายงานพร้อม Log ID

```
https://liff.line.me/2007349762-AJ9J432d?page=nutrition-report&logId=12345
https://liff.line.me/2007349762-AJ9J432d?targetPath=/nutrition-report&logId=67890&date=2024-01-15
```

### 📱 วิธีทดสอบใน LINE

#### วิธีที่ 1: ทดสอบผ่าน LINE Chat

1. ส่งข้อความที่มี URL ข้างต้นใน LINE Chat
2. คลิกที่ URL
3. สังเกตว่าแอปเปิดไปหน้าที่ถูกต้องโดยตรง

#### วิธีที่ 2: ทดสอบผ่าน Rich Menu

1. อัปเดต Rich Menu ใน LINE Developers Console
2. ตั้งค่า URI Action ตาม URL ข้างต้น
3. ทดสอบคลิกปุ่มใน Rich Menu

#### วิธีที่ 3: ทดสอบผ่าน Browser (Development)

1. เปิด browser
2. ไปที่ `localhost:3000` (หรือ URL ของ dev server)
3. เพิ่ม query parameters ใน address bar
4. สังเกตการทำงาน

### 🔍 สิ่งที่ควรสังเกต

#### ✅ พฤติกรรมที่ถูกต้อง

- **ไม่แสดงหน้าหลักแวบ** ก่อนนำทาง
- แสดงข้อความ "🚀 กำลังนำทางไปหน้าที่ต้องการ..."
- แสดงข้อความ "ตรวจพบการเข้าถึงผ่าน Deep Link"
- นำทางไปหน้าที่ต้องการโดยตรง

#### ❌ พฤติกรรมที่ผิดพลาด

- แสดงหน้าหลักก่อนแล้วค่อยนำทาง
- นำทางไปผิดหน้า
- ไม่นำทางเลย
- Error ใน console

### 🛠️ การ Debug

#### Console Logs ที่ควรเห็น

```
[LIFF_ROUTING] Early detection: Pending navigation detected, will show loading screen
[LIFF_ROUTING] Checking initial LIFF URL for path routing
[LIFF_ROUTING] URL Parameters: { targetPath: "/nutrition-report", page: null, logId: null }
[LIFF_ROUTING] Found targetPath: /nutrition-report
[LIFF_ROUTING] Setting flag to navigate to nutrition report after LIFF init
[LIFF_ROUTING] Executing pending navigation to: /nutrition-report
```

#### การตรวจสอบ Browser Developer Tools

1. เปิด Developer Tools (F12)
2. ไปที่ tab Console
3. ดู logs ที่ขึ้นต้นด้วย `[LIFF_ROUTING]`
4. ตรวจสอบ sessionStorage:
   - `pendingNavigation`
   - `pendingLogId`

#### การตรวจสอบ Network Tab

1. ดู API calls ที่เกิดขึ้น
2. ตรวจสอบว่า LIFF initialization สำเร็จ
3. ดู navigation events

### 🔧 การแก้ไขปัญหาเบื้องต้น

#### ปัญหา: ยังแสดงหน้าหลักแวบ

- ตรวจสอบว่า URL มี query parameters ถูกต้อง
- ดู console logs ว่า early detection ทำงานหรือไม่
- ตรวจสอบ browser cache (ลองใช้ incognito mode)

#### ปัญหา: ไม่นำทางเลย

- ตรวจสอบ LIFF initialization
- ดู error messages ใน console
- ตรวจสอบ network connectivity

#### ปัญหา: logId หรือ date ไม่ถูกส่งต่อ

- ตรวจสอบ URL encoding
- ดู sessionStorage ว่ามีการเก็บค่าหรือไม่
- ตรวจสอบ NutritionReportMain component

### 📊 ตัวอย่าง Test Cases

#### Test Case 1: Basic Deep Link

```
Input: https://liff.line.me/2007349762-AJ9J432d?page=nutrition-report
Expected: โหลดเข้าหน้ารายงานโภชนาการโดยตรง
```

#### Test Case 2: Deep Link with Log ID

```
Input: https://liff.line.me/2007349762-AJ9J432d?page=daily-report&logId=12345
Expected: โหลดเข้าหน้ารายงานรายวัน และ logId ถูกส่งต่อ
```

#### Test Case 3: Multiple Parameters

```
Input: https://liff.line.me/2007349762-AJ9J432d?targetPath=/nutrition-report&logId=67890&date=2024-01-15
Expected: โหลดเข้าหน้ารายงานโภชนาการ พร้อม logId และ date
```

#### Test Case 4: Invalid Parameters

```
Input: https://liff.line.me/2007349762-AJ9J432d?page=invalid-page
Expected: โหลดเข้าหน้าหลักปกติ
```

### 📝 การรายงานปัญหา

หากพบปัญหา กรุณารวบรวมข้อมูลต่อไปนี้:

1. **URL ที่ใช้ทดสอบ**
2. **Device และ Browser** (LINE App version, iOS/Android version)
3. **Console logs** (copy ทั้งหมด)
4. **พฤติกรรมที่เกิดขึ้น** vs **พฤติกรรมที่คาดหวัง**
5. **ขั้นตอนการทำซ้ำ**

### 🚀 Performance Notes

การปรับปรุงล่าสุดช่วยให้:

- ลดเวลาการแสดงหน้าหลักก่อนนำทาง จาก ~200ms เหลือ 0ms
- ตรวจสอบ deep link ตั้งแต่ component initialization
- แสดง loading screen ที่เฉพาะเจาะจงสำหรับ deep link

---

**หมายเหตุ**: การทดสอบใน development mode อาจแตกต่างจากการใช้งานจริงใน LINE App เนื่องจาก LIFF SDK behavior
