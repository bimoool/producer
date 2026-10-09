CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'one_time' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"status" text DEFAULT 'potential' NOT NULL,
	"personal_profit" integer,
	"expected_by" text,
	"paid_on" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_kind_check" CHECK ("deals"."kind" in ('one_time','monthly')),
	CONSTRAINT "deals_status_check" CHECK ("deals"."status" in ('paid','expected','potential','lost')),
	CONSTRAINT "deals_amount_check" CHECK ("deals"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "weekly_reports" DROP CONSTRAINT "weekly_reports_status_check";--> statement-breakpoint
ALTER TABLE "weekly_reports" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "declarations" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "original_text" text;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "facts" jsonb;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "sent_on" date;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_sent_has_date" CHECK ("weekly_reports"."status" <> 'sent' or "weekly_reports"."sent_on" is not null);--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_status_check" CHECK ("weekly_reports"."status" in ('draft','final','sent'));