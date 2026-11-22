import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, type Relation, Unique } from 'typeorm';

export type PostsStatus = 'todo' | 'in progress' | 'done';

// audit_log has no primary key, which every TypeORM entity needs.

@Entity({ name: 'categories' })
@Unique(['parent_id', 'slug'])
export class Categories {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id!: number;

  @Column({ type: 'int', nullable: true })
  parent_id!: number | null;

  @Column({ type: 'varchar', length: 40 })
  slug!: string;

  @ManyToOne(() => Categories, (t) => t.categories_parent)
  @JoinColumn({ name: 'parent_id', referencedColumnName: 'id', foreignKeyConstraintName: 'categories_ibfk_1' })
  parent!: Relation<Categories> | null;

  @OneToMany(() => Categories, (t) => t.parent)
  categories_parent!: Categories[];
}

@Entity({ name: 'invites' })
@Index('email', ['email'])
export class Invites {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @ManyToOne(() => Users, (t) => t.invites, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'email', referencedColumnName: 'email', foreignKeyConstraintName: 'invites_ibfk_1' })
  users!: Relation<Users> | null;
}

@Entity({ name: 'offices' })
@Index('country', ['country', 'code'])
export class Offices {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'char', length: 2 })
  country!: string;

  @Column({ type: 'varchar', length: 10 })
  code!: string;

  @ManyToOne(() => Regions, (t) => t.offices, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'country', referencedColumnName: 'country', foreignKeyConstraintName: 'offices_ibfk_1' }, { name: 'code', referencedColumnName: 'code', foreignKeyConstraintName: 'offices_ibfk_1' }])
  regions!: Relation<Regions>;
}

@Entity({ name: 'order items' })
@Check('note_set', '(`note` <> _utf8mb4\'it\\\'s\')')
@Check('order items_chk_1', '(`qty` > 0)')
export class OrderItems {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id!: number;

  @Column({ name: 'unit price', type: 'float', nullable: true })
  unit_price!: number | null;

  @Column({ type: 'int' })
  qty!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  note!: string | null;
}

@Entity({ name: 'post_tags' })
@Index('tag_code', ['tag_code'])
export class PostTags {
  @PrimaryColumn({ type: 'bigint' })
  post_id!: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  tag_code!: string;

  @ManyToOne(() => Posts, (t) => t.post_tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', referencedColumnName: 'id', foreignKeyConstraintName: 'post_tags_ibfk_1' })
  post!: Relation<Posts>;

  @ManyToOne(() => Tags, (t) => t.post_tags)
  @JoinColumn({ name: 'tag_code', referencedColumnName: 'code', foreignKeyConstraintName: 'post_tags_ibfk_2' })
  tags!: Relation<Tags>;
}

@Entity({ name: 'posts' })
@Index('by_author', ['author_id', 'published_on'])
@Index('editor_id', ['editor_id'])
@Index('posts_title_idx', ['title'])
export class Posts {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'int' })
  author_id!: number;

  @Column({ type: 'int', nullable: true })
  editor_id!: number | null;

  @Column({ type: 'varchar', length: 200, default: () => '\'it\'\'s "new"\'' })
  title!: string;

  @Column({ type: 'enum', enum: ['todo', 'in progress', 'done'], default: 'todo' })
  status!: PostsStatus;

  @Column({ type: 'blob', nullable: true })
  body!: Buffer | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: '1.50' })
  score!: string | null;

  @Column({ type: 'float', nullable: true })
  ratio!: number | null;

  @Column({ type: 'date', nullable: true })
  published_on!: string | null;

  @ManyToOne(() => Users, (t) => t.posts_author)
  @JoinColumn({ name: 'author_id', referencedColumnName: 'id', foreignKeyConstraintName: 'posts_ibfk_1' })
  author!: Relation<Users>;

  @ManyToOne(() => Users, (t) => t.posts_editor)
  @JoinColumn({ name: 'editor_id', referencedColumnName: 'id', foreignKeyConstraintName: 'posts_ibfk_2' })
  editor!: Relation<Users> | null;

  @OneToMany(() => PostTags, (t) => t.post)
  post_tags!: PostTags[];
}

@Entity({ name: 'regions' })
export class Regions {
  @PrimaryColumn({ type: 'char', length: 2 })
  country!: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  code!: string;

  @OneToMany(() => Offices, (t) => t.regions)
  offices!: Offices[];
}

@Entity({ name: 'tags' })
export class Tags {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @OneToMany(() => PostTags, (t) => t.tags)
  post_tags!: PostTags[];
}

@Entity({ name: 'users' })
export class Users {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)' })
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  joined!: Date | null;

  @Column({ type: 'tinyint', default: 1 })
  active!: number;

  @Column({ type: 'json', nullable: true })
  settings!: unknown;

  @Column({ type: 'varchar', length: 36, default: () => '(uuid())' })
  uid!: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  visits!: number;

  @OneToMany(() => Invites, (t) => t.users)
  invites!: Invites[];

  @OneToMany(() => Posts, (t) => t.author)
  posts_author!: Posts[];

  @OneToMany(() => Posts, (t) => t.editor)
  posts_editor!: Posts[];
}
