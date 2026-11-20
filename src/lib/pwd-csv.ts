import type { PwdRecord } from "./types";
import { generateId } from "./utils";

export interface CsvParseMetaResult {
  rows: string[][];
  hasUnclosedQuotes: boolean;
}

/**
 * Parses an RFC 4180 CSV string into a 2D array of trimmed cell values,
 * also reporting whether unclosed quotes remain at EOF.
 */
export function parseCsvRowsWithMeta(csvText: string): CsvParseMetaResult {
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

  return { rows, hasUnclosedQuotes: inQuotes };
}

/**
 * Parses an RFC 4180 CSV string into a 2D array of trimmed cell values.
 */
export function parseCsvRows(csvText: string): string[][] {
  return parseCsvRowsWithMeta(csvText).rows;
}

export interface PwdCsvFieldSpec {
  header: string;
  aliases: string[];
  required: boolean;
  format: string;
  example: string;
}

export const PWD_CSV_TEMPLATE_HEADERS = [
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
] as const;

export const PWD_CSV_FIELD_SPECS: PwdCsvFieldSpec[] = [
  {
    header: "Artist Name",
    aliases: ["Name", "Full Name"],
    required: true,
    format: "Non-empty text",
    example: "Yue Ting",
  },
  {
    header: "S/N",
    aliases: ["SN", "Serial No", "Serial Number"],
    required: false,
    format: "Whole number (>= 0)",
    example: "1",
  },
  {
    header: "Email",
    aliases: ["E-mail"],
    required: false,
    format: "Valid email address",
    example: "artist@example.com",
  },
  {
    header: "Mobile Telephone",
    aliases: ["Mobile", "Phone", "Mobile Phone", "Telephone"],
    required: false,
    format: "Phone number text",
    example: "+65 9123 4567",
  },
  {
    header: "Primary Talent/Art Form",
    aliases: ["Primary Talent", "Talent", "Art Form", "Role"],
    required: false,
    format: "Text description",
    example: "Quilling & Paper Jewelry",
  },
  {
    header: "Role 2",
    aliases: ["Secondary Role"],
    required: false,
    format: "Text description",
    example: "DMS",
  },
  {
    header: "Type of Disability",
    aliases: ["Disability", "Disability Type"],
    required: false,
    format: "Text description",
    example: "Autism",
  },
  {
    header: "Age",
    aliases: [],
    required: false,
    format: "Whole number (0–150)",
    example: "36",
  },
  {
    header: "Gender",
    aliases: ["Sex"],
    required: false,
    format: "m / f / Non-binary",
    example: "f",
  },
  {
    header: "Standard Rates",
    aliases: ["Standard Rate", "Pay Scale", "Rate", "Rates"],
    required: false,
    format: "Number (>= 0)",
    example: "250",
  },
  {
    header: "Currency",
    aliases: [],
    required: false,
    format: "3-letter code (default: SGD)",
    example: "SGD",
  },
  {
    header: "Accessibility Requirements",
    aliases: ["Accessibility"],
    required: false,
    format: "Text description",
    example: "Quiet prep room before session",
  },
  {
    header: "Previous Collaborations",
    aliases: ["Collaborations"],
    required: false,
    format: "Text description",
    example: "Art For Good Showcase 2025",
  },
  {
    header: "Portfolio Link",
    aliases: ["Portfolio", "URL", "Website"],
    required: false,
    format: "http:// or https:// URL",
    example: "https://www.artforgood.sg/featured-artists",
  },
  {
    header: "Notes",
    aliases: ["Remarks"],
    required: false,
    format: "Text notes",
    example: "Available weekends",
  },
];

export const PWD_CSV_TEMPLATE_SAMPLE_ROWS: Array<Record<(typeof PWD_CSV_TEMPLATE_HEADERS)[number], string>> = [
  {
    "S/N": "1",
    "Artist Name": "Yue Ting",
    Email: "yueting@example.com",
    "Mobile Telephone": "+65 9123 4567",
    "Primary Talent/Art Form": "Quilling & Paper Jewelry",
    "Role 2": "Workshop Assistant",
    "Type of Disability": "Autism",
    Age: "28",
    Gender: "f",
    "Standard Rates": "250",
    Currency: "SGD",
    "Accessibility Requirements": "Quiet prep room before session",
    "Previous Collaborations": "Art For Good Showcase 2025",
    "Portfolio Link": "https://www.artforgood.sg/featured-artists",
    Notes: "Sample CO3 artist entry",
  },
  {
    "S/N": "2",
    "Artist Name": "Jackie Chionh",
    Email: "",
    "Mobile Telephone": "",
    "Primary Talent/Art Form": "One-Handed Card Illusionist. Performer",
    "Role 2": "DMS",
    "Type of Disability": "Partial use of body",
    Age: "36",
    Gender: "m",
    "Standard Rates": "1500",
    Currency: "SGD",
    "Accessibility Requirements": "Table height wheelchair accessible",
    "Previous Collaborations": "ELI Grant Showcase",
    "Portfolio Link": "",
    Notes: "Sample ELI grant artist entry",
  },
];

