// Package studio is the application service between HTTP handlers and providers.
// It owns the active connection and is the single home for input validation.
package studio

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
)

// Error classes; handlers map them to status codes with errors.Is.
var (
	ErrNoConnection = session.ErrNoActiveConnection
	ErrInvalid      = errors.New("invalid request")
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("conflict")
	ErrTimeout      = errors.New("timed out")
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

// Config bounds the work one request can make the database do; zero values
// take the defaults.
type Config struct {
	QueryTimeout   time.Duration // per request: a console run, a page of rows, an edit
	ConnectTimeout time.Duration
	MaxRows        int // console rows returned before Truncated is set
}

const (
	DefaultQueryTimeout   = 30 * time.Second
	DefaultConnectTimeout = 10 * time.Second
	DefaultMaxRows        = 1000
)

// Service exposes every studio operation the API offers.
type Service struct {
	session  *session.Store
	projects projects.Store
	schemas  schemaCache
	access   accessMode
	cfg      Config
}

// New returns a Service over the given connection holder and project store.
func New(sess *session.Store, proj projects.Store, cfg Config) *Service {
	if cfg.QueryTimeout <= 0 {
		cfg.QueryTimeout = DefaultQueryTimeout
	}
	if cfg.ConnectTimeout <= 0 {
		cfg.ConnectTimeout = DefaultConnectTimeout
	}
	if cfg.MaxRows <= 0 {
		cfg.MaxRows = DefaultMaxRows
	}
	return &Service{session: sess, projects: proj, cfg: cfg}
}

// bounded applies the query timeout to ctx.
func (s *Service) bounded(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, s.cfg.QueryTimeout)
}

// classify reports a statement stopped by its deadline as ErrTimeout, whatever
// error the driver chose; other failures get class.
func (s *Service) classify(ctx context.Context, err error, class func(error) error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return classed{ErrTimeout, fmt.Errorf("stopped after %s: %w", s.cfg.QueryTimeout, err)}
	}
	return class(err)
}
