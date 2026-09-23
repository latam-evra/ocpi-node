import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";

const BASE_URL = "https://hub.latam-evra.org";

function jsonResponse(body: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
}

describe("OcpiHubClient — Hub Client Info", () => {
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

  it("listHubClientInfo() hace GET con paginación y devuelve las entries", async () => {
    const entry = {
      party_id: "TST",
      country_code: "CL",
      role: "CPO",
      status: "CONNECTED",
      last_updated: new Date().toISOString(),
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [entry],
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const result = await client.listHubClientInfo("TOKEN_B_1", 0, 50);

    expect(result).toEqual({ entries: [entry], total: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/hubclientinfo?offset=0&limit=50`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getHubClientInfo() hace GET por country_code/party_id y devuelve las entries", async () => {
    const entry = {
      party_id: "TST",
      country_code: "CL",
      role: "EMSP",
      status: "SUSPENDED",
      last_updated: new Date().toISOString(),
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [entry],
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const result = await client.getHubClientInfo("TOKEN_B_1", "CL", "TST");

    expect(result).toEqual([entry]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/hubclientinfo/CL/TST`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("listHubClientInfo() lanza OcpiError con un TOKEN_B inválido", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2003,
          status_message: "TOKEN_B inválido o conexión no activa.",
          timestamp: new Date().toISOString(),
        },
        401,
      ),
    );

    await expect(client.listHubClientInfo("TOKEN_B_INVALID")).rejects.toThrow(OcpiError);
  });
});
