# Contributing to Birthday Message Scheduler

Thank you for your interest in contributing to the Birthday Message Scheduler! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
```bash
   git clone https://github.com/YOUR-USERNAME/happy-bday-app.git
   cd happy-bday-app
   ```
3. **Add upstream remote**:
```bash
   git remote add upstream https://github.com/fairyhunter13/happy-bday-app.git
   ```

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker and Docker Compose
- age (for SOPS secret management)

### Setup Steps

1. **Install dependencies**:
```bash
   npm install
   ```

2. **Setup SOPS** (for secrets management):
```
   # See docs/DEVELOPER_SETUP.md for detailed instructions
   age-keygen -o ~/.config/sops/age/keys.txt
   ```

3. **Decrypt development secrets**:
```bash
   npm run secrets:decrypt:dev
   ```

4. **Start development environment**:
```
   docker-compose -f docker-compose.dev.yml up -d
   ```

5. **Run database migrations**:
```bash
   npm run db:migrate
   ```

6. **Start the development server**:
```bash
   npm run dev
   ```

## Making Changes

### Branch Naming Convention

Use descriptive branch names:

- `feature/` - New features (e.g., `feature/add-anniversary-messages`)
- `fix/` - Bug fixes (e.g., `fix/timezone-calculation`)
- `docs/` - Documentation changes (e.g., `docs/update-api-guide`)
- `refactor/` - Code refactoring (e.g., `refactor/message-service`)
- `test/` - Test additions/improvements (e.g., `test/add-edge-cases`)
- `perf/` - Performance improvements (e.g., `perf/optimize-queries`)

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(scheduler): add anniversary message support
fix(timezone): handle DST transitions correctly
docs(api): update rate limiting documentation
test(edge-cases): add leap year birthday tests
```

## Pull Request Process

1. **Sync with upstream**:
```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
```bash
   git checkout -b feature/your-feature
   ```

3. **Make your changes** and commit with meaningful messages

4. **Run tests locally**:
```bash
   npm run lint
   npm run typecheck
   npm run test:unit
   npm run test:integration
   ```

5. **Push to your fork**:
```bash
   git push origin feature/your-feature
   ```

6. **Open a Pull Request** against the `main` branch

7. **Fill out the PR template** completely

8. **Address review feedback** promptly

### PR Requirements

- [ ] All CI checks pass
- [ ] Tests cover new/changed functionality
- [ ] Documentation updated if needed
- [ ] No decrease in code coverage
- [ ] Follows coding standards

## Coding Standards

### TypeScript Guidelines

- Use strict TypeScript (`strict: true`)
- Prefer `const` over `let`
- Use explicit return types for functions
- Avoid `any` type - use `unknown` if necessary
- Use proper error handling with typed errors

### Code Style

- **ESLint**: All code must pass ESLint checks
- **Prettier**: Code is auto-formatted with Prettier
- **Line length**: Max 100 characters
- **Imports**: Use ES modules, organize imports logically

### Architecture Principles

- **DRY (Don't Repeat Yourself)**: Avoid code duplication
- **SOLID Principles**: Follow object-oriented design principles
- **Strategy Pattern**: Use for extensible message types
- **Repository Pattern**: Use for database operations

### Error Handling

```typescript
// Good: Typed errors with proper context
throw new ApplicationError('User not found', 'USER_NOT_FOUND', 404, { userId });

// Bad: Generic errors
throw new Error('Something went wrong');
```

## Testing Guidelines

### Test Categories

| Type | Location | Command |
|------|----------|---------|
| Unit | `tests/unit/` | `npm run test:unit` |
| Integration | `tests/integration/` | `npm run test:integration` |
| E2E | `tests/e2e/` | `npm run test:e2e` |
| Performance | `tests/performance/` | `npm run perf:all` |

### Test Requirements

- Unit tests for all business logic
- Integration tests for API endpoints
- Edge case coverage (see `tests/unit/edge-cases/`)
- Minimum 80% code coverage

### Writing Tests

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid timezone', async () => {
      // Arrange
      const userData = createUserFixture();

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result.timezone).toBe('America/New_York');
    });

    it('should throw for invalid timezone', async () => {
      // Arrange
      const userData = { ...createUserFixture(), timezone: 'Invalid/Zone' };

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow('INVALID_TIMEZONE');
    });
  });
});
```

## Documentation

### What to Document

- API changes (update OpenAPI schema)
- New features (add to `docs/`)
- Configuration changes (update `.env.example`)
- Architecture decisions (add ADR to `plan/`)

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `docs/API.md` | API usage guide |
| `docs/DEPLOYMENT_GUIDE.md` | Deployment instructions |
| `docs/DEVELOPER_SETUP.md` | Development setup |
| `plan/` | All planning & architecture docs |

## Questions?

- Check existing [Issues](https://github.com/fairyhunter13/happy-bday-app/issues)
- Read the [Documentation](./plan/README.md)
- Open a new issue with the `question` label

---

Thank you for contributing!
