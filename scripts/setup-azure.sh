#!/bin/bash

# 🚀 AI Nutritionist Azure Setup Script
# ใช้สำหรับตั้งค่า Azure resources อัตโนมัติ

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="ai-nutritionist-rg"
LOCATION="southeastasia"
ACR_NAME="ainutritionistacr"
ENVIRONMENT_NAME="ai-nutritionist-env"
BACKEND_APP_NAME="ai-nutritionist-backend"
FRONTEND_APP_NAME="ai-nutritionist-frontend"
SUBSCRIPTION_ID=""

# Functions
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    print_step "ตรวจสอบความพร้อม..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI ไม่พบ กรุณาติดตั้งก่อน"
        echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        print_error "กรุณาเข้าสู่ระบบ Azure ก่อน: az login"
        exit 1
    fi
    
    # Get subscription ID
    SUBSCRIPTION_ID=$(az account show --query id --output tsv)
    print_success "Azure CLI พร้อมใช้งาน (Subscription: $SUBSCRIPTION_ID)"
}

create_resource_group() {
    print_step "สร้าง Resource Group..."
    
    if az group show --name $RESOURCE_GROUP &> /dev/null; then
        print_warning "Resource Group '$RESOURCE_GROUP' มีอยู่แล้ว"
    else
        az group create \
            --name $RESOURCE_GROUP \
            --location $LOCATION \
            --output table
        print_success "สร้าง Resource Group เสร็จสิ้น"
    fi
}

create_container_registry() {
    print_step "สร้าง Container Registry..."
    
    if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Container Registry '$ACR_NAME' มีอยู่แล้ว"
    else
        az acr create \
            --resource-group $RESOURCE_GROUP \
            --name $ACR_NAME \
            --sku Basic \
            --admin-enabled true \
            --output table
        print_success "สร้าง Container Registry เสร็จสิ้น"
    fi
    
    # Get ACR credentials
    print_step "ดึงข้อมูล Container Registry credentials..."
    ACR_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)
    ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username --output tsv)
    ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value --output tsv)
    
    echo "ACR_LOGIN_SERVER=$ACR_SERVER"
    echo "ACR_USERNAME=$ACR_USERNAME"
    echo "ACR_PASSWORD=$ACR_PASSWORD"
}

create_container_apps_environment() {
    print_step "สร้าง Container Apps Environment..."
    
    if az containerapp env show --name $ENVIRONMENT_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Container Apps Environment '$ENVIRONMENT_NAME' มีอยู่แล้ว"
    else
        az containerapp env create \
            --name $ENVIRONMENT_NAME \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION \
            --output table
        print_success "สร้าง Container Apps Environment เสร็จสิ้น"
    fi
}

create_backend_container_app() {
    print_step "สร้าง Backend Container App..."
    
    if az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Backend Container App '$BACKEND_APP_NAME' มีอยู่แล้ว"
        
        # Update existing app
        print_step "อัพเดท Backend Container App configuration..."
        az containerapp update \
            --name $BACKEND_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --min-replicas 1 \
            --max-replicas 3 \
            --output table
    else
        az containerapp create \
            --name $BACKEND_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --environment $ENVIRONMENT_NAME \
            --image mcr.microsoft.com/k8se/quickstart:latest \
            --target-port 3000 \
            --ingress 'external' \
            --min-replicas 1 \
            --max-replicas 3 \
            --cpu 1.0 \
            --memory 2.0Gi \
            --output table
        print_success "สร้าง Backend Container App เสร็จสิ้น"
    fi
    
    # Get backend URL
    BACKEND_URL=$(az containerapp show \
        --name $BACKEND_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query properties.configuration.ingress.fqdn \
        --output tsv)
    
    echo "BACKEND_URL=https://$BACKEND_URL"
}

create_static_web_app() {
    print_step "สร้าง Static Web App..."
    
    if az staticwebapp show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Static Web App '$FRONTEND_APP_NAME' มีอยู่แล้ว"
    else
        print_warning "Static Web App ต้องสร้างผ่าน Azure Portal หรือ GitHub integration"
        print_step "คำสั่งสำหรับสร้าง Static Web App:"
        echo "az staticwebapp create \\"
        echo "  --name $FRONTEND_APP_NAME \\"
        echo "  --resource-group $RESOURCE_GROUP \\"
        echo "  --source https://github.com/YOUR_USERNAME/ai-nutritionist-nestjs-backend \\"
        echo "  --location $LOCATION \\"
        echo "  --branch main \\"
        echo "  --app-location \"liff-nutrition-next\" \\"
        echo "  --output-location \".next\""
    fi
}

create_service_principal() {
    print_step "สร้าง Service Principal สำหรับ GitHub Actions..."
    
    SP_NAME="ai-nutritionist-github-$(date +%s)"
    
    # Create service principal
    SP_OUTPUT=$(az ad sp create-for-rbac \
        --name $SP_NAME \
        --role contributor \
        --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
        --sdk-auth)
    
    print_success "สร้าง Service Principal เสร็จสิ้น"
    echo "AZURE_CREDENTIALS (เก็บใน GitHub Secret):"
    echo "$SP_OUTPUT"
}

setup_github_secrets_guide() {
    print_step "คำแนะนำการตั้งค่า GitHub Secrets..."
    
    echo ""
    echo "🔑 GitHub Secrets ที่ต้องตั้งค่า:"
    echo ""
    echo "1. AZURE_CREDENTIALS (ได้จาก Service Principal ด้านบน)"
    echo "2. ACR_LOGIN_SERVER=$ACR_SERVER"
    echo "3. ACR_USERNAME=$ACR_USERNAME"
    echo "4. ACR_PASSWORD=$ACR_PASSWORD"
    echo "5. NEXT_PUBLIC_API_BASE_URL=https://$BACKEND_URL"
    echo "6. NEXT_PUBLIC_LIFF_ID=your-liff-id"
    echo ""
    echo "📋 วิธีตั้งค่า:"
    echo "1. ไปที่ GitHub Repository > Settings > Secrets and variables > Actions"
    echo "2. เพิ่ม secrets ตามรายการด้านบน"
    echo "3. สำหรับ Static Web Apps token: ไปที่ Azure Portal > Static Web Apps > Manage deployment token"
    echo ""
}

main() {
    echo "🚀 AI Nutritionist Azure Setup"
    echo "==============================="
    echo ""
    
    check_prerequisites
    create_resource_group
    create_container_registry
    create_container_apps_environment
    create_backend_container_app
    create_static_web_app
    
    echo ""
    print_step "สร้าง Service Principal สำหรับ GitHub Actions..."
    read -p "ต้องการสร้าง Service Principal ใหม่หรือไม่? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_service_principal
    fi
    
    echo ""
    setup_github_secrets_guide
    
    echo ""
    print_success "🎉 Setup เสร็จสิ้น!"
    echo ""
    echo "Next Steps:"
    echo "1. ตั้งค่า GitHub Secrets ตามคำแนะนำด้านบน"
    echo "2. ตั้งค่า environment variables สำหรับ backend"
    echo "3. Push code ไป main branch เพื่อทดสอบ deployment"
    echo ""
}

# Run main function
main "$@" 