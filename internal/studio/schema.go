package studio

import (
	"context"
	"fmt"
	"sync"

	"github.com/knnedy/nexusql/internal/db"
)

// schemaCache holds the active connection's default schema, the only source
// of identifiers that may reach a provider.
type schemaCache struct {
	mu     sync.Mutex
	conn   *db.Connection
	schema *db.Schema
}

// get returns the cached schema for conn, introspecting it when missing or forced.
func (c *schemaCache) get(ctx context.Context, conn *db.Connection, force bool) (*db.Schema, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !force && c.conn == conn && c.schema != nil {
		return c.schema, nil
	}
	sch, err := conn.Impl.IntrospectSchema(ctx, conn.Impl.DefaultSchema())
	if err != nil {
		return nil, err
	}
	c.conn, c.schema = conn, sch
	return sch, nil
}

// invalidate drops the cache, e.g. after console SQL that may have run DDL.
func (c *schemaCache) invalidate() {
	c.mu.Lock()
	c.conn, c.schema = nil, nil
	c.mu.Unlock()
}

// table resolves a client-supplied table name, re-introspecting once on a miss
// so tables created outside NexusQL are found.
func (s *Service) table(ctx context.Context, conn *db.Connection, name string) (db.Table, error) {
	for _, force := range []bool{false, true} {
		sch, err := s.schemas.get(ctx, conn, force)
		if err != nil {
			return db.Table{}, err
		}
		if t, ok := sch.Table(name); ok {
			return t, nil
		}
	}
	return db.Table{}, invalid(fmt.Errorf("unknown table %q", name))
}

// field resolves a client-supplied column name of t.
func field(t db.Table, name string) (db.Field, error) {
	if f, ok := t.Field(name); ok {
		return f, nil
	}
	return db.Field{}, invalid(fmt.Errorf("unknown column %q in %s", name, t.Name))
}
