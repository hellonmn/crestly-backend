import { Injectable, BadRequestException } from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  ImportCommitResponse, ImportPreviewRequest, ImportPreviewResponse, ImportType,
} from "@crestly/shared";

interface CachedJob {
  type: ImportType;
  rows: Record<string, string>[];
  expiresAt: number;
}

const TOKEN_TTL_MS = 15 * 60_000;

/**
 * Two-step CSV importer:
 *   1. preview(): parse + classify each row, return what would happen.
 *   2. commit(token): apply the cached preview transactionally.
 *
 * Mirrors erp/lib/importer.php's alias dictionary so existing school CSVs
 * keep working without column renames. CSV-only for now; XLSX is a future
 * upgrade (`xlsx` package).
 */
@Injectable()
export class ImportService {
  // Process-local cache, keyed by token. Loss on restart is acceptable —
  // the user just re-uploads. Could move to Redis later.
  private static cache = new Map<string, CachedJob>();

  constructor(private readonly prisma: RequestPrismaService) {}

  async preview(input: ImportPreviewRequest): Promise<ImportPreviewResponse> {
    const csv = Buffer.from(input.csvBase64, "base64").toString("utf8").replace(/^﻿/, "");
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      throw new BadRequestException("CSV is empty or has no header row.");
    }

    const token = randomUUID();
    ImportService.cache.set(token, {
      type: input.type, rows, expiresAt: Date.now() + TOKEN_TTL_MS,
    });
    ImportService.evictExpired();

    const result = input.type === "students"
      ? await this.previewStudents(rows)
      : await this.previewStaff(rows);

