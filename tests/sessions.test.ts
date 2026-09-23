import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";
import type { OcpiSession } from "../src/index.js";

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

const SAMPLE_SESSION: OcpiSession = {
  country_code: "CL",
  party_id: "TST",
  id: "SES-1",
  start_date_time: "2026-09-23T10:00:00Z",
  kwh: 12.5,
  cdr_token: {
    country_code: "AR",
    party_id: "EVP",
    uid: "TOK-1",
    type: "RFID",
    contract_id: "C-1",
  },
  auth_method: "WHITELIST",
  location_id: "LOC-1",
  evse_uid: "EVSE-1",
  connector_id: "1",
  currency: "USD",
  status: "ACTIVE",
  last_updated: "2026-09-23T10:00:00Z",
};

describe("OcpiHubClient — Sessions", () => {
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

  it("putSession() hace PUT con el body y devuelve la session creada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_SESSION), 201));

    const result = await client.putSession(
      "TOKEN_B_1",
      "CL",
      "TST",
      "SES-1",
      {
        id: "SES-1",
        start_date_time: SAMPLE_SESSION.start_date_time,
        kwh: 12.5,
        cdr_token: SAMPLE_SESSION.cdr_token,
        auth_method: "WHITELIST",
        location_id: "LOC-1",
        evse_uid: "EVSE-1",
        connector_id: "1",
        currency: "USD",
        status: "ACTIVE",
      },
    );

    expect(result).toEqual(SAMPLE_SESSION);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/sessions/CL/TST/SES-1`,
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
        body: expect.any(String),
      }),
    );
  });

  it("patchSession() hace PATCH con body parcial y devuelve la session actualizada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ ...SAMPLE_SESSION, kwh: 20 })));

    const result = await client.patchSession("TOKEN_B_1", "CL", "TST", "SES-1", { kwh: 20 });

    expect(result.kwh).toBe(20);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/sessions/CL/TST/SES-1`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ kwh: 20 }) }),
    );
  });

  it("getSession() hace GET y devuelve la session", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_SESSION)));

    const result = await client.getSession("TOKEN_B_1", "CL", "TST", "SES-1");

    expect(result).toEqual(SAMPLE_SESSION);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/sessions/CL/TST/SES-1`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getSessions() hace GET con paginación y devuelve sessions + total", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope([SAMPLE_SESSION])));

    const result = await client.getSessions("TOKEN_B_1", 0, 10);

    expect(result.sessions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/sessions?offset=0&limit=10`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getSession() lanza OcpiError cuando el Hub responde 404 con status_code de error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "Session no encontrada.",
          timestamp: new Date().toISOString(),
        },
        404,
      ),
    );

    await expect(client.getSession("TOKEN_B_1", "CL", "TST", "DOES-NOT-EXIST")).rejects.toThrow(
      OcpiError,
    );
  });
});
