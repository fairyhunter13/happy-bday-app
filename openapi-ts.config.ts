import { defineConfig } from '@hey-api/openapi-ts';

/**
 * OpenAPI TypeScript Client Generator Configuration
 * DRY Principle: Auto-generate type-safe HTTP clients from OpenAPI specs
 *
 * This replaces 400+ lines of manual HTTP client code with auto-generated,
 * type-safe clients that stay in sync with the OpenAPI specification.
 */
export default defineConfig({
  // Email Service API (Digital Envision vendor)
  client: '@hey-api/client-fetch',
  input: './docs/vendor-specs/email-service-api.json',
  output: {
    path: './src/clients/generated',
    format: 'prettier',
    lint: 'eslint',
  },
  types: {
    enums: 'javascript',
    dates: 'types+transform',
  },
  schemas: {
    export: true,
    type: 'json',
  },
  services: {
    asClass: true,
    export: true,
    methodNameBuilder: (operation) => {
      // Generate method names like: sendEmail, getStatus, etc.
      return operation.operationId || operation.name;
    },
  },
  plugins: [
    {
      name: '@hey-api/typescript',
      enums: 'javascript',
      dates: true,
    },
    {
      name: '@hey-api/schemas',
      type: 'zod',
    },
    {
      name: '@hey-api/sdk',
      asClass: true,
    },
  ],
});
