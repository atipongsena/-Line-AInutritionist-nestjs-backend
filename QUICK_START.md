# 🚀 Quick Start Guide - Deploy AI Nutritionist to Azure

เริ่มต้น deploy ระบบ AI Nutritionist ขึ้น Azure ด้วย 3 ขั้นตอนง่าย ๆ

## 📋 Prerequisites

### ติดตั้ง Required Tools:

```bash
# 1. ติดตั้ง Azure CLI
# Windows (PowerShell)
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi; Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'

# macOS
brew install azure-cli

# Linux (Ubuntu/Debian)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# 2. ติดตั้ง Docker Desktop
# Download จาก: https://www.docker.com/products/docker-desktop/

# 3. ติดตั้ง Node.js และ pnpm
# Download Node.js v24+ จาก: https://nodejs.org/
# หรือใช้ Node Version Manager
npm install -g pnpm@latest
```

### เตรียม LINE Developer Account:

1. สมัคร LINE Developers account: https://developers.line.biz/
2. สร้าง Channel (Messaging API)
3. บันทึก Channel Access Token และ Channel Secret

---

## 🎯 Step 1: Setup Azure Infrastructure

### 1.1 Login และเตรียม Scripts

```bash
# Clone หรือ download โปรเจค
git clone <your-repo-url>
cd ai-nutritionist-nestjs-backend

# ให้สิทธิ์ execute scripts (Linux/macOS)
chmod +x scripts/*.sh

# Login ไปยัง Azure
az login
```

### 1.2 รัน Infrastructure Setup Script

```bash
# รัน script setup Azure infrastructure
./scripts/azure-setup.sh

# หรือถ้าใช้ Windows PowerShell
bash scripts/azure-setup.sh
```

**Script จะสร้าง:**

- ✅ Resource Group
- ✅ Cosmos DB (MongoDB API)
- ✅ Azure Storage Account
- ✅ Azure OpenAI Service
- ✅ Container Registry
- ✅ Service Principal
- ✅ Key Vault
- ✅ Application Insights
- ✅ Container Apps Environment

### 1.3 อัปเดต Environment Variables

```bash
# Copy ค่าจากไฟล์ที่ generate มา
cp .env.azure .env

# แก้ไข .env และเพิ่มค่า LINE credentials
nano .env  # หรือใช้ editor ที่ชอบ
```

**เพิ่มค่าเหล่านี้ใน .env:**

```bash
# LINE API Credentials (จาก LINE Developers Console)
LINE_CHANNEL_ACCESS_TOKEN="your_line_access_token"
LINE_CHANNEL_SECRET="your_line_channel_secret"
LINE_CONSOLE_CHANNEL_ID="your_channel_id"
LIFF_APPLICATION_ID="your_liff_app_id"
LIFF_ID_FOOD_REPORT="your_liff_id"
```

---

## 🚀 Step 2: Deploy Applications

### 2.1 รัน Deployment Script

```bash
# Deploy ทั้ง backend และ frontend
./scripts/deploy.sh

# หรือ deploy แยกส่วน
./scripts/deploy.sh backend   # Backend อย่างเดียว
./scripts/deploy.sh frontend  # Frontend อย่างเดียว
```

### 2.2 ตรวจสอบ Deployment

```bash
# Test deployment
./scripts/deploy.sh test

# ดู logs ของ backend
az containerapp logs show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --follow
```

---

## 🔗 Step 3: Configure LINE Integration

### 3.1 อัปเดต LINE Bot Webhook

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. ตั้งค่า Webhook URL:
   ```
   https://ai-nutritionist-backend.{YOUR_RANDOM_ID}.{REGION}.azurecontainerapps.io/line/webhook
   ```
5. เปิดใช้งาน **Use webhook**

### 3.2 อัปเดต LIFF App

1. ใน LINE Developers Console
2. ไปที่ **LIFF** tab
3. อัปเดต Endpoint URL:
   ```
   https://ai-nutritionist-frontend.{YOUR_RANDOM_ID}.z23.web.core.windows.net
   ```

### 3.3 ทดสอบระบบ

1. เพิ่ม LINE Bot เป็นเพื่อน
2. ส่งข้อความ "สวัสดี" ไปยัง Bot
3. ทดสอบ LIFF app

---

## 🛠️ Advanced Options

### Deploy ด้วย GitHub Actions (CI/CD)

1. **Setup GitHub Secrets:**

