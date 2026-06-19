import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { SearchHit, SearchResponse, SearchQuery } from "@crestly/shared";

/**
 * Spotlight search — fans out a single query against the major
 * entities and returns top-N matches per category. Designed to be
 * called from the global Cmd+K overlay; debounced client-side.
 *
 * Each entity does a permissive `contains` match on its identifying
 * columns. Result count is capped per group so a 5000-student school
 * doesn't return 5000 rows in one shot.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const q = query.q.trim();
    const limit = query.limit;
    if (q.length === 0) {
      return { q, total: 0, groups: [] };
    }

    const isNumeric = /^\d+$/.test(q);

    // ---------- parallel fan-out ----------
    const [
      students, team, families, vouchers, receipts, admissions, pickups,
    ] = await Promise.all([
      this.prisma.db.student.findMany({
        where: {
          status: "active",
          OR: [
            { studentName: { contains: q } },
            { fatherName: { contains: q } },
            { motherName: { contains: q } },
            { fatherContact: { contains: q } },
            { motherContact: { contains: q } },
            ...(isNumeric ? [{ srNumber: { equals: Number(q) } }] : []),
          ],
        },
        select: {
          srNumber: true, studentName: true, fatherName: true,
          class: true, section: true,
        },
        take: limit,
        orderBy: [{ class: "asc" }, { section: "asc" }, { studentName: "asc" }],
      }),
      this.prisma.db.user.findMany({
        where: {
          status: "active",
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
            { designation: { contains: q } },
            { employee_id: { contains: q } },
          ],
        },
        select: {
          id: true, name: true, designation: true, department: true, phone: true,
        },
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.db.siblingFamily.findMany({
        where: {
          OR: [
            { fatherName: { contains: q } },
            { motherName: { contains: q } },
            ...(isNumeric ? [{ familyId: { equals: Number(q) } }] : []),
          ],
        },
        select: { familyId: true, fatherName: true, motherName: true, siblingCount: true },
        take: limit,
        orderBy: { familyId: "asc" },
      }),
      this.prisma.db.vouchers.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { voucher_no: { contains: q } },
            { vendor_name: { contains: q } },
          ],
        },
        select: {
          id: true, voucher_no: true, title: true, status: true, amount: true,
        },
        take: limit,
        orderBy: { id: "desc" },
      }).catch(() => []),
      this.prisma.db.fee_payments.findMany({
        where: {
          OR: [
            { receipt_no: { contains: q } },
            { reference: { contains: q } },
            ...(isNumeric ? [{ sr_number: { equals: Number(q) } }] : []),
          ],
        },
        select: {
          id: true, receipt_no: true, sr_number: true, amount: true, paid_on: true,
        },
        take: limit,
        orderBy: { id: "desc" },
      }).catch(() => []),
      this.prisma.db.admission_enquiries.findMany({
        where: {
          OR: [
            { child_name: { contains: q } },
            { parent_name: { contains: q } },
            { phone: { contains: q } },
            ...(isNumeric ? [{ id: { equals: Number(q) } }] : []),
          ],
        },
        select: {
          id: true, child_name: true, parent_name: true, status: true, class_seeking: true,
        },
        take: limit,
        orderBy: { id: "desc" },
      }),
      this.prisma.db.pickupPoint.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            ...(isNumeric ? [{ id: { equals: Number(q) } }] : []),
          ],
        },
        select: {
          id: true, name: true, distanceKm: true,
        },
        take: limit,
        orderBy: { name: "asc" },
      }).catch(() => []),
    ]);

    // ---------- map to SearchHit format ----------
    const studentHits: SearchHit[] = students.map((s) => ({
      kind: "student",
      key: `student-${s.srNumber}`,
      title: s.studentName,
      subtitle: s.fatherName ? `Father: ${s.fatherName}` : null,
      href: `/students/${s.srNumber}`,
      meta: `${s.class}-${s.section}`,
    }));
    const teamHits: SearchHit[] = team.map((u) => ({
      kind: "team",
      key: `team-${u.id}`,
      title: u.name,
      subtitle: [u.designation, u.department].filter(Boolean).join(" · ") || (u.phone ?? null),
      href: `/team/${u.id}`,
      meta: u.department ?? null,
    }));
    const familyHits: SearchHit[] = families.map((f) => ({
      kind: "family",
      key: `family-${f.familyId}`,
      title: f.fatherName ?? `Family #${f.familyId}`,
      subtitle: f.motherName ? `Mother: ${f.motherName}` : null,
      href: `/families/${f.familyId}`,
      meta: `${f.siblingCount ?? 0} sib${f.siblingCount === 1 ? "" : "s"}`,
    }));
    const voucherHits: SearchHit[] = vouchers.map((v) => ({
      kind: "voucher",
      key: `voucher-${v.id}`,
      title: v.title || (v.voucher_no ?? `Voucher #${v.id}`),
      subtitle: v.voucher_no ?? null,
      href: `/vouchers/${v.id}`,
      meta: v.status ?? null,
    }));
    const receiptHits: SearchHit[] = receipts.map((r) => ({
      kind: "receipt",
      key: `receipt-${r.id}`,
      title: r.receipt_no ?? `Receipt #${r.id}`,
      subtitle: `SR ${String(r.sr_number).padStart(4, "0")} · ₹${r.amount.toLocaleString("en-IN")}`,
      href: `/print/receipt/${r.id}`,
      meta: r.paid_on ? r.paid_on.toISOString().slice(0, 10) : null,
    }));
    const admissionHits: SearchHit[] = admissions.map((a) => ({
      kind: "admission",
      key: `admission-${a.id}`,
      title: a.child_name,
      subtitle: a.parent_name ? `Parent: ${a.parent_name}` : null,
      href: `/admissions/${a.id}`,
      meta: a.class_seeking ? `Wants ${a.class_seeking}` : a.status,
    }));
    const pickupHits: SearchHit[] = pickups.map((p) => ({
      kind: "pickup",
      key: `pickup-${p.id}`,
      title: p.name,
      subtitle: p.distanceKm ? `${Number(p.distanceKm).toFixed(1)} km from school` : null,
      href: `/transport/${p.id}`,
      meta: null,
    }));

    const groups = [
      { kind: "student"   as const, label: "Students",   viewAllHref: `/students?q=${encodeURIComponent(q)}`,   hits: studentHits },
      { kind: "team"      as const, label: "Team",       viewAllHref: `/team?q=${encodeURIComponent(q)}`,       hits: teamHits },
      { kind: "family"    as const, label: "Families",   viewAllHref: `/families?q=${encodeURIComponent(q)}`,   hits: familyHits },
      { kind: "admission" as const, label: "Admissions", viewAllHref: `/admissions?q=${encodeURIComponent(q)}`, hits: admissionHits },
      { kind: "voucher"   as const, label: "Vouchers",   viewAllHref: `/vouchers?q=${encodeURIComponent(q)}`,   hits: voucherHits },
      { kind: "receipt"   as const, label: "Receipts",   viewAllHref: `/fee-ledger/receipts?q=${encodeURIComponent(q)}`, hits: receiptHits },
      { kind: "pickup"    as const, label: "Pickup points", viewAllHref: `/transport?q=${encodeURIComponent(q)}`, hits: pickupHits },
    ].filter((g) => g.hits.length > 0);

    const total = groups.reduce((s, g) => s + g.hits.length, 0);

    return { q, total, groups };
  }
}
