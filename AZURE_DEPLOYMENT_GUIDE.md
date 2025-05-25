# 🚀 คู่มือการ Deploy AI Nutritionist บน Azure ทั้งระบบ

## 📋 ภาพรวมการ Deploy

ระบบนี้ประกอบด้วย:

1. **NestJS Backend API** → Azure Container Apps
2. **React LIFF Frontend** → Azure Static Web Apps
3. **MongoDB Database** → Azure Cosmos DB (MongoDB API)
4. **Azure OpenAI** → สำหรับ AI analysis
5. **Azure Blob Storage** → เก็บรูปภาพอาหาร
6. **LINE Integration** → Webhook และ LIFF app

---

## 🏗️ **Phase 1: เตรียม Azure Infrastructure**

### 1.1 สร้าง Resource Group

```bash
# Login ไปยัง Azure
az login

# สร้าง Resource Group
az group create \
  --name ai-nutritionist-rg \
  --location "Southeast Asia"
```

### 1.2 สร้าง Azure Cosmos DB (MongoDB API)

```bash
# สร้าง Cosmos DB Account
az cosmosdb create \
  --resource-group ai-nutritionist-rg \
  --name ai-nutritionist-cosmos \
  --kind MongoDB \
  --server-version 4.2 \
  --default-consistency-level Session \
  --locations regionName="Southeast Asia" failoverPriority=0 isZoneRedundant=False

# สร้าง Database
az cosmosdb mongodb database create \
  --account-name ai-nutritionist-cosmos \
  --resource-group ai-nutritionist-rg \
  --name aifood

# ดึง Connection String
az cosmosdb keys list \
  --resource-group ai-nutritionist-rg \
  --name ai-nutritionist-cosmos \
  --type connection-strings
```

### 1.3 สร้าง Azure Storage Account

```bash
# สร้าง Storage Account
az storage account create \
  --name ainutritioniststorage \
  --resource-group ai-nutritionist-rg \
  --location "Southeast Asia" \
  --sku Standard_LRS

# สร้าง Container สำหรับรูปภาพ
az storage container create \
  --name food-images \
  --account-name ainutritioniststorage \
  --public-access blob

# ดึง Connection String
az storage account show-connection-string \
  --resource-group ai-nutritionist-rg \
  --name ainutritioniststorage
```

### 1.4 สร้าง Azure OpenAI Service

```bash
# สร้าง Azure OpenAI resource
az cognitiveservices account create \
  --name ai-nutritionist-openai \
  --resource-group ai-nutritionist-rg \
  --location "East US 2" \
  --kind OpenAI \
  --sku S0 \
  --custom-domain ai-nutritionist-openai

# Deploy models
# GPT-4.1 (หรือ GPT-4o)
az cognitiveservices account deployment create \
  --resource-group ai-nutritionist-rg \
  --name ai-nutritionist-openai \
  --deployment-name gpt-4-1 \
  --model-name gpt-4 \
  --model-version "1106-Preview" \
  --model-format OpenAI \
  --sku-capacity 20 \
  --sku-name Standard

# GPT-4.1 Mini
az cognitiveservices account deployment create \
  --resource-group ai-nutritionist-rg \
  --name ai-nutritionist-openai \
  --deployment-name gpt-4-1-mini \
  --model-name gpt-4 \
  --model-version "1106-Preview" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard

# Text Embedding
az cognitiveservices account deployment create \
  --resource-group ai-nutritionist-rg \
  --name ai-nutritionist-openai \
  --deployment-name text-embedding-3-small \
  --model-name text-embedding-3-small \
  --model-version "1" \
  --model-format OpenAI \
  --sku-capacity 20 \
  --sku-name Standard
```

### 1.5 สร้าง Azure Container Registry (ACR)

```bash
# สร้าง Container Registry
az acr create \
  --resource-group ai-nutritionist-rg \
  --name ainutritionistacr \
  --sku Basic \
  --admin-enabled true

# ดึง credentials
az acr credential show --name ainutritionistacr
```

