import type { PwdRecord } from "./types";
import { generateId } from "./utils";

/**
 * Parses an RFC 4180 CSV string into a 2D array of trimmed cell values.
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const normalized = csvText.replace(/^\uFEFF/, ""); // strip UTF-8 BOM if present

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseOptionalInt(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function parseOptionalRate(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Parses both CO3 Artists CSV format and ELI Grant List CSV format
 * into normalized PwdRecord objects.
 */
export function parsePwdCsv(
  csvText: string,
  currentUserId?: string | null
): PwdRecord[] {
  const rawRows = parseCsvRows(csvText);
  if (rawRows.length === 0) return [];

  // Locate header row (handles preamble title/blank lines such as ELI grant CSV)
  let headerIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const normalized = rawRows[i].map(normalizeHeader);
    const hasNameCol = normalized.some(
      (h) => h === "artist name" || h === "name" || h === "full name"
    );
    const hasPwdContext = normalized.some(
      (h) =>
        h === "type of disability" ||
        h === "disability" ||
        h === "primary talent art form" ||
        h === "role" ||
        h === "standard rates" ||
        h === "pay scale" ||
        h === "s n"
    );
    if (hasNameCol && (hasPwdContext || i === 0)) {
      headerIdx = i;
      headers = normalized;
      break;
    }
  }

  if (headerIdx === -1) return [];

  const colIndex = (candidates: string[]): number =>
    headers.findIndex((h) => candidates.includes(h));

  const idxName = colIndex(["artist name", "name", "full name"]);
  const idxSerialNo = colIndex(["s n", "sn", "serial no", "serial number"]);
  const idxEmail = colIndex(["email", "e mail"]);
  const idxMobile = colIndex(["mobile telephone", "mobile", "phone", "mobile phone", "telephone"]);
  const idxTalent = colIndex(["primary talent art form", "primary talent", "talent", "art form", "role"]);
  const idxRole2 = colIndex(["role 2", "secondary role"]);
  const idxDisability = colIndex(["type of disability", "disability", "disability type"]);
  const idxAge = colIndex(["age"]);
  const idxGender = colIndex(["gender", "sex"]);
  const idxRate = colIndex(["standard rates", "standard rate", "pay scale", "rate", "rates"]);
  const idxCurrency = colIndex(["currency"]);
  const idxAccess = colIndex(["accessibility requirements", "accessibility"]);
  const idxCollab = colIndex(["previous collaborations", "collaborations"]);
  const idxPortfolio = colIndex(["portfolio link", "portfolio", "url", "website"]);
  const idxNotes = colIndex(["notes", "remarks"]);

  if (idxName === -1) return [];

  const now = new Date().toISOString();
  const parsed: PwdRecord[] = [];

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const cells = rawRows[i];
    const name = (cells[idxName] || "").trim();
    if (!name) continue;

    const get = (idx: number): string | null => {
      if (idx === -1) return null;
      const val = (cells[idx] || "").trim();
      return val.length > 0 ? val : null;
    };

    parsed.push({
      id: generateId(),
      serialNo: idxSerialNo !== -1 ? parseOptionalInt(cells[idxSerialNo]) : null,
      name,
      email: get(idxEmail),
      mobilePhone: get(idxMobile),
      primaryTalent: get(idxTalent),
      secondaryRole: get(idxRole2),
      disabilityType: get(idxDisability),
      age: idxAge !== -1 ? parseOptionalInt(cells[idxAge]) : null,
      gender: get(idxGender),
      standardRate: idxRate !== -1 ? parseOptionalRate(cells[idxRate]) : null,
      currency: get(idxCurrency) || "SGD",
      accessibilityRequirements: get(idxAccess),
      previousCollaborations: get(idxCollab),
      portfolioLink: get(idxPortfolio),
      notes: get(idxNotes),
      createdAt: now,
      createdBy: currentUserId ?? null,
      updatedAt: now,
      updatedBy: currentUserId ?? null,
    });
  }

  return parsed;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportPwdsToCsv(records: PwdRecord[]): string {
  const header = [
    "S/N",
    "Artist Name",
    "Email",
    "Mobile Telephone",
    "Primary Talent/Art Form",
    "Role 2",
    "Type of Disability",
    "Age",
    "Gender",
    "Standard Rates",
    "Currency",
    "Accessibility Requirements",
    "Previous Collaborations",
    "Portfolio Link",
    "Notes",
  ];

  const lines = [header.join(",")];
  for (const r of records) {
    lines.push(
      [
        csvEscape(r.serialNo),
        csvEscape(r.name),
        csvEscape(r.email),
        csvEscape(r.mobilePhone),
        csvEscape(r.primaryTalent),
        csvEscape(r.secondaryRole),
        csvEscape(r.disabilityType),
        csvEscape(r.age),
        csvEscape(r.gender),
        csvEscape(r.standardRate),
        csvEscape(r.currency || "SGD"),
        csvEscape(r.accessibilityRequirements),
        csvEscape(r.previousCollaborations),
        csvEscape(r.portfolioLink),
        csvEscape(r.notes),
      ].join(",")
    );
  }
  return lines.join("\n");
}
