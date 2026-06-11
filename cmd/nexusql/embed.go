package main

import "embed"

//go:embed all:out
var staticFiles embed.FS
