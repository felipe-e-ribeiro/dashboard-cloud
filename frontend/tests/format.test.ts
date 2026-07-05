import { describe, expect, it } from "vitest";

import { formatMoney } from "../src/utils/format";

describe("formatMoney", () => {
  it("formats USD with a thousands separator and exactly 2 decimals", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(5, "usd")).toBe("$5.00");
  });

  it("formats BRL with pt-BR grouping and exactly 2 decimals", () => {
    expect(formatMoney(1234.5, "BRL")).toBe("R$ 1.234,50");
    expect(formatMoney(5, "brl")).toBe("R$ 5,00");
  });

  it("never shows more than 2 decimal places, even with a noisy float", () => {
    expect(formatMoney(0.1 + 0.2, "USD")).toBe("$0.30");
  });
});
