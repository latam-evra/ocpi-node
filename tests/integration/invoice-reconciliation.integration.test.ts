import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OcpiHubClient } from "../../src/index.js";
import type { OcpiCdrInput } from "../../src/index.js";

const HUB_URL = process.env.OCPI_HUB_TEST_URL ?? "http://localhost:3947";
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function createTestRegistration(role: "CPO" | "EMSP", countryCode: string, partyId: string) {
  const output = execFileSync(
    "npx",
    [
      "tsx",
      "scripts/create-test-registration.ts",
      "--role",
      role,
      "--country-code",
      countryCode,
      "--party-id",
      partyId,
    ],
    { cwd: REPO_ROOT, encoding: "utf-8" },
  );
  return JSON.parse(output.trim()) as { registrationId: string; rawTokenA: string };
}

function cleanupRegistration(registrationId: string) {
  execFileSync("npx", ["tsx", "scripts/create-test-registration.ts", "--cleanup", registrationId], {
    cwd: REPO_ROOT,
  });
}

describe("Invoice Reconciliation — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let registrationId: string;
  let tokenB: string;

  beforeAll(async () => {
    const { registrationId: id, rawTokenA } = createTestRegistration("CPO", "CL", "IR1");
    registrationId = id;

    const credentials = await client.registerCredentials(rawTokenA, `${HUB_URL}/api/ocpi/2.3.0/versions`, [
      { role: "CPO", party_id: "IR1", country_code: "CL" },
    ]);
    tokenB = credentials.token;

    // CDR en CLP (moneda soportada por Frankfurter vía BCCh) para el caso
    // con conversión FX real.
    const cdrInput: OcpiCdrInput = {
      id: "CDR-IR-1",
      start_date_time: "2026-09-23T09:00:00Z",
      end_date_time: "2026-09-23T10:00:00Z",
      cdr_token: {
        country_code: "AR",
        party_id: "EVP",
        uid: "TOK-IR-1",
        type: "RFID",
        contract_id: "C-IR-1",
      },
      auth_method: "WHITELIST",
      cdr_location: {
        id: "LOC-IR-1",
        address: "Av. Test 123",
        city: "Santiago",
        country: "CHL",
        coordinates: { latitude: "-33.4", longitude: "-70.6" },
        evse_uid: "EVSE-1",
        connector_id: "1",
        connector_standard: "IEC_62196_T2",
        connector_format: "SOCKET",
        connector_power_type: "AC_3_PHASE",
      },
      currency: "CLP",
      charging_periods: [
        { start_date_time: "2026-09-23T09:00:00Z", dimensions: [{ type: "ENERGY", volume: 10 }] },
      ],
      total_cost: { excl_vat: 5000 },
      total_energy: 10,
      total_time: 1,
    };
    await client.postCdr(tokenB, "CL", "IR1", "CDR-IR-1", cdrInput);
  });

  afterAll(() => {
    cleanupRegistration(registrationId);
  });

  it("publishes a reconciliation without discrepancy_amount (PUT), reads it back, lists it, and deletes it", async () => {
    const created = await client.putInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-1", {
      id: "REC-SDK-1",
      cdr_id: "CDR-IR-1",
      status: "PENDING",
    });
    expect(created.id).toBe("REC-SDK-1");
    expect(created.discrepancy_currency).toBeUndefined();
    expect(created.discrepancy_amount_usd).toBeUndefined();
    expect(created.exchange_rate_used).toBeUndefined();

    const fetched = await client.getInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-1");
    expect(fetched.status).toBe("PENDING");

    const { reconciliations } = await client.getInvoiceReconciliations(tokenB, 0, 100);
    expect(reconciliations.some((r) => r.id === "REC-SDK-1")).toBe(true);

    await client.deleteInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-1");
    await expect(client.getInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-1")).rejects.toThrow();
  });

  it(
    "publishes a reconciliation with discrepancy_amount and gets a real FX conversion to USD (CLP via Frankfurter/BCCh)",
    async () => {
      const created = await client.putInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-2", {
        id: "REC-SDK-2",
        cdr_id: "CDR-IR-1",
        status: "DISPUTED",
        discrepancy_description: "Total cost mismatch",
        discrepancy_amount: { excl_vat: 1000 },
      });

      expect(created.discrepancy_currency).toBe("CLP");
      expect(created.discrepancy_amount_usd).toBeDefined();
      expect(created.discrepancy_amount_usd?.excl_vat).toBeGreaterThan(0);
      expect(created.exchange_rate_used).toBeGreaterThan(0);

      await client.deleteInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-2");
    },
    30000,
  );

  it("putInvoiceReconciliation() with a cdr_id that doesn't resolve throws (400)", async () => {
    await expect(
      client.putInvoiceReconciliation(tokenB, "CL", "IR1", "REC-SDK-3", {
        id: "REC-SDK-3",
        cdr_id: "DOES-NOT-EXIST",
        status: "PENDING",
        discrepancy_amount: { excl_vat: 10 },
      }),
    ).rejects.toThrow();
  });
});
