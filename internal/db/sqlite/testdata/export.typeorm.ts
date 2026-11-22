import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, type Relation, Unique } from 'typeorm';

// audit_log has no primary key, which every TypeORM entity needs.

@Entity({ name: 'categories' })
@Unique(['parent_id', 'slug'])
export class Categories {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ type: 'integer', nullable: true })
  parent_id!: number | null;

  @Column({ type: 'varchar', length: 40 })
  slug!: string;

  @ManyToOne(() => Categories, (t) => t.categories_parent)
  @JoinColumn({ name: 'parent_id', referencedColumnName: 'id' })
  parent!: Relation<Categories> | null;

  @OneToMany(() => Categories, (t) => t.parent)
  categories_parent!: Categories[];
}

@Entity({ name: 'invites' })
export class Invites {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @ManyToOne(() => Users, (t) => t.invites, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'email', referencedColumnName: 'email' })
  users!: Relation<Users> | null;
}

@Entity({ name: 'offices' })
export class Offices {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'character', length: 2 })
  country!: string;

  @Column({ type: 'varchar', length: 10 })
  code!: string;

  @ManyToOne(() => Regions, (t) => t.offices, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'country', referencedColumnName: 'country' }, { name: 'code', referencedColumnName: 'code' }])
  regions!: Relation<Regions>;
}

@Entity({ name: 'order items' })
@Check('tag_set', 'tag <> \':x\'')
export class OrderItems {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ name: 'unit price', type: 'real', nullable: true })
  unit_price!: number | null;

  @Column({ type: 'integer' })
  qty!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'at :noon' })
  tag!: string | null;
}

@Entity({ name: 'post_tags' })
export class PostTags {
  @PrimaryColumn({ type: 'integer' })
  post_id!: number;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  tag_code!: string;

  @ManyToOne(() => Tags, (t) => t.post_tags)
  @JoinColumn({ name: 'tag_code', referencedColumnName: 'code' })
  tags!: Relation<Tags>;

  @ManyToOne(() => Posts, (t) => t.post_tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', referencedColumnName: 'id' })
  post!: Relation<Posts>;
}

@Entity({ name: 'posts' })
@Index('by_author', ['author_id', 'stamp'])
@Index('posts_title_idx', ['title'])
@Check('status IN (\'todo\', \'in progress\', \'done\')')
export class Posts {
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ type: 'integer' })
  author_id!: number;

  @Column({ type: 'integer', nullable: true })
  editor_id!: number | null;

  @Column({ type: 'varchar', length: 200, default: () => '\'it\'\'s "new"\'' })
  title!: string;

  @Column({ type: 'text', default: 'todo' })
  status!: string;

  @Column({ type: 'blob', nullable: true })
  body!: Buffer | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: () => '1.50' })
  score!: number | null;

  @Column({ type: 'real', nullable: true })
  ratio!: number | null;

  @Column({ type: 'text', nullable: true, default: () => 'datetime(\'now\')' })
  stamp!: string | null;

  @ManyToOne(() => Users, (t) => t.posts_editor)
  @JoinColumn({ name: 'editor_id', referencedColumnName: 'id' })
  editor!: Relation<Users> | null;

  @ManyToOne(() => Users, (t) => t.posts_author)
  @JoinColumn({ name: 'author_id', referencedColumnName: 'id' })
  author!: Relation<Users>;

  @OneToMany(() => PostTags, (t) => t.post)
  post_tags!: PostTags[];
}

@Entity({ name: 'regions' })
export class Regions {
  @PrimaryColumn({ type: 'character', length: 2 })
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
  @PrimaryGeneratedColumn('increment', { type: 'integer' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: string;

  @Column({ type: 'datetime', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  joined!: Date | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'json', nullable: true })
  settings!: unknown;

  @Column({ type: 'integer', default: 0 })
  visits!: number;

  @OneToMany(() => Invites, (t) => t.users)
  invites!: Invites[];

  @OneToMany(() => Posts, (t) => t.editor)
  posts_editor!: Posts[];

  @OneToMany(() => Posts, (t) => t.author)
  posts_author!: Posts[];
}
