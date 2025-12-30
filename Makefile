.PHONY: help install dev build start clean test lint format docker docs secrets

# Default target
.DEFAULT_GOAL := help

##@ Help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Dependencies

install: ## Install project dependencies
	@echo "📦 Installing dependencies..."
	npm ci
	@echo "✅ Dependencies installed"

install-dev: ## Install dependencies (including devDependencies)
	@echo "📦 Installing all dependencies..."
	npm install
	@echo "✅ All dependencies installed"

clean: ## Clean generated files and dependencies
	@echo "🧹 Cleaning..."
	rm -rf node_modules dist coverage .vitest perf-results
	@echo "✅ Cleaned"

##@ Development

dev: ## Start development server with watch mode
	@echo "🚀 Starting development server..."
	npm run dev

worker: ## Start worker in development mode
	@echo "👷 Starting worker..."
	npm run worker

scheduler: ## Start scheduler in development mode
	@echo "⏰ Starting scheduler..."
	npm run scheduler

##@ Building

build: ## Build production bundle
	@echo "🔨 Building..."
	npm run build
	@echo "✅ Build complete"

typecheck: ## Run TypeScript type checking
	@echo "🔍 Type checking..."
	npm run typecheck

##@ Testing

test: ## Run all tests
	@echo "🧪 Running all tests..."
	npm run test

test-unit: ## Run unit tests
	@echo "🧪 Running unit tests..."
	npm run test:unit

test-integration: ## Run integration tests
	@echo "🧪 Running integration tests..."
	npm run test:integration

test-e2e: ## Run end-to-end tests
	@echo "🧪 Running E2E tests..."
	npm run test:e2e

test-coverage: ## Run tests with coverage
	@echo "📊 Running tests with coverage..."
	npm run test:coverage

test-coverage-all: ## Run all tests with coverage
	@echo "📊 Running all test suites with coverage..."
	npm run test:coverage:all

test-watch: ## Run tests in watch mode
	@echo "👀 Running tests in watch mode..."
	npm run test:watch

test-ui: ## Open Vitest UI
	@echo "🎨 Opening Vitest UI..."
	npm run test:ui

##@ Performance Testing

perf: ## Run all k6 performance tests
	@echo "⚡ Running all k6 performance tests..."
	npm run perf:all

perf-api: ## Run API load tests
	@echo "⚡ Running API load tests..."
	npm run perf:k6:api

perf-scheduler: ## Run scheduler load tests
	@echo "⚡ Running scheduler load tests..."
	npm run perf:k6:scheduler

perf-worker: ## Run worker throughput tests
	@echo "⚡ Running worker throughput tests..."
	npm run perf:k6:worker-throughput

perf-e2e: ## Run E2E load tests
	@echo "⚡ Running E2E load tests..."
	npm run perf:k6:e2e

perf-report: ## Generate performance report
	@echo "📊 Generating performance report..."
	npm run perf:report

##@ Code Quality

lint: ## Run ESLint
	@echo "🔍 Linting..."
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	@echo "🔧 Fixing lint issues..."
	npm run lint:fix

format: ## Format code with Prettier
	@echo "💅 Formatting code..."
	npm run format

format-check: ## Check code formatting
	@echo "🔍 Checking code formatting..."
	npm run format:check

quality: typecheck lint format-check ## Run all quality checks
	@echo "✅ All quality checks passed"

##@ Database

db-generate: ## Generate database migrations
	@echo "📝 Generating migrations..."
	npm run db:generate

db-migrate: ## Run database migrations
	@echo "🔄 Running migrations..."
	npm run db:migrate

db-push: ## Push schema changes to database
	@echo "⬆️  Pushing schema changes..."
	npm run db:push

db-studio: ## Open Drizzle Studio
	@echo "🎨 Opening Drizzle Studio..."
	npm run db:studio

db-create-partitions: ## Create next month's partitions (run monthly)
	@echo "📊 Creating database partitions..."
	bash scripts/create-partitions.sh
	@echo "✅ Partitions created"

