/**
 * Demo seed for the new modules: calendar events + an online test.
 *
 * Inserts a handful of `calendar_events` and one published MCQ +
 * fill-blank `tests` row (with questions) into the platform DB so the
 * Calendar, Tests and parent-portal screens have something to show.
 *
 * Idempotent — guards on titles, so re-running won't duplicate.
 *
 *   npm run seed:features -w @crestly/api
 *
 * Customise via env:
 *   FEATURE_CLASS_SLUG=6     (which class the demo test targets)
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { TenantService } from "../src/tenant/tenant.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const db = app.get(TenantService).platform;

    // Resolve the current academic session (fallback to any).
    const session =
      (await db.session.findFirst({ where: { isCurrent: true } })) ??
      (await db.session.findFirst({ orderBy: { code: "desc" } }));
    if (!session) {
      console.error("No academic session found — run the main seed first.");
      return;
    }
    const sessionCode = session.code;

    // Pick a class to target the demo test at — prefer a real student's class.
    const envClass = process.env.FEATURE_CLASS_SLUG?.trim();
    const sampleStudent = await db.student.findFirst({ select: { class: true } });
    const classSlug = envClass || sampleStudent?.class || "1";

    console.log(`Seeding features for session ${sessionCode}, class ${classSlug}…`);

    /* ── Calendar events ── */
    const today = new Date();
    const iso = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const plus = (days: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + days);
      return iso(d);
    };

    const events = [
      { title: "Parent–Teacher Meeting", category: "ptm" as const, start_date: plus(7), audience: "all" as const, location: "School Auditorium" },
      { title: "Annual Sports Day", category: "sports" as const, start_date: plus(14), audience: "all" as const, location: "Main Ground" },
      { title: "Quarterly Fee Due", category: "fee" as const, start_date: plus(3), audience: "parents" as const, is_holiday: false },
      { title: "Staff Meeting", category: "meeting" as const, start_date: plus(1), audience: "staff" as const },
    ];

    for (const e of events) {
      const exists = await db.calendar_events.findFirst({
        where: { session_code: sessionCode, title: e.title },
      });
      if (exists) {
        console.log(`  · calendar event "${e.title}" already present — skipping`);
        continue;
      }
      await db.calendar_events.create({
        data: {
          session_code: sessionCode,
          title: e.title,
          category: e.category,
          start_date: e.start_date,
          all_day: true,
          is_holiday: e.is_holiday ?? false,
          audience: e.audience,
          location: e.location ?? null,
        },
      });
      console.log(`  ✓ calendar event "${e.title}"`);
    }

    /* ── Demo test ── */
    const TEST_TITLE = "Demo Quiz — General Knowledge";
    const already = await db.tests.findFirst({
      where: { session_code: sessionCode, title: TEST_TITLE },
    });
    if (already) {
      console.log(`  · test "${TEST_TITLE}" already present — skipping`);
    } else {
      const questions = [
        {
          q_type: "mcq" as const,
          prompt: "What is the capital of India?",
          marks: 1,
          sort_order: 0,
          options_json: JSON.stringify([{ text: "Mumbai" }, { text: "New Delhi" }, { text: "Kolkata" }, { text: "Chennai" }]),
          answer_json: JSON.stringify([1]),
          case_sensitive: false,
        },
        {
          q_type: "mcq" as const,
          prompt: "Which of these are primary colours? (select all)",
          marks: 2,
          sort_order: 1,
          options_json: JSON.stringify([{ text: "Red" }, { text: "Green" }, { text: "Blue" }, { text: "Orange" }]),
          answer_json: JSON.stringify([0, 2]),
          case_sensitive: false,
        },
        {
          q_type: "fill_blank" as const,
          prompt: "The chemical symbol for water is ____.",
          marks: 1,
          sort_order: 2,
          options_json: null,
          answer_json: JSON.stringify(["H2O", "h2o"]),
          case_sensitive: false,
        },
      ];
      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const test = await db.tests.create({
        data: {
          session_code: sessionCode,
          title: TEST_TITLE,
          instructions: "Answer all questions. MCQs may have more than one correct option.",
          class_slug: classSlug,
          status: "published",
          shuffle: false,
          total_marks: totalMarks,
        },
      });
      await db.test_questions.createMany({
        data: questions.map((q) => ({ ...q, test_id: test.id })),
      });
      console.log(`  ✓ test "${TEST_TITLE}" (${questions.length} questions, ${totalMarks} marks, published)`);
    }

    console.log("Done.");
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
