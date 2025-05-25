#!/bin/bash

# 🚀 Azure Infrastructure Setup Script for AI Nutritionist
# This script sets up all required Azure resources

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="ai-nutritionist-rg"
LOCATION="Southeast Asia"
COSMOS_ACCOUNT="ai-nutritionist-cosmos"
STORAGE_ACCOUNT="ainutritioniststorage"
OPENAI_ACCOUNT="ai-nutritionist-openai"
OPENAI_LOCATION="East US 2"
ACR_NAME="ainutritionistacr"
CONTAINER_ENV="ai-nutritionist-env"
BACKEND_APP="ai-nutritionist-backend"
FRONTEND_APP="ai-nutritionist-frontend"
KEY_VAULT="ai-nutritionist-kv"
APP_INSIGHTS="ai-nutritionist-insights"

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

check_az_cli() {
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    log_success "Azure CLI is available"
}

check_login() {
    if ! az account show &> /dev/null; then
        log_warning "Not logged in to Azure. Logging in..."
        az login
    fi
    
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    log_success "Logged in to Azure subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
}

create_resource_group() {
    log_info "Creating resource group: $RESOURCE_GROUP"
    
    if az group show --name $RESOURCE_GROUP &> /dev/null; then
        log_warning "Resource group $RESOURCE_GROUP already exists"
    else
        az group create \
            --name $RESOURCE_GROUP \
            --location "$LOCATION"
        log_success "Resource group created"
    fi
}

create_cosmos_db() {
    log_info "Creating Cosmos DB: $COSMOS_ACCOUNT"
    
    if az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "Cosmos DB $COSMOS_ACCOUNT already exists"
    else
        az cosmosdb create \
            --resource-group $RESOURCE_GROUP \
            --name $COSMOS_ACCOUNT \
            --kind MongoDB \
            --server-version 4.2 \
            --default-consistency-level Session \
            --locations regionName="$LOCATION" failoverPriority=0 isZoneRedundant=False
        
        # Create database
        az cosmosdb mongodb database create \
            --account-name $COSMOS_ACCOUNT \
            --resource-group $RESOURCE_GROUP \
            --name aifood
        
        log_success "Cosmos DB created"
    fi
    
    # Get connection string
    COSMOS_CONNECTION=$(az cosmosdb keys list \
        --resource-group $RESOURCE_GROUP \
        --name $COSMOS_ACCOUNT \
        --type connection-strings \
        --query "connectionStrings[0].connectionString" -o tsv)
    
    echo "COSMOS_CONNECTION_STRING=$COSMOS_CONNECTION" >> .env.azure
}

create_storage_account() {
    log_info "Creating Storage Account: $STORAGE_ACCOUNT"
    
    if az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "Storage account $STORAGE_ACCOUNT already exists"
    else
        az storage account create \
            --name $STORAGE_ACCOUNT \
            --resource-group $RESOURCE_GROUP \
            --location "$LOCATION" \
            --sku Standard_LRS
        
        # Create container
        az storage container create \
            --name food-images \
            --account-name $STORAGE_ACCOUNT \
            --public-access blob
        
        log_success "Storage account created"
    fi
    
    # Get connection string
    STORAGE_CONNECTION=$(az storage account show-connection-string \
        --resource-group $RESOURCE_GROUP \
        --name $STORAGE_ACCOUNT \
        --query connectionString -o tsv)
    
    echo "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION" >> .env.azure
}

create_openai_service() {
    log_info "Creating Azure OpenAI Service: $OPENAI_ACCOUNT"
    
    if az cognitiveservices account show --name $OPENAI_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "OpenAI service $OPENAI_ACCOUNT already exists"
    else
        az cognitiveservices account create \
            --name $OPENAI_ACCOUNT \
            --resource-group $RESOURCE_GROUP \
            --location "$OPENAI_LOCATION" \
            --kind OpenAI \
            --sku S0 \
            --custom-domain $OPENAI_ACCOUNT
        
        log_success "Azure OpenAI service created"
    fi
    
    # Deploy models (note: these might need approval)
    log_info "Deploying OpenAI models..."
    
    # GPT-4
    az cognitiveservices account deployment create \
        --resource-group $RESOURCE_GROUP \
        --name $OPENAI_ACCOUNT \
        --deployment-name gpt-4-1 \
        --model-name gpt-4 \
        --model-version "1106-Preview" \
        --model-format OpenAI \
        --sku-capacity 20 \
        --sku-name Standard || log_warning "GPT-4 deployment failed (might need approval)"
    
    # Text Embedding
    az cognitiveservices account deployment create \
        --resource-group $RESOURCE_GROUP \
        --name $OPENAI_ACCOUNT \
        --deployment-name text-embedding-3-small \
        --model-name text-embedding-3-small \
        --model-version "1" \
        --model-format OpenAI \
        --sku-capacity 20 \
        --sku-name Standard || log_warning "Embedding deployment failed (might need approval)"
    
    OPENAI_ENDPOINT="https://$OPENAI_ACCOUNT.openai.azure.com/"
    echo "AZURE_OPENAI_ENDPOINT=$OPENAI_ENDPOINT" >> .env.azure
}

