/**
 * No-DB smoke test for the question import parser.
 *   npx ts-node --transpile-only -P apps/api/tsconfig.json apps/api/scripts/check-import.ts
 */
import { parseQuestions } from "../src/tests/tests.import";

let failures = 0;
function ok(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failures++;
}

// 1) Block text: one MCQ + one fill-blank, with marks.
const blocks = `What is 2 + 2? [1]
- 3
* 4
- 5

Capital of France is ___ [2]
= Paris
= paris`;
const r1 = parseQuestions(blocks, "auto");
ok("block: 2 questions parsed", r1.questions.length === 2 && r1.errors.length === 0);
ok("block: mcq correct index = 1", r1.questions[0]!.type === "mcq" && JSON.stringify(r1.questions[0]!.correctOptions) === "[1]");
ok("block: mcq marks = 1", r1.questions[0]!.marks === 1);
ok("block: fill answers", r1.questions[1]!.type === "fill_blank" && (r1.questions[1]!.acceptedAnswers?.length === 2));
ok("block: fill marks = 2", r1.questions[1]!.marks === 2);

// 2) MCQ without a correct marker → error, skipped.
const r2 = parseQuestions(`Pick one\n- a\n- b`, "auto");
ok("block: mcq without '*' errors", r2.questions.length === 0 && r2.errors.length === 1);

// 3) Mixed markers → error.
const r3 = parseQuestions(`Bad\n* a\n= b`, "auto");
ok("block: mixed markers error", r3.questions.length === 0 && r3.errors.length === 1);

// 4) CSV.
const csv = `type,prompt,marks,options,correct,accepted,caseSensitive
mcq,2+2?,1,3|4|5,1,,
fill_blank,Capital of France,2,,,Paris|paris,0`;
const r4 = parseQuestions(csv, "auto");
ok("csv: 2 questions", r4.questions.length === 2 && r4.errors.length === 0);
ok("csv: mcq options=3 correct=[1]", r4.questions[0]!.options?.length === 3 && JSON.stringify(r4.questions[0]!.correctOptions) === "[1]");
ok("csv: fill accepted=2", r4.questions[1]!.acceptedAnswers?.length === 2);

if (failures) { console.error(`\n${failures} failed.`); process.exit(1); }
console.log("\nAll import checks passed.");
