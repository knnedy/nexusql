import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes any cell or header holding a comma, quote, CR or LF", () => {
    expect(toCsv(["a,b", "c"], [{ "a,b": 'say "hi"', c: "one\rtwo" }])).toBe(
      '"a,b",c\n"say ""hi""","one\rtwo"',
    );
    expect(toCsv(["v"], [{ v: "two\nlines" }])).toBe('v\n"two\nlines"');
  });

  it("writes NULL as an empty cell and objects as JSON", () => {
    expect(toCsv(["a", "b"], [{ a: null, b: { k: [1] } }])).toBe('a,b\n,"{""k"":[1]}"');
  });

  it("defuses text a spreadsheet would run as a formula", () => {
    const rows = [
      { v: "=HYPERLINK(\"http://x\")" },
      { v: "+1+1" },
      { v: "-2+3+cmd|' /C calc'!A0" },
      { v: "@SUM(A1)" },
      { v: "\t=1" },
      { v: "\r=1" },
    ];
    expect(toCsv(["v"], rows).split("\n").slice(1)).toEqual([
      '"\'=HYPERLINK(""http://x"")"',
      "'+1+1",
      "'-2+3+cmd|' /C calc'!A0",
      "'@SUM(A1)",
      "'\t=1",
      '"\'\r=1"',
    ]);
  });

  it("guards headers too", () => {
    expect(toCsv(["=cmd"], [])).toBe("'=cmd");
  });

  it("leaves numbers alone, negative and huge ones included", () => {
    const rows = [{ v: -5 }, { v: "-9007199254740993" }, { v: "+1.5e3" }, { v: "-0.25" }];
    expect(toCsv(["v"], rows)).toBe("v\n-5\n-9007199254740993\n+1.5e3\n-0.25");
  });
});
