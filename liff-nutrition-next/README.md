# AI Nutritionist LIFF App - Next.js Frontend

ระบบรายงานและติดตามโภชนาการอัจฉริยะสำหรับ LINE LIFF (LINE Front-end Framework) ที่พัฒนาด้วย Next.js

## 🚀 Features

### 📊 รายงานโภชนาการ

- **รายงานรายวัน**: ดูข้อมูลโภชนาการรายวันพร้อมแผนภูมิและสถิติ
- **รายงานรายสัปดาห์**: เปรียบเทียบข้อมูลโภชนาการตลอดสัปดาห์
- **รายงานรายเดือน**: สรุปแนวโน้มและความก้าวหน้าในระยะยาว

### 🍽️ การจัดการบันทึกอาหาร

- **แก้ไขบันทึกอาหาร**: อัปเดตข้อมูลอาหารที่บันทึกผ่าน LIFF
- **ข้อมูลโภชนาการ**: แสดงรายละเอียดแคลอรี่ โปรตีน คาร์โบไหเดรต และไขมัน
- **การจัดการมื้ออาหาร**: แยกตามมื้อเช้า กลางวัน เย็น และของว่าง

### 🔐 การยืนยันตัวตน

- **LINE Login**: เข้าสู่ระบบผ่าน LINE Account
- **LIFF Integration**: รองรับการทำงานใน LINE App
- **Token Management**: จัดการ ID Token และ Access Token อัตโนมัติ

## 🛠️ Tech Stack

### Frontend Framework

- **Next.js 15** - React Framework with App Router
- **React 18** - UI Library
- **TypeScript** - Type Safety

### UI/UX

- **Material-UI (MUI) 6** - Component Library
- **Tailwind CSS 3** - Utility-first CSS
- **Responsive Design** - Mobile-first approach

### State Management

- **Zustand** - Lightweight state management
- **React Hooks** - Built-in state management

### Data Visualization

- **Recharts** - Chart library for nutrition data
- **MUI Date Pickers** - Date selection components

### Development Tools

- **ESLint** - Code linting
- **TypeScript** - Static type checking
- **Prettier** - Code formatting

## 📁 Project Structure

```
liff-nutrition-next/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Home page
│   │   ├── providers.tsx            # Global providers
│   │   ├── nutrition-report/        # Nutrition reports
│   │   │   └── page.tsx
│   │   └── liff-food-log/          # LIFF food log editor
│   │       └── [logId]/
│   │           └── page.tsx
│   ├── components/                   # Reusable components
│   │   └── providers/
│   │       └── LiffProvider.tsx     # LIFF context provider
│   ├── lib/                         # Utilities and configurations
│   │   ├── api.ts                   # API service functions
│   │   └── store.ts                 # Zustand store
│   ├── types/                       # TypeScript type definitions
│   │   ├── food.ts                  # Food and nutrition types
│   │   └── liff.ts                  # LIFF-related types
│   └── hooks/                       # Custom React hooks
├── public/                          # Static assets
├── .env.local                       # Environment variables
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.ts              # Tailwind CSS configuration
└── next.config.js                  # Next.js configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 หรือใหม่กว่า
- npm 8.0.0 หรือใหม่กว่า
- LINE Developer Account (สำหรับ LIFF App)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/ai-nutritionist-nestjs-backend.git
   cd ai-nutritionist-nestjs-backend/liff-nutrition-next
   ```

2. **Install dependencies**

   ```bash
   npm install
   # หรือ
   pnpm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.local.example .env.local
   ```

   แก้ไขไฟล์ `.env.local`:

   ```env
   # LIFF Configuration
   NEXT_PUBLIC_LIFF_ID=your-liff-id-here

   # API Configuration
   NEXT_PUBLIC_API_URL=http://localhost:3000

   # Environment
   NODE_ENV=development
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Open browser**
   เปิด [http://localhost:3000](http://localhost:3000)

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run type-check   # TypeScript type checking

# Utilities
npm run clean        # Clean build files
npm run export       # Export static files
```

## 🌐 API Integration

### Backend Compatibility

แอพนี้ออกแบบมาให้ทำงานร่วมกับ NestJS backend:

