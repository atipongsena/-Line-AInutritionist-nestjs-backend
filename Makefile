# Makefile for AI Nutritionist Docker Commands

.PHONY: help build run stop clean logs shell dev prod compose-up compose-down

# Default target
help:
	@echo "🐳 AI Nutritionist Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev         - Start development environment with Docker Compose"
	@echo "  make dev-build   - Build development image"
	@echo "  make dev-run     - Run development container"
	@echo ""
	@echo "Production:"
	@echo "  make prod        - Build production image"
	@echo "  make prod-run    - Run production container"
	@echo ""
	@echo "Docker Compose:"
	@echo "  make compose-up   - Start all services with docker-compose"
	@echo "  make compose-down - Stop all services"
	@echo "  make compose-logs - View logs from all services"
	@echo ""
	@echo "Production Deployment:"
	@echo "  make deploy-production - Deploy full app to production"
	@echo "  make deploy-backend    - Deploy only backend"
	@echo "  make deploy-frontend   - Deploy only frontend"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs        - View backend container logs"
	@echo "  make shell       - Open shell in backend container"
	@echo "  make clean       - Remove all containers and images"
	@echo "  make push        - Build and push to Azure ACR"

# Development commands
dev-build:
	@echo "🔨 Building development image..."
	docker build --target development -t ai-nutritionist-dev .

dev-run: dev-build
	@echo "🚀 Running development container..."
	docker run -p 3000:3000 --env-file .env \
		-v $$(pwd)/src:/app/src \
		--name ai-nutritionist-dev-container \
		ai-nutritionist-dev

dev: dev-build
	@echo "🚀 Starting development environment..."
	docker run -d -p 3000:3000 --env-file .env \
		-v $$(pwd)/src:/app/src \
		--name ai-nutritionist-dev-container \
		ai-nutritionist-dev
	@echo "✅ Development server running at http://localhost:3000"

# Production commands
prod:
	@echo "🏭 Building production image..."
	docker build -t ai-nutritionist-backend .

prod-run: prod
	@echo "🚀 Running production container..."
	docker run -d -p 3000:3000 --env-file .env.production \
		--name ai-nutritionist-prod-container \
		ai-nutritionist-backend
	@echo "✅ Production server running at http://localhost:3000"

# Docker Compose commands
compose-up:
	@echo "🚀 Starting all services with Docker Compose..."
	docker-compose up -d
	@echo "✅ All services started!"
	@echo "🌐 Backend: http://localhost:3000"
	@echo "🌐 Frontend: http://localhost:3001"
	@echo "🗄️ MongoDB: localhost:27017"
	@echo "🔴 Redis: localhost:6379"

compose-down:
	@echo "🛑 Stopping all services..."
	docker-compose down

compose-logs:
	@echo "📝 Viewing logs from all services..."
	docker-compose logs -f

compose-build:
	@echo "🔨 Building all services..."
	docker-compose build

# Utility commands
logs:
	@echo "📝 Viewing backend logs..."
	@docker logs -f ai-nutritionist-dev-container 2>/dev/null || \
	 docker logs -f ai-nutritionist-prod-container 2>/dev/null || \
	 echo "❌ No running container found"

shell:
	@echo "🐚 Opening shell in backend container..."
	@docker exec -it ai-nutritionist-dev-container /bin/sh 2>/dev/null || \
	 docker exec -it ai-nutritionist-prod-container /bin/sh 2>/dev/null || \
	 echo "❌ No running container found"

stop:
	@echo "🛑 Stopping containers..."
	@docker stop ai-nutritionist-dev-container 2>/dev/null || echo "Dev container not running"
	@docker stop ai-nutritionist-prod-container 2>/dev/null || echo "Prod container not running"

clean: stop
	@echo "🧹 Cleaning up containers and images..."
	@docker rm ai-nutritionist-dev-container 2>/dev/null || echo "Dev container already removed"
	@docker rm ai-nutritionist-prod-container 2>/dev/null || echo "Prod container already removed"
	@docker rmi ai-nutritionist-dev 2>/dev/null || echo "Dev image not found"
	@docker rmi ai-nutritionist-backend 2>/dev/null || echo "Prod image not found"
	@echo "✅ Cleanup completed"

# Production deployment commands
deploy-backend:
	@echo "🚀 Deploying backend to production..."
	@bash ./scripts/deploy-production.sh backend

deploy-frontend:
	@echo "🚀 Deploying frontend to production..."
	@bash ./scripts/deploy-production.sh frontend

deploy-production:
	@echo "🚀 Deploying full application to production..."
	@bash ./scripts/deploy-production.sh all

# Azure commands
push: prod
	@echo "☁️ Building and pushing to Azure Container Registry..."
	docker tag ai-nutritionist-backend kingeng.azurecr.io/ai-nutritionist-backend:latest
	az acr login --name kingeng
	docker push kingeng.azurecr.io/ai-nutritionist-backend:latest
	@echo "✅ Images pushed to Azure ACR"

# Health check
health:
	@echo "🏥 Checking container health..."
	@curl -f http://localhost:3000/ || echo "❌ Backend health check failed"

# Status check
status:
	@echo "📊 Docker Status:"
	@echo ""
	@echo "Running Containers:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "Images:"
	@docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep ai-nutritionist || echo "No AI Nutritionist images found" 