create_container_registry() {
    log_info "Creating Azure Container Registry: $ACR_NAME"
    
    if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "ACR $ACR_NAME already exists"
    else
        az acr create \
            --resource-group $RESOURCE_GROUP \
            --name $ACR_NAME \
            --sku Basic \
            --admin-enabled true
        
        log_success "Container Registry created"
    fi
    
    # Get credentials
    ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
    
    echo "ACR_USERNAME=$ACR_USERNAME" >> .env.azure
    echo "ACR_PASSWORD=$ACR_PASSWORD" >> .env.azure
}

create_service_principal() {
    log_info "Creating Service Principal for authentication"
    
    SP_OUTPUT=$(az ad sp create-for-rbac \
        --name "ai-nutritionist-sp" \
        --role "Contributor" \
        --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
        --sdk-auth)
    
    CLIENT_ID=$(echo $SP_OUTPUT | jq -r '.clientId')
    CLIENT_SECRET=$(echo $SP_OUTPUT | jq -r '.clientSecret')
    TENANT_ID=$(echo $SP_OUTPUT | jq -r '.tenantId')
    
    echo "AZURE_CLIENT_ID=$CLIENT_ID" >> .env.azure
    echo "AZURE_CLIENT_SECRET=$CLIENT_SECRET" >> .env.azure
    echo "AZURE_TENANT_ID=$TENANT_ID" >> .env.azure
    
    # Assign additional roles
    log_info "Assigning additional roles to Service Principal"
    
    # OpenAI User role
    az role assignment create \
        --assignee $CLIENT_ID \
        --role "Cognitive Services OpenAI User" \
        --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$OPENAI_ACCOUNT
    
    # Storage Blob Data Contributor
    az role assignment create \
        --assignee $CLIENT_ID \
        --role "Storage Blob Data Contributor" \
        --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT
    
    log_success "Service Principal created and roles assigned"
}

create_key_vault() {
    log_info "Creating Azure Key Vault: $KEY_VAULT"
    
    if az keyvault show --name $KEY_VAULT --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "Key Vault $KEY_VAULT already exists"
    else
        az keyvault create \
            --name $KEY_VAULT \
            --resource-group $RESOURCE_GROUP \
            --location "$LOCATION"
        
        log_success "Key Vault created"
    fi
}

create_app_insights() {
    log_info "Creating Application Insights: $APP_INSIGHTS"
    
    if az monitor app-insights component show --app $APP_INSIGHTS --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "Application Insights $APP_INSIGHTS already exists"
    else
        az monitor app-insights component create \
            --app $APP_INSIGHTS \
            --location "$LOCATION" \
            --resource-group $RESOURCE_GROUP \
            --kind web
        
        log_success "Application Insights created"
    fi
    
    INSTRUMENTATION_KEY=$(az monitor app-insights component show \
        --app $APP_INSIGHTS \
        --resource-group $RESOURCE_GROUP \
        --query instrumentationKey -o tsv)
    
    echo "APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY" >> .env.azure
}

create_container_apps_environment() {
    log_info "Creating Container Apps Environment: $CONTAINER_ENV"
    
    if az containerapp env show --name $CONTAINER_ENV --resource-group $RESOURCE_GROUP &> /dev/null; then
        log_warning "Container Apps Environment $CONTAINER_ENV already exists"
    else
        az containerapp env create \
            --name $CONTAINER_ENV \
            --resource-group $RESOURCE_GROUP \
            --location "$LOCATION"
        
        log_success "Container Apps Environment created"
    fi
}

print_summary() {
    log_success "🎉 Azure infrastructure setup completed!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Review the generated .env.azure file"
    echo "2. Update your .env file with the new values"
    echo "3. Deploy your application using the provided commands"
    echo "4. Configure LINE Bot webhook and LIFF app URLs"
    echo ""
    echo "🔗 Useful URLs:"
    echo "- Azure Portal: https://portal.azure.com"
    echo "- LINE Developers Console: https://developers.line.biz/console/"
    echo ""
    echo "📁 Generated files:"
    echo "- .env.azure (contains all connection strings and secrets)"
}

# Main execution
main() {
    log_info "🚀 Starting Azure infrastructure setup for AI Nutritionist"
    
    # Create .env.azure file
    echo "# Generated Azure environment variables" > .env.azure
    echo "# Generated on: $(date)" >> .env.azure
    echo "" >> .env.azure
    
    check_az_cli
    check_login
    create_resource_group
    create_cosmos_db
    create_storage_account
    create_openai_service
    create_container_registry
    create_service_principal
    create_key_vault
    create_app_insights
    create_container_apps_environment
    
    print_summary
}

# Run the main function
main "$@" 