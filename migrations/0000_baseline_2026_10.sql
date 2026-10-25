CREATE TABLE "ai_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"function_key" varchar(100) NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"input_json" jsonb NOT NULL,
	"output_json" jsonb NOT NULL,
	"last_accessed" timestamp DEFAULT now(),
	"month" varchar(7),
	"expires_at" timestamp,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"function_name" varchar(50) NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"cost" numeric(10, 6) DEFAULT '0.000000' NOT NULL,
	"model" varchar(50) NOT NULL,
	"request_size" integer DEFAULT 0,
	"response_size" integer DEFAULT 0,
	"execution_time" integer DEFAULT 0,
	"cached" boolean DEFAULT false,
	"language" varchar(10) DEFAULT 'en-us',
	"plan" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'success',
	"error_message" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_usage_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan" varchar(20) NOT NULL,
	"function_name" varchar(50) NOT NULL,
	"monthly_request_limit" integer DEFAULT 0 NOT NULL,
	"monthly_cost_limit" numeric(10, 2) DEFAULT '0.00',
	"daily_request_limit" integer DEFAULT 0,
	"daily_cost_limit" numeric(10, 2) DEFAULT '0.00',
	"max_tokens_per_request" integer DEFAULT 0,
	"cooldown_seconds" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"reset_day" integer DEFAULT 1,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_user_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"function_name" varchar(50) NOT NULL,
	"monthly_request_limit" integer,
	"monthly_cost_limit" numeric(10, 2),
	"daily_request_limit" integer,
	"daily_cost_limit" numeric(10, 2),
	"max_tokens_per_request" integer,
	"cooldown_seconds" integer,
	"is_blocked" boolean DEFAULT false,
	"reason" text,
	"expires_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "backup_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"auto_backup" boolean DEFAULT true,
	"frequency" varchar(20) DEFAULT 'daily',
	"retention_days" integer DEFAULT 7,
	"include_attachments" boolean DEFAULT true,
	"encrypt_backups" boolean DEFAULT true,
	"last_backup_date" timestamp,
	"next_backup_date" timestamp,
	"total_backups" integer DEFAULT 0,
	"total_size" varchar(50) DEFAULT '0 MB',
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocked_countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"country_name" varchar(100) NOT NULL,
	"reason" text,
	"blocked_at" timestamp DEFAULT now(),
	"blocked_by" varchar,
	CONSTRAINT "blocked_countries_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"period" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" varchar(100) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"color" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"amount" numeric(12, 2),
	"metadata" jsonb,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collaborative_goal_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"personal_target" numeric(12, 2),
	"current_contribution" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"role" varchar(20) DEFAULT 'participant' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"last_contribution" timestamp
);
--> statement-breakpoint
CREATE TABLE "collaborative_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"target_date" timestamp NOT NULL,
	"category" varchar(100) NOT NULL,
	"challenge_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_by" varchar NOT NULL,
	"is_public" boolean DEFAULT false,
	"join_code" varchar(20),
	"milestone_rewards" jsonb,
	"competition_rules" jsonb,
	"goal_details" jsonb,
	"cover_image" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(24) NOT NULL,
	"kind" varchar(10) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"document_type" varchar(12) NOT NULL,
	"document_number" varchar(24) NOT NULL,
	"address" varchar(240) NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(32),
	"service" varchar(160) NOT NULL,
	"amount_claimed" varchar(32),
	"detail" text NOT NULL,
	"request" text NOT NULL,
	"language" varchar(5) DEFAULT 'es' NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"response" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "course_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"level_id" varchar(50) NOT NULL,
	"completed_at" timestamp,
	"score" integer DEFAULT 0,
	"attempts" integer DEFAULT 0,
	"best_score" integer DEFAULT 0,
	"time_spent" integer DEFAULT 0,
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar(32) NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"source" varchar(12) DEFAULT 'client' NOT NULL,
	"release" varchar(64),
	"route" varchar(200),
	"status" integer,
	"duration_ms" integer,
	"request_id" varchar(80),
	"message" text NOT NULL,
	"stack" text,
	"context" jsonb,
	"breadcrumbs" jsonb
);
--> statement-breakpoint
CREATE TABLE "error_groups" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"kind" varchar(24) NOT NULL,
	"source" varchar(12) DEFAULT 'client' NOT NULL,
	"title" varchar(240) NOT NULL,
	"message" text NOT NULL,
	"route" varchar(200),
	"release" varchar(64),
	"platform" varchar(32),
	"severity" varchar(12) DEFAULT 'error' NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"money_path" boolean DEFAULT false NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"ai_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"ai_analysis" jsonb,
	"ai_model" varchar(64),
	"ai_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "error_rollups" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar(32) NOT NULL,
	"bucket" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"amount" numeric(12, 2),
	"due_date" timestamp NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar(20),
	"recurring_end_date" timestamp,
	"reminder_days_before" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"is_completed" boolean DEFAULT false,
	"last_reminded" timestamp,
	"payment_url" text,
	"reference_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_mascots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"image_url" text NOT NULL,
	"health_score" integer NOT NULL,
	"mood" varchar(50) NOT NULL,
	"generation_prompt" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_generated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"contribution_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"transaction_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"message_type" varchar(50) DEFAULT 'text' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"target_date" timestamp NOT NULL,
	"category" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"summary" jsonb NOT NULL,
	"filename" varchar(255),
	"type" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar(64) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" varchar(12) DEFAULT 'running' NOT NULL,
	"error_code" varchar(120),
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "learning_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"total_xp" integer DEFAULT 0,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_learning_date" timestamp,
	"total_lessons_completed" integer DEFAULT 0,
	"total_time_spent" integer DEFAULT 0,
	"average_score" numeric(5, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "merchant_learning" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"merchant_name" varchar(255) NOT NULL,
	"transcript" text,
	"original_category_id" integer,
	"corrected_category_id" integer,
	"business_type" varchar(100),
	"country_code" varchar(10) NOT NULL,
	"language" varchar(10) NOT NULL,
	"confidence" numeric(3, 2),
	"correction_type" varchar(50) NOT NULL,
	"learned_at" timestamp DEFAULT now(),
	"transaction_id" integer
);
--> statement-breakpoint
CREATE TABLE "merchant_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_name" varchar(255) NOT NULL,
	"business_type" varchar(100) NOT NULL,
	"category_id" integer,
	"category_name" varchar(100) NOT NULL,
	"country_code" varchar(10) NOT NULL,
	"language" varchar(10) NOT NULL,
	"user_count" integer DEFAULT 1 NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"is_user_generated" boolean DEFAULT true,
	"source" varchar(50) DEFAULT 'user_feedback'
);
--> statement-breakpoint
CREATE TABLE "milestone_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"user_id" varchar,
	"milestone_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_amount" numeric(12, 2) NOT NULL,
	"achieved_amount" numeric(12, 2) NOT NULL,
	"reward_type" varchar(50),
	"reward_data" jsonb,
	"achieved_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_invoice_id" varchar,
	"stripe_customer_id" varchar,
	"failure_reason" text,
	"attempt_count" integer DEFAULT 1,
	"failed_at" timestamp DEFAULT now(),
	"notification_sent" boolean DEFAULT false,
	"last_notified" timestamp,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"last_processed" timestamp,
	"created_at" timestamp DEFAULT now(),
	"source_transaction_id" integer
);
--> statement-breakpoint
CREATE TABLE "redeem_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"redeemed" boolean DEFAULT false NOT NULL,
	"user_id" varchar,
	"redeemed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "redeem_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar(20),
	"recurring_end_date" timestamp,
	"parent_transaction_id" integer,
	"payment_url" text,
	"reference_note" text,
	"image_url" text,
	"ocr_text" text,
	"ocr_vendor" varchar(255),
	"ocr_detected_amount" numeric(12, 2),
	"ocr_detected_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"badge_id" varchar(50) NOT NULL,
	"earned_at" timestamp DEFAULT now(),
	"notified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"phone" varchar,
	"website" varchar,
	"password" varchar,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"billing_interval" varchar(20) DEFAULT 'monthly',
	"currency" varchar(5),
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"activated_at" timestamp,
	"settings" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"grace_expires_at" timestamp,
	"grace_period_active" boolean DEFAULT false,
	"payment_failure_count" integer DEFAULT 0,
	"last_payment_failure_notified" timestamp,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"mp_preapproval_id" varchar,
	"language" varchar(5),
	"email_notifications" boolean DEFAULT true NOT NULL,
	"timezone" varchar(64),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_cache" ADD CONSTRAINT "ai_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_overrides" ADD CONSTRAINT "ai_user_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_settings" ADD CONSTRAINT "backup_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_activities" ADD CONSTRAINT "challenge_activities_goal_id_collaborative_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."collaborative_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_activities" ADD CONSTRAINT "challenge_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborative_goal_participants" ADD CONSTRAINT "collaborative_goal_participants_goal_id_collaborative_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."collaborative_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborative_goal_participants" ADD CONSTRAINT "collaborative_goal_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborative_goals" ADD CONSTRAINT "collaborative_goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reminders" ADD CONSTRAINT "expense_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reminders" ADD CONSTRAINT "expense_reminders_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_mascots" ADD CONSTRAINT "financial_mascots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_collaborative_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."collaborative_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_messages" ADD CONSTRAINT "goal_messages_goal_id_collaborative_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."collaborative_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_messages" ADD CONSTRAINT "goal_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_stats" ADD CONSTRAINT "learning_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_learning" ADD CONSTRAINT "merchant_learning_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_learning" ADD CONSTRAINT "merchant_learning_original_category_id_categories_id_fk" FOREIGN KEY ("original_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_learning" ADD CONSTRAINT "merchant_learning_corrected_category_id_categories_id_fk" FOREIGN KEY ("corrected_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_learning" ADD CONSTRAINT "merchant_learning_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_patterns" ADD CONSTRAINT "merchant_patterns_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_achievements" ADD CONSTRAINT "milestone_achievements_goal_id_collaborative_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."collaborative_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_achievements" ADD CONSTRAINT "milestone_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_failures" ADD CONSTRAINT "payment_failures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_cache_user_function_idx" ON "ai_cache" USING btree ("user_id","function_key");--> statement-breakpoint
