import { expect, it } from "vitest";
import { imageName } from "./image-name";

it("names images after the project, then what they show", () => {
  expect(imageName("Quizify", "all", "quizzes")).toBe("quizify-diagram.png");
  expect(imageName("Quizify", "table", "quizzes")).toBe("quizify-quizzes.png");
  expect(imageName("Quizify", "linked", "quizzes")).toBe("quizify-quizzes-and-linked.png");
  expect(imageName("  Acme Retail (prod) ", "all", null)).toBe("acme-retail-prod-diagram.png");
  expect(imageName("", "table", "Order Items")).toBe("order-items.png");
  expect(imageName(null, "all", null)).toBe("diagram.png");
});