```bash
# สร้าง Service Principal credentials สำหรับ GitHub
az ad sp create-for-rbac \
  --name "github-actions-sp" \
  --role contributor \
  --scopes /subscriptions/{SUBSCRIPTION_ID} \
  --sdk-auth
```

2. **เพิ่ม Secrets ใน GitHub Repository:**

- `AZURE_CREDENTIALS` (output จาก command ข้างบน)
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `REACT_APP_API_BASE_URL`
- `REACT_APP_LIFF_ID`

3. **Push code เพื่อ trigger deployment:**

```bash
git add .
git commit -m "Deploy to Azure"
git push origin main
```

### Monitor และ Debug

```bash
# ดู resource ทั้งหมด
az resource list --resource-group ai-nutritionist-rg --output table

# ดู metrics ของ Container App
az monitor metrics list \
  --resource /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg/providers/Microsoft.App/containerApps/ai-nutritionist-backend \
  --metric "Requests"

# ดู Application Insights
az monitor app-insights component show \
  --app ai-nutritionist-insights \
  --resource-group ai-nutritionist-rg
```

---

## 📝 Environment Variables Reference

### Backend (.env):

```bash
# Production
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=<cosmos_connection_string>

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=<openai_endpoint>
AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1=gpt-4-1
AZURE_OPENAI_API_VERSION=2025-04-01-preview
AZURE_CLIENT_ID=<service_principal_id>
AZURE_TENANT_ID=<tenant_id>
AZURE_CLIENT_SECRET=<service_principal_secret>

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=<storage_connection>
AZURE_STORAGE_CONTAINER_NAME=food-images

# LINE
LINE_CHANNEL_ACCESS_TOKEN=<line_token>
LINE_CHANNEL_SECRET=<line_secret>
LIFF_APPLICATION_ID=<liff_app_id>
```

### Frontend (environment variables):

```bash
REACT_APP_API_BASE_URL=<backend_url>
REACT_APP_LIFF_ID=<liff_id>
```

---

## 🎯 Cost Optimization Tips

### 1. Auto-scaling Configuration:

```bash
# อัปเดต scaling rules
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --min-replicas 0 \
  --max-replicas 2
```

### 2. Cosmos DB Optimization:

- ใช้ **Serverless** mode สำหรับ development
- ตั้งค่า **TTL** สำหรับ temporary data
- ใช้ **Autoscale** สำหรับ production

### 3. Monitor Costs:

```bash
# ตั้งค่า budget alert
az consumption budget create \
  --budget-name "ai-nutritionist-budget" \
  --amount 50 \
  --time-grain Monthly \
  --resource-group ai-nutritionist-rg
```

---

## 🆘 Troubleshooting

### ปัญหาที่พบบ่อย:

#### 1. Container App ไม่ start:

```bash
# ตรวจสอบ logs
az containerapp logs show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --follow

# ตรวจสอบ environment variables
az containerapp show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --query properties.template.containers[0].env
```

#### 2. OpenAI Model ไม่พร้อมใช้งาน:

```bash
# ตรวจสอบ model deployments
az cognitiveservices account deployment list \
  --name ai-nutritionist-openai \
  --resource-group ai-nutritionist-rg
```

#### 3. LINE Webhook ไม่ทำงาน:

- ตรวจสอบ webhook URL ใน LINE Console
- ตรวจสอบ SSL certificate ของ Container App
- ตรวจสอบ CORS settings

#### 4. Frontend ไม่โหลด:

- ตรวจสอบ build output ใน `/dist`
- ตรวจสอบ environment variables
- ตรวจสอบ Static Web App configuration

### Reset Environment:

```bash
# ลบ resource group ทั้งหมด (ระวัง!)
az group delete --name ai-nutritionist-rg --yes --no-wait

# สร้างใหม่
./scripts/azure-setup.sh
```

---

## 📞 Support

หากมีปัญหาหรือข้อสงสัย:

1. **ตรวจสอบ logs:**

   - Container Apps logs
   - Application Insights
   - Azure Activity Log

2. **ดู documentation:**

   - [Azure Container Apps](https://docs.microsoft.com/en-us/azure/container-apps/)
   - [Azure Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/)
   - [LINE Developers](https://developers.line.biz/en/docs/)

3. **Community:**
   - Azure Community Support
   - Stack Overflow (แท็ก: azure, nestjs, line-bot)

---

**🎉 ขอให้การ deploy สำเร็จ และขอให้ AI Nutritionist ช่วยให้ทุกคนมีสุขภาพดีกันครับ!**
