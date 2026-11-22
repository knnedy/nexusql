package export

// Format is one schema export the studio offers, in display order.
type Format struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Language    string `json:"language"` // syntax highlighting name
	Filename    string `json:"filename"`
	render      func(*Model) string
}

// Render renders m in this format.
func (f Format) Render(m *Model) string { return f.render(m) }

var formats = []Format{
	{ID: "sql", Label: "SQL DDL", Description: "CREATE statements for this database", Language: "sql", Filename: "schema.sql", render: SQL},
	{ID: "prisma", Label: "Prisma schema", Description: "Models for schema.prisma", Language: "prisma", Filename: "schema.prisma", render: Prisma},
	{ID: "drizzle", Label: "Drizzle schema", Description: "drizzle-orm table definitions", Language: "typescript", Filename: "schema.ts", render: Drizzle},
	{ID: "dbml", Label: "DBML", Description: "Database Markup Language for dbdiagram.io", Language: "text", Filename: "schema.dbml", render: DBML},
	{ID: "mermaid", Label: "Mermaid ER diagram", Description: "erDiagram for Markdown and docs", Language: "mermaid", Filename: "schema.mmd", render: Mermaid},
}

// Formats lists every export format.
func Formats() []Format { return append([]Format(nil), formats...) }

// Lookup returns the format with this id.
func Lookup(id string) (Format, bool) {
	for _, f := range formats {
		if f.ID == id {
			return f, true
		}
	}
	return Format{}, false
}
