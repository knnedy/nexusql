import { sql } from 'drizzle-orm';
import { type AnyPgColumn, bigint, boolean, char, customType, date, foreignKey, index, integer, interval, jsonb, numeric, pgEnum, pgTable, primaryKey, real, serial, smallint, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

// bytea has no drizzle-orm builder.
const byteaType = customType<{ data: string }>({ dataType: () => 'bytea' });

export const task_statusEnum = pgEnum('task_status', ['todo', 'in progress', 'done']);

export const audit_log = pgTable('audit_log', {
  at: timestamp('at'),
  msg: text('msg'),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  parent_id: integer('parent_id').references((): AnyPgColumn => categories.id),
  slug: varchar('slug', { length: 40 }).notNull(),
}, (t) => [
  unique().on(t.parent_id, t.slug),
]);

export const invites = pgTable('invites', {
  id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
  email: varchar('email', { length: 255 }).references((): AnyPgColumn => users.email, { onDelete: 'set null' }),
});

export const offices = pgTable('offices', {
  id: integer('id').primaryKey(),
  country: char('country', { length: 2 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
}, (t) => [
  foreignKey({ columns: [t.country, t.code], foreignColumns: [regions.country, regions.code] }).onDelete('cascade').onUpdate('cascade'),
]);

export const order_items = pgTable('order items', {
  id: serial('id').primaryKey(),
  unit_price: real('unit price'),
  qty: integer('qty').notNull(),
  note: varchar('note', { length: 20 }),
});

export const post_tags = pgTable('post_tags', {
  post_id: bigint('post_id', { mode: 'bigint' }).notNull().references((): AnyPgColumn => posts.id, { onDelete: 'cascade' }),
  tag_code: varchar('tag_code', { length: 20 }).notNull().references((): AnyPgColumn => tags.code),
}, (t) => [
  primaryKey({ columns: [t.post_id, t.tag_code] }),
]);

export const posts = pgTable('posts', {
  id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
  author_id: integer('author_id').notNull().references((): AnyPgColumn => users.id),
  editor_id: integer('editor_id').references((): AnyPgColumn => users.id),
  title: varchar('title', { length: 200 }).notNull().default('it\'s "new"'),
  status: task_statusEnum('status').notNull().default('todo'),
  body: byteaType('body'),
  score: numeric('score', { precision: 10, scale: 2 }).default('1.50'),
  ratio: real('ratio'),
  published_on: date('published_on'),
  span: interval('span'),
}, (t) => [
  index('by_author').on(t.author_id, t.published_on),
  index('posts_title_idx').on(t.title),
]);

export const regions = pgTable('regions', {
  country: char('country', { length: 2 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.country, t.code] }),
]);

export const tags = pgTable('tags', {
  code: varchar('code', { length: 20 }).primaryKey(),
  label: text('label'),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: text('name'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  joined: timestamp('joined', { precision: 3 }).defaultNow(),
  active: boolean('active').notNull().default(true),
  settings: jsonb('settings').default(sql`'{}'::jsonb`),
  uid: uuid('uid').notNull().default(sql`gen_random_uuid()`),
  visits: smallint('visits').notNull().default(-1),
});