export function generatePwdCsvTemplate(): string {
  const lines = [PWD_CSV_TEMPLATE_HEADERS.join(",")];
  for (const sample of PWD_CSV_TEMPLATE_SAMPLE_ROWS) {
    lines.push(
      PWD_CSV_TEMPLATE_HEADERS.map((col) => csvEscape(sample[col])).join(",")
    );
  }
  return lines.join("\n");
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function trimTrailingEmptyCells(cells: string[]): string[] {
  const copy = [...cells];
  while (copy.length > 0 && copy[copy.length - 1].trim() === "") {
    copy.pop();
  }
  return copy;
}

const NAME_HEADER_ALIASES = ["artist name", "name", "full name"];
const PWD_CONTEXT_ALIASES = [
  "s n",
  "sn",
  "serial no",
  "serial number",
  "email",
  "e mail",
  "mobile telephone",
  "mobile",
  "phone",
  "mobile phone",
  "telephone",
  "primary talent art form",
  "primary talent",
  "talent",
  "art form",
  "role",
  "role 2",
  "secondary role",
  "type of disability",
  "disability",
  "disability type",
  "age",
  "gender",
  "sex",
  "standard rates",
  "standard rate",
  "pay scale",
  "rate",
  "rates",
  "currency",
  "accessibility requirements",
  "accessibility",
  "previous collaborations",
  "collaborations",
  "portfolio link",
  "portfolio",
  "url",
  "website",
  "notes",
  "remarks",
];

function validateOptionalInteger(
  raw: string,
  min: number,
  max?: number
): { valid: boolean; value: number | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: null };
  if (!/^-?\d+$/.test(trimmed)) {
    return { valid: false, value: null };
  }
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < min || (max !== undefined && num > max)) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

function validateOptionalRate(raw: string): { valid: boolean; value: number | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: null };
  const cleaned = trimmed.replace(/^(SGD|USD|MYR|EUR|\$)\s*/i, "").replace(/,/g, "").trim();
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { valid: false, value: null };
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface PwdCsvValidationError {
  row?: number;
  column?: string;
  message: string;
}

export interface PwdCsvValidationResult {
  valid: boolean;
  records: PwdRecord[];
  errors: PwdCsvValidationError[];
  warnings: string[];
  detectedFormat: string;
  totalDataRows: number;
}

/**
 * Strictly validates CSV structure, mandatory fields, and cell data types,
 * returning both actionable errors and normalized PwdRecord objects.
 */
