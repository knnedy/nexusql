package projects

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/knnedy/nexusql/internal/db"
)

var (
	ErrProjectNotFound = errors.New("project not found")
	ErrProjectExists   = errors.New("project with that name already exists")
)

type Project struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	URI          string      `json:"uri"`
	Provider     db.Provider `json:"provider"`
	CreatedAt    time.Time   `json:"created_at"`
	LastOpenedAt time.Time   `json:"last_opened_at"`
}

type store struct {
	mu       sync.RWMutex
	projects map[string]*Project
	path     string
}

type Store interface {
	List() []*Project
	Get(id string) (*Project, error)
	Create(name, uri string, provider db.Provider) (*Project, error)
	Delete(id string) error
	Touch(id string) error
}

func NewStore() (Store, error) {
	dir, err := nexusqlDir()
	if err != nil {
		return nil, err
	}

	path := filepath.Join(dir, "projects.json")

	s := &store{
		projects: make(map[string]*Project),
		path:     path,
	}

	if err := s.load(); err != nil {
		return nil, fmt.Errorf("load projects: %w", err)
	}

	return s, nil
}

func (s *store) List() []*Project {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]*Project, 0, len(s.projects))
	for _, p := range s.projects {
		list = append(list, p)
	}

	return list
}

func (s *store) Get(id string) (*Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	p, ok := s.projects[id]
	if !ok {
		return nil, ErrProjectNotFound
	}
	return p, nil
}

func (s *store) Create(name, uri string, provider db.Provider) (*Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, p := range s.projects {
		if p.Name == name {
			return nil, ErrProjectExists
		}
	}

	id := generateID()
	now := time.Now()

	p := &Project{
		ID:           id,
		Name:         name,
		URI:          uri,
		Provider:     provider,
		CreatedAt:    now,
		LastOpenedAt: now,
	}

	s.projects[id] = p

	if err := s.persist(); err != nil {
		delete(s.projects, id)
		return nil, fmt.Errorf("persist project: %w", err)
	}

	return p, nil
}

func (s *store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.projects[id]; !ok {
		return ErrProjectNotFound
	}

	delete(s.projects, id)

	if err := s.persist(); err != nil {
		return fmt.Errorf("persist after delete: %w", err)
	}

	return nil
}

func (s *store) Touch(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, ok := s.projects[id]
	if !ok {
		return ErrProjectNotFound
	}

	p.LastOpenedAt = time.Now()

	if err := s.persist(); err != nil {
		return fmt.Errorf("persist touch: %w", err)
	}

	return nil
}

func (s *store) load() error {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}

	var list []*Project
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}

	for _, p := range list {
		s.projects[p.ID] = p
	}

	return nil
}

func (s *store) persist() error {
	list := make([]*Project, 0, len(s.projects))
	for _, p := range s.projects {
		list = append(list, p)
	}

	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.path, data, 0600)
}

func nexusqlDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}

	dir := filepath.Join(home, ".nexusql")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("create .nexusql dir: %w", err)
	}

	return dir, nil
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