```typescript
// API Endpoints
GET  /nutrition/daily-report     # รายงานรายวัน
GET  /nutrition/weekly-report    # รายงานรายสัปดาห์
GET  /nutrition/monthly-report   # รายงานรายเดือน
GET  /nutrition/liff-food-log/:id # ข้อมูลบันทึกอาหาร
PUT  /nutrition/liff-food-log/:id # อัปเดตบันทึกอาหาร
GET  /user/profile/:userId       # ข้อมูลผู้ใช้
```

### Authentication

- ใช้ LINE ID Token สำหรับการยืนยันตัวตน
- ส่ง Authorization header: `Bearer ${idToken}`
- รองรับ automatic token refresh

## 📱 LIFF Integration

### LIFF Configuration

1. สร้าง LIFF App ใน LINE Developers Console
2. ตั้งค่า Endpoint URL เป็น domain ของแอพ
3. เพิ่ม LIFF ID ใน environment variables

### URL Parameters

แอพรองรับ URL parameters สำหรับ deep linking:

```
# รายงานโภชนาการ
/?type=daily&date=2024-01-15
/?type=weekly&date=2024-01-15
/?type=monthly&date=2024-01

# แก้ไขบันทึกอาหาร
/?logId=food-log-id-123
```

## 🎨 UI/UX Design

### Mobile-First Approach

- ออกแบบสำหรับมือถือเป็นหลัก
- รองรับ touch interactions
- Responsive design สำหรับทุกขนาดหน้าจอ

### Material Design

- ใช้ Material-UI components
- LINE Brand Colors (Green: #06C755)
- Thai language support

### Performance

- Code splitting with Next.js
- Lazy loading components
- Optimized bundle size

## 🔒 Security

### Data Protection

- Client-side validation
- Secure API communication
- Token-based authentication

### Privacy

- ไม่เก็บข้อมูลส่วนตัวใน localStorage
- ใช้ secure cookies สำหรับ session
- HTTPS only in production

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Static Export (Optional)

```bash
npm run export
```

### Environment Variables

Production environment ต้องตั้งค่า:

- `NEXT_PUBLIC_LIFF_ID`
- `NEXT_PUBLIC_API_URL`
- `NODE_ENV=production`

## 🧪 Testing

### Manual Testing

1. ทดสอบใน LINE App (LIFF)
2. ทดสอบใน web browser
3. ทดสอบ responsive design

### LIFF Testing

- ใช้ LINE Simulator สำหรับทดสอบ
- ทดสอบ deep linking
- ทดสอบ authentication flow

## 📈 Performance Optimization

### Bundle Analysis

```bash
npm run build
# ดู bundle size ใน terminal output
```

### Optimization Features

- Next.js automatic code splitting
- Image optimization
- Font optimization
- CSS optimization

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Material-UI Documentation](https://mui.com/)
- [LIFF Documentation](https://developers.line.biz/en/docs/liff/)

### Issues

หากพบปัญหาหรือต้องการขอ feature ใหม่ กรุณาสร้าง [GitHub Issue](https://github.com/your-org/ai-nutritionist-nestjs-backend/issues)

## 🚀 Deployment Configuration

### Azure Static Web Apps

โปรเจกต์นี้ใช้ `staticwebapp.config.json` สำหรับการกำหนดค่า Azure Static Web Apps:

- **Node.js Runtime**: กำหนดให้ใช้ Node.js 20
- **Navigation Fallback**: รองรับ SPA routing
- **Security Headers**: ตั้งค่า CSP และ security headers
- **LIFF Integration**: รองรับการโหลดใน LINE application

```json
{
  "platform": {
    "apiRuntime": "node:20"
  },
  "navigationFallback": {
    "rewrite": "/"
  }
}
```

### Environment Variables

ตั้งค่า secrets ต่อไปนี้ใน GitHub repository:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Token จาก Azure Static Web Apps
- `NEXT_PUBLIC_LIFF_ID`: LIFF ID จาก LINE Developers Console
- `NEXT_PUBLIC_API_BASE_URL`: URL ของ backend API

---

**AI Nutritionist Team** - สร้างด้วย ❤️ สำหรับสุขภาพที่ดีของทุกคน
