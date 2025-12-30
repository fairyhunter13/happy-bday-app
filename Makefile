# Birthday Message Scheduler - Makefile
# Convenient shortcuts for common tasks

.PHONY: help install docker-up docker-down db-migrate db-seed db-reset dev build test clean

# Default target
help:
	@echo "Birthday Message Scheduler - Available Commands:"
	@echo ""
	@echo "  make install       - Install dependencies"
	@echo "  make docker-up     - Start Docker services (PostgreSQL, RabbitMQ, Redis)"
	@echo "  make docker-down   - Stop Docker services"
	@echo "  make docker-logs   - View Docker logs"
	@echo ""
	@echo "  make db-migrate    - Run database migrations"
	@echo "  make db-seed       - Seed test data"
	@echo "  make db-reset      - Reset database (drops all data)"
	@echo "  make db-studio     - Open Drizzle Studio"
	@echo ""
	@echo "  make dev           - Start development server"
	@echo "  make build         - Build TypeScript"
	@echo "  make start         - Start production server"
	@echo ""
	@echo "  make test          - Run all tests"
	@echo "  make test-watch    - Run tests in watch mode"
	@echo "  make lint          - Run ESLint"
	@echo "  make format        - Format code with Prettier"
	@echo ""
	@echo "  make clean         - Remove build artifacts"
	@echo "  make setup         - Complete setup (docker + migrate + seed)"

# Install dependencies
install:
	npm install

# Docker commands
docker-up:
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	docker-compose ps

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-reset:
	docker-compose down -v
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5

# Database commands
db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

db-reset: docker-reset
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	npm run db:migrate
	npm run db:seed

db-studio:
	npm run db:studio

# Development
dev:
	npm run dev

build:
	npm run build

start:
	npm run start

# Testing
test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

# Code quality
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

# Cleanup
clean:
	rm -rf dist node_modules/.cache

clean-all: clean
	rm -rf node_modules

# Complete setup
setup: install docker-up db-migrate db-seed
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Services running:"
	@echo "  - PostgreSQL: localhost:5432"
	@echo "  - RabbitMQ: localhost:5672 (Management UI: http://localhost:15672)"
	@echo "  - Redis: localhost:6379"
	@echo "  - PgAdmin: http://localhost:5050"
	@echo ""
	@echo "Next steps:"
	@echo "  - Run 'make dev' to start development server"
	@echo "  - Run 'make db-studio' to open Drizzle Studio"
	@echo "  - Run 'make test' to run tests"

# Partition management
create-partitions:
	tsx scripts/create-partitions.ts 24

drop-old-partitions:
	tsx scripts/drop-old-partitions.ts 6
