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
 * /details (con un endpoint "commands") y /commands/{TYPE}, respondiendo
 * un ACK válido. Mismo patrón que
 * tests/api/ocpi/commands-send.test.ts en el repo del Hub.
 */
function startMockCpoServer(): Promise<{
  server: Server;
  baseUrl: string;
  lastCommandId: { current: string | undefined };
}> {
  let baseUrl = "";
  const lastCommandId = { current: undefined as string | undefined };

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
            endpoints: [{ identifier: "commands", role: "CPO", url: `${baseUrl}/cpo/commands` }],
          },
          status_code: 1000,
        }),
      );
      return;
    }
    if (req.url?.startsWith("/cpo/commands/")) {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(raw) as { response_url?: string };
          // El Hub reescribe response_url a su propia URL de callback
          // interna .../commands/callback/{command_id} antes de forwardear
          // al CPO — es la única forma de que el mock descubra el id del
          // comando recién creado (el ACK que el CPO devuelve no lo trae).
          if (body.response_url) {
            const match = body.response_url.match(/\/commands\/callback\/([^/]+)$/);
            if (match) lastCommandId.current = match[1];
          }
        } catch {
          // Body no parseable: no bloquea la respuesta del ACK.
        }
        res.end(JSON.stringify({ data: { result: "ACCEPTED", timeout: 30 }, status_code: 1000 }));
      });
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
      resolve({ server, baseUrl, lastCommandId });
    });
  });
}

describe("Commands — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let emspRegistrationId: string;
  let emspTokenB: string;
  let cpoRegistrationId: string;
  let cpoTokenB: string;
  let cpoServer: Server;
  let cpoBaseUrl: string;
  let lastCommandId: { current: string | undefined };

  beforeAll(async () => {
    const mock = await startMockCpoServer();
    cpoServer = mock.server;
    cpoBaseUrl = mock.baseUrl;
    lastCommandId = mock.lastCommandId;

    const cpo = createTestRegistration("CPO", "CL", "CM1");
    cpoRegistrationId = cpo.registrationId;
    const cpoCredentials = await client.registerCredentials(cpo.rawTokenA, `${cpoBaseUrl}/cpo/versions`, [
      { role: "CPO", party_id: "CM1", country_code: "CL" },
    ]);
    cpoTokenB = cpoCredentials.token;

    // Publica la location y la session que los comandos van a referenciar,
    // usando el propio cliente SDK (rol CPO).
    await client.putLocation(cpoTokenB, "CL", "CM1", "LOC-CMD-1", {
      id: "LOC-CMD-1",
      publish: true,
      address: "x",
      city: "x",
      country: "CHL",
      coordinates: { latitude: "0", longitude: "0" },
    });
    await client.putSession(cpoTokenB, "CL", "CM1", "SES-CMD-1", {
      id: "SES-CMD-1",
      start_date_time: "2026-09-23T09:00:00Z",
      kwh: 0,
      cdr_token: {
        country_code: "AR",
        party_id: "EMS",
        uid: "TOK-CMD-1",
        type: "RFID",
        contract_id: "C-CMD-1",
      },
      auth_method: "AUTH_REQUEST",
      location_id: "LOC-CMD-1",
      evse_uid: "EVSE-1",
      connector_id: "1",
      currency: "USD",
      status: "ACTIVE",
    });

    const emsp = createTestRegistration("EMSP", "AR", "EMS");
    emspRegistrationId = emsp.registrationId;
    const emspCredentials = await client.registerCredentials(
      emsp.rawTokenA,
      `${HUB_URL}/api/ocpi/2.3.0/versions`,
      [{ role: "EMSP", party_id: "EMS", country_code: "AR" }],
    );
    emspTokenB = emspCredentials.token;
  });

  afterAll(() => {
    cleanupRegistration(emspRegistrationId);
    cleanupRegistration(cpoRegistrationId);
    cpoServer.close();
  });

  it("startSession() resolves the target CPO via location_id and returns the ACK from the mock CPO", async () => {
    const ack = await client.startSession(emspTokenB, {
      response_url: "https://emsp.example.com/callback",
      country_code: "CL",
      party_id: "CM1",
      token: { uid: "TOK-CMD-1", type: "RFID", contract_id: "C-CMD-1" },
      location_id: "LOC-CMD-1",
    });

    expect(ack.result).toBe("ACCEPTED");
    expect(ack.timeout).toBe(30);
  });

  it("stopSession() resolves the target CPO via session_id and returns the ACK", async () => {
    const ack = await client.stopSession(emspTokenB, {
      response_url: "https://emsp.example.com/callback",
      country_code: "CL",
      party_id: "CM1",
      session_id: "SES-CMD-1",
    });

    expect(ack.result).toBe("ACCEPTED");
  });

  it("unlockConnector() resolves the target CPO via session_id and returns the ACK", async () => {
    const ack = await client.unlockConnector(emspTokenB, {
      response_url: "https://emsp.example.com/callback",
      country_code: "CL",
      party_id: "CM1",
      session_id: "SES-CMD-1",
    });

    expect(ack.result).toBe("ACCEPTED");
  });

  it("cancelReservation() resolves the target CPO via session_id and returns the ACK", async () => {
    const ack = await client.cancelReservation(emspTokenB, {
      response_url: "https://emsp.example.com/callback",
      country_code: "CL",
      party_id: "CM1",
      session_id: "SES-CMD-1",
    });

    expect(ack.result).toBe("ACCEPTED");
  });

  it("reserveNow() resolves the target CPO via location_id and returns the ACK", async () => {
    const ack = await client.reserveNow(emspTokenB, {
      response_url: "https://emsp.example.com/callback",
      country_code: "CL",
      party_id: "CM1",
      token: { uid: "TOK-CMD-1", type: "RFID", contract_id: "C-CMD-1" },
      expiry_date: "2026-09-24T00:00:00Z",
      reservation_id: "RES-CMD-1",
      location_id: "LOC-CMD-1",
    });

    expect(ack.result).toBe("ACCEPTED");
  });

  it("getCommand() fetches the command created by startSession() via GET /commands/callback/{id}", async () => {
    const ack = await client.startSession(emspTokenB, {
      response_url: "https://emsp.example.com/callback",
      country_code: "CL",
      party_id: "CM1",
      token: { uid: "TOK-CMD-1", type: "RFID", contract_id: "C-CMD-1" },
      location_id: "LOC-CMD-1",
    });
    expect(ack.result).toBe("ACCEPTED");

    // El ACK que devuelve startSession() es el del CPO destino, no trae el
    // id del comando — el mock CPO lo captura leyendo el response_url que
    // el Hub reescribe internamente antes de forwardear el POST.
    const commandId = lastCommandId.current;
    expect(commandId).toBeDefined();

    const command = await client.getCommand(emspTokenB, commandId as string);
    expect(command.id).toBe(commandId);
    expect(command.type).toBe("START_SESSION");
    expect(command.ack_result).toBe("ACCEPTED");
  });
});