---

## 🔧 **Phase 2: Setup Service Principal สำหรับ Authentication**

### 2.1 สร้าง Service Principal

```bash
# สร้าง Service Principal
az ad sp create-for-rbac \
  --name "ai-nutritionist-sp" \
  --role "Contributor" \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg

# จดบันทึก output:
# {
#   "appId": "xxxx-xxxx-xxxx-xxxx",     # AZURE_CLIENT_ID
#   "displayName": "ai-nutritionist-sp",
#   "password": "xxxx-xxxx-xxxx-xxxx",  # AZURE_CLIENT_SECRET
#   "tenant": "xxxx-xxxx-xxxx-xxxx"     # AZURE_TENANT_ID
# }
```

### 2.2 กำหนด Role สำหรับ OpenAI และ Storage

```bash
# ให้สิทธิ์ Cognitive Services OpenAI User
az role assignment create \
  --assignee {APP_ID} \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg/providers/Microsoft.CognitiveServices/accounts/ai-nutritionist-openai

# ให้สิทธิ์ Storage Blob Data Contributor
az role assignment create \
  --assignee {APP_ID} \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg/providers/Microsoft.Storage/storageAccounts/ainutritioniststorage
```

---

## 🐳 **Phase 3: Deploy Backend (NestJS) ไปยัง Azure Container Apps**

### 3.1 เตรียม Dockerfile สำหรับ Backend

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Install pnpm และ dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./

# Build application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Install pnpm และ production dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/main"]
```

### 3.2 Build และ Push Docker Image

```bash
# Login ไปยัง ACR
az acr login --name ainutritionistacr

# Build และ tag image
docker build -t ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest .

# Push image
docker push ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest
```

### 3.3 สร้าง Azure Container Apps Environment

```bash
# สร้าง Container Apps Environment
az containerapp env create \
  --name ai-nutritionist-env \
  --resource-group ai-nutritionist-rg \
  --location "Southeast Asia"
```

### 3.4 Deploy Backend Container App

```bash
# สร้าง Container App สำหรับ backend
az containerapp create \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --environment ai-nutritionist-env \
  --image ainutritionistacr.azurecr.io/ai-nutritionist-backend:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --registry-server ainutritionistacr.azurecr.io \
  --registry-username {ACR_USERNAME} \
  --registry-password {ACR_PASSWORD} \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL={COSMOS_CONNECTION_STRING} \
    AZURE_OPENAI_ENDPOINT=https://ai-nutritionist-openai.openai.azure.com/ \
    AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1=gpt-4-1 \
    AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI=gpt-4-1-mini \
    AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO=gpt-4-1-nano \
    AZURE_OPENAI_API_VERSION=2025-04-01-preview \
    AZURE_OPENAI_EMBEDDING_API_VERSION=2025-04-01-preview \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-small \
    AZURE_CLIENT_ID={YOUR_CLIENT_ID} \
    AZURE_TENANT_ID={YOUR_TENANT_ID} \
    AZURE_CLIENT_SECRET={YOUR_CLIENT_SECRET} \
    AZURE_STORAGE_CONNECTION_STRING={STORAGE_CONNECTION_STRING} \
    AZURE_STORAGE_CONTAINER_NAME=food-images \
    LINE_CHANNEL_ACCESS_TOKEN={YOUR_LINE_TOKEN} \
    LINE_CHANNEL_SECRET={YOUR_LINE_SECRET} \
    LINE_CONSOLE_CHANNEL_ID={YOUR_LINE_CHANNEL_ID} \
    LIFF_APPLICATION_ID={YOUR_LIFF_APP_ID} \
    LIFF_ID_FOOD_REPORT={YOUR_LIFF_ID}
