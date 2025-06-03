# 🚀 Quick Deploy Reference

คู่มือสั้นๆ สำหรับการ deploy AI Nutritionist ขึ้น Azure

## 📋 Prerequisites Checklist

- [ ] Node.js 24+ installed
- [ ] pnpm 9+ installed
- [ ] Azure CLI installed and logged in
- [ ] Docker installed (สำหรับ backend)
- [ ] GitHub repository setup
- [ ] Azure resources created

## 🔧 Quick Setup Commands

### 1. Setup Azure Resources (ครั้งแรกเท่านั้น)

```bash
# Windows (PowerShell)
./scripts/setup-azure.sh

# หรือ manual setup (ดู DEPLOYMENT_GUIDE.md)
```

### 2. Setup GitHub Secrets

ไปที่ **GitHub Repository > Settings > Secrets and variables > Actions**

Required secrets:

```
AZURE_CREDENTIALS
AZURE_STATIC_WEB_APPS_API_TOKEN
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_LIFF_ID
```

## 🚀 Deployment Methods

### Method 1: Automatic (แนะนำ)

```bash
# Push ไป main branch
git add .
git commit -m "deploy: update application"
git push origin main

# หรือ manual trigger ใน GitHub Actions
```

### Method 2: Manual Deployment

#### Windows (PowerShell)

```powershell
# Deploy ทั้งหมด
./scripts/deploy-manual.ps1

# Deploy เฉพาะ backend
./scripts/deploy-manual.ps1 -Component backend

# Deploy เฉพาะ frontend
./scripts/deploy-manual.ps1 -Component frontend

# Skip tests (เร็วขึ้น)
./scripts/deploy-manual.ps1 -SkipTests
```

#### Manual Steps

```bash
# Backend
docker build -t ainutritionistacr.azurecr.io/ai-nutritionist-backend .
az acr login --name ainutritionistacr
docker push ainutritionistacr.azurecr.io/ai-nutritionist-backend
az containerapp update --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --image ainutritionistacr.azurecr.io/ai-nutritionist-backend

# Frontend
cd liff-nutrition-next
pnpm build
# ใช้ GitHub Actions หรือ Azure Static Web Apps CLI
```

## 🔍 Monitoring Commands

### Check Backend Status

```bash
# Container App status
az containerapp show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --query properties.provisioningState

# Get backend URL
az containerapp show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --query properties.configuration.ingress.fqdn

# View logs
az containerapp logs show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --follow
```

### Check Frontend Status

```bash
# Static Web App status
az staticwebapp show --name ai-nutritionist-frontend --resource-group ai-nutritionist-rg --query defaultHostname

# GitHub Actions status
# ดูใน GitHub repository > Actions tab
```

## 🐛 Quick Troubleshooting

### Common Issues & Solutions

#### 1. Docker Build Failed

```bash
# ตรวจสอบ dependencies
pnpm install --frozen-lockfile
pnpm build

# Clean build
docker system prune -f
docker build --no-cache -t test .
```

#### 2. Tests Failed

```bash
# รัน tests locally
pnpm test
pnpm lint

# Fix และ commit
git add .
git commit -m "fix: resolve test issues"
```

#### 3. Container App Not Starting

```bash
# ตรวจสอบ logs
az containerapp logs show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg

# ตรวจสอบ environment variables
az containerapp show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --query properties.configuration
```

#### 4. Frontend Build Failed

```bash
cd liff-nutrition-next
pnpm install
pnpm type-check
pnpm lint
pnpm build
```

## 🔄 Rollback Commands

### Backend Rollback

```bash
# ดู revisions
az containerapp revision list --name ai-nutritionist-backend --resource-group ai-nutritionist-rg

# Rollback
az containerapp revision activate --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --revision REVISION_NAME
```

### Frontend Rollback

```bash
# Revert commit และ push
git revert HEAD
git push origin main
```

## 📱 Health Check URLs

### Production URLs

- **Backend**: `https://ai-nutritionist-backend.{domain}.azurecontainerapps.io`
- **Frontend**: `https://{static-web-app-name}.azurestaticapps.net`

### Health Check Endpoints

- **Backend Health**: `GET /health`
- **Backend API Docs**: `GET /api-docs`

## 🔧 Environment Variables

### Backend (.env)

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=sk-...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_BASE_URL=https://...
NEXT_PUBLIC_LIFF_ID=...
NEXT_PUBLIC_VERSION=latest
```

## 📞 Emergency Contacts

### Deployment Issues

1. Check GitHub Actions logs
2. Check Azure Portal resource status
3. Check application logs in Azure

### Quick Commands Summary

```bash
# Setup (ครั้งแรก)
./scripts/setup-azure.sh

# Deploy
git push origin main
# หรือ
./scripts/deploy-manual.ps1

# Monitor
az containerapp logs show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --follow

# Rollback
az containerapp revision activate --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --revision REVISION_NAME
```

---

**💡 Tip**: เก็บไฟล์นี้ไว้เป็น bookmark สำหรับการ deploy ด่วน!
