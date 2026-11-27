import { afterEach, describe, expect, it } from "vitest";
import { clampHeight, errorLine, isNumeric, loadHistory, nearMiss, saveHistory, toRun } from "./console";

describe("toRun", () => {
  const sql = "SELECT 1;\n\nSELECT 2\nFROM t;";
  it("runs the whole script when nothing is selected", () => {
    expect(toRun(sql, 4, 4)).toEqual({ sql, lines: null });
  });
  it("runs only the selection, naming its lines", () => {
    expect(toRun(sql, 11, sql.length)).toEqual({ sql: "SELECT 2\nFROM t;", lines: [3, 4] });
  });
  it("treats a selection of blanks as no selection", () => {
    expect(toRun(sql, 9, 11)).toEqual({ sql, lines: null });
  });
});

describe("nearMiss", () => {
  const tables = ["quiz_attempts", "quizzes", "users"];
  it("suggests the table a misspelt name in the error was meant to be", () => {
    expect(nearMiss("no such table: quiz_attempt", tables, "SELECT * FROM quiz_attempt")).toEqual({ wrong: "quiz_attempt", meant: "quiz_attempts" });
    expect(nearMiss('relation "usres" does not exist', tables, "SELECT * FROM usres")).toEqual({ wrong: "usres", meant: "users" });
    expect(nearMiss("Table 'shop.quizes' doesn't exist", tables, "SELECT * FROM shop.quizes")).toEqual({ wrong: "quizes", meant: "quizzes" });
  });
  it("only weighs words from the SQL that ran, so short names count and the error's own words don't", () => {
    expect(nearMiss("no such table: pet", ["pets", "tables"], "SELECT * FROM pet")).toEqual({ wrong: "pet", meant: "pets" });
    expect(nearMiss("no such table: x", ["tables"], "SELECT * FROM x")).toBeNull();
  });
  it("says nothing when no word is near a table, or the name is right", () => {
    expect(nearMiss("syntax error at or near \"FORM\"", tables, "SELECT * FORM users")).toBeNull();
    expect(nearMiss("no such column: users.nmae", tables, "SELECT users.nmae FROM users")).toBeNull();
  });
});

describe("errorLine", () => {
  it("finds the line that holds a word, whole words only", () => {
    expect(errorLine("SELECT *\nFROM quiz_attempts_x\nJOIN quiz_attempt a", "quiz_attempt")).toBe(3);
    expect(errorLine("SELECT 1", "nope")).toBeNull();
  });
});

describe("isNumeric", () => {
  it("right-aligns numbers by type, or by value when the type is unknown", () => {
    expect(isNumeric("int4", "7")).toBe(true);
    expect(isNumeric("numeric", "7.5")).toBe(true);
    expect(isNumeric("text", 7)).toBe(false);
    expect(isNumeric("", 7)).toBe(true);
    expect(isNumeric("", "7")).toBe(false);
    expect(isNumeric("interval", "1 day")).toBe(false);
  });
});

describe("clampHeight", () => {
  it("keeps the dock between a usable minimum and the room there is", () => {
    expect(clampHeight(50, 600)).toBe(120);
    expect(clampHeight(300, 600)).toBe(300);
    expect(clampHeight(900, 600)).toBe(600);
  });
});

describe("history", () => {
  afterEach(() => localStorage.clear());
  it("keeps each project's history apart, across reloads", () => {
    saveHistory("a", [{ sql: "SELECT 1", ranAt: 1 }]);
    expect(loadHistory("a")).toEqual([{ sql: "SELECT 1", ranAt: 1 }]);
    expect(loadHistory("b")).toEqual([]);
    expect(loadHistory(null)).toEqual([]);
  });
  it("ignores what it can't read", () => {
    localStorage.setItem("nexusql.history.a", "{not json");
    expect(loadHistory("a")).toEqual([]);
  });
});
