import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  exportPwdsToCsv,
  generatePwdCsvTemplate,
  parsePwdCsv,
  validateAndParsePwdCsv,
} from "./pwd-csv";
import { seedPwds } from "./seed-data";

describe("PWD CSV parser, validator & exporter", () => {
  it("parses the CO3 Artists with Disabilities CSV attachment accurately", () => {
    const csvPath = path.resolve(
      process.cwd(),
      "public/assets/aistudio/CO3_Artists_with_Disabilities_Database_-_Artists_faf10be3.csv"
    );
    const content = fs.readFileSync(csvPath, "utf8");
    const result = validateAndParsePwdCsv(content, "user-1", "co3.csv");

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.records.length).toBe(2);

    expect(result.records[0]).toMatchObject({
      name: "Daniel Oon",
      primaryTalent: "Guitar player (Female voice)",
      standardRate: 200,
      currency: "SGD",
    });

    expect(result.records[1]).toMatchObject({
      name: "Yue Ting",
      primaryTalent: "Quilling & Paper Jewelry",
      disabilityType: "Autism",
      currency: "SGD",
      portfolioLink: "https://www.artforgood.sg/featured-artists",
    });
  });

  it("parses the ELI grant Artists List CSV attachment accurately despite preamble rows", () => {
    const csvPath = path.resolve(
      process.cwd(),
      "public/assets/aistudio/List_of_artists_with_disabilities__List_in_progress__-_List_of_100_artists_List_in_progressfor_ELI_grant_74c688ca.csv"
    );
    const content = fs.readFileSync(csvPath, "utf8");
    const parsed = parsePwdCsv(content, "user-1");

    expect(parsed.length).toBe(1);
    expect(parsed[0]).toMatchObject({
      serialNo: 1,
      name: "Jackie Chionh",
      disabilityType: "Partial use of body",
      primaryTalent: "One-Handed Card Illusionist. Performer",
      secondaryRole: "DMS",
      age: 36,
      gender: "m",
      standardRate: 1500,
      currency: "SGD",
    });
  });

  it("round-trips PWD records through CSV export and re-import", () => {
    const exported = exportPwdsToCsv(seedPwds);
    const reimported = parsePwdCsv(exported, "user-1");

    expect(reimported.length).toBe(seedPwds.length);
    expect(reimported[0].name).toBe("Daniel Oon");
    expect(reimported[0].standardRate).toBe(200);
    expect(reimported[1].name).toBe("Yue Ting");
    expect(reimported[1].disabilityType).toBe("Autism");
    expect(reimported[2].name).toBe("Jackie Chionh");
    expect(reimported[2].serialNo).toBe(1);
    expect(reimported[2].age).toBe(36);
    expect(reimported[2].standardRate).toBe(1500);
  });

  it("generates a valid CSV template with headers and sample rows", () => {
    const templateCsv = generatePwdCsvTemplate();
    const validation = validateAndParsePwdCsv(templateCsv, "user-1", "pwd-import-template.csv");

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.records.length).toBe(2);
    expect(validation.records[0]).toMatchObject({
      serialNo: 1,
      name: "Yue Ting",
      createdBy: "user-1",
      updatedBy: "user-1",
    });
    expect(validation.records[1]).toMatchObject({
      serialNo: 2,
      name: "Jackie Chionh",
      standardRate: 1500,
    });
  });

  it("rejects wrong file extension, empty files, unclosed quotes, and wrong delimiters", () => {
    const wrongExt = validateAndParsePwdCsv("Artist Name\nAlice", "user-1", "artists.xlsx");
    expect(wrongExt.valid).toBe(false);
    expect(wrongExt.errors[0].message).toContain(".csv");

    const empty = validateAndParsePwdCsv("   ", "user-1", "empty.csv");
    expect(empty.valid).toBe(false);
    expect(empty.errors[0].message).toContain("empty");

    const unclosed = validateAndParsePwdCsv('Artist Name,Notes\n"Alice,unclosed quote', "user-1");
    expect(unclosed.valid).toBe(false);
    expect(unclosed.errors[0].message).toContain("unclosed quotation");

    const semicolon = validateAndParsePwdCsv("Artist Name;Type of Disability\nAlice;Autism", "user-1");
    expect(semicolon.valid).toBe(false);
    expect(semicolon.errors[0].message).toContain("delimiter");
  });

  it("rejects missing mandatory Artist Name column or unrelated CSV columns", () => {
    const missingName = validateAndParsePwdCsv(
      "S/N,Type of Disability,Standard Rates\n1,Autism,200",
      "user-1"
    );
    expect(missingName.valid).toBe(false);
    expect(missingName.errors[0].message).toContain("Artist Name");

    const unrelated = validateAndParsePwdCsv(
      "Name,Invoice ID,Tax Rate\nAcme,INV-1,9%",
      "user-1"
    );
    expect(unrelated.valid).toBe(false);
    expect(unrelated.errors[0].message).toContain("PWD Directory template");
  });

  it("validates mandatory Artist Name and typed columns row by row", () => {
    const badRowsCsv = [
      "S/N,Artist Name,Email,Age,Standard Rates,Currency,Portfolio Link",
      "1,,bad-email,200,-50,SG,not-a-url",
      "abc,Valid Artist,good@example.com,30,250,SGD,https://example.com",
    ].join("\n");

    const result = validateAndParsePwdCsv(badRowsCsv, "user-1", "bad.csv");
    expect(result.valid).toBe(false);
    expect(result.records).toEqual([]);

    const messages = result.errors.map((e) => e.message).join("\n");
    expect(messages).toContain('Row 2: Missing mandatory field "Artist Name"');
    expect(messages).toContain("Row 2: Invalid Email format");
    expect(messages).toContain("Row 2: Invalid Age");
    expect(messages).toContain("Row 2: Invalid Standard Rates");
    expect(messages).toContain("Row 2: Invalid Currency");
    expect(messages).toContain("Row 2: Invalid Portfolio Link");
    expect(messages).toContain("Row 3: Invalid S/N");
  });
});
