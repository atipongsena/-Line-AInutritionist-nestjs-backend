#!/bin/bash

# 🚀 Deploy Script for AI Nutritionist
# This script deploys both backend and frontend to Azure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="ai-nutritionist-rg"
ACR_NAME="ainutritionistacr"
BACKEND_APP="ai-nutritionist-backend"
FRONTEND_APP="ai-nutritionist-frontend"
CONTAINER_ENV="ai-nutritionist-env"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Run 'az login' first"
        exit 1
    fi
    
    # Check if .env.azure exists
    if [ ! -f ".env.azure" ]; then
        log_error ".env.azure file not found. Run azure-setup.sh first"
        exit 1
    fi
    
    log_success "All requirements met"
}

load_env() {
    log_info "Loading environment variables from .env.azure"
    
    # Source the environment file
    set -a
    source .env.azure
    set +a
    
    log_success "Environment variables loaded"
}

build_and_push_backend() {
    log_info "Building and pushing backend Docker image..."
    
    # Get build timestamp
    BUILD_TIME=$(date +%Y%m%d-%H%M%S)
    IMAGE_TAG="$ACR_NAME.azurecr.io/$BACKEND_APP:$BUILD_TIME"
    LATEST_TAG="$ACR_NAME.azurecr.io/$BACKEND_APP:latest"
    
    # Login to ACR
    az acr login --name $ACR_NAME
    
    # Build image
    log_info "Building Docker image: $IMAGE_TAG"
    docker build -t $IMAGE_TAG -t $LATEST_TAG .
    
    # Push image
    log_info "Pushing Docker image to ACR..."
    docker push $IMAGE_TAG
    docker push $LATEST_TAG
    
    # Store image tag for deployment
    BACKEND_IMAGE_TAG=$IMAGE_TAG
    
    log_success "Backend image built and pushed: $IMAGE_TAG"
}

deploy_backend() {
    log_info "Deploying backend to Azure Container Apps..."
    
    # Check if app exists
    if az containerapp show --name $BACKEND_APP --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_info "Updating existing container app..."
        
        az containerapp update \
            --name $BACKEND_APP \
            --resource-group $RESOURCE_GROUP \
            --image $BACKEND_IMAGE_TAG
    else
        log_info "Creating new container app..."
        
        az containerapp create \
            --name $BACKEND_APP \
            --resource-group $RESOURCE_GROUP \
            --environment $CONTAINER_ENV \
            --image $BACKEND_IMAGE_TAG \
            --target-port 3000 \
            --ingress external \
            --min-replicas 1 \
            --max-replicas 3 \
            --cpu 1.0 \
            --memory 2.0Gi \
            --registry-server "$ACR_NAME.azurecr.io" \
            --registry-username $ACR_USERNAME \
            --registry-password $ACR_PASSWORD \
            --env-vars \
                NODE_ENV=production \
                PORT=3000 \
                DATABASE_URL="$COSMOS_CONNECTION_STRING" \
                AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
                AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1=gpt-4-1 \
                AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI=gpt-4-1-mini \
                AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO=gpt-4-1-nano \
                AZURE_OPENAI_API_VERSION=2025-04-01-preview \
                AZURE_OPENAI_EMBEDDING_API_VERSION=2025-04-01-preview \
                AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-small \
                AZURE_CLIENT_ID="$AZURE_CLIENT_ID" \
                AZURE_TENANT_ID="$AZURE_TENANT_ID" \
                AZURE_CLIENT_SECRET="$AZURE_CLIENT_SECRET" \
                AZURE_STORAGE_CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING" \
                AZURE_STORAGE_CONTAINER_NAME=food-images \
                LINE_CHANNEL_ACCESS_TOKEN="$LINE_CHANNEL_ACCESS_TOKEN" \
                LINE_CHANNEL_SECRET="$LINE_CHANNEL_SECRET" \
                LINE_CONSOLE_CHANNEL_ID="$LINE_CONSOLE_CHANNEL_ID" \
                LIFF_APPLICATION_ID="$LIFF_APPLICATION_ID" \
                LIFF_ID_FOOD_REPORT="$LIFF_ID_FOOD_REPORT" \
                APPINSIGHTS_INSTRUMENTATIONKEY="$APPINSIGHTS_INSTRUMENTATIONKEY"
    fi
    
    # Get the backend URL
    BACKEND_URL=$(az containerapp show \
        --name $BACKEND_APP \
        --resource-group $RESOURCE_GROUP \
        --query properties.configuration.ingress.fqdn -o tsv)
    
    echo "BACKEND_URL=https://$BACKEND_URL" >> .env.deployment
    
    log_success "Backend deployed successfully"
    log_info "Backend URL: https://$BACKEND_URL"
}