export function validateAndParsePwdCsv(
  csvText: string,
  currentUserId?: string | null,
  fileName?: string
): PwdCsvValidationResult {
  const errors: PwdCsvValidationError[] = [];
  const warnings: string[] = [];

  if (fileName && !fileName.toLowerCase().endsWith(".csv")) {
    return {
      valid: false,
      records: [],
      errors: [
        {
          message: `Unsupported file "${fileName}". Please upload a valid .csv (comma-separated values) file.`,
        },
      ],
      warnings,
      detectedFormat: "Invalid file type",
      totalDataRows: 0,
    };
  }

  if (!csvText || !csvText.trim()) {
    return {
      valid: false,
      records: [],
      errors: [{ message: "The uploaded CSV file is empty." }],
      warnings,
      detectedFormat: "Empty file",
      totalDataRows: 0,
    };
  }

  if (csvText.includes("\u0000")) {
    return {
      valid: false,
      records: [],
      errors: [
        {
          message:
            "Invalid CSV format: binary or corrupted content detected. Please export as UTF-8 Comma-Separated Values (.csv).",
        },
      ],
      warnings,
      detectedFormat: "Invalid binary content",
      totalDataRows: 0,
    };
  }

  const { rows: rawRows, hasUnclosedQuotes } = parseCsvRowsWithMeta(csvText);

  if (hasUnclosedQuotes) {
    return {
      valid: false,
      records: [],
      errors: [
        {
          message:
            'Malformed CSV syntax: unclosed quotation mark (") detected. Please check quoted fields and re-export as CSV.',
        },
      ],
      warnings,
      detectedFormat: "Malformed CSV",
      totalDataRows: 0,
    };
  }

  if (rawRows.length === 0) {
    return {
      valid: false,
      records: [],
      errors: [{ message: "No rows found in CSV file." }],
      warnings,
      detectedFormat: "Empty file",
      totalDataRows: 0,
    };
  }

  // Detect semicolon or tab-delimited files that lack commas
  const nonEmptyLines = rawRows.filter((r) => trimTrailingEmptyCells(r).length > 0);
  if (
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((r) => r.length === 1 && (r[0].includes(";") || r[0].includes("\t")))
  ) {
    return {
      valid: false,
      records: [],
      errors: [
        {
          message:
            "Wrong CSV delimiter detected (semicolons or tabs). Please save/export using standard comma (,) separated .csv format or use the provided CSV template.",
        },
      ],
      warnings,
      detectedFormat: "Wrong delimiter",
      totalDataRows: 0,
    };
  }

  // Locate header row (handles preamble title/blank lines such as ELI grant CSV)
  let headerIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const normalized = rawRows[i].map(normalizeHeader);
    const hasNameCol = normalized.some((h) => NAME_HEADER_ALIASES.includes(h));
    const hasPwdContext = normalized.some((h) => PWD_CONTEXT_ALIASES.includes(h));
    if (hasNameCol && (hasPwdContext || i === 0)) {
      headerIdx = i;
      headers = normalized;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      valid: false,
      records: [],
      errors: [
        {
          message:
            'Invalid CSV headers: missing mandatory column "Artist Name" (or "Name"). Download the CSV template to see the required columns.',
        },
      ],
      warnings,
      detectedFormat: "Unrecognized headers",
      totalDataRows: 0,
    };
  }

  const trimmedHeaders = trimTrailingEmptyCells(headers);
  const nonEmptyHeaderCount = trimmedHeaders.filter((h) => h.length > 0).length;
  const recognizedPwdColsCount = trimmedHeaders.filter(
    (h) => NAME_HEADER_ALIASES.includes(h) || PWD_CONTEXT_ALIASES.includes(h)
  ).length;

  if (nonEmptyHeaderCount > 1 && recognizedPwdColsCount < 2) {
    return {
      valid: false,
      records: [],
      errors: [
        {
          message:
            'CSV columns do not match the PWD Directory template format. Expected columns include "Artist Name", "S/N", "Type of Disability", "Primary Talent/Art Form", "Standard Rates", "Currency", etc.',
        },
      ],
      warnings,
      detectedFormat: "Wrong column schema",
      totalDataRows: 0,
    };
  }

  const colIndex = (candidates: string[]): number =>
    headers.findIndex((h) => candidates.includes(h));

  const idxName = colIndex(NAME_HEADER_ALIASES);
  const idxSerialNo = colIndex(["s n", "sn", "serial no", "serial number"]);
  const idxEmail = colIndex(["email", "e mail"]);
  const idxMobile = colIndex(["mobile telephone", "mobile", "phone", "mobile phone", "telephone"]);
  const idxTalent = colIndex([
    "primary talent art form",
    "primary talent",
    "talent",
    "art form",
    "role",
  ]);
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

  const detectedFormat =
    idxRole2 !== -1 && idxSerialNo !== -1
      ? idxNotes !== -1 || idxEmail !== -1
        ? "Unified PWD Template CSV"
        : "ELI Grant Artists CSV"
      : "CO3 Artists Database CSV";

  const now = new Date().toISOString();
  const parsed: PwdRecord[] = [];
  let totalDataRows = 0;

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const rawCells = rawRows[i];
    const trimmedCells = trimTrailingEmptyCells(rawCells);
    if (trimmedCells.length === 0) continue; // skip completely blank rows

    const rowNumber = i + 1;
    totalDataRows++;

    if (trimmedCells.length > trimmedHeaders.length) {
      errors.push({
        row: rowNumber,
        message: `Row ${rowNumber}: Found ${trimmedCells.length} columns, expected at most ${trimmedHeaders.length}. Wrap values containing commas in double quotes (").`,
      });
    }

    const get = (idx: number): string | null => {
      if (idx === -1) return null;
      const val = (rawCells[idx] || "").trim();
      return val.length > 0 ? val : null;
    };

    const name = (idxName !== -1 ? rawCells[idxName] || "" : "").trim();
    if (!name) {
      errors.push({
        row: rowNumber,
        column: "Artist Name",
        message: `Row ${rowNumber}: Missing mandatory field "Artist Name".`,
      });
    }

    const serialRaw = idxSerialNo !== -1 ? (rawCells[idxSerialNo] || "").trim() : "";
    const serialCheck = validateOptionalInteger(serialRaw, 0);
    if (!serialCheck.valid) {
      errors.push({
        row: rowNumber,
        column: "S/N",
        message: `Row ${rowNumber}: Invalid S/N "${serialRaw}" — must be a non-negative whole integer.`,
      });
    }

    const ageRaw = idxAge !== -1 ? (rawCells[idxAge] || "").trim() : "";
    const ageCheck = validateOptionalInteger(ageRaw, 0, 150);
    if (!ageCheck.valid) {
      errors.push({
        row: rowNumber,
        column: "Age",
        message: `Row ${rowNumber}: Invalid Age "${ageRaw}" — must be a whole integer between 0 and 150.`,
      });
    }

    const rateRaw = idxRate !== -1 ? (rawCells[idxRate] || "").trim() : "";
    const rateCheck = validateOptionalRate(rateRaw);
    if (!rateCheck.valid) {
      errors.push({
        row: rowNumber,
        column: "Standard Rates",
        message: `Row ${rowNumber}: Invalid Standard Rates "${rateRaw}" — must be a non-negative number.`,
      });
    }

    const emailVal = get(idxEmail);
    if (emailVal && !isValidEmail(emailVal)) {
      errors.push({
        row: rowNumber,
        column: "Email",
        message: `Row ${rowNumber}: Invalid Email format "${emailVal}".`,
      });
    }

    const portfolioVal = get(idxPortfolio);
    if (portfolioVal && !isValidHttpUrl(portfolioVal)) {
      errors.push({
        row: rowNumber,
        column: "Portfolio Link",
        message: `Row ${rowNumber}: Invalid Portfolio Link "${portfolioVal}" — must start with http:// or https://.`,
      });
    }

    const currencyVal = get(idxCurrency);
    if (currencyVal && !/^[A-Za-z]{3}$/.test(currencyVal)) {
      errors.push({
        row: rowNumber,
        column: "Currency",
        message: `Row ${rowNumber}: Invalid Currency "${currencyVal}" — expected a 3-letter currency code (e.g. SGD).`,
      });
    }

    if (name) {
      parsed.push({
        id: generateId(),
        serialNo: serialCheck.value,
        name,
        email: emailVal,
        mobilePhone: get(idxMobile),
        primaryTalent: get(idxTalent),
        secondaryRole: get(idxRole2),
        disabilityType: get(idxDisability),
        age: ageCheck.value,
        gender: get(idxGender),
        standardRate: rateCheck.value,
        currency: (currencyVal || "SGD").toUpperCase(),
        accessibilityRequirements: get(idxAccess),
        previousCollaborations: get(idxCollab),
        portfolioLink: portfolioVal,
        notes: get(idxNotes),
        createdAt: now,
        createdBy: currentUserId ?? null,
        updatedAt: now,
        updatedBy: currentUserId ?? null,
      });
    }
  }

  if (totalDataRows === 0) {
    errors.push({
      message:
        "No data rows found beneath the CSV header. Add at least one row containing an Artist Name.",
    });
  }

  return {
    valid: errors.length === 0 && parsed.length > 0,
    records: errors.length === 0 ? parsed : [],
    errors,
    warnings,
    detectedFormat,
    totalDataRows,
  };
}

/**
 * Parses both CO3 Artists CSV format and ELI Grant List CSV format
 * into normalized PwdRecord objects.
 */
export function parsePwdCsv(
  csvText: string,
  currentUserId?: string | null
): PwdRecord[] {
  const result = validateAndParsePwdCsv(csvText, currentUserId);
  return result.records;
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
  const lines = [PWD_CSV_TEMPLATE_HEADERS.join(",")];
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
