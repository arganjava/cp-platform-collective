import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { exportPwdsToCsv, parsePwdCsv } from "./pwd-csv";
import { seedPwds } from "./seed-data";

describe("PWD CSV parser & exporter", () => {
  it("parses the CO3 Artists with Disabilities CSV attachment accurately", () => {
    const csvPath = path.resolve(
      process.cwd(),
      "public/assets/aistudio/CO3_Artists_with_Disabilities_Database_-_Artists_faf10be3.csv"
    );
    const content = fs.readFileSync(csvPath, "utf8");
    const parsed = parsePwdCsv(content, "user-1");

    expect(parsed.length).toBe(2);

    expect(parsed[0]).toMatchObject({
      name: "Daniel Oon",
      primaryTalent: "Guitar player (Female voice)",
      standardRate: 200,
      currency: "SGD",
    });

    expect(parsed[1]).toMatchObject({
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
});
