#!/bin/bash

# 🚀 Production Deployment Script for AI Nutritionist
# Usage: ./scripts/deploy-production.sh [backend|frontend|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="kin-geng-openai"
ACR_NAME="KinGeng"
BACKEND_APP_NAME="ai-nutritionist-backend"
FRONTEND_APP_NAME="ai-nutritionist-frontend"
VERSION=$(date +%Y%m%d-%H%M%S)

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install it first."
        exit 1
    fi
    
    # Check Azure login
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

deploy_backend() {
    log_info "Starting backend deployment..."
    
    # Build and push Docker image
    log_info "Building Docker image..."
    docker build -t ${ACR_NAME}.azurecr.io/ai-nutritionist-backend:${VERSION} .
    docker tag ${ACR_NAME}.azurecr.io/ai-nutritionist-backend:${VERSION} ${ACR_NAME}.azurecr.io/ai-nutritionist-backend:latest
    
    # Login to ACR
    log_info "Logging in to Azure Container Registry..."
    az acr login --name ${ACR_NAME}
    
    # Push images
    log_info "Pushing Docker images..."
    docker push ${ACR_NAME}.azurecr.io/ai-nutritionist-backend:${VERSION}
    docker push ${ACR_NAME}.azurecr.io/ai-nutritionist-backend:latest
    
    # Deploy to Container Apps
    log_info "Deploying to Azure Container Apps..."
    az containerapp update \
        --name ${BACKEND_APP_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --image ${ACR_NAME}.azurecr.io/ai-nutritionist-backend:${VERSION}
    
    # Wait for deployment
    log_info "Waiting for deployment to complete..."
    sleep 30
    
    # Get the backend URL
    BACKEND_URL=$(az containerapp show \
        --name ${BACKEND_APP_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --query "properties.configuration.ingress.fqdn" \
        --output tsv)
    
    # Health check
    log_info "Performing health check..."
    if curl -f "https://${BACKEND_URL}/" > /dev/null 2>&1; then
        log_success "Backend deployed successfully!"
        log_success "Backend URL: https://${BACKEND_URL}"
        echo "VITE_API_BASE_URL=https://${BACKEND_URL}" > .env.production.local
    else
        log_error "Backend health check failed"
        exit 1
    fi
}

deploy_frontend() {
    log_info "Starting frontend deployment..."
    
    # Read backend URL from environment or prompt
    if [[ -f .env.production.local ]]; then
        source .env.production.local
        log_info "Using backend URL: ${VITE_API_BASE_URL}"
    else
        read -p "Enter backend URL (https://...): " VITE_API_BASE_URL
        echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production.local
    fi
    
    # Set environment variables
    export VITE_API_BASE_URL
    export VITE_LIFF_ID="2007349762-AJ9J432d"
    export NODE_ENV="production"
    
    # Build frontend
    log_info "Building frontend..."
    cd liff-profile-app
    pnpm install --frozen-lockfile
    pnpm build
    
    # Check if Static Web Apps deployment token exists
    if [[ -z "${AZURE_STATIC_WEB_APPS_API_TOKEN}" ]]; then
        log_warning "AZURE_STATIC_WEB_APPS_API_TOKEN not set"
        log_info "Please get the deployment token from Azure Portal:"
        log_info "Static Web Apps → ${FRONTEND_APP_NAME} → Overview → Manage deployment token"
        read -p "Enter deployment token: " AZURE_STATIC_WEB_APPS_API_TOKEN
        export AZURE_STATIC_WEB_APPS_API_TOKEN
    fi
    
    # Deploy using SWA CLI
    log_info "Deploying to Azure Static Web Apps..."
    npx @azure/static-web-apps-cli deploy ./dist \
        --deployment-token ${AZURE_STATIC_WEB_APPS_API_TOKEN} \
        --env production
    
    cd ..
    
    # Get frontend URL
    FRONTEND_URL=$(az staticwebapp show \
        --name ${FRONTEND_APP_NAME} \
        --query "defaultHostname" \
        --output tsv)
    
    log_success "Frontend deployed successfully!"
    log_success "Frontend URL: https://${FRONTEND_URL}"
    log_success "LIFF URL: https://liff.line.me/2007349762-AJ9J432d"
}

show_deployment_summary() {
    log_info "Deployment Summary:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ -f .env.production.local ]]; then
        source .env.production.local
        echo "🖥️  Backend:  ${VITE_API_BASE_URL}"
    fi
    
    FRONTEND_URL=$(az staticwebapp show \
        --name ${FRONTEND_APP_NAME} \
        --query "defaultHostname" \
        --output tsv 2>/dev/null || echo "Not found")
    
    echo "🌐 Frontend: https://${FRONTEND_URL}"
    echo "📱 LIFF:     https://liff.line.me/2007349762-AJ9J432d"
    echo "🐳 Version:  ${VERSION}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log_info "Next steps:"
    echo "1. Test the LIFF app in LINE"
    echo "2. Test the LINE Bot functionality"
    echo "3. Monitor logs in Azure Portal"
    echo "4. Update LINE Developers Console webhook URL if needed"
}

# Main script
main() {
    echo "🚀 AI Nutritionist Production Deployment"
    echo "======================================="
    
    DEPLOY_TARGET=${1:-all}
    
    case $DEPLOY_TARGET in
        backend)
            check_prerequisites
            deploy_backend
            ;;
        frontend)
            check_prerequisites
            deploy_frontend
            ;;
        all)
            check_prerequisites
            deploy_backend
            deploy_frontend
            show_deployment_summary
            ;;
        *)
            log_error "Invalid deployment target. Use: backend, frontend, or all"
            echo "Usage: $0 [backend|frontend|all]"
            exit 1
            ;;
    esac
    
    log_success "Deployment completed successfully! 🎉"
}

# Run the script
main "$@" 