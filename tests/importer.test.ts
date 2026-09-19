import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { discoverMonthSections, extractLength, normalizeVesselName } from "../scripts/parseWorkbook";

describe("workbook importer helpers", () => {
  it("normalizes case, prefix spacing, and embedded length for identity", () => {
    expect(normalizeVesselName("  r / v   Golden Compass 120' ")).toBe("r/v golden compass");
  });
  it("prefers explicit LOA syntax when parsing dimensions", () => {
    expect(extractLength("LOA: 145', Draft: 12'")).toBe(145);
    expect(extractLength("R/V High Drift 120'")).toBe(120);
  });
  it("discovers shifted month columns and builds actual dates", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("2019");
    sheet.getCell("A7").value = "January";
    sheet.getCell("C7").value = 1;
    sheet.getCell("D7").value = 2;
    sheet.getCell("E7").value = 3;
    const sections = discoverMonthSections(sheet, 2019);
    expect(sections).toHaveLength(1);
    expect(sections[0].dateMap.get(3)).toBe("2019-01-01");
    expect(sections[0].dateMap.get(5)).toBe("2019-01-03");
  });
  it("fills dates from a single day-one anchor used by early annual sheets", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("1997");
    sheet.getCell("A1").value = "AUGUST 1997";
    sheet.getCell("B3").value = 1;
    const section = discoverMonthSections(sheet, 1997)[0];
    expect(section.dateMap.size).toBe(31);
    expect(section.dateMap.get(32)).toBe("1997-08-31");
  });
  it("ignores a prior-year carryover month at the top of an annual sheet", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("2002");
    sheet.getCell("A1").value = "DECEMBER 2001";
    sheet.getCell("B2").value = 1;
    sheet.getCell("A12").value = "JANUARY 2002";
    sheet.getCell("B13").value = 1;
    const sections = discoverMonthSections(sheet, 2002);
    expect(sections).toHaveLength(1);
    expect(sections[0].dateMap.get(2)).toBe("2002-01-01");
  });
});
