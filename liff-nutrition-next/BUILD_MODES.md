# 🚀 Build Modes & Configurations

## การเปลี่ยนแปลงสำคัญ

เพื่อให้ production build ใช้ **CSR (Client-Side Rendering)** เหมือนกับ development แทนที่จะเป็น **SSG (Static Site Generation)**

## 📦 Build Modes

### 1. CSR Mode (Default) - ใช้สำหรับ Production ปกติ

```bash
# Development
npm run dev

# Production (CSR)
npm run build
npm run start

# หรือ
npm run build:production
npm run build:csr
```

**ลักษณะ:**

- ✅ Client-Side Rendering เหมือน development
- ✅ Next.js Image Optimization เปิดใช้งาน
- ✅ API Routes ทำงานได้
- ✅ Dynamic imports และ code splitting
- ✅ Hot reload ใน development
- 📁 Output: `.next` folder

### 2. SSG Mode - ใช้สำหรับ Azure Static Web Apps

```bash
# Static Site Generation
npm run build:ssg
npm run export:ssg

# สำหรับ Azure deployment
npm run build:azure
```

**ลักษณะ:**

- ✅ Static HTML generation ที่ build time
- ✅ ใช้ได้กับ CDN และ static hosting
- ❌ Image Optimization ปิดใช้งาน (unoptimized: true)
- ❌ API Routes ไม่ทำงาน
- ✅ เร็วสุดสำหรับ loading
- 📁 Output: `out` folder

## 🔧 Configuration Files

### หลัก: `next.config.mjs`

- ใช้สำหรับ **CSR mode** (development และ production)
- `output: export` ถูก comment ออก
- Image optimization เปิดใช้งาน
- `trailingSlash: false`

### สำรอง: `next.config.ssg.mjs`

- ใช้สำหรับ **SSG mode** เมื่อต้องการ static export
- `output: 'export'` เปิดใช้งาน
- Image optimization ปิดใช้งาน
- `trailingSlash: true`

## 🔄 วิธีสลับระหว่าง Modes

### สลับเป็น CSR (Default)

```bash
# ใช้ default config (next.config.mjs)
npm run build
```

### สลับเป็น SSG

```bash
# ใช้ SSG config (next.config.ssg.mjs)
npm run build:ssg
```

## 📋 สรุปความแตกต่าง

| Feature            | CSR Mode         | SSG Mode             |
| ------------------ | ---------------- | -------------------- |
| Rendering          | Client-Side      | Pre-generated        |
| API Routes         | ✅ ทำงาน         | ❌ ไม่ทำงาน          |
| Image Optimization | ✅ เปิด          | ❌ ปิด               |
| Dynamic Content    | ✅ รองรับ        | ⚠️ จำกัด             |
| Load Time          | ปานกลาง          | เร็วมาก              |
| Server Required    | ✅ ต้องใช้       | ❌ ไม่ต้องใช้        |
| Deployment         | Standard hosting | Static hosting (CDN) |

## 🚀 คำแนะนำ

**ใช้ CSR Mode เมื่อ:**

- ต้องการ API Routes
- มี dynamic content เยอะ
- ต้องการ server-side features
- เหมือนกับ development environment

**ใช้ SSG Mode เมื่อ:**

- Deploy ไป Azure Static Web Apps
- ต้องการ performance สูงสุด
- Content ส่วนใหญ่เป็น static
- ไม่ต้องการ server

## 🔍 การตรวจสอบ Mode

ตรวจสอบว่าใช้ mode ไหนอยู่:

```bash
# ดู output directory
ls -la # ถ้ามี .next = CSR, ถ้ามี out = SSG

# ดู package.json scripts ที่รัน
npm run build # CSR
npm run build:ssg # SSG
```
