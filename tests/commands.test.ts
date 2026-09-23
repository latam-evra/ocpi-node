import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";
import type { OcpiCommandAck, OcpiCommand } from "../src/index.js";

const BASE_URL = "https://hub.latam-evra.org";

function jsonResponse(body: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
}

function envelope<T>(data: T) {
  return {
    data,
    status_code: OCPI_STATUS.SUCCESS,
    status_message: "Success",
    timestamp: new Date().toISOString(),
  };
}

const SAMPLE_ACK: OcpiCommandAck = { result: "ACCEPTED", timeout: 30 };

const TOKEN_REF = { uid: "TOK-1", type: "RFID" as const, contract_id: "C-1" };

describe("OcpiHubClient — Commands", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: OcpiHubClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    client = new OcpiHubClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("startSession() hace POST /commands/START_SESSION y devuelve el ACK", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.startSession("TOKEN_B_1", {
      response_url: "https://emsp.example.com/callback",
      country_code: "AR",
      party_id: "EVP",
      token: TOKEN_REF,
      location_id: "LOC-1",
    });

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/commands/START_SESSION`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
      }),
    );
  });

  it("reserveNow() hace POST /commands/RESERVE_NOW", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.reserveNow("TOKEN_B_1", {
      response_url: "https://emsp.example.com/callback",
      country_code: "AR",
      party_id: "EVP",
      token: TOKEN_REF,
      expiry_date: "2026-09-24T00:00:00Z",
      reservation_id: "RES-1",
      location_id: "LOC-1",
    });

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/commands/RESERVE_NOW`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("stopSession() hace POST /commands/STOP_SESSION", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.stopSession("TOKEN_B_1", {
      response_url: "https://emsp.example.com/callback",
      country_code: "AR",
      party_id: "EVP",
      session_id: "SES-1",
    });

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/commands/STOP_SESSION`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("unlockConnector() hace POST /commands/UNLOCK_CONNECTOR", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.unlockConnector("TOKEN_B_1", {
      response_url: "https://emsp.example.com/callback",
      country_code: "AR",
      party_id: "EVP",
      session_id: "SES-1",
    });

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/commands/UNLOCK_CONNECTOR`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("cancelReservation() hace POST /commands/CANCEL_RESERVATION", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.cancelReservation("TOKEN_B_1", {
      response_url: "https://emsp.example.com/callback",
      country_code: "AR",
      party_id: "EVP",
      session_id: "SES-1",
    });

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/commands/CANCEL_RESERVATION`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getCommand() hace GET /commands/callback/{id} (no /commands/{type})", async () => {
    const command: OcpiCommand = {
      id: "cmd-1",
      type: "START_SESSION",
      payload: { location_id: "LOC-1" },
      ack_result: "ACCEPTED",
      last_updated: "2026-09-23T10:00:00Z",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(command)));

    const result = await client.getCommand("TOKEN_B_1", "cmd-1");

    expect(result).toEqual(command);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/commands/callback/cmd-1`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("startSession() lanza OcpiError cuando el Hub responde 422 (CPO destino desconectado)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 3001,
          status_message: "El CPO destino no está conectado.",
          timestamp: new Date().toISOString(),
        },
        422,
      ),
    );

    await expect(
      client.startSession("TOKEN_B_1", {
        response_url: "https://emsp.example.com/callback",
        country_code: "AR",
        party_id: "EVP",
        token: TOKEN_REF,
        location_id: "LOC-1",
      }),
    ).rejects.toThrow(OcpiError);
  });
});
