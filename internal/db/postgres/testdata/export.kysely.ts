import type { ColumnType, Generated, GeneratedAlways } from 'kysely';

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Json = ColumnType<JsonValue, string, string>;

export type JsonArray = JsonValue[];
export type JsonObject = { [x: string]: JsonValue | undefined };
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type TaskStatus = 'todo' | 'in progress' | 'done';

export interface AuditLog {
  at: Timestamp | null;
  msg: string | null;
}

export interface Categories {
  id: Generated<number>;
  parent_id: number | null;
  slug: string;
}

export interface Invites {
  id: Generated<number>;
  email: string | null;
}

export interface Offices {
  id: number;
  country: string;
  code: string;
}

export interface OrderItems {
  id: Generated<number>;
  'unit price': number | null;
  qty: number;
  note: string | null;
}

export interface PostTags {
  post_id: Int8;
  tag_code: string;
}

export interface Posts {
  id: GeneratedAlways<Int8>;
  author_id: number;
  editor_id: number | null;
  title: Generated<string>;
  status: Generated<TaskStatus>;
  body: Buffer | null;
  score: Generated<Numeric | null>;
  ratio: number | null;
  published_on: Timestamp | null;
  span: unknown;
}

export interface Regions {
  country: string;
  code: string;
}

export interface Tags {
  code: string;
  label: string | null;
}

export interface Users {
  id: Generated<number>;
  email: string;
  name: string | null;
  created_at: Generated<Timestamp>;
  joined: Generated<Timestamp | null>;
  active: Generated<boolean>;
  settings: Generated<Json | null>;
  uid: Generated<string>;
  visits: Generated<number>;
}

export interface DB {
  audit_log: AuditLog;
  categories: Categories;
  invites: Invites;
  offices: Offices;
  'order items': OrderItems;
  post_tags: PostTags;
  posts: Posts;
  regions: Regions;
  tags: Tags;
  users: Users;
}
