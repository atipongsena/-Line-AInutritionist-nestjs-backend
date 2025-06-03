# 🚀 AI Nutritionist Deployment Guide

คู่มือการ deploy backend และ frontend ขึ้น Azure ผ่าน GitHub Actions

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Azure Resources](#azure-resources)
- [GitHub Secrets](#github-secrets)
- [Deployment Process](#deployment-process)
- [Manual Deployment](#manual-deployment)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### ความต้องการของระบบ

- Node.js 24+
- pnpm 9+
- Docker (สำหรับ local testing)
- Azure CLI
- GitHub account ที่มีสิทธิ์ในการตั้งค่า secrets

### Azure Resources ที่จำเป็น

1. **Resource Group**: `ai-nutritionist-rg`
2. **Container Registry**: `ainutritionistacr`
3. **Container Apps**: `ai-nutritionist-backend`
4. **Static Web Apps**: `ai-nutritionist-frontend`
5. **MongoDB Atlas** (หรือ Azure Cosmos DB)

## 🏗️ Azure Resources

### 1. สร้าง Resource Group

```bash
az group create \
  --name ai-nutritionist-rg \
  --location southeastasia
```

### 2. สร้าง Container Registry

```bash
az acr create \
  --resource-group ai-nutritionist-rg \
  --name ainutritionistacr \
  --sku Basic \
  --admin-enabled true
```

### 3. สร้าง Container Apps Environment

```bash
az containerapp env create \
  --name ai-nutritionist-env \
  --resource-group ai-nutritionist-rg \
  --location southeastasia
```

### 4. สร้าง Container App สำหรับ Backend

```bash
az containerapp create \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --environment ai-nutritionist-env \
  --image nginx:latest \
  --target-port 3000 \
  --ingress 'external' \
  --min-replicas 1 \
  --max-replicas 3
```

### 5. สร้าง Static Web Apps สำหรับ Frontend

```bash
az staticwebapp create \
  --name ai-nutritionist-frontend \
  --resource-group ai-nutritionist-rg \
  --source https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend \
  --location southeastasia \
  --branch main \
  --app-location "liff-nutrition-next" \
  --output-location ".next"
```

## 🔑 GitHub Secrets

### การตั้งค่า Secrets ใน GitHub Repository

ไปที่ **Settings > Secrets and variables > Actions** แล้วเพิ่ม secrets ต่อไปนี้:

#### Azure Authentication

```
AZURE_CREDENTIALS
```

สร้างจาก:

```bash
az ad sp create-for-rbac \
  --name "ai-nutritionist-github" \
  --role contributor \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg \
  --sdk-auth
```

#### Container Registry

```
ACR_LOGIN_SERVER=ainutritionistacr.azurecr.io
ACR_USERNAME=ainutritionistacr
ACR_PASSWORD={ได้จาก Azure Portal}
```

#### Static Web Apps

```
AZURE_STATIC_WEB_APPS_API_TOKEN={ได้จาก Azure Portal}
```

#### Frontend Environment Variables

```
NEXT_PUBLIC_API_BASE_URL=https://ai-nutritionist-backend.{your-domain}.azurecontainerapps.io
NEXT_PUBLIC_LIFF_ID=your-liff-id
```

#### Backend Environment Variables (ตั้งใน Container App)

```bash
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --set-env-vars \
    NODE_ENV=production \
    MONGODB_URI=your-mongodb-connection-string \
    OPENAI_API_KEY=your-openai-key \
    LINE_CHANNEL_ACCESS_TOKEN=your-line-token \
    LINE_CHANNEL_SECRET=your-line-secret \
    AZURE_STORAGE_CONNECTION_STRING=your-storage-connection
```

## 🚀 Deployment Process

### Automatic Deployment (แนะนำ)

การ deploy จะทำงานอัตโนมัติเมื่อ:

1. **Push ไป main branch**:

   - ตรวจสอบการเปลี่ยนแปลงในไฟล์
   - รัน tests และ lint checks
   - Deploy เฉพาะส่วนที่มีการเปลี่ยนแปลง

2. **Manual Deployment**:
   - ไปที่ GitHub Actions tab
   - เรื่น workflow "Deploy AI Nutritionist to Azure"
   - เลือกได้วา่จะ deploy ส่วนไหน

### Workflow Features

#### 🔍 Smart Change Detection

- ตรวจสอบการเปลี่ยนแปลงในไฟล์แบบอัตโนมัติ
- Deploy เฉพาะส่วนที่มีการเปลี่ยนแปลง
- ประหยัดเวลาและทรัพยากร

#### 🧪 Comprehensive Testing

- Unit tests สำหรับ backend
- Lint checks สำหรับทั้ง backend และ frontend
- Type checking สำหรับ TypeScript
- Build verification

#### 🔒 Security Scanning

- Trivy vulnerability scanner สำหรับ Docker images
- ส่งผลลัพธ์ไป GitHub Security tab

#### 📊 Deployment Status

- แสดงสถานะการ deploy แบบ real-time
- Comment ใน Pull Request
- Deployment summary

## 🛠️ Manual Deployment

### Backend (NestJS)

```bash
# 1. Build Docker image
docker build -t ai-nutritionist-backend .

# 2. Tag for Azure Container Registry
docker tag ai-nutritionist-backend \
  ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest

# 3. Push to registry
az acr login --name ainutritionistacr
docker push ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest

# 4. Update Container App
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --image ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest
```

### Frontend (Next.js)

```bash
# 1. Build application
cd liff-nutrition-next
pnpm install --frozen-lockfile
pnpm build

# 2. Deploy to Static Web Apps (ใช้ Azure Static Web Apps CLI)
npx @azure/static-web-apps-cli deploy \
  --app-location . \
  --output-location .next \
  --deployment-token $AZURE_STATIC_WEB_APPS_API_TOKEN
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Docker Build Failed

```bash
# ตรวจสอบ Dockerfile syntax
docker build --no-cache -t test-image .

# ตรวจสอบ dependencies
pnpm install --frozen-lockfile
pnpm build
```

#### 2. Container App Not Starting

```bash
# ตรวจสอบ logs
az containerapp logs show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg

# ตรวจสอบ environment variables
az containerapp show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --query properties.configuration.secrets
```

#### 3. Static Web Apps Build Failed

```bash
# ตรวจสอบ build locally
cd liff-nutrition-next
pnpm install
pnpm build

# ตรวจสอบ environment variables
echo $NEXT_PUBLIC_API_BASE_URL
echo $NEXT_PUBLIC_LIFF_ID
```

#### 4. Authentication Issues

```bash
# ตรวจสอบ Azure credentials
az account show

# ตรวจสอบ service principal
az ad sp show --id {CLIENT_ID}

# ตรวจสอบ permissions
az role assignment list --assignee {CLIENT_ID}
```

### Debugging Commands

```bash
# ตรวจสอบ Container App status
az containerapp show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --query properties.provisioningState

# ตรวจสอบ Container App URL
az containerapp show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --query properties.configuration.ingress.fqdn

# ตรวจสอบ Static Web Apps URL
az staticwebapp show \
  --name ai-nutritionist-frontend \
  --resource-group ai-nutritionist-rg \
  --query defaultHostname
```

### Performance Optimization

#### Backend Optimization

```bash
# ตั้งค่า scaling rules
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --min-replicas 1 \
  --max-replicas 5 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-metadata concurrentRequests=10
```

#### Frontend Optimization

- ใช้ Next.js Image Optimization
- Enable Static Generation สำหรับหน้าที่เหมาะสม
- ใช้ CDN สำหรับ static assets

## 📝 Environment Variables Reference

### Backend (.env)

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=sk-...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
AZURE_STORAGE_CONNECTION_STRING=...
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_BASE_URL=https://ai-nutritionist-backend.{domain}.azurecontainerapps.io
NEXT_PUBLIC_LIFF_ID=...
NEXT_PUBLIC_VERSION=latest
```

## 🔄 Rollback Strategy

### Backend Rollback

```bash
# ดู revision history
az containerapp revision list \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg

# Rollback ไป revision ก่อนหน้า
az containerapp revision activate \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --revision {REVISION_NAME}
```

### Frontend Rollback

- ใช้ Git revert commit
- GitHub Actions จะ deploy version ก่อนหน้าอัตโนมัติ

## 📞 Support

หากมีปัญหาในการ deploy สามารถ:

1. ตรวจสอบ GitHub Actions logs
2. ดู Azure Portal สำหรับ resource status
3. ตรวจสอบ application logs ใน Azure

---

**Last Updated**: `date +%Y-%m-%d`
**Version**: 2.0.0
