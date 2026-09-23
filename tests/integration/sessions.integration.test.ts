import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OcpiHubClient } from "../../src/index.js";

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

describe("Sessions — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let registrationId: string;
  let tokenB: string;

  beforeAll(async () => {
    const { registrationId: id, rawTokenA } = createTestRegistration("CPO", "CL", "SI1");
    registrationId = id;

    const credentials = await client.registerCredentials(rawTokenA, `${HUB_URL}/api/ocpi/2.3.0/versions`, [
      { role: "CPO", party_id: "SI1", country_code: "CL" },
    ]);
    tokenB = credentials.token;
  });

  afterAll(() => {
    cleanupRegistration(registrationId);
  });

  it("publishes a session (PUT), reads it back, patches it, and lists it", async () => {
    const created = await client.putSession(tokenB, "CL", "SI1", "SES-SDK-1", {
      id: "SES-SDK-1",
      start_date_time: "2026-09-23T09:00:00Z",
      kwh: 5.5,
      cdr_token: {
        country_code: "AR",
        party_id: "EVP",
        uid: "TOK-SDK-1",
        type: "RFID",
        contract_id: "C-SDK-1",
      },
      auth_method: "WHITELIST",
      location_id: "LOC-SDK-1",
      evse_uid: "EVSE-1",
      connector_id: "1",
      currency: "USD",
      status: "ACTIVE",
    });
    expect(created.id).toBe("SES-SDK-1");
    expect(created.country_code).toBe("CL");
    expect(created.status).toBe("ACTIVE");

    const fetched = await client.getSession(tokenB, "CL", "SI1", "SES-SDK-1");
    expect(fetched.kwh).toBe(5.5);

    const patched = await client.patchSession(tokenB, "CL", "SI1", "SES-SDK-1", {
      kwh: 9.2,
      status: "COMPLETED",
    });
    expect(patched.kwh).toBe(9.2);
    expect(patched.status).toBe("COMPLETED");

    const { sessions } = await client.getSessions(tokenB, 0, 100);
    expect(sessions.some((s) => s.id === "SES-SDK-1")).toBe(true);
  });

  it("patchSession() on a non-existent session throws (404)", async () => {
    await expect(
      client.patchSession(tokenB, "CL", "SI1", "DOES-NOT-EXIST", { kwh: 1 }),
    ).rejects.toThrow();
  });
});
