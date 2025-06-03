# 🔧 Deployment Troubleshooting Guide

คู่มือแก้ไขปัญหาการ deploy AI Nutritionist

## 🚨 Common Issues & Solutions

### 1. `pnpm not found` Error

**อาการ:**

```
Error: Unable to locate executable file: pnpm. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable.
```

**สาเหตุ:** `actions/setup-node@v4` พยายาม cache pnpm ก่อนที่ pnpm จะถูกติดตั้ง

**วิธีแก้:**

```yaml
# ❌ ผิด: ติดตั้ง Node.js พร้อม cache pnpm ก่อน
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: 'pnpm' # ❌ Error: pnpm ยังไม่มี

- name: Setup pnpm
  uses: pnpm/action-setup@v4

# ✅ ถูก: ติดตั้ง pnpm ก่อน แล้วค่อย setup Node.js
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: ${{ env.PNPM_VERSION }}

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: 'pnpm' # ✅ ตอนนี้ pnpm มีแล้ว
```

### 2. `environment: production` Error

**อาการ:**

```
Error: Value 'production' is not valid
```

**สาเหตุ:** GitHub repository ไม่มี environment ชื่อ 'production' ที่ถูกสร้างไว้

**วิธีแก้ Option 1: สร้าง Environment**

1. ไปที่ GitHub Repository > Settings > Environments
2. คลิก "New environment"
3. ตั้งชื่อ "production"
4. ตั้งค่า protection rules ตามต้องการ

**วิธีแก้ Option 2: เอา environment ออก**

```yaml
# ❌ มี environment
deploy-backend:
  runs-on: ubuntu-latest
  environment: production  # ❌ เอาบรรทัดนี้ออก

# ✅ ไม่มี environment
deploy-backend:
  runs-on: ubuntu-latest
  # environment: production  # ✅ comment หรือลบออก
```

### 3. Azure Login Failed

**อาการ:**

```
Error: Az CLI Login failed. Please check the credentials.
```

**สาเหตุ:** `AZURE_CREDENTIALS` secret ไม่ถูกต้องหรือไม่มี

**วิธีแก้:**

```bash
# 1. สร้าง Service Principal
az ad sp create-for-rbac \
  --name "ai-nutritionist-github" \
  --role contributor \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg \
  --sdk-auth

# 2. คัดลอกผลลัพธ์ไปใส่ใน GitHub Secret: AZURE_CREDENTIALS
# 3. ตรวจสอบว่า Service Principal มีสิทธิ์เพียงพอ
az role assignment list --assignee {CLIENT_ID}
```

### 4. ACR Permission Denied

**อาการ:**

```
Error: unauthorized: authentication required
```

**วิธีแก้:**

```bash
# 1. ตรวจสอบ ACR credentials
az acr credential show --name ainutritionistacr --resource-group ai-nutritionist-rg

# 2. ตรวจสอบ admin enabled
az acr update --name ainutritionistacr --admin-enabled true

# 3. เพิ่ม Service Principal ใน ACR
az role assignment create \
  --assignee {SERVICE_PRINCIPAL_ID} \
  --role AcrPush \
  --scope /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg/providers/Microsoft.ContainerRegistry/registries/ainutritionistacr
```

### 5. Container App Update Failed

**อาการ:**

```
Error: (ContainerAppNotFound) The Container App 'ai-nutritionist-backend' under resource group 'ai-nutritionist-rg' was not found.
```

**วิธีแก้:**

```bash
# 1. ตรวจสอบว่า Container App มีอยู่จริง
az containerapp list --resource-group ai-nutritionist-rg

# 2. ถ้าไม่มี ให้สร้างใหม่
az containerapp create \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --environment ai-nutritionist-env \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 3000 \
  --ingress 'external'
```

### 6. Frontend Build Failed

**อาการ:**

```
Error: next build failed
```

**วิธีแก้:**

```bash
# 1. ตรวจสอบ environment variables
echo $NEXT_PUBLIC_API_BASE_URL
echo $NEXT_PUBLIC_LIFF_ID

# 2. ตรวจสอบ build locally
cd liff-nutrition-next
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm build

# 3. ตรวจสอบ dependencies conflicts
pnpm audit
pnpm update
```

### 7. Static Web Apps Token Invalid

**อาการ:**

```
Error: Invalid deployment token
```

**วิธีแก้:**

1. ไปที่ Azure Portal > Static Web Apps
2. เลือก app ของคุณ
3. ไปที่ "Manage deployment token"
4. คัดลอก token ใหม่
5. อัพเดท GitHub Secret: `AZURE_STATIC_WEB_APPS_API_TOKEN`

### 8. Node.js Runtime Version Mismatch

**อาการ:**

```
[WARNING] Nodejs runtime version info is not provided for the Next.js app.
Defaulting to version: 18.
```

**สาเหตุ:** Azure Static Web Apps ไม่ทราบ Node.js version ที่ควรใช้

**วิธีแก้:**

1. **สร้างไฟล์ `staticwebapp.config.json`:**

```json
{
  "platform": {
    "apiRuntime": "node:20"
  },
  "navigationFallback": {
    "rewrite": "/"
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/*",
      "allowedRoles": ["anonymous"]
    }
  ]
}
```

2. **อัพเดท package.json engines:**

```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

3. **เพิ่ม config_file_location ใน workflow:**

```yaml
- name: Deploy to Azure Static Web Apps
  uses: Azure/static-web-apps-deploy@v1
  with:
    config_file_location: 'liff-nutrition-next'
