// Package studio is the application service between HTTP handlers and providers.
// It owns the active connection and is the single home for input validation.
package studio

import (
	"errors"

	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
)

// Error classes; handlers map them to status codes with errors.Is.
var (
	ErrNoConnection = session.ErrNoActiveConnection
	ErrInvalid      = errors.New("invalid request")
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("conflict")
)

// classed tags err with a class while keeping err's message unchanged.
type classed struct {
	class error
	err   error
}

func (e classed) Error() string        { return e.err.Error() }
func (e classed) Unwrap() error        { return e.err }
func (e classed) Is(target error) bool { return target == e.class }

func invalid(err error) error { return classed{ErrInvalid, err} }

// Service exposes every studio operation the API offers.
type Service struct {
	session  *session.Store
	projects projects.Store
}

// New returns a Service over the given connection holder and project store.
func New(sess *session.Store, proj projects.Store) *Service {
	return &Service{session: sess, projects: proj}
}
