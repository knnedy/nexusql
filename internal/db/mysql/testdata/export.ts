import { sql } from 'drizzle-orm';
import { type AnyMySqlColumn, bigint, boolean, char, customType, date, datetime, decimal, float, foreignKey, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, timestamp, unique, varchar } from 'drizzle-orm/mysql-core';

// blob has no drizzle-orm builder.
const blobType = customType<{ data: string }>({ dataType: () => 'blob' });

export const audit_log = mysqlTable('audit_log', {
  at: datetime('at'),
  msg: text('msg'),
});

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  parent_id: int('parent_id').references((): AnyMySqlColumn => categories.id),
  slug: varchar('slug', { length: 40 }).notNull(),
}, (t) => [
  unique().on(t.parent_id, t.slug),
]);

export const invites = mysqlTable('invites', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).references((): AnyMySqlColumn => users.email, { onDelete: 'set null' }),
}, (t) => [
  index('email').on(t.email),
]);

export const offices = mysqlTable('offices', {
  id: int('id').primaryKey(),
  country: char('country', { length: 2 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
}, (t) => [
  foreignKey({ columns: [t.country, t.code], foreignColumns: [regions.country, regions.code] }).onDelete('cascade').onUpdate('cascade'),
  index('country').on(t.country, t.code),
]);

export const order_items = mysqlTable('order items', {
  id: int('id').autoincrement().primaryKey(),
  unit_price: float('unit price'),
  qty: int('qty').notNull(),
  note: varchar('note', { length: 20 }),
});

export const post_tags = mysqlTable('post_tags', {
  post_id: bigint('post_id', { mode: 'bigint' }).notNull().references((): AnyMySqlColumn => posts.id, { onDelete: 'cascade' }),
  tag_code: varchar('tag_code', { length: 20 }).notNull().references((): AnyMySqlColumn => tags.code),
}, (t) => [
  primaryKey({ columns: [t.post_id, t.tag_code] }),
  index('tag_code').on(t.tag_code),
]);

export const posts = mysqlTable('posts', {
  id: bigint('id', { mode: 'bigint' }).autoincrement().primaryKey(),
  author_id: int('author_id').notNull().references((): AnyMySqlColumn => users.id),
  editor_id: int('editor_id').references((): AnyMySqlColumn => users.id),
  title: varchar('title', { length: 200 }).notNull().default('it\'s "new"'),
  status: mysqlEnum('status', ['todo', 'in progress', 'done']).notNull().default('todo'),
  body: blobType('body'),
  score: decimal('score', { precision: 10, scale: 2 }).default('1.50'),
  ratio: float('ratio'),
  published_on: date('published_on'),
}, (t) => [
  index('by_author').on(t.author_id, t.published_on),
  index('editor_id').on(t.editor_id),
  index('posts_title_idx').on(t.title),
]);

export const regions = mysqlTable('regions', {
  country: char('country', { length: 2 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.country, t.code] }),
]);

export const tags = mysqlTable('tags', {
  code: varchar('code', { length: 20 }).primaryKey(),
  label: text('label'),
});

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: text('name'),
  created_at: datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  joined: timestamp('joined').default(sql`CURRENT_TIMESTAMP`),
  active: boolean('active').notNull().default(true),
  settings: json('settings'),
  uid: varchar('uid', { length: 36 }).notNull().default(sql`(uuid())`),
  visits: int('visits', { unsigned: true }).notNull().default(0),
});
