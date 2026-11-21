package studio

import (
	"context"
	"errors"
	"time"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/projects"
)

// ProjectInfo is a saved project as shown to clients: the URI is redacted.
type ProjectInfo struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	DisplayURI   string          `json:"displayUri"`
	Provider     db.ProviderKind `json:"provider"`
	CreatedAt    time.Time       `json:"createdAt"`
	LastOpenedAt time.Time       `json:"lastOpenedAt"`
}

func infoOf(p *projects.Project) ProjectInfo {
	return ProjectInfo{
		ID: p.ID, Name: p.Name, DisplayURI: db.RedactURI(p.URI), Provider: p.Provider,
		CreatedAt: p.CreatedAt, LastOpenedAt: p.LastOpenedAt,
	}
}

// Projects lists saved projects.
func (s *Service) Projects() []ProjectInfo {
	list := s.projects.List()
	out := make([]ProjectInfo, len(list))
	for i, p := range list {
		out[i] = infoOf(p)
	}
	return out
}

// OpenProject connects to a saved project by id, so its URI never leaves the server.
func (s *Service) OpenProject(ctx context.Context, id string) (ConnectResult, error) {
	p, err := s.projects.Get(id)
	if err != nil {
		return ConnectResult{}, classifyProjectErr(err)
	}
	res, err := s.Connect(ctx, p.URI, p.Name)
	if err != nil {
		return ConnectResult{}, err
	}
	res.ProjectID = p.ID
	return res, classifyProjectErr(s.projects.Touch(p.ID))
}

// CreateProject saves a project for uri without connecting to it.
func (s *Service) CreateProject(name, uri string) (ProjectInfo, error) {
	if name == "" {
		return ProjectInfo{}, invalid(errors.New("name is required"))
	}
	if uri == "" {
		return ProjectInfo{}, invalid(errors.New("uri is required"))
	}
	kind, err := db.DetectProviderKind(uri)
	if err != nil {
		return ProjectInfo{}, invalid(err)
	}
	p, err := s.projects.Create(name, uri, kind)
	if err != nil {
		return ProjectInfo{}, classifyProjectErr(err)
	}
	return infoOf(p), nil
}

// RenameProject changes a project's display name.
func (s *Service) RenameProject(id, name string) error {
	if name == "" {
		return invalid(errors.New("name is required"))
	}
	return classifyProjectErr(s.projects.Rename(id, name))
}

// DeleteProject removes a saved project.
func (s *Service) DeleteProject(id string) error {
	return classifyProjectErr(s.projects.Delete(id))
}

// TouchProject marks a project as opened now.
func (s *Service) TouchProject(id string) error {
	return classifyProjectErr(s.projects.Touch(id))
}

func classifyProjectErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, projects.ErrProjectNotFound):
		return classed{ErrNotFound, err}
	case errors.Is(err, projects.ErrProjectExists):
		return classed{ErrConflict, err}
	default:
		return err
	}
}
