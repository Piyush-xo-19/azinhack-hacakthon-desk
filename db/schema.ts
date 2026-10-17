import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  phone: text('phone').notNull(), team: text('team').notNull().default(''),
  token: text('token').notNull().unique(), createdAt: integer('created_at').notNull(),
});
export const claims = sqliteTable('claims', {
  participantId: text('participant_id').notNull().references(() => participants.id),
  action: text('action').notNull(), at: integer('at').notNull(), actor: text('actor').notNull(),
}, t => [primaryKey({ columns: [t.participantId, t.action] })]);
export const deliveries = sqliteTable('deliveries', {
  participantId: text('participant_id').notNull().references(() => participants.id),
  channel: text('channel').notNull(), status: text('status').notNull(), at: integer('at').notNull(),
  providerId: text('provider_id'), error: text('error'),
}, t => [primaryKey({ columns: [t.participantId, t.channel] })]);
