import { describe, expect, it } from "vitest";
import { PAGE_TITLES } from "@/components/shell/copy";

describe("PAGE_TITLES", () => {
  it("names the e-mail settings page", () => {
    expect(PAGE_TITLES["/config/email"]).toBe("E-mail");
  });
});
