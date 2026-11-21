package studio

import (
	"errors"
	"sync"

	"github.com/knnedy/nexusql/internal/db"
)

var errReadOnly = classed{ErrConflict, errors.New("the connection is read-only")}

// accessMode remembers the connection switched to read-only; a new
// connection is never it, so every connection starts read-write.
type accessMode struct {
	mu       sync.Mutex
	readOnly *db.Connection
}

func (a *accessMode) is(conn *db.Connection) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.readOnly == conn
}

// ReadOnly reports whether the active connection refuses writes.
func (s *Service) ReadOnly() (bool, error) {
	conn, err := s.conn()
	if err != nil {
		return false, err
	}
	return s.access.is(conn), nil
}

// SetReadOnly switches the active connection's mode. In read-only mode the
// database refuses console writes, and studio refuses row edits and seeding.
func (s *Service) SetReadOnly(on bool) error {
	conn, err := s.conn()
	if err != nil {
		return err
	}
	s.access.mu.Lock()
	defer s.access.mu.Unlock()
	if on {
		s.access.readOnly = conn
	} else {
		s.access.readOnly = nil
	}
	return nil
}
