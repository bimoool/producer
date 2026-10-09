CREATE TABLE "workspace_sheet_snapshots" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"spreadsheet_id" text NOT NULL,
	"spreadsheet_title" text,
	"data" jsonb,
	"synced_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "workspace_sheet_snapshots" ADD CONSTRAINT "workspace_sheet_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;