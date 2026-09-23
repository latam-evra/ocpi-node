import { describe, expect, it } from "vitest";
import { OcpiHubClient, OcpiModuleNotAvailableError } from "../src/index.js";

describe("OcpiHubClient — stubs de módulos en roadmap", () => {
  const client = new OcpiHubClient({
    baseUrl: "https://hub.latam-evra.org",
    fetchImpl: (async () => {
      throw new Error("fetch no debería llamarse para stubs");
    }) as unknown as typeof fetch,
  });

  it("getActiveSession() lanza OcpiModuleNotAvailableError", async () => {
    await expect(client.getActiveSession("SES-1")).rejects.toBeInstanceOf(
      OcpiModuleNotAvailableError,
    );
    await expect(client.getActiveSession("SES-1")).rejects.toThrow(/Sessions/);
  });

  it("getCdr() lanza OcpiModuleNotAvailableError", async () => {
    await expect(client.getCdr("CDR-1")).rejects.toBeInstanceOf(
      OcpiModuleNotAvailableError,
    );
    await expect(client.getCdr("CDR-1")).rejects.toThrow(/CDRs/);
  });

  it("authorizeToken() lanza OcpiModuleNotAvailableError", async () => {
    await expect(client.authorizeToken("RFID-1")).rejects.toBeInstanceOf(
      OcpiModuleNotAvailableError,
    );
    await expect(client.authorizeToken("RFID-1")).rejects.toThrow(
      /Tokens & Authorisation/,
    );
  });

  it("sendCommand() lanza OcpiModuleNotAvailableError", async () => {
    await expect(
      client.sendCommand("START_SESSION", {}),
    ).rejects.toBeInstanceOf(OcpiModuleNotAvailableError);
    await expect(client.sendCommand("START_SESSION", {})).rejects.toThrow(
      /Commands & Charging Profiles/,
    );
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

  it("getInvoiceReconciliation() lanza OcpiModuleNotAvailableError", async () => {
    await expect(
      client.getInvoiceReconciliation("CDR-1"),
    ).rejects.toBeInstanceOf(OcpiModuleNotAvailableError);
    await expect(client.getInvoiceReconciliation("CDR-1")).rejects.toThrow(
      /Invoice Reconciliation/,
    );
  });
});
