import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
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

/**
 * Servidor HTTP real que simula el CSMS/CPO destino: expone /versions,
 * /details (con un endpoint "chargingprofiles") y
 * GET|PUT|DELETE /chargingprofiles/{session_id}, respondiendo un ACK
 * válido. Mismo patrón que
 * tests/api/ocpi/charging-profiles-request.test.ts en el repo del Hub.
 */
function startMockCpoServer(): Promise<{
  server: Server;
  baseUrl: string;
  lastMethod: { current: string | undefined };
}> {
  let baseUrl = "";
  const lastMethod = { current: undefined as string | undefined };

  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/cpo/versions") {
      res.end(JSON.stringify({ data: [{ version: "2.3.0", url: `${baseUrl}/cpo/details` }], status_code: 1000 }));
      return;
    }
    if (req.url === "/cpo/details") {
      res.end(
        JSON.stringify({
          data: {
            version: "2.3.0",
            endpoints: [{ identifier: "chargingprofiles", role: "CPO", url: `${baseUrl}/cpo/chargingprofiles` }],
          },
          status_code: 1000,
        }),
      );
      return;
    }
    if (req.url?.startsWith("/cpo/chargingprofiles/")) {
      lastMethod.current = req.method;
      res.end(JSON.stringify({ data: { result: "ACCEPTED", timeout: 30 }, status_code: 1000 }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve({ server, baseUrl, lastMethod });
    });
  });
}

describe("Charging Profiles — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let emspRegistrationId: string;
  let emspTokenB: string;
  let cpoRegistrationId: string;
  let cpoTokenB: string;
  let cpoServer: Server;
  let cpoBaseUrl: string;
  let lastMethod: { current: string | undefined };

  beforeAll(async () => {
    const mock = await startMockCpoServer();
    cpoServer = mock.server;
    cpoBaseUrl = mock.baseUrl;
    lastMethod = mock.lastMethod;

    const cpo = createTestRegistration("CPO", "CL", "CQ1");
    cpoRegistrationId = cpo.registrationId;
    const cpoCredentials = await client.registerCredentials(cpo.rawTokenA, `${cpoBaseUrl}/cpo/versions`, [
      { role: "CPO", party_id: "CQ1", country_code: "CL" },
    ]);
    cpoTokenB = cpoCredentials.token;

    await client.putSession(cpoTokenB, "CL", "CQ1", "SES-CP-1", {
      id: "SES-CP-1",
      start_date_time: "2026-09-23T09:00:00Z",
      kwh: 0,
      cdr_token: {
        country_code: "AR",
        party_id: "EMQ",
        uid: "TOK-CP-1",
        type: "RFID",
        contract_id: "C-CP-1",
      },
      auth_method: "AUTH_REQUEST",
      location_id: "LOC-CP-1",
      evse_uid: "EVSE-1",
      connector_id: "1",
      currency: "USD",
      status: "ACTIVE",
    });

    const emsp = createTestRegistration("EMSP", "AR", "EMQ");
    emspRegistrationId = emsp.registrationId;
    const emspCredentials = await client.registerCredentials(
      emsp.rawTokenA,
      `${HUB_URL}/api/ocpi/2.3.0/versions`,
      [{ role: "EMSP", party_id: "EMQ", country_code: "AR" }],
    );
    emspTokenB = emspCredentials.token;
  });

  afterAll(() => {
    cleanupRegistration(emspRegistrationId);
    cleanupRegistration(cpoRegistrationId);
    cpoServer.close();
  });

  it("setChargingProfile() resolves the target CPO via session_id, forwards a PUT and returns the ACK", async () => {
    const ack = await client.setChargingProfile(
      emspTokenB,
      "CL",
      "CQ1",
      "SES-CP-1",
      "https://emsp.example.com/callback",
      {
        charging_rate_unit: "W",
        charging_profile_period: [{ start_period: 0, limit: 7400 }],
      },
    );

    expect(ack.result).toBe("ACCEPTED");
    expect(ack.timeout).toBe(30);
    expect(lastMethod.current).toBe("PUT");
  });

  it("getActiveChargingProfile() forwards a GET and returns the ACK", async () => {
    const ack = await client.getActiveChargingProfile(
      emspTokenB,
      "CL",
      "CQ1",
      "SES-CP-1",
      "https://emsp.example.com/callback",
    );

    expect(ack.result).toBe("ACCEPTED");
    expect(lastMethod.current).toBe("GET");
  });

  it("deleteChargingProfile() forwards a DELETE and returns the ACK", async () => {
    const ack = await client.deleteChargingProfile(
      emspTokenB,
      "CL",
      "CQ1",
      "SES-CP-1",
      "https://emsp.example.com/callback",
    );

    expect(ack.result).toBe("ACCEPTED");
    expect(lastMethod.current).toBe("DELETE");
  });
});
