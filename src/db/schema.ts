import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

// ─────────────────────────── Identité ───────────────────────────
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    image: text("image"),
    locale: text("locale").default("fr").notNull(),
    isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// Compatible Auth.js (OAuth ultérieur)
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: integer("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("accounts_provider_idx").on(t.provider, t.providerAccountId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

// ─────────────────────────── Organisations ───────────────────────────
export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sector: text("sector"),
    country: text("country").default("ML").notNull(),
    city: text("city"),
    phone: text("phone"),
    website: text("website"),
    logoUrl: text("logo_url"),
    defaultLocale: text("default_locale").default("fr").notNull(),
    conversationRetentionDays: integer("conversation_retention_days").default(365).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("organizations_slug_idx").on(t.slug)],
);

export type OrgRole = "admin" | "member";

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<OrgRole>().default("member").notNull(),
    invitedBy: text("invited_by"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("org_members_unique_idx").on(t.organizationId, t.userId),
    index("org_members_user_idx").on(t.userId),
  ],
);

// ─────────────────────────── Abonnements ───────────────────────────
export const plans = pgTable("plans", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthlyXof: integer("price_monthly_xof").default(0).notNull(),
  maxDocuments: integer("max_documents").default(20).notNull(),
  maxStorageMb: integer("max_storage_mb").default(100).notNull(),
  maxQuestionsPerMonth: integer("max_questions_per_month").default(200).notNull(),
  maxUsers: integer("max_users").default(3).notNull(),
  maxAssistants: integer("max_assistants").default(1).notNull(),
  features: jsonb("features").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SubscriptionStatus = "trial" | "active" | "suspended" | "expired" | "cancelled";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => plans.id),
    status: text("status").$type<SubscriptionStatus>().default("trial").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscriptions_org_idx").on(t.organizationId)],
);

export type PaymentMethod = "orange_money" | "moov_money" | "bank_transfer" | "cash" | "other";
export type PaymentStatus = "pending" | "confirmed" | "rejected";

export const payments = pgTable(
  "payments",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    planId: text("plan_id").references(() => plans.id),
    amountXof: integer("amount_xof").notNull(),
    method: text("method").$type<PaymentMethod>().notNull(),
    reference: text("reference"),
    proofUrl: text("proof_url"),
    status: text("status").$type<PaymentStatus>().default("pending").notNull(),
    periodMonths: integer("period_months").default(1).notNull(),
    declaredBy: text("declared_by"),
    confirmedBy: text("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_org_idx").on(t.organizationId)],
);

// ─────────────────────────── Connaissance ───────────────────────────
export const knowledgeBases = pgTable(
  "knowledge_bases",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("kb_org_idx").on(t.organizationId)],
);

export const assistants = pgTable(
  "assistants",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    welcomeMessage: text("welcome_message"),
    model: text("model"),
    temperature: real("temperature").default(0.2).notNull(),
    minConfidence: real("min_confidence").default(0.22).notNull(),
    topK: integer("top_k").default(6).notNull(),
    language: text("language").default("fr").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("assistants_org_idx").on(t.organizationId)],
);

export const assistantKnowledgeBases = pgTable(
  "assistant_knowledge_bases",
  {
    assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
  },
  (t) => [uniqueIndex("assistant_kb_unique_idx").on(t.assistantId, t.knowledgeBaseId)],
);

export type SourceType = "file" | "url" | "text" | "qa";
export type SourceStatus = "pending" | "processing" | "completed" | "error";

export const sources = pgTable(
  "sources",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    type: text("type").$type<SourceType>().notNull(),
    name: text("name").notNull(),
    status: text("status").$type<SourceStatus>().default("pending").notNull(),
    errorMessage: text("error_message"),
    url: text("url"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    chunkCount: integer("chunk_count").default(0).notNull(),
    createdBy: text("created_by"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("sources_kb_idx").on(t.knowledgeBaseId), index("sources_org_idx").on(t.organizationId)],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    storagePath: text("storage_path"),
    charCount: integer("char_count").default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("documents_source_idx").on(t.sourceId), index("documents_org_idx").on(t.organizationId)],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chunks_kb_idx").on(t.knowledgeBaseId), index("chunks_doc_idx").on(t.documentId)],
);

// Vecteurs : stockés en real[] (repli natif). En production avec pgvector,
// une colonne `vector` est ajoutée par scripts/enable-pgvector.sql.
export const embeddings = pgTable(
  "embeddings",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    chunkId: text("chunk_id").notNull().references(() => documentChunks.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dims: integer("dims").notNull(),
    vector: real("vector").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("embeddings_chunk_idx").on(t.chunkId), index("embeddings_kb_idx").on(t.knowledgeBaseId)],
);

