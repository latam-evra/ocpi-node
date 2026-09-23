import { describe, expect, it } from "vitest";
import { OcpiHubClient, OcpiModuleNotAvailableError } from "../src/index.js";

describe("OcpiHubClient — Charging Profiles (único módulo restante en roadmap)", () => {
  const client = new OcpiHubClient({
    baseUrl: "https://hub.latam-evra.org",
    fetchImpl: (async () => {
      throw new Error("fetch no debería llamarse para stubs");
    }) as unknown as typeof fetch,
  });

  it("setChargingProfile() lanza OcpiModuleNotAvailableError", async () => {
    await expect(
      client.setChargingProfile("SES-1", {
        start_date_time: new Date().toISOString(),
        charging_rate_unit: "W",
        limit: 7400,
      }),
    ).rejects.toBeInstanceOf(OcpiModuleNotAvailableError);
  });
});