    return { ...result, type: input.type, token };
  }

  async commit(token: string): Promise<ImportCommitResponse> {
    const job = ImportService.cache.get(token);
    if (!job) throw new BadRequestException("Preview expired or token invalid. Re-upload and try again.");
    if (job.expiresAt < Date.now()) {
      ImportService.cache.delete(token);
      throw new BadRequestException("Preview expired. Re-upload and try again.");
    }

    const counters = { added: 0, updated: 0, skipped: 0, errored: 0 };
    for (const row of job.rows) {
      try {
        const r = job.type === "students" ? await this.commitStudent(row) : await this.commitStaff(row);
        counters[r]++;
      } catch {
        counters.errored++;
      }
    }
    ImportService.cache.delete(token);
    return counters;
  }

  // --- students ---

  private async previewStudents(rows: Record<string, string>[]): Promise<Omit<ImportPreviewResponse, "type" | "token">> {
    const out: ImportPreviewResponse["rows"] = [];
    let toInsert = 0, toUpdate = 0, toSkip = 0, errors = 0;

    const existingSrs = new Set(
      (await this.prisma.db.student.findMany({ select: { srNumber: true } })).map((s) => s.srNumber),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const sr = parseInt(field(row, ["sr_number", "srnumber", "srno", "sr", "admissionno", "admno", "rollno"]) ?? "", 10);
      const name = field(row, ["student_name", "studentname", "name"]);
      const rowErrors: string[] = [];
      if (!name) rowErrors.push("Missing student name");
      if (!sr || Number.isNaN(sr)) rowErrors.push("Missing or invalid SR number");

      if (rowErrors.length > 0) {
        out.push({ rowNumber: i + 2, status: "error", identifier: `SR ${sr || "?"}`, summary: name ?? "(no name)", errors: rowErrors });
        errors++;
        continue;
      }

      if (existingSrs.has(sr)) {
        toUpdate++;
        out.push({ rowNumber: i + 2, status: "update", identifier: `SR ${sr}`, summary: `Update ${name}`, errors: [] });
      } else {
        toInsert++;
        out.push({ rowNumber: i + 2, status: "insert", identifier: `SR ${sr}`, summary: `Add ${name}`, errors: [] });
      }
    }

    return { totalRows: rows.length, toInsert, toUpdate, toSkip, errors, rows: out };
  }

  private async commitStudent(row: Record<string, string>): Promise<"added" | "updated" | "skipped" | "errored"> {
    const sr = parseInt(field(row, ["sr_number", "srnumber", "srno", "sr"]) ?? "", 10);
    const name = field(row, ["student_name", "studentname", "name"]);
    if (!sr || !name) return "errored";

    const data = {
      studentName: name,
      fatherName: field(row, ["father_name", "fathername", "father"]),
      motherName: field(row, ["mother_name", "mothername", "mother"]),
      class: field(row, ["class"]) ?? "",
      section: field(row, ["section"]) ?? "",
      dob: parseDate(field(row, ["dob", "dateofbirth", "date_of_birth"])),
      gender: parseGender(field(row, ["gender", "sex"])),
      fatherContact: field(row, ["father_contact", "fathercontact", "fatherphone"]),
      motherContact: field(row, ["mother_contact", "mothercontact", "motherphone"]),
      address: field(row, ["address"]),
      schoolName: field(row, ["school_name", "schoolname", "previous_school"]),
      board: field(row, ["board"]),
    };

    const existing = await this.prisma.db.student.findUnique({ where: { srNumber: sr } });
    if (existing) {
      await this.prisma.db.student.update({ where: { srNumber: sr }, data });
      return "updated";
    }
    if (!data.class || !data.section) return "errored";
    await this.prisma.db.student.create({
      data: { ...data, srNumber: sr, status: "active" },
    });
    return "added";
  }

  // --- staff ---

  private async previewStaff(rows: Record<string, string>[]): Promise<Omit<ImportPreviewResponse, "type" | "token">> {
    const out: ImportPreviewResponse["rows"] = [];
    let toInsert = 0, toUpdate = 0, toSkip = 0, errors = 0;

    const existingPhones = new Set(
      (await this.prisma.db.user.findMany({ select: { phone: true } })).map((u) => u.phone).filter(Boolean) as string[],
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = field(row, ["name", "fullname", "staff_name"]);
      const phoneRaw = field(row, ["phone", "mobile", "contact"]) ?? "";
      const phone = phoneDigits(phoneRaw);
      const rowErrors: string[] = [];
      if (!name) rowErrors.push("Missing name");
      if (!phone) rowErrors.push("Phone must be 10 digits");

      if (rowErrors.length > 0) {
        out.push({ rowNumber: i + 2, status: "error", identifier: phone || "?", summary: name ?? "(no name)", errors: rowErrors });
        errors++;
        continue;
      }

      if (existingPhones.has(phone)) {
        toUpdate++;
        out.push({ rowNumber: i + 2, status: "update", identifier: phone, summary: `Update ${name}`, errors: [] });
      } else {
        toInsert++;
        out.push({ rowNumber: i + 2, status: "insert", identifier: phone, summary: `Add ${name}`, errors: [] });
      }
    }

    return { totalRows: rows.length, toInsert, toUpdate, toSkip, errors, rows: out };
  }

  private async commitStaff(row: Record<string, string>): Promise<"added" | "updated" | "skipped" | "errored"> {
    const name = field(row, ["name", "fullname", "staff_name"]);
    const phone = phoneDigits(field(row, ["phone", "mobile", "contact"]) ?? "");
    if (!name || !phone) return "errored";

    const role = field(row, ["role", "role_slug"]) ?? "teacher";
    const roleRow = await this.prisma.db.role.findUnique({ where: { slug: role } });

    const data = {
      name,
      phone,
      email: field(row, ["email"]),
      employee_id: field(row, ["employee_id", "empid", "emp_id"]),
      designation: field(row, ["designation"]),
      department: field(row, ["department"]),
      roleId: roleRow?.id ?? null,
    };

    const existing = await this.prisma.db.user.findFirst({ where: { phone } });
    if (existing) {
      await this.prisma.db.user.update({ where: { id: existing.id }, data });
      return "updated";
    }
    const passwordHash = await bcrypt.hash(phone, 10);
    await this.prisma.db.user.create({
      data: { ...data, status: "active", passwordHash },
    });
    return "added";
  }

  // --- maintenance ---

  private static evictExpired() {
    const now = Date.now();
    for (const [k, v] of ImportService.cache) {
      if (v.expiresAt < now) ImportService.cache.delete(k);
    }
  }
}

// --- helpers ---

const _ = createHash; // silence unused-warning on builds where the hash is unused

function parseCsv(text: string): Record<string, string>[] {
  // Minimal CSV parser; handles quoted commas + escaped quotes. Good enough
  // for the school CSVs we import. Replace with `papaparse` if you need
  // multi-line cell values.
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => normaliseHeader(h));
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? "").trim(); });
    out.push(row);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') { inQuote = true; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function field(row: Record<string, string>, aliases: string[]): string | null {
  for (const a of aliases) {
    const k = normaliseHeader(a);
    const v = row[k];
    if (v !== undefined && v !== null && v !== "" && !isPlaceholder(v)) return v;
  }
  return null;
}

function isPlaceholder(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === "-" || t === "–" || t === "n/a" || t === "na";
}

function phoneDigits(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  return new Date(t);
}

function parseGender(raw: string | null): "Male" | "Female" | "Other" | null {
  if (!raw) return null;
  const c = raw.trim()[0]?.toLowerCase();
  if (c === "m") return "Male";
  if (c === "f") return "Female";
  return "Other";
}
