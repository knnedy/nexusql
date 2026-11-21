package studio

import (
	"context"
	"errors"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

// ConnectResult describes a freshly opened connection.
type ConnectResult struct {
	Provider  db.ProviderKind
	ProjectID string // empty when no matching project could be created or found
}

// Connect replaces any active connection and records it as a project.
func (s *Service) Connect(ctx context.Context, uri, name string) (ConnectResult, error) {
	if uri == "" {
		return ConnectResult{}, invalid(errors.New("uri is required"))
	}

	if s.session.IsConnected() {
		s.session.Clear()
	}

	conn, err := db.Connect(context.Background(), uri)
	if err != nil {
		return ConnectResult{}, invalid(err)
	}

	if err := s.session.Set(conn); err != nil {
		conn.Close()
		return ConnectResult{}, err
	}

	if name == "" {
		name = fmt.Sprintf("Project %s", conn.Kind)
	}

	res := ConnectResult{Provider: conn.Kind}
	p, err := s.projects.Create(name, uri, conn.Kind)
	if err != nil {
		// name taken: reuse the project that already has this URI, if any
		for _, existing := range s.projects.List() {
			if existing.URI == uri {
				res.ProjectID = existing.ID
				break
			}
		}
		return res, nil
	}

	res.ProjectID = p.ID
	return res, nil
}

// Disconnect closes the active connection.
func (s *Service) Disconnect() error {
	if !s.session.IsConnected() {
		return ErrNoConnection
	}
	s.session.Clear()
	return nil
}

func (s *Service) conn() (*db.Connection, error) {
	return s.session.Get()
}
