/**
 * No-DB smoke test for the test auto-grader.
 *
 *   npx ts-node --transpile-only -P apps/api/tsconfig.json apps/api/scripts/check-grading.ts
 *
 * Exercises gradeAnswer() across MCQ (single + multi-correct) and
 * fill-in-the-blank (case-insensitive + case-sensitive). Exits non-zero
 * on any failed assertion.
 */

import { gradeAnswer, type ParsedQuestion } from "../src/tests/tests.grading";

let failures = 0;
function check(name: string, got: { isCorrect: boolean; awarded: number }, wantCorrect: boolean, wantMarks: number) {
  const ok = got.isCorrect === wantCorrect && got.awarded === wantMarks;
  console.log(`${ok ? "✓" : "✗"} ${name} — got {correct:${got.isCorrect}, marks:${got.awarded}}`);
  if (!ok) failures++;
}

const mcqSingle: ParsedQuestion = {
  id: 1, type: "mcq", prompt: "Capital of India?", marks: 1, sortOrder: 0,
  options: [{ text: "Mumbai" }, { text: "New Delhi" }, { text: "Kolkata" }],
  correctOptions: [1], acceptedAnswers: null, caseSensitive: false,
};
const mcqMulti: ParsedQuestion = {
  id: 2, type: "mcq", prompt: "Primary colours?", marks: 2, sortOrder: 1,
  options: [{ text: "Red" }, { text: "Green" }, { text: "Blue" }, { text: "Orange" }],
  correctOptions: [0, 2], acceptedAnswers: null, caseSensitive: false,
};
const fillCI: ParsedQuestion = {
  id: 3, type: "fill_blank", prompt: "Symbol for water?", marks: 1, sortOrder: 2,
  options: null, correctOptions: null, acceptedAnswers: ["H2O", "water"], caseSensitive: false,
};
const fillCS: ParsedQuestion = {
  id: 4, type: "fill_blank", prompt: "Case-sensitive code?", marks: 1, sortOrder: 3,
  options: null, correctOptions: null, acceptedAnswers: ["AbC"], caseSensitive: true,
};

check("mcq single correct", gradeAnswer(mcqSingle, [1], undefined), true, 1);
check("mcq single wrong", gradeAnswer(mcqSingle, [0], undefined), false, 0);
check("mcq multi exact", gradeAnswer(mcqMulti, [0, 2], undefined), true, 2);
check("mcq multi reversed order", gradeAnswer(mcqMulti, [2, 0], undefined), true, 2);
check("mcq multi partial (wrong)", gradeAnswer(mcqMulti, [0], undefined), false, 0);
check("mcq multi extra (wrong)", gradeAnswer(mcqMulti, [0, 2, 3], undefined), false, 0);
check("mcq no answer", gradeAnswer(mcqSingle, [], undefined), false, 0);
check("fill case-insensitive match", gradeAnswer(fillCI, undefined, "h2o"), true, 1);
check("fill trims + spaces", gradeAnswer(fillCI, undefined, "  Water  "), true, 1);
check("fill wrong", gradeAnswer(fillCI, undefined, "oxygen"), false, 0);
check("fill case-sensitive match", gradeAnswer(fillCS, undefined, "AbC"), true, 1);
check("fill case-sensitive mismatch", gradeAnswer(fillCS, undefined, "abc"), false, 0);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll grading checks passed.");
