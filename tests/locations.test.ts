import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";

const BASE_URL = "https://hub.latam-evra.org";

function jsonResponse(body: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
}

describe("OcpiHubClient — Locations", () => {
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

  it("putLocation() hace PUT con el body y devuelve la location creada", async () => {
    const location = {
      country_code: "CL",
      party_id: "TST",
      locationId: "LOC-1",
      publish: true,
      address: "x",
      city: "x",
      country: "CHL",
      latitude: "0",
      longitude: "0",
      evses: [],
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: location,
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const result = await client.putLocation("TOKEN_B_1", "CL", "TST", "LOC-1", {
      id: "LOC-1",
      publish: true,
      address: "x",
      city: "x",
      country: "CHL",
      coordinates: { latitude: "0", longitude: "0" },
    });

    expect(result).toEqual(location);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/locations/CL/TST/LOC-1`,
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
      }),
    );
  });

  it("getLocations() hace GET con paginación y devuelve locations + total", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ country_code: "CL", party_id: "TST", locationId: "LOC-1", evses: [] }],
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const result = await client.getLocations("TOKEN_B_1", 0, 10);

    expect(result.locations).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/locations?offset=0&limit=10`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getLocation() lanza OcpiError cuando el Hub responde 404 con status_code de error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "Location no encontrada.",
          timestamp: new Date().toISOString(),
        },
        404,
      ),
    );

    await expect(client.getLocation("TOKEN_B_1", "CL", "TST", "DOES-NOT-EXIST")).rejects.toThrow(
      OcpiError,
    );
  });
});
