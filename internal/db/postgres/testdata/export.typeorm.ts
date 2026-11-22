import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, type Relation, Unique } from 'typeorm';

export type TaskStatus = 'todo' | 'in progress' | 'done';

// audit_log has no primary key, which every TypeORM entity needs.

@Entity({ name: 'categories' })
@Unique(['parent_id', 'slug'])
export class Categories {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ type: 'integer', nullable: true })
  parent_id!: number | null;

  @Column({ type: 'character varying', length: 40 })
  slug!: string;

  @ManyToOne(() => Categories, (t) => t.categories_parent)
  @JoinColumn({ name: 'parent_id', referencedColumnName: 'id', foreignKeyConstraintName: 'categories_parent_id_fkey' })
  parent!: Relation<Categories> | null;

  @OneToMany(() => Categories, (t) => t.parent)
  categories_parent!: Categories[];
}

@Entity({ name: 'invites' })
export class Invites {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @Column({ type: 'character varying', length: 255, nullable: true })
  email!: string | null;

  @ManyToOne(() => Users, (t) => t.invites, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'email', referencedColumnName: 'email', foreignKeyConstraintName: 'invites_email_fkey' })
  users!: Relation<Users> | null;
}

@Entity({ name: 'offices' })
export class Offices {
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'character', length: 2 })
  country!: string;

  @Column({ type: 'character varying', length: 10 })
  code!: string;

  @ManyToOne(() => Regions, (t) => t.offices, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'country', referencedColumnName: 'country', foreignKeyConstraintName: 'offices_country_code_fkey' }, { name: 'code', referencedColumnName: 'code', foreignKeyConstraintName: 'offices_country_code_fkey' }])
  regions!: Relation<Regions>;
}

@Entity({ name: 'order items' })
@Check('note_set', '((note)::text <> \'it\'\'s\'::text)')
@Check('order items_qty_check', '(qty > 0)')
@Check('tag_set', '((tag)::text <> \':x\'::text)')
export class OrderItems {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ name: 'unit price', type: 'real', nullable: true })
  unit_price!: number | null;

  @Column({ type: 'integer' })
  qty!: number;

  @Column({ type: 'character varying', length: 20, nullable: true })
  note!: string | null;

  @Column({ type: 'character varying', length: 20, nullable: true, default: 'at :noon' })
  tag!: string | null;
}

@Entity({ name: 'post_tags' })
export class PostTags {
  @PrimaryColumn({ type: 'bigint' })
  post_id!: string;

  @PrimaryColumn({ type: 'character varying', length: 20 })
  tag_code!: string;

  @ManyToOne(() => Posts, (t) => t.post_tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', referencedColumnName: 'id', foreignKeyConstraintName: 'post_tags_post_id_fkey' })
  post!: Relation<Posts>;

  @ManyToOne(() => Tags, (t) => t.post_tags)
  @JoinColumn({ name: 'tag_code', referencedColumnName: 'code', foreignKeyConstraintName: 'post_tags_tag_code_fkey' })
  tags!: Relation<Tags>;
}

@Entity({ name: 'posts' })
@Index('by_author', ['author_id', 'published_on'])
@Index('posts_title_idx', ['title'])
export class Posts {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'integer' })
  author_id!: number;

  @Column({ type: 'integer', nullable: true })
  editor_id!: number | null;

  @Column({ type: 'character varying', length: 200, default: () => '\'it\'\'s "new"\'::character varying' })
  title!: string;

  @Column({ type: 'enum', enum: ['todo', 'in progress', 'done'], enumName: 'task_status', default: 'todo' })
  status!: TaskStatus;

  @Column({ type: 'bytea', nullable: true })
  body!: Buffer | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true, default: '1.50' })
  score!: string | null;

  @Column({ type: 'real', nullable: true })
  ratio!: number | null;

  @Column({ type: 'date', nullable: true })
  published_on!: string | null;

  @Column({ type: 'interval', nullable: true })
  span!: unknown;

  @ManyToOne(() => Users, (t) => t.posts_author)
  @JoinColumn({ name: 'author_id', referencedColumnName: 'id', foreignKeyConstraintName: 'posts_author_id_fkey' })
  author!: Relation<Users>;

  @ManyToOne(() => Users, (t) => t.posts_editor)
  @JoinColumn({ name: 'editor_id', referencedColumnName: 'id', foreignKeyConstraintName: 'posts_editor_id_fkey' })
  editor!: Relation<Users> | null;

  @OneToMany(() => PostTags, (t) => t.post)
  post_tags!: PostTags[];
}

@Entity({ name: 'regions' })
export class Regions {
  @PrimaryColumn({ type: 'character', length: 2 })
  country!: string;

  @PrimaryColumn({ type: 'character varying', length: 10 })
  code!: string;

  @OneToMany(() => Offices, (t) => t.regions)
  offices!: Offices[];
}

@Entity({ name: 'tags' })
export class Tags {
  @PrimaryColumn({ type: 'character varying', length: 20 })
  code!: string;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @OneToMany(() => PostTags, (t) => t.tags)
  post_tags!: PostTags[];
}

@Entity({ name: 'users' })
export class Users {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ type: 'character varying', length: 255, unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamp without time zone', precision: 3, nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  joined!: Date | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  settings!: unknown;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  uid!: string;

  @Column({ type: 'smallint', default: -1 })
  visits!: number;

  @OneToMany(() => Invites, (t) => t.users)
  invites!: Invites[];

  @OneToMany(() => Posts, (t) => t.author)
  posts_author!: Posts[];

  @OneToMany(() => Posts, (t) => t.editor)
  posts_editor!: Posts[];
}
