import type { Generated } from 'kysely';

export interface AuditLog {
  at: string | null;
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
  id: number | null;
  country: string;
  code: string;
}

export interface OrderItems {
  id: Generated<number>;
  'unit price': number | null;
  qty: number;
}

export interface PostTags {
  post_id: number;
  tag_code: string;
}

export interface Posts {
  id: Generated<number>;
  author_id: number;
  editor_id: number | null;
  title: Generated<string>;
  status: Generated<string>;
  body: Buffer | null;
  score: Generated<number | null>;
  ratio: number | null;
  stamp: Generated<string | null>;
}

export interface Regions {
  country: string | null;
  code: string | null;
}

export interface Tags {
  code: string | null;
  label: string | null;
}

export interface Users {
  id: Generated<number>;
  email: string;
  name: string | null;
  created_at: Generated<string>;
  joined: Generated<string | null>;
  active: Generated<number>;
  settings: string | null;
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