CREATE INDEX "ai_cache_hash_idx" ON "ai_cache" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "ai_cache_month_idx" ON "ai_cache" USING btree ("month");--> statement-breakpoint
CREATE INDEX "ai_cache_last_accessed_idx" ON "ai_cache" USING btree ("last_accessed");--> statement-breakpoint
CREATE INDEX "ai_cache_expires_at_idx" ON "ai_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_usage_user_date_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_function_idx" ON "ai_usage" USING btree ("function_name");--> statement-breakpoint
CREATE INDEX "ai_usage_plan_idx" ON "ai_usage" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "ai_usage_month_idx" ON "ai_usage" USING btree ("user_id","function_name","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_cost_idx" ON "ai_usage" USING btree ("cost","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_limits_plan_function_idx" ON "ai_usage_limits" USING btree ("plan","function_name");--> statement-breakpoint
CREATE INDEX "ai_usage_limits_active_idx" ON "ai_usage_limits" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ai_user_overrides_user_function_idx" ON "ai_user_overrides" USING btree ("user_id","function_name");--> statement-breakpoint
CREATE INDEX "ai_user_overrides_blocked_idx" ON "ai_user_overrides" USING btree ("is_blocked");--> statement-breakpoint
CREATE INDEX "ai_user_overrides_expires_idx" ON "ai_user_overrides" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_budgets_user" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_categories_user" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_complaints_code" ON "complaints" USING btree ("code");--> statement-breakpoint
CREATE INDEX "IDX_complaints_email" ON "complaints" USING btree ("email");--> statement-breakpoint
CREATE INDEX "IDX_error_events_group" ON "error_events" USING btree ("group_id","occurred_at");--> statement-breakpoint
CREATE INDEX "IDX_error_groups_status" ON "error_groups" USING btree ("status","last_seen");--> statement-breakpoint
CREATE INDEX "IDX_error_groups_severity" ON "error_groups" USING btree ("severity");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_error_rollups_group_bucket" ON "error_rollups" USING btree ("group_id","bucket");--> statement-breakpoint
CREATE INDEX "IDX_expense_reminders_user_due" ON "expense_reminders" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "IDX_goal_contributions_goal" ON "goal_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "IDX_goal_messages_goal" ON "goal_messages" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "IDX_goals_user" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_job_runs_name_started" ON "job_runs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "IDX_recurring_active_user" ON "recurring_transactions" USING btree ("is_active","user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_transactions_user_date" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "IDX_transactions_category" ON "transactions" USING btree ("category_id");