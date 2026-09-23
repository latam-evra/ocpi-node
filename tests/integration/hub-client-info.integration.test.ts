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

describe("Hub Client Info — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let registrationId: string;
  let tokenB: string;

  beforeAll(async () => {
    const { registrationId: id, rawTokenA } = createTestRegistration("CPO", "CL", "ND3");
    registrationId = id;

    const credentials = await client.registerCredentials(rawTokenA, `${HUB_URL}/api/ocpi/2.3.0/versions`, [
      { role: "CPO", party_id: "ND3", country_code: "CL" },
    ]);
    tokenB = credentials.token;
  });

  afterAll(() => {
    cleanupRegistration(registrationId);
  });

  it("lists this connection's own entry among all known parties, and fetches it by country_code/party_id", async () => {
    const { entries } = await client.listHubClientInfo(tokenB, 0, 100);
    const own = entries.find((e) => e.party_id === "ND3" && e.country_code === "CL");
    expect(own).toBeDefined();
    expect(own?.role).toBe("CPO");
    expect(own?.status).toBe("CONNECTED");

    const byRole = await client.getHubClientInfo(tokenB, "CL", "ND3");
    expect(byRole).toHaveLength(1);
    expect(byRole[0].status).toBe("CONNECTED");
  });
});