```

---

## 🌐 **Phase 4: Deploy Frontend (React LIFF) ไปยัง Azure Static Web Apps**

### 4.1 เตรียม Build Configuration

```json
// liff-profile-app/staticwebapp.config.json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*.{png,jpg,gif}", "/css/*"]
  },
  "mimeTypes": {
    ".json": "application/json"
  }
}
```

### 4.2 แก้ไข Environment Configuration

```typescript
// liff-profile-app/src/config/environment.ts
export const environment = {
  production: true,
  apiBaseUrl:
    process.env.REACT_APP_API_BASE_URL ||
    'https://ai-nutritionist-backend.{RANDOM}.{REGION}.azurecontainerapps.io',
  liffId: process.env.REACT_APP_LIFF_ID || '{YOUR_LIFF_ID}',
}
```

### 4.3 Deploy Static Web App

```bash
# สร้าง Static Web App
az staticwebapp create \
  --name ai-nutritionist-frontend \
  --resource-group ai-nutritionist-rg \
  --source https://github.com/{YOUR_USERNAME}/{YOUR_REPO} \
  --location "East Asia" \
  --branch main \
  --app-location "liff-profile-app" \
  --api-location "" \
  --output-location "dist"

# หรือ deploy ด้วย Azure CLI
cd liff-profile-app
npm run build
az staticwebapp deploy \
  --name ai-nutritionist-frontend \
  --resource-group ai-nutritionist-rg \
  --source ./dist
```

---

## 🔗 **Phase 5: Configure LINE Integration**

### 5.1 ตั้งค่า LINE Bot Webhook

1. ไปที่ LINE Developers Console
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. ตั้งค่า Webhook URL: `https://ai-nutritionist-backend.{RANDOM}.{REGION}.azurecontainerapps.io/line/webhook`
5. เปิดใช้งาน **Use webhook**

### 5.2 ตั้งค่า LIFF App

1. ไปที่ LINE Developers Console
2. เลือก Channel ของคุณ
3. ไปที่ **LIFF** tab
4. สร้าง LIFF app ใหม่หรือแก้ไขที่มีอยู่:
   - **Endpoint URL**: `https://ai-nutritionist-frontend.{RANDOM}.z23.web.core.windows.net`
   - **Size**: Full
   - **Features**:
     - ✅ Scan QR
     - ✅ Use Bluetooth LE (ถ้าต้องการ)

---

## 📊 **Phase 6: Monitoring และ Optimization**

### 6.1 ตั้งค่า Application Insights

```bash
# สร้าง Application Insights
az monitor app-insights component create \
  --app ai-nutritionist-insights \
  --location "Southeast Asia" \
  --resource-group ai-nutritionist-rg \
  --kind web

# ดึง Instrumentation Key
az monitor app-insights component show \
  --app ai-nutritionist-insights \
  --resource-group ai-nutritionist-rg \
  --query instrumentationKey
```

### 6.2 เพิ่ม Environment Variable สำหรับ Monitoring

```bash
# อัปเดต Container App environment variables
az containerapp update \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --set-env-vars \
    APPINSIGHTS_INSTRUMENTATIONKEY={INSTRUMENTATION_KEY}
```

---

## 🔐 **Phase 7: Security และ Performance Optimization**

### 7.1 ตั้งค่า Custom Domain และ SSL (Optional)

```bash
# เพิ่ม custom domain สำหรับ Static Web App
az staticwebapp hostname set \
  --name ai-nutritionist-frontend \
  --resource-group ai-nutritionist-rg \
  --hostname {YOUR_DOMAIN}

# เพิ่ม custom domain สำหรับ Container App
az containerapp hostname add \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --hostname {YOUR_API_DOMAIN}
```

### 7.2 ตั้งค่า CORS และ Rate Limiting

```typescript
// src/main.ts - อัปเดต CORS settings
app.enableCors({
  origin: [
    'https://ai-nutritionist-frontend.{RANDOM}.z23.web.core.windows.net',
    'https://liff.line.me',
    // เพิ่ม custom domain ถ้ามี
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Accept, Authorization, X-LINE-ID-TOKEN',
  credentials: true,
})
```

---

## 🧪 **Phase 8: Testing การ Deploy**

### 8.1 ทดสอบ Backend API

