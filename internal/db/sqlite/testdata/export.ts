import { sql } from 'drizzle-orm';
import { type AnySQLiteColumn, blob, foreignKey, index, integer, numeric, primaryKey, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const audit_log = sqliteTable('audit_log', {
  at: text('at'),
  msg: text('msg'),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey(),
  parent_id: integer('parent_id').references((): AnySQLiteColumn => categories.id),
  slug: text('slug').notNull(),
}, (t) => [
  unique().on(t.parent_id, t.slug),
]);

export const invites = sqliteTable('invites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').references((): AnySQLiteColumn => users.email, { onDelete: 'set null' }),
});

export const offices = sqliteTable('offices', {
  id: integer('id').primaryKey(),
  country: text('country').notNull(),
  code: text('code').notNull(),
}, (t) => [
  foreignKey({ columns: [t.country, t.code], foreignColumns: [regions.country, regions.code] }).onDelete('cascade').onUpdate('cascade'),
]);

export const order_items = sqliteTable('order items', {
  id: integer('id').primaryKey(),
  unit_price: real('unit price'),
  qty: integer('qty').notNull(),
  tag: text('tag').default('at :noon'),
});

export const post_tags = sqliteTable('post_tags', {
  post_id: integer('post_id').notNull().references((): AnySQLiteColumn => posts.id, { onDelete: 'cascade' }),
  tag_code: text('tag_code').notNull().references((): AnySQLiteColumn => tags.code),
}, (t) => [
  primaryKey({ columns: [t.post_id, t.tag_code] }),
]);

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  author_id: integer('author_id').notNull().references((): AnySQLiteColumn => users.id),
  editor_id: integer('editor_id').references((): AnySQLiteColumn => users.id),
  title: text('title').notNull().default('it\'s "new"'),
  status: text('status', { enum: ['todo', 'in progress', 'done'] }).notNull().default('todo'),
  body: blob('body'),
  score: numeric('score').default('1.50'),
  ratio: real('ratio'),
  stamp: text('stamp').default(sql`(datetime('now'))`),
}, (t) => [
  index('by_author').on(t.author_id, t.stamp),
  index('posts_title_idx').on(t.title),
]);

export const regions = sqliteTable('regions', {
  country: text('country'),
  code: text('code'),
}, (t) => [
  primaryKey({ columns: [t.country, t.code] }),
]);

export const tags = sqliteTable('tags', {
  code: text('code').primaryKey(),
  label: text('label'),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  joined: text('joined').default(sql`CURRENT_TIMESTAMP`),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  settings: text('settings', { mode: 'json' }),
  visits: integer('visits').notNull().default(0),
});
