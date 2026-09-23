import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";

const BASE_URL = "https://hub.latam-evra.org";

function jsonResponse(body: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
}

describe("OcpiHubClient — Tariffs", () => {
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

  it("putTariff() hace PUT con el body y devuelve el tariff creado", async () => {
    const tariff = {
      country_code: "CL",
      party_id: "TST",
      tariffId: "TAR-1",
      currency: "USD",
      elements: [{ price_components: [{ type: "ENERGY", price: 0.35, step_size: 1 }] }],
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: tariff,
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const result = await client.putTariff("TOKEN_B_1", "CL", "TST", "TAR-1", {
      id: "TAR-1",
      currency: "USD",
      elements: [{ price_components: [{ type: "ENERGY", price: 0.35, step_size: 1 }] }],
    });

    expect(result).toEqual(tariff);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tariffs/CL/TST/TAR-1`,
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("deleteTariff() hace DELETE y no lanza en éxito", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {},
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    await expect(
      client.deleteTariff("TOKEN_B_1", "CL", "TST", "TAR-1"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tariffs/CL/TST/TAR-1`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("getTariff() lanza OcpiError en error del Hub", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "Tariff no encontrado.",
          timestamp: new Date().toISOString(),
        },
        404,
      ),
    );

    await expect(client.getTariff("TOKEN_B_1", "CL", "TST", "DOES-NOT-EXIST")).rejects.toThrow(
      OcpiError,
    );
  });
});