```bash
# ทดสอบ health check
curl https://ai-nutritionist-backend.{RANDOM}.{REGION}.azurecontainerapps.io/

# ทดสอบ LINE webhook
curl -X POST https://ai-nutritionist-backend.{RANDOM}.{REGION}.azurecontainerapps.io/line/webhook \
  -H "Content-Type: application/json" \
  -d '{"events": []}'
```

### 8.2 ทดสอบ Frontend

1. เปิด LIFF app ใน LINE
2. ทดสอบการอัปโหลดรูปภาพ
3. ทดสอบการแสดงผลรายงานโภชนาการ

---

## 🔄 **Phase 9: CI/CD Pipeline (Optional)**

### 9.1 สร้าง GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push Docker image
        run: |
          az acr login --name ainutritionistacr
          docker build -t ainutritionistacr.azurecr.io/ai-nutritionist-backend:${{ github.sha }} .
          docker push ainutritionistacr.azurecr.io/ai-nutritionist-backend:${{ github.sha }}

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name ai-nutritionist-backend \
            --resource-group ai-nutritionist-rg \
            --image ainutritionistacr.azurecr.io/ai-nutritionist-backend:${{ github.sha }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Build frontend
        run: |
          cd liff-profile-app
          npm install
          npm run build

      - name: Deploy to Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: 'upload'
          app_location: 'liff-profile-app'
          output_location: 'dist'
```

---

## 📝 **Environment Variables Checklist**

สร้าง Azure Key Vault เพื่อจัดการ secrets:

```bash
# สร้าง Key Vault
az keyvault create \
  --name ai-nutritionist-kv \
  --resource-group ai-nutritionist-rg \
  --location "Southeast Asia"

# เพิ่ม secrets
az keyvault secret set --vault-name ai-nutritionist-kv --name "line-channel-token" --value "{YOUR_LINE_TOKEN}"
az keyvault secret set --vault-name ai-nutritionist-kv --name "line-channel-secret" --value "{YOUR_LINE_SECRET}"
az keyvault secret set --vault-name ai-nutritionist-kv --name "azure-client-secret" --value "{YOUR_CLIENT_SECRET}"
```

### Environment Variables ที่ต้องตั้งค่า:

#### Backend Container App:

- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL` (Cosmos DB connection string)
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1`
- `AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI`
- `AZURE_OPENAI_API_VERSION`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `LIFF_APPLICATION_ID`

#### Frontend Static Web App:

- `REACT_APP_API_BASE_URL`
- `REACT_APP_LIFF_ID`

---

## 🎯 **Next Steps**

1. **Cost Optimization**: ตั้งค่า auto-scaling และ monitoring
2. **Security**: เพิ่ม Azure WAF และ DDoS protection
3. **Performance**: ตั้งค่า CDN สำหรับ static assets
4. **Backup**: ตั้งค่า backup policy สำหรับ Cosmos DB
5. **Monitoring**: ตั้งค่า alerts และ dashboards

---

## 🆘 **Troubleshooting**

### ปัญหาที่พบบ่อย:

1. **Container Apps ไม่ start**: ตรวจสอบ environment variables และ logs
2. **CORS errors**: ตรวจสอบ origin settings ใน main.ts
3. **LINE webhook errors**: ตรวจสอบ webhook URL และ SSL certificate
4. **Azure OpenAI quota**: ตรวจสอบ usage และ increase quota ถ้าจำเป็น

### Commands สำหรับ debugging:

```bash
# ดู logs ของ Container App
az containerapp logs show \
  --name ai-nutritionist-backend \
  --resource-group ai-nutritionist-rg \
  --follow

# ดู metrics
az monitor metrics list \
  --resource /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/ai-nutritionist-rg/providers/Microsoft.App/containerApps/ai-nutritionist-backend \
  --metric "Requests"
```

---

**🎉 ขอให้การ deploy สำเร็จนะครับ! หากมีปัญหาใด ๆ สามารถถามได้เลย**
