# 🚀 Production Deployment - Quick Reference

## 🎯 Quick Deploy Commands

### 🤖 **Automated (GitHub Actions) - แนะนำ**

```bash
# Deploy ทุกอย่างผ่าน GitHub Actions
git add .
git commit -m "deploy: production release"
git push origin main
# ดู progress ที่ GitHub Actions tab
```

### 🛠️ **Manual Deployment**

```bash
# Deploy ทุกอย่าง (Backend + Frontend)
make deploy-production

# Deploy แค่ Backend
make deploy-backend

# Deploy แค่ Frontend
make deploy-frontend
```

### 🐳 **Docker Only**

```bash
# Build & push ไป Azure Container Registry
make push

# Update Container App manually
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --image ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest
```

---

## 📋 Pre-deployment Checklist

### ✅ **Required Setup:**

- [ ] Azure CLI installed และ logged in (`az login`)
- [ ] Docker installed และ running
- [ ] pnpm installed
- [ ] Azure resources created (ตาม MANUAL_DEPLOYMENT_GUIDE.md)
- [ ] GitHub Secrets configured (ตาม GITHUB_SECRETS_SETUP.md)

### ✅ **Environment Variables:**

```bash
# Backend (Container Apps)
AZURE_OPENAI_ENDPOINT=https://kinge-m9yh57s3-eastus2.cognitiveservices.azure.com
AZURE_OPENAI_API_KEY=your-key
MONGODB_URI=mongodb://cosmos-connection-string
AZURE_STORAGE_CONNECTION_STRING=your-storage-connection
LINE_CHANNEL_SECRET=your-line-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
NODE_ENV=production

# Frontend (Static Web Apps)
VITE_API_BASE_URL=https://your-backend-url.azurecontainerapps.io
VITE_LIFF_ID=2007349762-AJ9J432d
```

---

## 🌐 Production URLs

```bash
# 🖥️ Backend API
https://ai-nutritionist-backend.{random}.eastasia.azurecontainerapps.io

# 🌐 Frontend LIFF App
https://ai-nutritionist-frontend.{random}.azurestaticapps.net

# 📱 LINE LIFF URL
https://liff.line.me/2007349762-AJ9J432d
```

---

## 🔍 Health Checks

```bash
# Backend health
curl https://your-backend-url.azurecontainerapps.io/

# Frontend test
curl https://your-frontend-url.azurestaticapps.net/

# LIFF test (ใน LINE app)
```

---

## 📝 Monitoring Commands

```bash
# Container Apps logs
az containerapp logs show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --follow

# Container status
az containerapp show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --query "properties.provisioningState"

# Static Web Apps status
az staticwebapp show \
  --name ai-nutritionist-frontend
```

---

## 🚨 Emergency Commands

### 🔄 **Rollback**

```bash
# ดู revision history
az containerapp revision list \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg

# Rollback ไป revision ก่อนหน้า
az containerapp revision set-mode \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --mode single \
  --revision-name previous-revision-name
```

### 🛑 **Stop Services**

```bash
# Stop Container App
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --min-replicas 0 \
  --max-replicas 0
```

### 🔧 **Restart Services**

```bash
# Restart Container App
az containerapp revision restart \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg
```

---

## 🐛 Common Issues

### ❌ **Backend ไม่ start**

```bash
# ตรวจสอบ logs
az containerapp logs show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg

# ตรวจสอบ environment variables
az containerapp show --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --query "properties.configuration"
```

### ❌ **Frontend ไม่โหลด**

```bash
# ตรวจสอบ build
cd liff-profile-app && pnpm build

# ตรวจสอบ environment variables
echo $VITE_API_BASE_URL
echo $VITE_LIFF_ID
```

### ❌ **LIFF ไม่ทำงาน**

```bash
# ตรวจสอบ LINE Developers Console:
# 1. LIFF ID ถูกต้อง
# 2. Endpoint URL ชี้ไปที่ Static Web Apps (HTTPS)
# 3. Scope permissions ครบถ้วน
```

---

## 📊 Performance Monitoring

### Application Insights Queries

```kusto
# Request performance
requests
| where timestamp > ago(1h)
| summarize avg(duration), count() by name

# Error tracking
exceptions
| where timestamp > ago(24h)
| summarize count() by type
```

### Container Metrics

```bash
# CPU และ Memory usage
az monitor metrics list \
  --resource ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --metric "CpuUsage,MemoryUsage"
```

---

## 🔐 Security Notes

- 🔒 ทุก endpoint ใช้ HTTPS automatically
- 🗝️ Secrets จัดเก็บใน Azure Key Vault
- 🛡️ Container ใช้ non-root user
- 📊 Application Insights logging enabled
- 🔍 CORS configured correctly

---

## 🔧 GitHub Actions Issues (แก้ไขแล้ว)

### ✅ **Context access might be invalid**

```bash
# แก้ไขแล้ว: เพิ่ม permissions ใน workflow
permissions:
  contents: read
  deployments: write
  statuses: write
```

### ✅ **Static Web Apps config error**

```bash
# แก้ไขแล้ว: เปลี่ยนจาก "serve" เป็น "rewrite"
# ใน liff-profile-app/staticwebapp.config.json
```

### 🔑 **Required GitHub Secrets:**

```bash
AZURE_CREDENTIALS          # Service Principal JSON
VITE_API_BASE_URL          # Backend Container App URL
VITE_LIFF_ID               # LINE LIFF ID (2007349762-AJ9J432d)
AZURE_STATIC_WEB_APPS_API_TOKEN  # Static Web Apps deployment token
```

---

## 📚 Full Documentation

- [PRODUCTION_DEPLOYMENT_GUIDE.md](./docs/PRODUCTION_DEPLOYMENT_GUIDE.md) - Full deployment guide
- [GITHUB_ACTIONS_SETUP.md](./docs/GITHUB_ACTIONS_SETUP.md) - GitHub Actions troubleshooting
- [GITHUB_SECRETS_SETUP.md](./docs/GITHUB_SECRETS_SETUP.md) - Detailed secrets setup
- [MANUAL_DEPLOYMENT_GUIDE.md](./docs/MANUAL_DEPLOYMENT_GUIDE.md) - Azure setup
- [DOCKER_GUIDE.md](./docs/DOCKER_GUIDE.md) - Docker usage
