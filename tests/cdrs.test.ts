import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";
import type { OcpiCdr, OcpiCdrInput } from "../src/index.js";

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

const CDR_INPUT: OcpiCdrInput = {
  id: "CDR-1",
  start_date_time: "2026-09-23T09:00:00Z",
  end_date_time: "2026-09-23T10:00:00Z",
  cdr_token: {
    country_code: "AR",
    party_id: "EVP",
    uid: "TOK-1",
    type: "RFID",
    contract_id: "C-1",
  },
  auth_method: "WHITELIST",
  cdr_location: {
    id: "LOC-1",
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
    { start_date_time: "2026-09-23T09:00:00Z", dimensions: [{ type: "ENERGY", volume: 12.5 }] },
  ],
  total_cost: { excl_vat: 10 },
  total_energy: 12.5,
  total_time: 1,
};

const SAMPLE_CDR: OcpiCdr = {
  ...CDR_INPUT,
  country_code: "CL",
  party_id: "TST",
  last_updated: "2026-09-23T10:00:00Z",
};

describe("OcpiHubClient — CDRs", () => {
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

  it("postCdr() hace POST con el body y devuelve el CDR creado (201)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_CDR), 201));

    const result = await client.postCdr("TOKEN_B_1", "CL", "TST", "CDR-1", CDR_INPUT);

    expect(result).toEqual(SAMPLE_CDR);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/cdrs/CL/TST/CDR-1`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
        body: JSON.stringify(CDR_INPUT),
      }),
    );
  });

  it("getCdr() hace GET y devuelve el CDR", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_CDR)));

    const result = await client.getCdr("TOKEN_B_1", "CL", "TST", "CDR-1");

    expect(result).toEqual(SAMPLE_CDR);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/cdrs/CL/TST/CDR-1`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getCdrs() hace GET con paginación y devuelve cdrs + total", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope([SAMPLE_CDR])));

    const result = await client.getCdrs("TOKEN_B_1", 0, 10);

    expect(result.cdrs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/cdrs?offset=0&limit=10`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("postCdr() lanza OcpiError con 409 cuando el CDR ya existe (inmutabilidad)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "Este CDR ya fue emitido y es inmutable.",
          timestamp: new Date().toISOString(),
        },
        409,
      ),
    );

    await expect(client.postCdr("TOKEN_B_1", "CL", "TST", "CDR-1", CDR_INPUT)).rejects.toThrow(
      OcpiError,
    );
  });
});
