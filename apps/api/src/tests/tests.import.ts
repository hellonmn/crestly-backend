import type { TestImportResult, TestQuestionUpsert } from "@crestly/shared";

/* ============================================================
   Parse pasted text / CSV into draft questions.

   Two formats (see the doc-comment on TestImportRequestSchema):
     • block text — prompt line + '*'/'-' MCQ options or '=' answers,
       blank line between questions. Easy to paste from Google Docs.
     • CSV/TSV — header row: type,prompt,marks,options,correct,accepted,caseSensitive

   Returns whatever parsed cleanly plus a list of human-readable errors
   for the bits that didn't — the teacher reviews before saving.
   ============================================================ */

export function parseQuestions(
  text: string,
  format: "auto" | "text" | "csv",
): TestImportResult {
  const fmt = format === "auto" ? detectFormat(text) : format;
  return fmt === "csv" ? parseCsv(text) : parseBlocks(text);
}

function detectFormat(text: string): "text" | "csv" {
  const first = (text.split(/\r?\n/).find((l) => l.trim()) ?? "").toLowerCase();
  const looksCsv = /\btype\b/.test(first) && /\bprompt\b/.test(first) && /[,\t]/.test(first);
  return looksCsv ? "csv" : "text";
}

/* ─────────────────── block text ─────────────────── */

function parseBlocks(text: string): TestImportResult {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  const questions: TestQuestionUpsert[] = [];
  const errors: string[] = [];

  blocks.forEach((lines, i) => {
    const head = lines[0]!;
    const { prompt, marks } = extractMarks(head);
    const rest = lines.slice(1);

    const accepted = rest.filter((l) => l.startsWith("=")).map((l) => l.slice(1).trim()).filter(Boolean);
    const optionLines = rest.filter((l) => l.startsWith("*") || l.startsWith("-"));

    const label = `Q${i + 1} "${prompt.slice(0, 40)}${prompt.length > 40 ? "…" : ""}"`;

    if (accepted.length && optionLines.length) {
      errors.push(`${label}: mixed MCQ options and '=' answers — pick one.`);
      return;
    }

    if (optionLines.length) {
      const options = optionLines.map((l) => ({ text: l.slice(1).trim() })).filter((o) => o.text);
      const correctOptions = optionLines
        .map((l, idx) => (l.startsWith("*") ? idx : -1))
        .filter((x) => x >= 0);
      if (options.length < 2) { errors.push(`${label}: MCQ needs at least 2 options.`); return; }
      if (correctOptions.length < 1) { errors.push(`${label}: mark a correct option with '*'.`); return; }
      questions.push({ type: "mcq", prompt, marks, options, correctOptions, caseSensitive: false });
    } else if (accepted.length) {
      questions.push({ type: "fill_blank", prompt, marks, acceptedAnswers: accepted, caseSensitive: false });
    } else {
      errors.push(`${label}: no options ('*'/'-') or answers ('=') found.`);
    }
  });

  return { questions, errors };
}

/* ─────────────────── CSV / TSV ─────────────────── */

function parseCsv(text: string): TestImportResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  const questions: TestQuestionUpsert[] = [];
  const errors: string[] = [];
  if (lines.length < 2) return { questions, errors: ["CSV has no data rows."] };

  const delim = lines[0]!.includes("\t") ? "\t" : ",";
  const header = lines[0]!.split(delim).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    type: col("type"), prompt: col("prompt"), marks: col("marks"),
    options: col("options"), correct: col("correct"),
    accepted: col("accepted"), caseSensitive: col("casesensitive"),
  };
  if (idx.type < 0 || idx.prompt < 0) {
    return { questions, errors: ["CSV header must include at least 'type' and 'prompt'."] };
  }

  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r]!.split(delim);
    const get = (c: number) => (c >= 0 ? (cells[c] ?? "").trim() : "");
    const type = get(idx.type).toLowerCase();
    const prompt = get(idx.prompt);
    const marks = clampMarks(Number(get(idx.marks)));
    const caseSensitive = /^(1|true|yes)$/i.test(get(idx.caseSensitive));
    const label = `Row ${r + 1} "${prompt.slice(0, 40)}"`;
    if (!prompt) { errors.push(`${label}: empty prompt.`); continue; }

    if (type === "mcq") {
      const options = pipeSplit(get(idx.options)).map((t) => ({ text: t }));
      const correctOptions = pipeSplit(get(idx.correct)).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
      if (options.length < 2) { errors.push(`${label}: MCQ needs ≥2 options (pipe-separated).`); continue; }
      if (!correctOptions.length || correctOptions.some((n) => n >= options.length)) {
        errors.push(`${label}: 'correct' must be 0-based option indices.`); continue;
      }
      questions.push({ type: "mcq", prompt, marks, options, correctOptions, caseSensitive });
    } else if (type === "fill_blank" || type === "fill") {
      const acceptedAnswers = pipeSplit(get(idx.accepted));
      if (!acceptedAnswers.length) { errors.push(`${label}: provide 'accepted' answers (pipe-separated).`); continue; }
      questions.push({ type: "fill_blank", prompt, marks, acceptedAnswers, caseSensitive });
    } else {
      errors.push(`${label}: type must be 'mcq' or 'fill_blank'.`);
    }
  }

  return { questions, errors };
}

/* ─────────────────── helpers ─────────────────── */

function extractMarks(line: string): { prompt: string; marks: number } {
  const m = line.match(/\[(\d{1,3})\]\s*$/);
  if (m) return { prompt: line.slice(0, m.index).trim(), marks: clampMarks(Number(m[1])) };
  return { prompt: line, marks: 1 };
}

function clampMarks(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(100, Math.floor(n));
}

function pipeSplit(s: string): string[] {
  return s.split("|").map((x) => x.trim()).filter(Boolean);
}
