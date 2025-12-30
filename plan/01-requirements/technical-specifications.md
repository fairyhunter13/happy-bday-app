# Birthday Message Scheduler - Technical Specifications
**ANALYST Agent - Implementation Guide**
**Date:** 2025-12-30
**Version:** 1.0

---

## 1. Technology Stack Specifications

### 1.1 Core Dependencies

```json
{
  "name": "birthday-message-scheduler",
  "version": "1.0.0",
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/schedule": "^4.0.0",
    "@nestjs/bull": "^10.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",
    "bull": "^4.11.0",
    "ioredis": "^5.3.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "date-fns": "^3.0.0",
    "date-fns-tz": "^2.0.0",
    "axios": "^1.6.0",
    "opossum": "^8.1.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.0.0",
    "@nestjs/testing": "^10.0.0",
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 1.2 Runtime Requirements

- **Node.js:** v20.x LTS or higher
- **PostgreSQL:** v15 or higher
- **Redis:** v7 or higher
- **Docker:** v24 or higher (for containerization)
- **npm:** v10 or higher

---

## 2. Database Schema Implementation

### 2.1 TypeORM Entity Definitions

```typescript
// src/entities/User.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MessageLog } from './MessageLog.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100, name: 'first_name' })
    firstName: string;

    @Column({ type: 'varchar', length: 100, name: 'last_name' })
    lastName: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ type: 'date', name: 'birthday_date' })
    birthdayDate: Date;

    @Column({ type: 'varchar', length: 100 })
    timezone: string;

    @Column({ type: 'varchar', length: 100, nullable: true, name: 'location_city' })
    locationCity?: string;

    @Column({ type: 'varchar', length: 100, nullable: true, name: 'location_country' })
    locationCountry?: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    @Column({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
    deletedAt?: Date;

    @OneToMany(() => MessageLog, (messageLog) => messageLog.user)
    messageLogs: MessageLog[];
}

// src/entities/MessageLog.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';

export enum MessageStatus {
    SCHEDULED = 'SCHEDULED',
    SENDING = 'SENDING',
    SENT = 'SENT',
    FAILED = 'FAILED',
    RETRYING = 'RETRYING'
}

export enum MessageType {
    BIRTHDAY = 'BIRTHDAY',
    ANNIVERSARY = 'ANNIVERSARY'
}

@Entity('message_logs')
@Index(['scheduledSendTime', 'status'])
@Index(['idempotencyKey'], { unique: true })
export class MessageLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, (user) => user.messageLogs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', length: 50, name: 'message_type' })
    messageType: MessageType;

    @Column({ type: 'text', name: 'message_content' })
    messageContent: string;

    @Column({ type: 'timestamptz', name: 'scheduled_send_time' })
    scheduledSendTime: Date;

    @Column({ type: 'timestamptz', nullable: true, name: 'actual_send_time' })
    actualSendTime?: Date;

    @Column({ type: 'varchar', length: 50 })
    status: MessageStatus;

    @Column({ type: 'int', default: 0, name: 'retry_count' })
    retryCount: number;

    @Column({ type: 'timestamptz', nullable: true, name: 'last_retry_at' })
    lastRetryAt?: Date;

    @Column({ type: 'int', nullable: true, name: 'api_response_code' })
    apiResponseCode?: number;

    @Column({ type: 'text', nullable: true, name: 'api_response_body' })
    apiResponseBody?: string;

    @Column({ type: 'text', nullable: true, name: 'error_message' })
    errorMessage?: string;

    @Column({ type: 'varchar', length: 255, unique: true, name: 'idempotency_key' })
    idempotencyKey: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;
}
```

### 2.2 Database Migration Files

```typescript
// src/migrations/1703001_CreateUsersTable.ts
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUsersTable1703001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'users',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'gen_random_uuid()'
                    },
                    {
                        name: 'first_name',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'last_name',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '255',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'birthday_date',
                        type: 'date',
                        isNullable: false
                    },
                    {
                        name: 'timezone',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'location_city',
                        type: 'varchar',
                        length: '100',
                        isNullable: true
                    },
                    {
                        name: 'location_country',
                        type: 'varchar',
                        length: '100',
                        isNullable: true
                    },
                    {
                        name: 'created_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                        isNullable: false
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                        isNullable: false
                    },
                    {
                        name: 'deleted_at',
                        type: 'timestamptz',
                        isNullable: true
                    }
                ]
            }),
            true
        );

        await queryRunner.createIndex(
            'users',
            new TableIndex({
                name: 'idx_users_birthday_date',
                columnNames: ['birthday_date'],
                where: 'deleted_at IS NULL'
            })
        );

        await queryRunner.createIndex(
            'users',
            new TableIndex({
                name: 'idx_users_email',
                columnNames: ['email'],
                isUnique: true,
                where: 'deleted_at IS NULL'
            })
        );

        await queryRunner.createIndex(
            'users',
            new TableIndex({
                name: 'idx_users_birthday_timezone',
                columnNames: ['birthday_date', 'timezone'],
                where: 'deleted_at IS NULL'
            })
        );

        // Add timezone validation constraint
        await queryRunner.query(`
            ALTER TABLE users
            ADD CONSTRAINT check_timezone
            CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('users');
    }
}

// src/migrations/1703002_CreateMessageLogsTable.ts
import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMessageLogsTable1703002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'message_logs',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'gen_random_uuid()'
                    },
                    {
                        name: 'user_id',
                        type: 'uuid',
                        isNullable: false
                    },
                    {
                        name: 'message_type',
                        type: 'varchar',
                        length: '50',
                        isNullable: false
                    },
                    {
                        name: 'message_content',
                        type: 'text',
                        isNullable: false
                    },
                    {
                        name: 'scheduled_send_time',
                        type: 'timestamptz',
                        isNullable: false
                    },
                    {
                        name: 'actual_send_time',
                        type: 'timestamptz',
                        isNullable: true
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '50',
                        isNullable: false
                    },
                    {
                        name: 'retry_count',
                        type: 'int',
                        default: 0,
                        isNullable: false
                    },
                    {
                        name: 'last_retry_at',
                        type: 'timestamptz',
                        isNullable: true
                    },
                    {
                        name: 'api_response_code',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'api_response_body',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'error_message',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'idempotency_key',
                        type: 'varchar',
                        length: '255',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'created_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                        isNullable: false
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                        isNullable: false
                    }
                ]
            }),
            true
        );

        // Foreign key
        await queryRunner.createForeignKey(
            'message_logs',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE'
            })
        );

        // Indexes
        await queryRunner.createIndex(
            'message_logs',
            new TableIndex({
                name: 'idx_message_logs_user_id',
                columnNames: ['user_id']
            })
        );

        await queryRunner.createIndex(
            'message_logs',
            new TableIndex({
                name: 'idx_message_logs_status',
                columnNames: ['status']
            })
        );

        await queryRunner.createIndex(
            'message_logs',
            new TableIndex({
                name: 'idx_message_logs_scheduled_time',
                columnNames: ['scheduled_send_time']
            })
        );

        await queryRunner.createIndex(
            'message_logs',
            new TableIndex({
                name: 'idx_message_logs_idempotency',
                columnNames: ['idempotency_key'],
                isUnique: true
            })
        );

        await queryRunner.createIndex(
            'message_logs',
            new TableIndex({
                name: 'idx_message_logs_recovery',
                columnNames: ['scheduled_send_time', 'status'],
                where: "status IN ('SCHEDULED', 'RETRYING', 'FAILED')"
            })
        );

        // Status check constraint
        await queryRunner.query(`
            ALTER TABLE message_logs
            ADD CONSTRAINT check_status
            CHECK (status IN ('SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'RETRYING'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('message_logs');
    }
}
```

---

## 3. API Endpoint Specifications

### 3.1 POST /user - Create User

**Request:**
```http
POST /user HTTP/1.1
Content-Type: application/json

{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "birthdayDate": "1990-12-30",
    "timezone": "America/New_York",
    "locationCity": "New York",
    "locationCountry": "USA"
}
```

**Response (201 Created):**
```json
{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "birthdayDate": "1990-12-30",
    "timezone": "America/New_York",
    "locationCity": "New York",
    "locationCountry": "USA",
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:00:00.000Z"
}
```

**Error Responses:**
```json
// 400 Bad Request - Invalid input
{
    "statusCode": 400,
    "message": [
        "firstName should not be empty",
        "email must be an email",
        "timezone must be a valid IANA timezone"
    ],
    "error": "Bad Request"
}

// 409 Conflict - Email already exists
{
    "statusCode": 409,
    "message": "User with email john.doe@example.com already exists",
    "error": "Conflict"
}
```

**Validation Rules:**
- `firstName`: Required, string, 1-100 characters
- `lastName`: Required, string, 1-100 characters
- `email`: Required, valid email format, unique
- `birthdayDate`: Required, valid date (YYYY-MM-DD)
- `timezone`: Required, valid IANA timezone (e.g., "America/New_York")
- `locationCity`: Optional, string, max 100 characters
- `locationCountry`: Optional, string, max 100 characters

---

### 3.2 DELETE /user/:id - Delete User

**Request:**
```http
DELETE /user/123e4567-e89b-12d3-a456-426614174000 HTTP/1.1
```

**Response (200 OK):**
```json
{
    "message": "User deleted successfully",
    "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Error Responses:**
```json
// 404 Not Found
{
    "statusCode": 404,
    "message": "User not found",
    "error": "Not Found"
}
```

**Implementation Notes:**
- Soft delete (set `deleted_at` timestamp)
- Cascade delete associated message logs (handled by database FK)
- Return 404 if user already deleted or doesn't exist

---

### 3.3 PUT /user/:id - Update User (Bonus)

**Request:**
```http
PUT /user/123e4567-e89b-12d3-a456-426614174000 HTTP/1.1
Content-Type: application/json

{
    "firstName": "Jane",
    "timezone": "Europe/London"
}
```

**Response (200 OK):**
```json
{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "birthdayDate": "1990-12-30",
    "timezone": "Europe/London",
    "locationCity": "New York",
    "locationCountry": "USA",
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T11:30:00.000Z"
}
```

**Error Responses:**
```json
// 404 Not Found
{
    "statusCode": 404,
    "message": "User not found",
    "error": "Not Found"
}

// 409 Conflict - Email already in use
{
    "statusCode": 409,
    "message": "Email already in use by another user",
    "error": "Conflict"
}
```

**Special Handling:**
- If `timezone` or `birthdayDate` changed:
  1. Find all SCHEDULED messages for user
  2. Recalculate `scheduled_send_time` (9am new timezone)
  3. Update message logs
  4. Update queue job delays (if applicable)

---

### 3.4 GET /health - Health Check

**Request:**
```http
GET /health HTTP/1.1
```

**Response (200 OK):**
```json
{
    "status": "ok",
    "timestamp": "2025-12-30T10:00:00.000Z",
    "services": {
        "database": {
            "status": "up",
            "responseTime": 5
        },
        "redis": {
            "status": "up",
            "responseTime": 2
        },
        "emailApi": {
            "status": "up",
            "responseTime": 120
        }
    }
}
```

**Response (503 Service Unavailable):**
```json
{
    "status": "degraded",
    "timestamp": "2025-12-30T10:00:00.000Z",
    "services": {
        "database": {
            "status": "up",
            "responseTime": 5
        },
        "redis": {
            "status": "down",
            "error": "Connection timeout"
        },
        "emailApi": {
            "status": "up",
            "responseTime": 120
        }
    }
}
```

---

### 3.5 GET /metrics - System Metrics

**Request:**
```http
GET /metrics HTTP/1.1
```

**Response (200 OK):**
```json
{
    "timestamp": "2025-12-30T10:00:00.000Z",
    "users": {
        "total": 10000,
        "createdToday": 45
    },
    "messages": {
        "scheduled": 250,
        "sent": 1200,
        "failed": 5,
        "retrying": 10
    },
    "queue": {
        "waiting": 50,
        "active": 5,
        "completed": 1195,
        "failed": 5,
        "delayed": 200
    },
    "performance": {
        "averageSendTime": 1500,
        "deliverySuccessRate": 99.6
    }
}
```

---

## 4. Configuration Specifications

### 4.1 Environment Variables

```bash
# .env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=birthday_app
DATABASE_POOL_SIZE=20
DATABASE_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Email Service
EMAIL_SERVICE_URL=https://email-service.digitalenvision.com.au/send-email
EMAIL_SERVICE_TIMEOUT=10000

# Queue Configuration
QUEUE_NAME=birthday-messages
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=5
QUEUE_BACKOFF_DELAY=2000
QUEUE_BACKOFF_TYPE=exponential

# CRON Schedules
CRON_DAILY_SCHEDULE=0 0 * * *          # Daily at midnight UTC
CRON_MINUTE_SCHEDULE=* * * * *         # Every minute
CRON_RECOVERY_SCHEDULE=*/10 * * * *    # Every 10 minutes

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.2 TypeORM Configuration

```typescript
// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: configService.get('DATABASE_HOST'),
    port: configService.get('DATABASE_PORT'),
    username: configService.get('DATABASE_USERNAME'),
    password: configService.get('DATABASE_PASSWORD'),
    database: configService.get('DATABASE_NAME'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false, // Never use in production
    logging: configService.get('NODE_ENV') === 'development',
    poolSize: configService.get('DATABASE_POOL_SIZE'),
    ssl: configService.get('DATABASE_SSL') === 'true',
    extra: {
        max: configService.get('DATABASE_POOL_SIZE'),
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    }
});
```

### 4.3 Bull Queue Configuration

```typescript
// src/config/queue.config.ts
import { BullModuleOptions } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const getQueueConfig = (configService: ConfigService): BullModuleOptions => ({
    redis: {
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB')
    },
    defaultJobOptions: {
        attempts: configService.get('QUEUE_MAX_RETRIES'),
        backoff: {
            type: configService.get('QUEUE_BACKOFF_TYPE'),
            delay: configService.get('QUEUE_BACKOFF_DELAY')
        },
        removeOnComplete: true,
        removeOnFail: false
    }
});
```

---

## 5. Service Implementation Specifications

### 5.1 TimezoneService

```typescript
// src/services/timezone.service.ts
import { Injectable } from '@nestjs/common';
import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';
import { isValid } from 'date-fns';

@Injectable()
export class TimezoneService {
    /**
     * Calculate when to send message (9am user's local time)
     * @param birthdayDate - User's birthday (month/day)
     * @param timezone - IANA timezone (e.g., 'America/New_York')
     * @returns UTC date/time for scheduled send
     */
    calculateSendTime(birthdayDate: Date, timezone: string): Date {
        const currentYear = new Date().getFullYear();

        // Create date in user's timezone (9am on birthday)
        const localDate = new Date(
            currentYear,
            birthdayDate.getMonth(),
            birthdayDate.getDate(),
            9, 0, 0, 0
        );

        // Convert to UTC
        const utcDate = zonedTimeToUtc(localDate, timezone);

        return utcDate;
    }

    /**
     * Validate IANA timezone
     * @param timezone - Timezone string
     * @returns true if valid
     */
    isValidTimezone(timezone: string): boolean {
        try {
            const testDate = new Date();
            zonedTimeToUtc(testDate, timezone);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get current time in user's timezone
     * @param timezone - IANA timezone
     * @returns Current date/time in timezone
     */
    getCurrentTimeInTimezone(timezone: string): Date {
        return utcToZonedTime(new Date(), timezone);
    }

    /**
     * Check if today is user's birthday in their timezone
     * @param birthdayDate - User's birthday
     * @param timezone - User's timezone
     * @returns true if today is birthday
     */
    isBirthdayToday(birthdayDate: Date, timezone: string): boolean {
        const nowInTimezone = this.getCurrentTimeInTimezone(timezone);

        return nowInTimezone.getMonth() === birthdayDate.getMonth() &&
               nowInTimezone.getDate() === birthdayDate.getDate();
    }
}
```

### 5.2 IdempotencyService

```typescript
// src/services/idempotency.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdempotencyService {
    /**
     * Generate idempotency key
     * @param userId - User UUID
     * @param messageType - Message type (BIRTHDAY, ANNIVERSARY)
     * @param date - Date for message
     * @returns Idempotency key string
     */
    generateKey(userId: string, messageType: string, date: Date): string {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        return `${userId}:${messageType}:${dateStr}`;
    }

    /**
     * Parse idempotency key
     * @param key - Idempotency key
     * @returns Parsed components
     */
    parseKey(key: string): { userId: string; messageType: string; date: string } {
        const [userId, messageType, date] = key.split(':');
        return { userId, messageType, date };
    }
}
```

### 5.3 MessageSenderService

```typescript
// src/services/message-sender.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import CircuitBreaker from 'opossum';
import { User } from '../entities/User.entity';

export interface MessageResult {
    success: boolean;
    apiResponseCode?: number;
    apiResponseBody?: any;
    errorMessage?: string;
}

@Injectable()
export class MessageSenderService {
    private readonly logger = new Logger(MessageSenderService.name);
    private readonly httpClient: AxiosInstance;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(private readonly configService: ConfigService) {
        // Setup HTTP client
        this.httpClient = axios.create({
            baseURL: this.configService.get('EMAIL_SERVICE_URL'),
            timeout: this.configService.get('EMAIL_SERVICE_TIMEOUT'),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Setup circuit breaker
        this.circuitBreaker = new CircuitBreaker(this.sendEmailRequest.bind(this), {
            timeout: this.configService.get('CIRCUIT_BREAKER_TIMEOUT'),
            errorThresholdPercentage: this.configService.get('CIRCUIT_BREAKER_ERROR_THRESHOLD'),
            resetTimeout: this.configService.get('CIRCUIT_BREAKER_RESET_TIMEOUT'),
            volumeThreshold: this.configService.get('CIRCUIT_BREAKER_VOLUME_THRESHOLD')
        });

        // Circuit breaker events
        this.circuitBreaker.on('open', () => {
            this.logger.warn('Circuit breaker opened - email service degraded');
        });

        this.circuitBreaker.on('close', () => {
            this.logger.log('Circuit breaker closed - email service recovered');
        });
    }

    /**
     * Send birthday message to user
     * @param user - User entity
     * @returns Message result
     */
    async sendBirthdayMessage(user: User): Promise<MessageResult> {
        const message = `Hey, ${user.firstName} ${user.lastName} it's your birthday`;

        try {
            const response = await this.circuitBreaker.fire(user.email, message);

            this.logger.log(`Birthday message sent to ${user.email}`);

            return {
                success: true,
                apiResponseCode: response.status,
                apiResponseBody: response.data
            };
        } catch (error) {
            this.logger.error(`Failed to send birthday message to ${user.email}: ${error.message}`);

            return {
                success: false,
                apiResponseCode: error.response?.status,
                errorMessage: error.message
            };
        }
    }

    /**
     * Internal method to send email request
     * @param email - User email
     * @param message - Message content
     * @returns Axios response
     */
    private async sendEmailRequest(email: string, message: string): Promise<any> {
        return await this.httpClient.post('', {
            email,
            message
        });
    }
}
```

---

## 6. Queue Worker Implementation

### 6.1 Message Queue Processor

```typescript
// src/processors/message-queue.processor.ts
import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MessageSchedulerService } from '../services/message-scheduler.service';

export interface MessageJobData {
    messageId: string;
    userId: string;
    scheduledSendTime: Date;
}

@Processor('birthday-messages')
export class MessageQueueProcessor {
    private readonly logger = new Logger(MessageQueueProcessor.name);

    constructor(
        private readonly messageSchedulerService: MessageSchedulerService
    ) {}

    @Process('send-birthday')
    async handleSendBirthday(job: Job<MessageJobData>): Promise<void> {
        const { messageId, userId } = job.data;

        this.logger.log(`Processing message ${messageId} for user ${userId}`);

        await this.messageSchedulerService.processBirthdayMessage(messageId);
    }

    @OnQueueActive()
    onActive(job: Job<MessageJobData>): void {
        this.logger.debug(`Job ${job.id} is now active`);
    }

    @OnQueueCompleted()
    onCompleted(job: Job<MessageJobData>, result: any): void {
        this.logger.log(`Job ${job.id} completed successfully`);
    }

    @OnQueueFailed()
    onFailed(job: Job<MessageJobData>, error: Error): void {
        this.logger.error(`Job ${job.id} failed: ${error.message}`);
    }
}
```

---

## 7. CRON Job Specifications

### 7.1 Daily Birthday Pre-Calculation

```typescript
// src/schedulers/daily-birthday.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessageSchedulerService } from '../services/message-scheduler.service';

@Injectable()
export class DailyBirthdayScheduler {
    private readonly logger = new Logger(DailyBirthdayScheduler.name);

    constructor(
        private readonly messageSchedulerService: MessageSchedulerService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        name: 'daily-birthday-precalculation',
        timeZone: 'UTC'
    })
    async handleDailyBirthdayCalculation(): Promise<void> {
        this.logger.log('Starting daily birthday pre-calculation');

        try {
            const count = await this.messageSchedulerService.preCalculateTodaysBirthdays();

            this.logger.log(`Scheduled ${count} birthday messages for today`);
        } catch (error) {
            this.logger.error(`Daily birthday calculation failed: ${error.message}`);
        }
    }
}
```

### 7.2 Minute-by-Minute Detection

```typescript
// src/schedulers/minute-detection.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessageSchedulerService } from '../services/message-scheduler.service';

@Injectable()
export class MinuteDetectionScheduler {
    private readonly logger = new Logger(MinuteDetectionScheduler.name);

    constructor(
        private readonly messageSchedulerService: MessageSchedulerService
    ) {}

    @Cron(CronExpression.EVERY_MINUTE, {
        name: 'minute-detection',
        timeZone: 'UTC'
    })
    async handleMinuteDetection(): Promise<void> {
        this.logger.debug('Checking for upcoming birthdays');

        try {
            const count = await this.messageSchedulerService.enqueueUpcomingMessages();

            if (count > 0) {
                this.logger.log(`Enqueued ${count} messages to queue`);
            }
        } catch (error) {
            this.logger.error(`Minute detection failed: ${error.message}`);
        }
    }
}
```

### 7.3 Recovery Job

```typescript
// src/schedulers/recovery.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MessageSchedulerService } from '../services/message-scheduler.service';

@Injectable()
export class RecoveryScheduler {
    private readonly logger = new Logger(RecoveryScheduler.name);

    constructor(
        private readonly messageSchedulerService: MessageSchedulerService
    ) {}

    @Cron('*/10 * * * *', {
        name: 'recovery-job',
        timeZone: 'UTC'
    })
    async handleRecovery(): Promise<void> {
        this.logger.log('Starting recovery job');

        try {
            const count = await this.messageSchedulerService.recoverMissedMessages();

            if (count > 0) {
                this.logger.warn(`Recovered ${count} missed messages`);
            }
        } catch (error) {
            this.logger.error(`Recovery job failed: ${error.message}`);
        }
    }
}
```

---

## 8. Testing Specifications

### 8.1 Unit Test Example

```typescript
// src/services/__tests__/timezone.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TimezoneService } from '../timezone.service';

describe('TimezoneService', () => {
    let service: TimezoneService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TimezoneService]
        }).compile();

        service = module.get<TimezoneService>(TimezoneService);
    });

    describe('calculateSendTime', () => {
        it('should calculate correct UTC time for New York user', () => {
            const birthdayDate = new Date('1990-12-30');
            const timezone = 'America/New_York';

            const sendTime = service.calculateSendTime(birthdayDate, timezone);

            // In winter (EST = UTC-5), 9am EST = 14:00 UTC
            expect(sendTime.getUTCHours()).toBe(14);
            expect(sendTime.getUTCMinutes()).toBe(0);
        });

        it('should handle DST correctly', () => {
            const birthdayDate = new Date('1990-07-15');
            const timezone = 'America/New_York';

            const sendTime = service.calculateSendTime(birthdayDate, timezone);

            // In summer (EDT = UTC-4), 9am EDT = 13:00 UTC
            expect(sendTime.getUTCHours()).toBe(13);
        });
    });

    describe('isValidTimezone', () => {
        it('should validate correct timezone', () => {
            expect(service.isValidTimezone('America/New_York')).toBe(true);
            expect(service.isValidTimezone('Europe/London')).toBe(true);
            expect(service.isValidTimezone('Australia/Melbourne')).toBe(true);
        });

        it('should reject invalid timezone', () => {
            expect(service.isValidTimezone('Invalid/Timezone')).toBe(false);
            expect(service.isValidTimezone('EST')).toBe(false);
        });
    });
});
```

---

## 9. Performance Benchmarks

### 9.1 Expected Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API Response Time (POST /user) | < 100ms (p95) | Load testing with Artillery |
| API Response Time (DELETE /user) | < 50ms (p95) | Load testing with Artillery |
| Birthday Detection Query | < 500ms | Database query EXPLAIN ANALYZE |
| Message Enqueue Throughput | > 1000/sec | Bull queue metrics |
| Message Send Throughput | > 50/sec (5 workers x 10/sec) | Worker metrics |
| Database Connections | < 15/20 pool size | PostgreSQL monitoring |
| Memory Usage (per instance) | < 512MB | Node.js process monitoring |

### 9.2 Load Testing Scenario

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"

scenarios:
  - name: "Create users"
    weight: 70
    flow:
      - post:
          url: "/user"
          json:
            firstName: "Test"
            lastName: "User"
            email: "test{{ $randomNumber() }}@example.com"
            birthdayDate: "1990-12-30"
            timezone: "America/New_York"

  - name: "Health check"
    weight: 30
    flow:
      - get:
          url: "/health"
```

---

**END OF TECHNICAL SPECIFICATIONS**

---

**Implementation Checklist:**

- [ ] Setup project structure (NestJS)
- [ ] Configure TypeORM with PostgreSQL
- [ ] Create database migrations
- [ ] Implement entity models
- [ ] Setup Bull queue with Redis
- [ ] Implement repositories
- [ ] Implement services (Timezone, Idempotency, MessageSender)
- [ ] Implement controllers (User, Health)
- [ ] Implement CRON schedulers
- [ ] Implement queue processor
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Setup Docker Compose
- [ ] Configure logging (Winston/Pino)
- [ ] Setup monitoring (Prometheus)
- [ ] Load testing
- [ ] Documentation
- [ ] CI/CD pipeline
