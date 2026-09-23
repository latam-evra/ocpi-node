import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";
import type { OcpiChargingProfileAck, OcpiChargingProfileRequest } from "../src/index.js";

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

const SAMPLE_ACK: OcpiChargingProfileAck = { result: "ACCEPTED", timeout: 30 };

describe("OcpiHubClient — Charging Profiles", () => {
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

  it("getActiveChargingProfile() hace POST /chargingprofiles/.../GET_ACTIVE_CHARGING_PROFILE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.getActiveChargingProfile(
      "TOKEN_B_1",
      "AR",
      "EVP",
      "SES-1",
      "https://emsp.example.com/callback",
    );

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/chargingprofiles/AR/EVP/SES-1/GET_ACTIVE_CHARGING_PROFILE`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
      }),
    );
  });

  it("setChargingProfile() hace POST /chargingprofiles/.../PUT_CHARGING_PROFILE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.setChargingProfile(
      "TOKEN_B_1",
      "AR",
      "EVP",
      "SES-1",
      "https://emsp.example.com/callback",
      {
        charging_rate_unit: "W",
        charging_profile_period: [{ start_period: 0, limit: 7400 }],
      },
    );

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/chargingprofiles/AR/EVP/SES-1/PUT_CHARGING_PROFILE`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("deleteChargingProfile() hace POST /chargingprofiles/.../DELETE_CHARGING_PROFILE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_ACK)));

    const result = await client.deleteChargingProfile(
      "TOKEN_B_1",
      "AR",
      "EVP",
      "SES-1",
      "https://emsp.example.com/callback",
    );

    expect(result).toEqual(SAMPLE_ACK);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/chargingprofiles/AR/EVP/SES-1/DELETE_CHARGING_PROFILE`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getChargingProfile() hace GET /chargingprofiles/callback/{id} (no /chargingprofiles/{session_id})", async () => {
    const request: OcpiChargingProfileRequest = {
      id: "cp-1",
      session_id: "SES-1",
      action: "PUT_CHARGING_PROFILE",
      ack_result: "ACCEPTED",
      last_updated: "2026-09-23T10:00:00Z",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(request)));

    const result = await client.getChargingProfile("TOKEN_B_1", "cp-1");

    expect(result).toEqual(request);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/chargingprofiles/callback/cp-1`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("setChargingProfile() lanza OcpiError cuando el Hub responde 404 (sesión inexistente)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "No se encontró la sesión referenciada.",
          timestamp: new Date().toISOString(),
        },
        404,
      ),
    );

    await expect(
      client.setChargingProfile("TOKEN_B_1", "AR", "EVP", "SES-1", "https://emsp.example.com/callback", {
        charging_rate_unit: "W",
        charging_profile_period: [{ start_period: 0, limit: 7400 }],
      }),
    ).rejects.toThrow(OcpiError);
  });
});
