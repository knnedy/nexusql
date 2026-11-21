package seed

import (
	"fmt"
	"slices"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// link is a foreign key the seeder fills with every key column of one parent row.
type link struct {
	db.Relation
	nullable bool // every source column accepts NULL
	deferred bool // NULL on insert, filled once every table is seeded
}

func (l *link) self() bool { return l.SourceTable == l.TargetTable }

// orders reports whether l decides insert order.
func (l *link) orders() bool { return !l.deferred && !l.self() }

// plan orders tables so each comes after the tables it references. Nullable
// self-references, and one nullable key on each cycle, are deferred.
func plan(schema *db.Schema) ([]string, map[string][]*link, error) {
	fields := map[string]map[string]db.Field{}
	var names []string
	for _, t := range schema.Tables {
		names = append(names, t.Name)
		fields[t.Name] = map[string]db.Field{}
		for _, f := range t.Fields {
			fields[t.Name][f.Name] = f
		}
	}
	slices.Sort(names)

	links := map[string][]*link{}
	var all []*link
	for _, r := range schema.Relations {
		src := fields[r.SourceTable]
		if src == nil || fields[r.TargetTable] == nil {
			continue
		}
		if len(r.SourceFields) == 0 {
			r.SourceFields, r.TargetFields = []string{r.SourceField}, []string{r.TargetField}
		}
		l := &link{Relation: r, nullable: true}
		for _, name := range r.SourceFields {
			l.nullable = l.nullable && src[name].Nullable
		}
		l.deferred = l.self() && l.nullable
		links[r.SourceTable] = append(links[r.SourceTable], l)
		all = append(all, l)
	}

	for {
		order, stuck := topo(names, all)
		if len(stuck) == 0 {
			return order, links, nil
		}
		l := breakable(all)
		if l == nil {
			return nil, nil, fmt.Errorf("foreign keys form a cycle with no nullable column to fill in later: %s",
				strings.Join(stuck, ", "))
		}
		l.deferred = true
	}
}

// topo returns the tables whose references can be inserted first, in order,
// and the tables left waiting on a cycle.
func topo(names []string, all []*link) (order, stuck []string) {
	waits := map[string][]string{}
	for _, l := range all {
		if l.orders() {
			waits[l.SourceTable] = append(waits[l.SourceTable], l.TargetTable)
		}
	}
	done := map[string]bool{}
	for progress := true; progress; {
		progress = false
		for _, n := range names {
			if !done[n] && !slices.ContainsFunc(waits[n], func(d string) bool { return !done[d] }) {
				done[n], progress = true, true
				order = append(order, n)
			}
		}
	}
	for _, n := range names {
		if !done[n] {
			stuck = append(stuck, n)
		}
	}
	return order, stuck
}

// breakable returns the first nullable key that lies on a cycle.
func breakable(all []*link) *link {
	for _, l := range all {
		if l.orders() && l.nullable && reaches(all, l.TargetTable, l.SourceTable) {
			return l
		}
	}
	return nil
}

// reaches reports whether table from references table to, directly or not.
func reaches(all []*link, from, to string) bool {
	seen := map[string]bool{from: true}
	queue := []string{from}
	for len(queue) > 0 {
		n := queue[0]
		queue = queue[1:]
		if n == to {
			return true
		}
		for _, l := range all {
			if l.orders() && l.SourceTable == n && !seen[l.TargetTable] {
				seen[l.TargetTable] = true
				queue = append(queue, l.TargetTable)
			}
		}
	}
	return false
}
