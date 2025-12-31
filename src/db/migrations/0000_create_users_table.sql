CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"timezone" varchar(100) NOT NULL,
	"birthday_date" date,
	"anniversary_date" date,
	"location_city" varchar(100),
	"location_country" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_users_birthday_date" ON "users" ("birthday_date") WHERE "deleted_at" IS NULL AND "birthday_date" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_users_anniversary_date" ON "users" ("anniversary_date") WHERE "deleted_at" IS NULL AND "anniversary_date" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_users_birthday_timezone" ON "users" ("birthday_date","timezone") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL;
