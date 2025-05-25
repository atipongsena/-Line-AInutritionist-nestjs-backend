#!/bin/bash

# 🚀 Update Azure Container App Script
# อัปเดต Container App ด้วย image และ environment variables ที่ถูกต้อง

set -e

# Variables
RESOURCE_GROUP="kin-geng-openai"
CONTAINER_APP_NAME="ai-nutritionist-backend"
ACR_NAME="kingeng"
IMAGE_NAME="ai-nutritionist-backend:latest"
FULL_IMAGE_NAME="$ACR_NAME.azurecr.io/$IMAGE_NAME"

echo "🔄 Updating Container App: $CONTAINER_APP_NAME"
echo "📦 Image: $FULL_IMAGE_NAME"

# Get ACR credentials
echo "🔐 Getting ACR credentials..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv)

echo "✅ ACR Username: $ACR_USERNAME"

# Update Container App with image and environment variables
echo "🚀 Updating Container App..."

az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $FULL_IMAGE_NAME \
  --registry-server "$ACR_NAME.azurecr.io" \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --cpu 1.0 \
  --memory 2Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="mongodb+srv://bosskingza1:GgUizCSwy5sN4eS@ai-nutritionist.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000" \
    AZURE_OPENAI_ENDPOINT="https://kinge-m9yh57s3-eastus2.cognitiveservices.azure.com/" \
    AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1="gpt-4.1" \
    AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI="gpt-4.1-mini" \
    AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO="gpt-4.1-nano" \
    AZURE_OPENAI_API_VERSION="2025-04-01-preview" \
    AZURE_OPENAI_EMBEDDING_API_VERSION="2025-04-01-preview" \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME="text-embedding-3-small" \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=kingengai;AccountKey=w3bP7kSF+EgSmLi4v5AAq1igLebXGRJyAXP1VlkVqM4Goykrvq/MhVdN7+tSDM+HR3wGqqnBbJ6N+AStLpLUXQ==;EndpointSuffix=core.windows.net" \
    AZURE_STORAGE_CONTAINER_NAME="food-images" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=94eb111a-bec8-4c3c-87d3-05dbe755523c;IngestionEndpoint=https://southeastasia-1.in.applicationinsights.azure.com/;LiveEndpoint=https://southeastasia.livediagnostics.monitor.azure.com/;ApplicationId=94bf548e-8f59-449f-9b23-b791dbe323f5" \
    LINE_CHANNEL_ACCESS_TOKEN="azzTtOXYOda5WPRYGbqza/S9hlPDFc8eO9i62EQrPxHJ1UMTnj90hzpMRD5cRg2M3h79P53M86RxeVCt20vQq4qWdIP+qNXvhV9/FCyNbWV96l6Uhyjc1f6V8LAh3FzathK4por0mY5HqjOgWg4plwdB04t89/1O/w1cDnyilFU=" \
    LINE_CHANNEL_SECRET="7abe98f2adb591fbf8613453bc9b801b" \
    LINE_CONSOLE_CHANNEL_ID="2007349762" \
    LIFF_APPLICATION_ID="2007349762-AJ9J432d" \
    LIFF_ID_FOOD_REPORT="2007349762-AJ9J432d" \
    BACKEND_URL="https://ai-nutritionist-backend.wittyground-3784ecfe.southeastasia.azurecontainerapps.io" \
    FRONTEND_URL="https://salmon-pond-09f432200.6.azurestaticapps.net"

echo "✅ Container App updated successfully!"

# Check status
echo "🔍 Checking Container App status..."
STATUS=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.runningStatus" --output tsv)
IMAGE=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.template.containers[0].image" --output tsv)
FQDN=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" --output tsv)

echo "📊 Status: $STATUS"
echo "📦 Image: $IMAGE"  
echo "🌐 URL: https://$FQDN"

echo "�� Update completed!" 