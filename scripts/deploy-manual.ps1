# 🚀 AI Nutritionist Manual Deployment Script (PowerShell)
# ใช้สำหรับ deploy manual บน Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$Component = "all",  # all, backend, frontend
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests = $false
)

# Configuration
$RESOURCE_GROUP = "ai-nutritionist-rg"
$ACR_NAME = "ainutritionistacr"
$BACKEND_APP_NAME = "ai-nutritionist-backend"
$FRONTEND_APP_NAME = "ai-nutritionist-frontend"

# Colors
$RED = "`e[31m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$NC = "`e[0m"

function Write-Step {
    param($Message)
    Write-Host "📋 $Message" -ForegroundColor Blue
}

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Test-Prerequisites {
    Write-Step "ตรวจสอบความพร้อม..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js พบ: $nodeVersion"
    } catch {
        Write-Error-Custom "Node.js ไม่พบ กรุณาติดตั้งก่อน"
        exit 1
    }
    
    # Check pnpm
    try {
        $pnpmVersion = pnpm --version
        Write-Success "pnpm พบ: $pnpmVersion"
    } catch {
        Write-Error-Custom "pnpm ไม่พบ กรุณาติดตั้งก่อน: npm install -g pnpm"
        exit 1
    }
    
    # Check Azure CLI
    try {
        $azVersion = az --version | Select-String "azure-cli" | Select-Object -First 1
        Write-Success "Azure CLI พบ: $azVersion"
    } catch {
        Write-Error-Custom "Azure CLI ไม่พบ กรุณาติดตั้งก่อน"
        exit 1
    }
    
    # Check Docker (for backend)
    if ($Component -eq "all" -or $Component -eq "backend") {
        try {
            $dockerVersion = docker --version
            Write-Success "Docker พบ: $dockerVersion"
        } catch {
            Write-Error-Custom "Docker ไม่พบ กรุณาติดตั้งก่อน"
            exit 1
        }
    }
    
    # Check Azure login
    try {
        $account = az account show --output json | ConvertFrom-Json
        Write-Success "Azure เข้าสู่ระบบแล้ว: $($account.user.name)"
    } catch {
        Write-Error-Custom "กรุณาเข้าสู่ระบบ Azure: az login"
        exit 1
    }
}

function Install-Dependencies {
    if ($SkipBuild) {
        Write-Warning "ข้าม build process"
        return
    }
    
    Write-Step "ติดตั้ง dependencies..."
    
    # Install root dependencies
    Write-Step "ติดตั้ง root dependencies..."
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "ไม่สามารถติดตั้ง root dependencies ได้"
        exit 1
    }
    
    # Install frontend dependencies
    if ($Component -eq "all" -or $Component -eq "frontend") {
        Write-Step "ติดตั้ง frontend dependencies..."
        Set-Location "liff-nutrition-next"
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "ไม่สามารถติดตั้ง frontend dependencies ได้"
            exit 1
        }
        Set-Location ".."
    }
    
    Write-Success "ติดตั้ง dependencies เสร็จสิ้น"
}

function Run-Tests {
    if ($SkipTests) {
        Write-Warning "ข้าม tests"
        return
    }
    
    Write-Step "รัน tests..."
    
    # Backend tests
    if ($Component -eq "all" -or $Component -eq "backend") {
        Write-Step "รัน backend tests..."
        pnpm test
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Backend tests ล้มเหลว"
            exit 1
        }
        
        pnpm lint
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Backend lint ล้มเหลว"
            exit 1
        }
    }
    
    # Frontend tests
    if ($Component -eq "all" -or $Component -eq "frontend") {
        Write-Step "รัน frontend type check และ lint..."
        Set-Location "liff-nutrition-next"
        
        pnpm type-check
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Frontend type check ล้มเหลว"
            exit 1
        }
        
        pnpm lint
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Frontend lint ล้มเหลว"
            exit 1
        }
        
        Set-Location ".."
    }
    
    Write-Success "Tests ผ่านทั้งหมด"
}

function Deploy-Backend {
    Write-Step "Deploy Backend..."
    
    # Build Docker image
    Write-Step "Build Docker image..."
    $imageName = "$ACR_NAME.azurecr.io/ai-nutritionist-backend"
    $imageTag = Get-Date -Format "yyyyMMdd-HHmmss"
    $fullImageName = "${imageName}:${imageTag}"
    
    docker build -t $fullImageName .
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Docker build ล้มเหลว"
        exit 1
    }
    
    # Tag as latest
    docker tag $fullImageName "${imageName}:latest"
    
    # Login to ACR
    Write-Step "Login to Azure Container Registry..."
    az acr login --name $ACR_NAME
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "ACR login ล้มเหลว"
        exit 1
    }
    
    # Push images
    Write-Step "Push Docker images..."
    docker push $fullImageName
    docker push "${imageName}:latest"
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Docker push ล้มเหลว"
        exit 1
    }
    
    # Update Container App
    Write-Step "Update Container App..."
    az containerapp update `
        --name $BACKEND_APP_NAME `
        --resource-group $RESOURCE_GROUP `
        --image $fullImageName `
        --revision-suffix "manual-$imageTag"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Container App update ล้มเหลว"
        exit 1
    }
    
    # Get backend URL
    $backendUrl = az containerapp show `
        --name $BACKEND_APP_NAME `
        --resource-group $RESOURCE_GROUP `
        --query properties.configuration.ingress.fqdn `
        --output tsv
    
    Write-Success "Backend deploy เสร็จสิ้น"
    Write-Host "🌐 Backend URL: https://$backendUrl" -ForegroundColor Cyan
}

function Deploy-Frontend {
    Write-Step "Deploy Frontend..."
    
    # Build frontend
    Write-Step "Build frontend..."
    Set-Location "liff-nutrition-next"
    
    # Set environment variables
    $env:NODE_ENV = "production"
    $env:NEXT_PUBLIC_VERSION = Get-Date -Format "yyyyMMdd-HHmmss"
    
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Frontend build ล้มเหลว"
        exit 1
    }
    
    Set-Location ".."
    
    Write-Success "Frontend build เสร็จสิ้น"
    Write-Warning "สำหรับ Static Web Apps deployment, กรุณาใช้ GitHub Actions หรือ Azure Static Web Apps CLI"
    Write-Host "📋 คำสั่งสำหรับ manual deploy:" -ForegroundColor Cyan
    Write-Host "npx @azure/static-web-apps-cli deploy --app-location liff-nutrition-next --output-location .next --deployment-token `$AZURE_STATIC_WEB_APPS_API_TOKEN" -ForegroundColor Gray
}

