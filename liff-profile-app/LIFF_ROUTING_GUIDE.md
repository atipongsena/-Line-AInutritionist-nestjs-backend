# คู่มือการตั้งค่า LIFF Routing สำหรับ Rich Menu

## ปัญหาที่พบ

"แม้จะกำหนด path แล้ว แต่หน้าอื่นเวลาเข้ามักจะไป path หลักก่อน"

## สาเหตุ

1. LIFF App มี Endpoint URL เดียวที่กำหนดใน LINE Developers Console
2. LINE จะเปิด LIFF App ที่ Endpoint URL เสมอ ไม่ว่าจะต้องการไปหน้าไหน
3. การ Routing ใน Client-side ต้องทำงานหลังจาก LIFF initialization เสร็จ

## วิธีแก้ไข (ที่ได้ implement แล้ว)

### 1. การตั้งค่า Rich Menu URI

ใน Rich Menu ของ LINE ให้ตั้งค่า URI Action ดังนี้:

#### สำหรับปุ่มไปหน้าโปรไฟล์:

```
https://liff.line.me/2007349762-AJ9J432d
```

#### สำหรับปุ่มไปหน้ารายงานโภชนาการ:

```
https://liff.line.me/2007349762-AJ9J432d?targetPath=/nutrition-report
```

#### สำหรับปุ่มไปหน้ารายงานรายวัน:

```
https://liff.line.me/2007349762-AJ9J432d?page=daily-report
```

#### สำหรับปุ่มไปหน้ารายงานพร้อม logId เฉพาะ:

```
https://liff.line.me/2007349762-AJ9J432d?page=nutrition-report&logId=12345
```

### 2. รูปแบบ Query Parameters ที่รองรับ

| Parameter    | ค่าที่รองรับ                         | ตัวอย่าง                        |
| ------------ | ------------------------------------ | ------------------------------- |
| `targetPath` | `/nutrition-report`, `/daily-report` | `?targetPath=/nutrition-report` |
| `page`       | `nutrition-report`, `daily-report`   | `?page=nutrition-report`        |
| `logId`      | ID ของ log ที่ต้องการแสดง            | `?logId=12345`                  |

### 3. ลำดับการทำงาน

1. User คลิกปุ่มใน Rich Menu
2. LINE เปิด LIFF App ที่ Endpoint URL พร้อม query parameters
3. App ตรวจสอบ URL parameters ทันทีและเก็บไว้ใน sessionStorage
4. App รอ LIFF initialization เสร็จ
5. App ทำการ navigate ไปยัง path ที่ต้องการ

### 4. การ Debug

ดู Console logs ที่ขึ้นต้นด้วย `[LIFF_ROUTING]` เพื่อตรวจสอบการทำงาน:

```
[LIFF_ROUTING] Checking initial LIFF URL for path routing
[LIFF_ROUTING] URL Parameters: { targetPath: "/nutrition-report", page: null, logId: null }
[LIFF_ROUTING] Found targetPath: /nutrition-report
[LIFF_ROUTING] Setting flag to navigate to nutrition report after LIFF init
[LIFF_ROUTING] Executing pending navigation to: /nutrition-report
```

## ตัวอย่างการใช้งาน

### Rich Menu Configuration (JSON)

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": false,
  "name": "Rich Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 1250,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007349762-AJ9J432d"
      }
    },
    {
      "bounds": {
        "x": 1250,
        "y": 0,
        "width": 1250,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007349762-AJ9J432d?targetPath=/nutrition-report"
      }
    },
    {
      "bounds": {
        "x": 0,
        "y": 843,
        "width": 2500,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007349762-AJ9J432d?page=daily-report"
      }
    }
  ]
}
```

### การส่ง Flex Message พร้อม Deep Link

```javascript
// ตัวอย่างการส่ง Flex Message ที่มี button ไปหน้ารายงานโภชนาการ
{
  "type": "flex",
  "altText": "รายงานโภชนาการ",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "รายงานโภชนาการของคุณพร้อมแล้ว!"
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "ดูรายงาน",
            "uri": "https://liff.line.me/2007349762-AJ9J432d?targetPath=/nutrition-report&logId=LOG_ID_HERE"
          }
        }
      ]
    }
  }
}
```

## หมายเหตุ

- ระบบจะตรวจสอบ URL parameters ก่อน LIFF initialization เพื่อไม่ให้เกิดการ redirect ไปหน้าหลักก่อน
- ใช้ sessionStorage เก็บข้อมูล pending navigation เพื่อให้แน่ใจว่าการ routing จะเกิดขึ้นหลัง LIFF พร้อมใช้งาน
- รองรับทั้ง `targetPath` และ `page` parameters เพื่อความยืดหยุ่น
- รองรับ `logId` parameter สำหรับการแสดงรายงานเฉพาะ