// ─────────────────────────── Conversations ───────────────────────────
export type ConversationChannel = "app" | "widget" | "api";

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    visitorId: text("visitor_id"),
    channel: text("channel").$type<ConversationChannel>().default("app").notNull(),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("conversations_org_idx").on(t.organizationId),
    index("conversations_assistant_idx").on(t.assistantId),
    index("conversations_user_idx").on(t.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    content: text("content").notNull(),
    confidence: real("confidence"),
    refused: boolean("refused").default(false).notNull(),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    provider: text("provider"),
    model: text("model"),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

export const citations = pgTable(
  "citations",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    chunkId: text("chunk_id").references(() => documentChunks.id, { onDelete: "set null" }),
    documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }),
    sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
    sourceName: text("source_name").notNull(),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    snippet: text("snippet").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("citations_message_idx").on(t.messageId)],
);

// ─────────────────────────── Consommation & audit ───────────────────────────
export type UsageType = "question" | "document" | "tokens" | "storage";

export const usageRecords = pgTable(
  "usage_records",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").$type<UsageType>().notNull(),
    quantity: integer("quantity").default(1).notNull(),
    period: text("period").notNull(), // YYYY-MM
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("usage_org_period_idx").on(t.organizationId, t.period)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.organizationId), index("audit_created_idx").on(t.createdAt)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    createdBy: text("created_by"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.keyHash), index("api_keys_org_idx").on(t.organizationId)],
);

export const widgetConfigurations = pgTable(
  "widget_configurations",
  {
    id: id(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(),
    title: text("title").default("Assistant").notNull(),
    welcomeMessage: text("welcome_message"),
    primaryColor: text("primary_color").default("#1E6FE8").notNull(),
    position: text("position").$type<"right" | "left">().default("right").notNull(),
    allowedDomains: jsonb("allowed_domains").$type<string[]>().default([]).notNull(),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    dailyLimitPerVisitor: integer("daily_limit_per_visitor").default(30).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("widget_public_key_idx").on(t.publicKey), uniqueIndex("widget_assistant_idx").on(t.assistantId)],
);

// ─────────────────────────── Demandes (contact / démonstration) ───────────────────────────
export type LeadKind = "contact" | "demo";
export type LeadStatus = "new" | "in_progress" | "done" | "archived";

export const leads = pgTable(
  "leads",
  {
    id: id(),
    kind: text("kind").$type<LeadKind>().notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    organization: text("organization"),
    sector: text("sector"),
    // Démonstration : présentiel ou visioconférence
    mode: text("mode").$type<"presentiel" | "visio" | null>(),
    preferredDate: text("preferred_date"),
    message: text("message"),
    status: text("status").$type<LeadStatus>().default("new").notNull(),
    handledBy: text("handled_by"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("leads_status_idx").on(t.status), index("leads_created_idx").on(t.createdAt)],
);

export type Lead = typeof leads.$inferSelect;

// ─────────────────────────── Réinitialisation de mot de passe ───────────────────────────
export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_resets_token_idx").on(t.tokenHash), index("password_resets_user_idx").on(t.userId)],
);

// ─────────────────────────── Relations ───────────────────────────
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  subscriptions: many(subscriptions),
  knowledgeBases: many(knowledgeBases),
  assistants: many(assistants),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  organization: one(organizations, { fields: [subscriptions.organizationId], references: [organizations.id] }),
}));

export const assistantsRelations = relations(assistants, ({ many, one }) => ({
  knowledgeBases: many(assistantKnowledgeBases),
  widget: one(widgetConfigurations, { fields: [assistants.id], references: [widgetConfigurations.assistantId] }),
}));

export const assistantKnowledgeBasesRelations = relations(assistantKnowledgeBases, ({ one }) => ({
  assistant: one(assistants, { fields: [assistantKnowledgeBases.assistantId], references: [assistants.id] }),
  knowledgeBase: one(knowledgeBases, { fields: [assistantKnowledgeBases.knowledgeBaseId], references: [knowledgeBases.id] }),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  knowledgeBase: one(knowledgeBases, { fields: [sources.knowledgeBaseId], references: [knowledgeBases.id] }),
}));

export const messagesRelations = relations(messages, ({ many, one }) => ({
  citations: many(citations),
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const citationsRelations = relations(citations, ({ one }) => ({
  message: one(messages, { fields: [citations.messageId], references: [messages.id] }),
}));

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Assistant = typeof assistants.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Citation = typeof citations.$inferSelect;