function Show-Summary {
    Write-Step "สรุปการ deploy..."
    
    Write-Host ""
    Write-Host "🎉 Deployment Summary" -ForegroundColor Green
    Write-Host "=====================" -ForegroundColor Green
    
    if ($Component -eq "all" -or $Component -eq "backend") {
        $backendUrl = az containerapp show `
            --name $BACKEND_APP_NAME `
            --resource-group $RESOURCE_GROUP `
            --query properties.configuration.ingress.fqdn `
            --output tsv
        
        Write-Host "🔧 Backend: https://$backendUrl" -ForegroundColor Cyan
    }
    
    if ($Component -eq "all" -or $Component -eq "frontend") {
        try {
            $frontendUrl = az staticwebapp show `
                --name $FRONTEND_APP_NAME `
                --resource-group $RESOURCE_GROUP `
                --query defaultHostname `
                --output tsv
            
            Write-Host "🌐 Frontend: https://$frontendUrl" -ForegroundColor Cyan
        } catch {
            Write-Host "🌐 Frontend: Manual deployment required" -ForegroundColor Yellow
        }
    }
    
    Write-Host "📅 Deployed at: $(Get-Date)" -ForegroundColor Gray
    Write-Host ""
}

# Main execution
Write-Host "🚀 AI Nutritionist Manual Deployment" -ForegroundColor Blue
Write-Host "====================================" -ForegroundColor Blue
Write-Host "Component: $Component" -ForegroundColor Gray
Write-Host "Environment: $Environment" -ForegroundColor Gray
Write-Host ""

try {
    Test-Prerequisites
    Install-Dependencies
    Run-Tests
    
    if ($Component -eq "all" -or $Component -eq "backend") {
        Deploy-Backend
    }
    
    if ($Component -eq "all" -or $Component -eq "frontend") {
        Deploy-Frontend
    }
    
    Show-Summary
    
    Write-Success "🎉 Deployment เสร็จสิ้น!"
    
} catch {
    Write-Error-Custom "❌ Deployment ล้มเหลว: $($_.Exception.Message)"
    exit 1
} 