<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">AI Nutritionist LINE Bot Backend</h1>

<p align="center">
  ระบบ Backend สำหรับ AI Nutritionist LINE Bot พัฒนาด้วย NestJS ทำหน้าที่วิเคราะห์ข้อมูลโภชนาการจากรูปภาพและข้อความอาหาร รวมถึงการจัดการข้อมูลผู้ใช้และการสนทนาผ่าน LINE Messaging API
</p>

<p align="center">
  <a href="#🚀-deployment">🚀 Deployment</a> |
  <a href="#⚡-quick-start">⚡ Quick Start</a> |
  <a href="#📚-api-docs">📚 API Docs</a> |
  <a href="#🛠️-tech-stack">🛠️ Tech Stack</a>
</p>

---

## 🚀 Deployment

### Quick Deploy to Azure

```bash
# ตั้งค่า Azure resources (ครั้งแรกเท่านั้น)
./scripts/setup-azure.sh

# Deploy ผ่าน GitHub Actions (แนะนำ)
git push origin main

# หรือ deploy manual
./scripts/deploy-manual.ps1
```

📋 **คู่มือ Deployment:**

- [📖 DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - คู่มือการ deploy แบบละเอียด
- [⚡ QUICK_DEPLOY_REFERENCE.md](./QUICK_DEPLOY_REFERENCE.md) - คำสั่งสำหรับ deploy ด่วน
- [🔧 DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) - แก้ไขปัญหาการ deploy

### Production URLs

- **Backend API**: `https://ai-nutritionist-backend.{domain}.azurecontainerapps.io`
- **Frontend App**: `https://{static-web-app-name}.azurestaticapps.net`

### GitHub Actions Status

- **Backend Deploy**: [![Deploy Backend](https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend/actions/workflows/deploy.yml)
- **Frontend Deploy**: [![Deploy Frontend](https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend/actions/workflows/azure-static-web-apps.yml/badge.svg)](https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend/actions/workflows/azure-static-web-apps.yml)

---

## Features

### 🤖 AI-Powered Food Analysis

- อัตโนมัติการวิเคราะห์อาหารจากข้อความและรูปภาพ
- การคำนวณคุณค่าทางโภชนาการแบบละเอียด
- คำแนะนำเฉพาะบุคคลตามเป้าหมายสุขภาพ

<img width="399" height="770" alt="image" src="https://github.com/user-attachments/assets/1e39baf9-eba0-4830-be02-8ce0bd7b33ca" />
<img width="288" height="501" alt="image" src="https://github.com/user-attachments/assets/1cb1c700-0ab1-4f5e-bf0b-f42758ddb4fc" />
<img width="298" height="960" alt="image" src="https://github.com/user-attachments/assets/04ef240a-aa90-457f-b3af-02d99be03396" />


### 💬 Smart Conversation Management

- ระบบแชทบอทอัจฉริยะผ่าน LINE
- **การกรองคำสั่งเฉพาะ**: ระบบจะไม่ประมวลผลข้อความที่ขึ้นต้นด้วย "/" เนื่องจากเป็นคำสั่งเฉพาะ
- การจัดเก็บประวัติการสนทนาแบบอัจฉริยะ
- การตรวจจับความตั้งใจ (Intent Detection) ด้วย AI
  <img width="322" height="711" alt="image" src="https://github.com/user-attachments/assets/736a0ceb-b23c-43f2-b913-daebdb2488d0" />


### 🍽️ Conversational Food History

- ถามคำถามเกี่ยวกับประวัติการกินในภาษาธรรมชาติ
- วิเคราะห์รูปแบบการกินแบบอัตโนมัติ
- สร้างข้อเสนอแนะเฉพาะบุคคล
  <img width="774" height="738" alt="image" src="https://github.com/user-attachments/assets/4a132f02-c323-4cc4-b954-bcdbb9a6e122" />


### 🎯 Nutrition Goal Calculation

- คำนวณ BMR และ TDEE อัตโนมัติ
- ตั้งเป้าหมายโภชนาการตามความต้องการ
- ติดตามความก้าวหน้าแบบเรียลไทม์
 <img width="408" height="555" alt="image" src="https://github.com/user-attachments/assets/0d7835ab-3aa4-446d-bafe-d84db3429d73" />
<img width="388" height="616" alt="image" src="https://github.com/user-attachments/assets/d5537dc0-543b-46a7-b70b-1e86ffc61cfa" />
<img width="869" height="1097" alt="image" src="https://github.com/user-attachments/assets/e9214b64-46b4-4010-978e-d242b0410cc6" />




### 📊 Eating Pattern Analysis

- วิเคราะห์รูปแบบการกินแบบลึก
- ตรวจหาพฤติกรรมที่ควรปรับปรุง
- คำแนะนำการปรับเปลี่ยนพฤติกรรม
- <img width="398" height="531" alt="image" src="https://github.com/user-attachments/assets/b24ec56f-d888-4e33-a816-667668537c3a" />


### 🍴 AI Meal Recommendations

- แนะนำเมนูอาหารตามความต้องการ
- คำนวณสัดส่วนโภชนาการ
- ปรับแต่งตามข้อจำกัดทางอาหาร

## ⚡ Quick Start

### Prerequisites Checklist

- [ ] Node.js 24+ installed
- [ ] pnpm 9+ installed
- [ ] MongoDB running
- [ ] Azure account with resources
- [ ] LINE Developer account

### 1-Minute Setup

```bash
# Clone และ install
git clone https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend.git
cd ai-nutritionist-nestjs-backend
pnpm install

# Setup environment
cp .env.example .env  # แก้ไขค่าต่างๆ

# Start development
pnpm run start:dev
```

### Health Check

- **API**: `GET http://localhost:3001/health`
- **API Docs**: `http://localhost:3001/api-docs`

## Command Filtering

ระบบได้รับการออกแบบให้ไม่ประมวลผลข้อความที่เป็น**คำสั่งเฉพาะ** เพื่อประสิทธิภาพที่ดีขึ้น:

### คำสั่งที่ถูกกรอง

- ข้อความที่ขึ้นต้นด้วย `/` (เช่น `/start`, `/help`, `/menu`)
- ข้อความเหล่านี้จะไม่ถูก:
  - ประมวลผลโดย AI
  - เก็บไว้ในประวัติการสนทนา
  - ส่งไปยัง Intent Detection

### การตั้งค่า

คุณสามารถปรับแต่งรายการ command prefixes ได้ที่:

```typescript
// src/ai/ai.config.ts
exclusionRules: {
  commandPrefixes: ['/'] // เพิ่มสัญลักษณ์อื่นๆ ได้ตามต้องการ
}
```

### ประโยชน์

- ประหยัด tokens และค่าใช้จ่าย AI
- เพิ่มความเร็วในการตอบสนอง
- ลดข้อมูลที่ไม่จำเป็นในประวัติการสนทนา
- ป้องกันการประมวลผลคำสั่งระบบผิดพลาด

## 🛠️ Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **Language:** TypeScript
- **Database:** MongoDB (ผ่าน [Mongoose](https://mongoosejs.com/))
- **AI & Machine Learning:** [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service) (GPT-4 models)
- **Image Storage:** [Azure Blob Storage](https://azure.microsoft.com/en-us/services/storage/blobs/)
- **Messaging Platform:** [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/overview/)
- **HTTP Client:** [Axios](https://axios-http.com/) (ผ่าน `@nestjs/axios`)
- **Configuration Management:** `@nestjs/config`
- **Authentication (Azure):** `@azure/identity` (for Azure OpenAI Service)
- **Package Manager:** [pnpm](https://pnpm.io/)
<img width="869" height="786" alt="image" src="https://github.com/user-attachments/assets/f9439345-fb1c-4933-999d-60c58dc47da3" />
<img width="869" height="543" alt="image" src="https://github.com/user-attachments/assets/6331cc42-d28e-4eaa-8e47-3be722c750bc" />
<img width="772" height="672" alt="image" src="https://github.com/user-attachments/assets/8c9046e0-ace3-41f1-b843-d13f742995c9" />
<img width="869" height="563" alt="image" src="https://github.com/user-attachments/assets/0398956a-91b5-484a-a5b1-1d786540b6db" />




## 📋 Prerequisites

ก่อนเริ่มโปรเจกต์ ตรวจสอบว่าคุณได้ติดตั้งสิ่งต่อไปนี้แล้ว:

- [Node.js](https://nodejs.org/) (แนะนำเวอร์ชัน LTS ล่าสุด)
- [pnpm](https://pnpm.io/installation)
- [MongoDB](https://www.mongodb.com/try/download/community) (ติดตั้งและรัน service)
- บัญชี [Azure](https://azure.microsoft.com/) ที่มีการเข้าถึง:
  - Azure OpenAI Service (พร้อม deployment ของ GPT models)
  - Azure Blob Storage
  - Azure Active Directory (Entra ID) app registration (สำหรับ service principal authentication)
- บัญชี [LINE Developers](https://developers.line.biz/) พร้อม Channel Access Token และ Channel Secret

## ⚙️ Environment Variables Setup

โปรเจกต์นี้ใช้ไฟล์ `.env` สำหรับการตั้งค่าตัวแปรสภาพแวดล้อม (environment variables) ให้คัดลอกหรือสร้างไฟล์ `.env` ที่ root ของโปรเจกต์ และกรอกค่าที่จำเป็นตามตัวอย่างนี้:

```env
# Server Configuration
NODE_ENV=development # or production
PORT=3001

# Database (MongoDB)
DATABASE_URL=mongodb://localhost:27017/ai_food # เปลี่ยนตามการตั้งค่า MongoDB ของคุณ

# LINE API Credentials
LINE_CHANNEL_ACCESS_TOKEN="YOUR_LINE_CHANNEL_ACCESS_TOKEN"
LINE_CHANNEL_SECRET="YOUR_LINE_CHANNEL_SECRET"

# OpenAI API Credentials (Azure)
AZURE_OPENAI_ENDPOINT="YOUR_AZURE_OPENAI_ENDPOINT" # e.g., https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1=gpt-4-deployment-name # ชื่อ deployment GPT-4 สำหรับงานหลัก
AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI=gpt-4-mini-deployment-name # ชื่อ deployment GPT-4 รุ่นเล็ก (ถ้ามี)
AZURE_OPENAI_API_VERSION=2024-04-01-preview # หรือเวอร์ชัน API ที่คุณใช้
AZURE_OPENAI_EMBEDDING_API_VERSION=2023-05-15 # หรือเวอร์ชัน API ที่คุณใช้สำหรับ embedding
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME="your-embedding-deployment-name"

# Azure AD (Entra ID) Service Principal Credentials (สำหรับการ authenticate กับ Azure OpenAI)
AZURE_CLIENT_ID="YOUR_AZURE_AD_APP_CLIENT_ID"
AZURE_TENANT_ID="YOUR_AZURE_AD_TENANT_ID"
AZURE_CLIENT_SECRET="YOUR_AZURE_AD_APP_CLIENT_SECRET"

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING="YOUR_AZURE_STORAGE_CONNECTION_STRING"
AZURE_STORAGE_CONTAINER_NAME=food-images # หรือชื่อ container ที่คุณสร้าง

# API Keys (ถ้ามี)
INTERNAL_API_KEY=YOUR_INTERNAL_API_KEY_IF_NEEDED
```

**หมายเหตุ:** ค่าใน `.env` ที่ให้มาเป็นตัวอย่าง อย่าลืมแทนที่ด้วยค่าจริงของคุณ

## 🚀 Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend.git
    cd ai-nutritionist-nestjs-backend
    ```

2.  Install dependencies using pnpm:
    ```bash
    pnpm install
    ```

## ▶️ Running the Application

### Development Mode

- To start the application with auto-reload on file changes:
  ```bash
  pnpm run start:dev
  ```
  The application will typically be available at `http://localhost:3001` (หรือตาม `PORT` ที่ตั้งใน `.env`).

### Production Mode

1.  Build the application:

    ```bash
    pnpm run build
    ```

2.  Start the application:
    ```bash
    pnpm run start:prod
    ```

### Debug Mode

- To start the application in debug mode with watch:
  ```bash
  pnpm run start:debug
  ```

## 🧪 Running Tests

- **Unit tests:**

  ```bash
  pnpm run test
  ```

- **Watch unit tests:**

  ```bash
  pnpm run test:watch
  ```

- **Test coverage:**

  ```bash
  pnpm run test:cov
  ```

- **End-to-end (e2e) tests:**
  ```bash
  pnpm run test:e2e
  ```
  (Ensure your e2e test setup, including any necessary database state or mock servers, is configured.)

## 📁 Project Structure

โครงสร้างหลักของโปรเจกต์:

```
ai-nutritionist-nestjs-backend/
├── liff-profile-app/         # แอปพลิเคชัน LIFF (LINE Front-end Framework) สำหรับจัดการโปรไฟล์ผู้ใช้ หรือส่วนติดต่อผู้ใช้อื่นๆ
├── packages/                 # Shared libraries ภายใน monorepo
│   └── shared-types/         # แหล่งรวม TypeScript type definitions ที่ใช้ร่วมกันภายในโปรเจค
├── src/                      # Source files
│   ├── ai/                   # ตรรกะเกี่ยวกับ AI, การเชื่อมต่อ OpenAI, prompts, tool definitions, และ service handlers สำหรับ AI
│   ├── analysis-cache/       # Caching for analysis results
│   ├── conversation-history/ # Storing conversation logs
│   ├── image/                # Image processing and storage (Azure Blob)
│   ├── line/                 # LINE Messaging API integration, webhook handler
│   ├── nutrition/            # ตรรกะหลักเกี่ยวกับโภชนาการ, การแปลงข้อมูล, และการคำนวณที่ไม่ใช่ AI
│   ├── openai/               # Service สำหรับการตั้งค่า client และการติดต่อกับ Azure OpenAI API โดยตรง
│   ├── schemas/              # คำจำกัดความของ Mongoose schema สำหรับ MongoDB และโมดูลที่เกี่ยวข้อง
│   ├── user/                 # User profile management
│   ├── app.module.ts         # Root application module
│   └── main.ts               # Application entry point
├── test/                     # Test files (unit and e2e)
├── .env                      # Environment variables (ignored by Git)
├── .gitignore
├── eslint.config.mjs         # ESLint configuration
├── nest-cli.json             # NestJS CLI configuration
├── package.json              # Project dependencies and scripts
├── pnpm-lock.yaml
├── README.md                 # This file
├── tsconfig.build.json
└── tsconfig.json
```

## ↔️ LINE Webhook Setup

เพื่อให้ LINE Bot ทำงานได้ คุณต้องตั้งค่า Webhook URL ใน [LINE Developers Console](https://developers.line.biz/console/) ของ Channel คุณ:

1.  ไปที่ Channel settings > "Messaging API" tab.
2.  แก้ไข "Webhook URL" ให้เป็น URL ของเซิร์ฟเวอร์ที่คุณ deploy backend นี้ไว้ ตามด้วย `/line/webhook` (เช่น `https://your-deployed-domain.com/line/webhook`).
3.  เปิดใช้งาน "Use webhook".

เซิร์ฟเวอร์ต้องสามารถเข้าถึงได้จากภายนอก (publicly accessible) และมี HTTPS. ระหว่างการพัฒนา คุณอาจใช้เครื่องมืออย่าง [ngrok](https://ngrok.com/) เพื่อสร้าง tunnel ไปยัง `localhost` ของคุณ.

ตัวอย่างการใช้ ngrok:

```bash
ngrok http 3001 # หาก PORT ของคุณคือ 3001
```

จากนั้นนำ URL ที่ ngrok ให้ (ที่เป็น `https`) ไปใส่ใน LINE Developers Console.
