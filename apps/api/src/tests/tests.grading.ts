import type { Prisma } from "@prisma/client";
import type { McqOption, QuestionType, TestQuestion } from "@crestly/shared";

/* ============================================================
   Pure test helpers — JSON (de)serialisation + auto-grading.

   Question storage:
     options_json  MCQ option list   →  [{ "text": "..." }]
     answer_json   answer key        →  mcq: [0,2]   fill_blank: ["Paris","paris"]
   ============================================================ */

type QuestionRow = Prisma.test_questionsGetPayload<Record<string, never>>;

/** Parsed answer key — never sent to students. */
export interface ParsedQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  marks: number;
  sortOrder: number;
  options: McqOption[] | null;
  correctOptions: number[] | null;
  acceptedAnswers: string[] | null;
  caseSensitive: boolean;
}

export function parseQuestion(q: QuestionRow): ParsedQuestion {
  const isMcq = q.q_type === "mcq";
  const answer = safeJson<unknown[]>(q.answer_json, []);
  return {
    id: q.id,
    type: q.q_type,
    prompt: q.prompt,
    marks: q.marks,
    sortOrder: q.sort_order,
    options: isMcq ? safeJson<McqOption[]>(q.options_json, []) : null,
    correctOptions: isMcq ? (answer as number[]) : null,
    acceptedAnswers: isMcq ? null : (answer as string[]),
    caseSensitive: Boolean(q.case_sensitive),
  };
}

/** Staff-facing DTO (carries the answer key). */
export function toTestQuestionDto(q: QuestionRow): TestQuestion {
  const p = parseQuestion(q);
  return {
    id: p.id,
    type: p.type,
    prompt: p.prompt,
    marks: p.marks,
    sortOrder: p.sortOrder,
    options: p.options,
    correctOptions: p.correctOptions,
    acceptedAnswers: p.acceptedAnswers,
    caseSensitive: p.caseSensitive,
  };
}

/** Grade a single answer. Returns correctness + marks awarded (all-or-nothing). */
export function gradeAnswer(
  q: ParsedQuestion,
  selectedOptions: number[] | undefined,
  responseText: string | undefined,
): { isCorrect: boolean; awarded: number } {
  let isCorrect = false;
  if (q.type === "mcq") {
    isCorrect = setEquals(selectedOptions ?? [], q.correctOptions ?? []);
  } else {
    isCorrect = matchesFill(responseText ?? "", q.acceptedAnswers ?? [], q.caseSensitive);
  }
  return { isCorrect, awarded: isCorrect ? q.marks : 0 };
}

/* ─────────────────── internals ─────────────────── */

function setEquals(a: number[], b: number[]): boolean {
  const sa = [...new Set(a)].sort((x, y) => x - y);
  const sb = [...new Set(b)].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

function matchesFill(response: string, accepted: string[], caseSensitive: boolean): boolean {
  const norm = (s: string) => {
    const t = s.trim().replace(/\s+/g, " ");
    return caseSensitive ? t : t.toLowerCase();
  };
  const r = norm(response);
  if (!r) return false;
  return accepted.some((a) => norm(a) === r);
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
