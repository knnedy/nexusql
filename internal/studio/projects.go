package studio

import (
	"errors"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/projects"
)

// Projects lists saved projects.
func (s *Service) Projects() []*projects.Project {
	return s.projects.List()
}

// CreateProject saves a project for uri without connecting to it.
func (s *Service) CreateProject(name, uri string) (*projects.Project, error) {
	if name == "" {
		return nil, invalid(errors.New("name is required"))
	}
	if uri == "" {
		return nil, invalid(errors.New("uri is required"))
	}
	kind, err := db.DetectProviderKind(uri)
	if err != nil {
		return nil, invalid(err)
	}
	p, err := s.projects.Create(name, uri, kind)
	return p, classifyProjectErr(err)
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