db-partitions-status: ## Show partition status and sizes
	@echo "📊 Partition Status:"
	@psql $$DATABASE_URL -c "SELECT tablename AS partition, pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size, n_live_tup AS rows FROM pg_stat_user_tables WHERE tablename LIKE 'message_logs_%' ORDER BY tablename DESC;"

##@ Docker - Development

docker-dev: ## Start development environment (Postgres + RabbitMQ + Redis)
	@echo "🐳 Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment started"

docker-dev-down: ## Stop development environment
	@echo "🛑 Stopping development environment..."
	docker-compose -f docker-compose.dev.yml down
	@echo "✅ Development environment stopped"

docker-dev-logs: ## Show development environment logs
	docker-compose -f docker-compose.dev.yml logs -f

##@ Docker - Testing

docker-test: ## Start test environment
	@echo "🐳 Starting test environment..."
	npm run docker:test
	@echo "✅ Test environment started"

docker-test-down: ## Stop test environment
	@echo "🛑 Stopping test environment..."
	npm run docker:test:down
	@echo "✅ Test environment stopped"

docker-perf: ## Start performance test environment
	@echo "🐳 Starting performance test environment..."
	npm run docker:perf
	@echo "✅ Performance test environment started"

docker-perf-down: ## Stop performance test environment
	@echo "🛑 Stopping performance test environment..."
	npm run docker:perf:down
	@echo "✅ Performance test environment stopped"

##@ Secrets Management (SOPS)

secrets-encrypt: ## Encrypt all environment files
	@echo "🔐 Encrypting all environment files..."
	bash scripts/sops/encrypt.sh
	@echo "✅ All environment files encrypted"

secrets-decrypt: ## Decrypt all environment files
	@echo "🔓 Decrypting all environment files..."
	bash scripts/sops/decrypt.sh
	@echo "✅ All environment files decrypted"

secrets-edit: ## Edit encrypted environment files
	@echo "✏️  Opening encrypted environment files in editor..."
	bash scripts/sops/edit.sh

secrets-view: ## View encrypted environment files (read-only)
	@echo "👀 Viewing encrypted environment files..."
	bash scripts/sops/view.sh

secrets-encrypt-dev: ## Encrypt development environment file
	@echo "🔐 Encrypting development environment..."
	bash scripts/sops/encrypt.sh development
	@echo "✅ Development environment encrypted"

secrets-decrypt-dev: ## Decrypt development environment file
	@echo "🔓 Decrypting development environment..."
	bash scripts/sops/decrypt.sh development
	@echo "✅ Development environment decrypted"

secrets-encrypt-test: ## Encrypt test environment file
	@echo "🔐 Encrypting test environment..."
	bash scripts/sops/encrypt.sh test
	@echo "✅ Test environment encrypted"

secrets-decrypt-test: ## Decrypt test environment file
	@echo "🔓 Decrypting test environment..."
	bash scripts/sops/decrypt.sh test
	@echo "✅ Test environment decrypted"


##@ OpenAPI

openapi-generate: ## Generate OpenAPI client from vendor spec
	@echo "🔧 Generating OpenAPI client..."
	npm run openapi:generate
	@echo "✅ OpenAPI client generated"

openapi-validate: ## Validate OpenAPI spec
	@echo "🔍 Validating OpenAPI spec..."
	npm run openapi:validate

openapi-lint: ## Lint OpenAPI spec
	@echo "🔍 Linting OpenAPI spec..."
	npm run openapi:lint

openapi-export: ## Export OpenAPI spec to JSON
	@echo "📤 Exporting OpenAPI spec..."
	npm run openapi:export

openapi-all: ## Run all OpenAPI operations
	@echo "🔧 Running all OpenAPI operations..."
	npm run openapi:all

##@ Monitoring

metrics: ## View Prometheus metrics
	@echo "📊 Opening metrics endpoint..."
	@echo "Visit: http://localhost:9090/metrics"

##@ Common Workflows

