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

describe("CDRs — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let registrationId: string;
  let tokenB: string;

  beforeAll(async () => {
    const { registrationId: id, rawTokenA } = createTestRegistration("CPO", "CL", "CI1");
    registrationId = id;

    const credentials = await client.registerCredentials(rawTokenA, `${HUB_URL}/api/ocpi/2.3.0/versions`, [
      { role: "CPO", party_id: "CI1", country_code: "CL" },
    ]);
    tokenB = credentials.token;
  });

  afterAll(() => {
    cleanupRegistration(registrationId);
  });

  const cdrInput: OcpiCdrInput = {
    id: "CDR-SDK-1",
    start_date_time: "2026-09-23T09:00:00Z",
    end_date_time: "2026-09-23T10:00:00Z",
    cdr_token: {
      country_code: "AR",
      party_id: "EVP",
      uid: "TOK-SDK-1",
      type: "RFID",
      contract_id: "C-SDK-1",
    },
    auth_method: "WHITELIST",
    cdr_location: {
      id: "LOC-SDK-1",
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
    currency: "USD",
    charging_periods: [
      { start_date_time: "2026-09-23T09:00:00Z", dimensions: [{ type: "ENERGY", volume: 5.5 }] },
    ],
    total_cost: { excl_vat: 2.5 },
    total_energy: 5.5,
    total_time: 1,
  };

  it("creates a CDR (POST), reads it back, and lists it", async () => {
    const created = await client.postCdr(tokenB, "CL", "CI1", "CDR-SDK-1", cdrInput);
    expect(created.id).toBe("CDR-SDK-1");
    expect(created.country_code).toBe("CL");
    expect(created.total_energy).toBe(5.5);

    const fetched = await client.getCdr(tokenB, "CL", "CI1", "CDR-SDK-1");
    expect(fetched.currency).toBe("USD");

    const { cdrs } = await client.getCdrs(tokenB, 0, 100);
    expect(cdrs.some((c) => c.id === "CDR-SDK-1")).toBe(true);
  });

  it("immutability: a second POST with the same id fails with 409", async () => {
    await expect(client.postCdr(tokenB, "CL", "CI1", "CDR-SDK-1", cdrInput)).rejects.toThrow();
  });
});
