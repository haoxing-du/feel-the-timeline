import assert from "node:assert/strict";
import test from "node:test";
import { modelForDate } from "../lib/models.ts";

const boundaries = [
  ["2019-11-05", "GPT-2 XL"],
  ["2021-06-08", "GPT-2 XL"],
  ["2021-06-09", "GPT-J 6B"],
  ["2022-10-20", "FLAN-T5 XL"],
  ["2023-07-18", "Llama 2 13B Chat"],
  ["2024-07-23", "Llama 3.1 8B"],
  ["2025-01-20", "DeepSeek-R1"],
  ["2026-03-09", "DeepSeek-R1"],
  ["2026-03-10", "Qwen 3.5 9B"],
];

test("routes release boundaries to the correct exhibit", () => {
  for (const [date, expectedModel] of boundaries) {
    assert.equal(modelForDate(date).name, expectedModel, date);
  }
});