```

### 9. PWA Manifest Icon Errors

**อาการ:**

```
Error while trying to use the following icon from the Manifest:
/icon-192x192.png (Download error or resource isn't a valid image)
```

**สาเหตุ:** ไฟล์ icon ที่ระบุใน manifest.json ไม่พบหรือชื่อไฟล์ไม่ตรงกัน

**วิธีแก้:**

1. **ตรวจสอบไฟล์ icon ใน public folder:**

```bash
ls liff-nutrition-next/public/*.png
# ผลลัพธ์ควรแสดง: logo192.png, logo512.png
```

2. **อัพเดท manifest.json ให้ตรงกับชื่อไฟล์:**

```json
{
  "icons": [
    {
      "src": "/logo192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/logo512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 10. LINE Authentication Errors

**อาการ:**

```
api.line.me/oauth2/v2.1/token:1 Failed to load resource:
the server responded with a status of 400
```

**สาเหตุ:**

- LIFF ID ไม่ถูกต้อง
- Environment variables ไม่ถูกตั้งค่าใน production
- LIFF App configuration ผิดพลาด

**วิธีแก้:**

1. **ตรวจสอบ LIFF ID format:**

```javascript
// LIFF ID ต้องมีรูปแบบ: xxxxxxxxx-xxxxxxxx
const liffIdPattern = /^\d{10}-\w{8}$/
console.log(liffIdPattern.test('2007487958-0W2jaran')) // true
```

2. **ตั้งค่า environment variables ใน Azure Static Web Apps:**

```bash
# ใน Azure Portal > Static Web Apps > Configuration
NEXT_PUBLIC_LIFF_ID=your-actual-liff-id
NEXT_PUBLIC_API_BASE_URL=https://your-backend.azurecontainerapps.io
```

3. **ตรวจสอบ LIFF App settings ใน LINE Developers Console:**

- Endpoint URL ต้องตรงกับ Azure Static Web Apps URL
- LIFF App Type: Full
- Auto login: Enable (ถ้าต้องการ)

4. **Debug LIFF ใน browser console:**

```javascript
// เปิด Developer Tools > Console
console.log('LIFF ID:', process.env.NEXT_PUBLIC_LIFF_ID)
console.log('API URL:', process.env.NEXT_PUBLIC_API_BASE_URL)
```

## 🔧 Quick Fix Commands

### Reset Deployment

```bash
# 1. ลบ Container App revision ที่ผิดพลาด
az containerapp revision list --name ai-nutritionist-backend --resource-group ai-nutritionist-rg
az containerapp revision deactivate --name ai-nutritionist-backend --resource-group ai-nutritionist-rg --revision {REVISION_NAME}

# 2. Redeploy ด้วย image ล่าสุด
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --image ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest
```

### Clear GitHub Actions Cache

```bash
# ใน GitHub repository
# ไปที่ Actions > Caches > ลบ cache ทั้งหมด
```

### Manual Deploy

```powershell
# Windows PowerShell
./scripts/deploy-manual.ps1 -SkipTests

# หรือ deploy เฉพาะส่วน
./scripts/deploy-manual.ps1 -Component backend -SkipTests
./scripts/deploy-manual.ps1 -Component frontend -SkipTests
```

## 🔍 Debugging Steps

### 1. ตรวจสอบ GitHub Actions Logs

```
1. ไปที่ GitHub Repository > Actions
2. คลิกที่ failed workflow
3. คลิกที่ failed job
4. ดู logs แต่ละ step
```

### 2. ตรวจสอบ Azure Resources

```bash
# Resource Group
az group show --name ai-nutritionist-rg

# Container Apps
az containerapp list --resource-group ai-nutritionist-rg

# Container Registry
az acr list --resource-group ai-nutritionist-rg

# Static Web Apps
az staticwebapp list --resource-group ai-nutritionist-rg
```

### 3. ตรวจสอบ Environment Variables

```bash
# ใน Azure Container Apps
az containerapp show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --query properties.configuration.secrets

# ใน GitHub Secrets
# ไปที่ Repository > Settings > Secrets and variables > Actions
```

## 📋 Checklist ก่อน Deploy

- [ ] Azure CLI logged in และมีสิทธิ์เพียงพอ
- [ ] GitHub Secrets ถูกต้องครบถ้วน
- [ ] Azure Resources ถูกสร้างแล้ว
- [ ] Local build สำเร็จ
- [ ] Tests ผ่านทั้งหมด
- [ ] Environment variables ถูกต้อง

## 🆘 Emergency Procedures

### Rollback Backend

```bash
# ดู revision history
az containerapp revision list --name ai-nutritionist-backend --resource-group ai-nutritionist-rg

# Activate revision ก่อนหน้า
az containerapp revision activate \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --revision {PREVIOUS_REVISION_NAME}
```

### Rollback Frontend

```bash
# Revert commit และ push
git revert HEAD
git push origin main
```

### Contact Support

- GitHub Actions Issues: https://github.com/actions/runner/issues
- Azure Container Apps: https://docs.microsoft.com/en-us/azure/container-apps/
- Azure Static Web Apps: https://docs.microsoft.com/en-us/azure/static-web-apps/

---

**💡 Tip:** เก็บไฟล์นี้ไว้ใกล้ๆ เพื่อแก้ไขปัญหาได้รวดเร็วเมื่อ deployment มีปัญหา!
