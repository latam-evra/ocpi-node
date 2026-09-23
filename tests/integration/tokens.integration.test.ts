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

describe("Tokens & Authorisation — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let emspRegistrationId: string;
  let emspTokenB: string;
  let cpoRegistrationId: string;
  let cpoTokenB: string;

  beforeAll(async () => {
    const emsp = createTestRegistration("EMSP", "AR", "TI1");
    emspRegistrationId = emsp.registrationId;
    const emspCredentials = await client.registerCredentials(
      emsp.rawTokenA,
      `${HUB_URL}/api/ocpi/2.3.0/versions`,
      [{ role: "EMSP", party_id: "TI1", country_code: "AR" }],
    );
    emspTokenB = emspCredentials.token;

    const cpo = createTestRegistration("CPO", "CL", "TI2");
    cpoRegistrationId = cpo.registrationId;
    const cpoCredentials = await client.registerCredentials(
      cpo.rawTokenA,
      `${HUB_URL}/api/ocpi/2.3.0/versions`,
      [{ role: "CPO", party_id: "TI2", country_code: "CL" }],
    );
    cpoTokenB = cpoCredentials.token;
  });

  afterAll(() => {
    cleanupRegistration(emspRegistrationId);
    cleanupRegistration(cpoRegistrationId);
  });

  it("publishes a token (PUT) as EMSP, reads it back, patches it, lists it, and deletes it", async () => {
    const created = await client.putToken(emspTokenB, "AR", "TI1", "TOK-SDK-1", {
      uid: "TOK-SDK-1",
      type: "RFID",
      contract_id: "C-SDK-1",
      issuer: "LATAM EVP",
      valid: true,
      whitelist: "ALWAYS",
    });
    expect(created.uid).toBe("TOK-SDK-1");
    expect(created.country_code).toBe("AR");

    const fetched = await client.getToken(emspTokenB, "AR", "TI1", "TOK-SDK-1");
    expect(fetched.issuer).toBe("LATAM EVP");

    const patched = await client.patchToken(emspTokenB, "AR", "TI1", "TOK-SDK-1", { valid: false });
    expect(patched.valid).toBe(false);

    const { tokens } = await client.getTokens(emspTokenB, 0, 100);
    expect(tokens.some((t) => t.uid === "TOK-SDK-1")).toBe(true);

    await client.deleteToken(emspTokenB, "AR", "TI1", "TOK-SDK-1");
    await expect(client.getToken(emspTokenB, "AR", "TI1", "TOK-SDK-1")).rejects.toThrow();
  });

  it("authorizeToken() as CPO always resolves to {allowed}, never throws for a business error (BLOCKED for a nonexistent token)", async () => {
    const result = await client.authorizeToken(cpoTokenB, "AR", "ZZZ", "DOES-NOT-EXIST-SDK");
    expect(result.allowed).toBe("BLOCKED");
  });
});