setup: install docker-dev db-migrate secrets-decrypt-dev ## Complete setup for new developers
	@echo ""
	@echo "✅ Setup complete! You can now run:"
	@echo "   make dev        # Start API server"
	@echo "   make worker     # Start worker"
	@echo "   make scheduler  # Start scheduler"

start: ## Start all services (API + worker + scheduler)
	@echo "🚀 Starting all services..."
	@echo "⚠️  Note: Run these in separate terminals:"
	@echo "   Terminal 1: make dev"
	@echo "   Terminal 2: make worker"
	@echo "   Terminal 3: make scheduler"

verify: typecheck lint test-coverage ## Run all verification checks
	@echo "✅ All verification checks passed"

ci: install quality test-coverage ## Run CI pipeline locally
	@echo "✅ CI pipeline completed successfully"

pre-commit: quality test-unit ## Run pre-commit checks
	@echo "✅ Pre-commit checks passed"

pre-push: quality test-coverage ## Run pre-push checks
	@echo "✅ Pre-push checks passed"

##@ Deployment

deploy-prep: clean install build verify ## Prepare for deployment
	@echo "✅ Deployment preparation complete"

##@ Documentation

docs: ## Open API documentation
	@echo "📚 API documentation available at: http://localhost:3000/docs"
	@echo "⚠️  Note: Server must be running (make dev)"

docs-vendor: ## Open vendor API documentation
	@echo "📚 Vendor API documentation: https://email-service.digitalenvision.com.au/api-docs/"
	@command -v open >/dev/null 2>&1 && open https://email-service.digitalenvision.com.au/api-docs/ || echo "Visit: https://email-service.digitalenvision.com.au/api-docs/"

##@ Utility

env-example: ## Create .env from .env.example
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env from .env.example"; \
		echo "⚠️  Update the values in .env before running"; \
	else \
		echo "⚠️  .env already exists"; \
	fi

health: ## Check health of all services
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:3000/health | jq . || echo "❌ API not responding"
	@curl -s http://localhost:9090/metrics > /dev/null && echo "✅ Metrics endpoint healthy" || echo "❌ Metrics endpoint not responding"

reset: clean docker-dev-down docker-test-down docker-perf-down ## Reset everything to clean state
	@echo "🔄 Resetting to clean state..."
	rm -rf .env.*.dec
	@echo "✅ Reset complete"

##@ Information

status: ## Show status of running services
	@echo "📊 Service Status:"
	@docker-compose -f docker-compose.dev.yml ps 2>/dev/null || echo "❌ Development environment not running"
	@echo ""
	@docker-compose -f docker-compose.test.yml ps 2>/dev/null || echo "ℹ️  Test environment not running"
	@echo ""
	@docker-compose -f docker-compose.perf.yml ps 2>/dev/null || echo "ℹ️  Performance environment not running"

version: ## Show version information
	@echo "📦 Version Information:"
	@echo "Node: $$(node --version)"
	@echo "NPM: $$(npm --version)"
	@echo "TypeScript: $$(npx tsc --version)"
	@echo "Docker: $$(docker --version)"
	@echo "Docker Compose: $$(docker-compose --version)"

info: ## Show project information
	@echo "📖 Birthday Message Scheduler"
	@echo ""
	@echo "🎯 Purpose: Send happy birthday messages at 9am local time"
	@echo "🏗️  Architecture: Fastify API + PostgreSQL + RabbitMQ + Workers"
	@echo "📚 Documentation: ./plan/README.md"
	@echo "🔐 Requirements: ./REQUIREMENTS_VERIFICATION.md"
	@echo ""
	@echo "📋 Quick Start:"
	@echo "  1. make setup         # One-time setup"
	@echo "  2. make dev           # Start API (Terminal 1)"
	@echo "  3. make worker        # Start worker (Terminal 2)"
	@echo "  4. make scheduler     # Start scheduler (Terminal 3)"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test            # Run all tests"
	@echo "  make perf            # Run performance tests"
	@echo ""
	@echo "📚 Documentation:"
	@echo "  make docs            # API docs (Swagger UI)"
	@echo "  make docs-vendor     # Vendor API docs"