build_frontend() {
    log_info "Building frontend application..."
    
    cd liff-profile-app
    
    # Install dependencies
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile
    else
        npm install
    fi
    
    # Set environment variables for build
    export REACT_APP_API_BASE_URL="https://$BACKEND_URL"
    export REACT_APP_LIFF_ID="$LIFF_ID_FOOD_REPORT"
    export REACT_APP_VERSION="$(date +%Y%m%d-%H%M%S)"
    
    # Build the application
    if command -v pnpm &> /dev/null; then
        pnpm build
    else
        npm run build
    fi
    
    cd ..
    
    log_success "Frontend built successfully"
}

deploy_frontend() {
    log_info "Deploying frontend to Azure Static Web Apps..."
    
    # Check if Static Web App exists
    if az staticwebapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_info "Updating existing Static Web App..."
        
        # Deploy using Azure CLI
        az staticwebapp deploy \
            --name $FRONTEND_APP \
            --resource-group $RESOURCE_GROUP \
            --source ./liff-profile-app/dist
    else
        log_info "Creating new Static Web App..."
        
        # Create Static Web App (manual deployment)
        az staticwebapp create \
            --name $FRONTEND_APP \
            --resource-group $RESOURCE_GROUP \
            --location "East Asia" \
            --source https://github.com/placeholder/placeholder \
            --branch main \
            --app-location "liff-profile-app" \
            --api-location "" \
            --output-location "dist"
        
        # Deploy the built app
        az staticwebapp deploy \
            --name $FRONTEND_APP \
            --resource-group $RESOURCE_GROUP \
            --source ./liff-profile-app/dist
    fi
    
    # Get the frontend URL
    FRONTEND_URL=$(az staticwebapp show \
        --name $FRONTEND_APP \
        --resource-group $RESOURCE_GROUP \
        --query defaultHostname -o tsv)
    
    echo "FRONTEND_URL=https://$FRONTEND_URL" >> .env.deployment
    
    log_success "Frontend deployed successfully"
    log_info "Frontend URL: https://$FRONTEND_URL"
}

test_deployment() {
    log_info "Testing deployment..."
    
    # Test backend health check
    if curl -f "https://$BACKEND_URL/" > /dev/null 2>&1; then
        log_success "✅ Backend health check passed"
    else
        log_warning "⚠️ Backend health check failed"
    fi
    
    # Test frontend
    if curl -f "https://$FRONTEND_URL/" > /dev/null 2>&1; then
        log_success "✅ Frontend accessibility check passed"
    else
        log_warning "⚠️ Frontend accessibility check failed"
    fi
}

print_summary() {
    log_success "🎉 Deployment completed!"
    echo ""
    echo "📝 Deployment Summary:"
    echo "- Backend URL: https://$BACKEND_URL"
    echo "- Frontend URL: https://$FRONTEND_URL"
    echo ""
    echo "🔗 Next Steps:"
    echo "1. Update LINE Bot webhook URL to: https://$BACKEND_URL/line/webhook"
    echo "2. Update LIFF app endpoint URL to: https://$FRONTEND_URL"
    echo "3. Test the application through LINE"
    echo ""
    echo "📁 Generated files:"
    echo "- .env.deployment (contains deployment URLs)"
    echo ""
    echo "🔧 Monitor your application:"
    echo "- Azure Portal: https://portal.azure.com"
    echo "- Container Apps: https://portal.azure.com/#blade/HubsExtension/BrowseResource/resourceType/Microsoft.App%2FcontainerApps"
    echo "- Static Web Apps: https://portal.azure.com/#blade/HubsExtension/BrowseResource/resourceType/Microsoft.Web%2FstaticSites"
}

# Main execution
main() {
    log_info "🚀 Starting deployment process..."
    
    # Create deployment log file
    echo "# Deployment URLs" > .env.deployment
    echo "# Generated on: $(date)" >> .env.deployment
    echo "" >> .env.deployment
    
    check_requirements
    load_env
    
    # Deploy backend
    build_and_push_backend
    deploy_backend
    
    # Deploy frontend
    build_frontend
    deploy_frontend
    
    # Test deployment
    test_deployment
    
    print_summary
}

# Command line options
case "$1" in
    backend)
        log_info "Deploying backend only..."
        check_requirements
        load_env
        build_and_push_backend
        deploy_backend
        ;;
    frontend)
        log_info "Deploying frontend only..."
        check_requirements
        load_env
        # Load backend URL from previous deployment
        if [ -f ".env.deployment" ]; then
            source .env.deployment
        else
            log_error "Backend URL not found. Deploy backend first or run full deployment."
            exit 1
        fi
        build_frontend
        deploy_frontend
        ;;
    test)
        log_info "Testing deployment..."
        if [ -f ".env.deployment" ]; then
            source .env.deployment
            test_deployment
        else
            log_error "Deployment URLs not found. Run deployment first."
            exit 1
        fi
        ;;
    *)
        main
        ;;
esac 