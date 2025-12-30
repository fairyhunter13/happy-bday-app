CREATE TABLE IF NOT EXISTS "message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_type" varchar(50) NOT NULL,
	"message_content" text NOT NULL,
	"scheduled_send_time" timestamp with time zone NOT NULL,
	"actual_send_time" timestamp with time zone,
	"status" varchar(20) NOT NULL DEFAULT 'SCHEDULED',
	"retry_count" integer NOT NULL DEFAULT 0,
	"last_retry_at" timestamp with time zone,
	"api_response_code" integer,
	"api_response_body" text,
	"error_message" text,
	"idempotency_key" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_logs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "message_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "idx_message_logs_user_id" ON "message_logs" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_message_logs_status" ON "message_logs" ("status");
--> statement-breakpoint
CREATE INDEX "idx_message_logs_scheduled_time" ON "message_logs" ("scheduled_send_time");
--> statement-breakpoint
CREATE INDEX "idx_message_logs_scheduler" ON "message_logs" ("message_type","status","scheduled_send_time");
--> statement-breakpoint
CREATE INDEX "idx_message_logs_recovery" ON "message_logs" ("scheduled_send_time","status") WHERE "status" IN ('SCHEDULED', 'RETRYING', 'FAILED');
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_logs_idempotency" ON "message_logs" ("idempotency_key");
