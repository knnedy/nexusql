package session

import (
	"errors"
	"sync"

	"github.com/knnedy/nexusql/internal/db"
)

var (
	ErrNoActiveConnection = errors.New("no active database connection")
	ErrAlreadyConnected   = errors.New("a connection is already active, disconnect first")
)

type Store struct {
	mu   sync.RWMutex
	conn *db.Connection
}

func NewStore() *Store {
	return &Store{}
}

func (s *Store) Set(conn *db.Connection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.conn != nil {
		return ErrAlreadyConnected
	}

	s.conn = conn
	return nil
}

func (s *Store) Get() (*db.Connection, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.conn == nil {
		return nil, ErrNoActiveConnection
	}

	return s.conn, nil
}

func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
	}
}

func (s *Store) IsConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.conn != nil
}
