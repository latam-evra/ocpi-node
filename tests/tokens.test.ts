import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";
import type { OcpiToken } from "../src/index.js";

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

const SAMPLE_TOKEN: OcpiToken = {
  country_code: "AR",
  party_id: "EVP",
  uid: "TOK-1",
  type: "RFID",
  contract_id: "C-1",
  issuer: "LATAM EVP",
  valid: true,
  whitelist: "ALWAYS",
  last_updated: "2026-09-23T10:00:00Z",
};

describe("OcpiHubClient — Tokens & Authorisation", () => {
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

  it("putToken() hace PUT con el body y devuelve el token creado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_TOKEN), 201));

    const result = await client.putToken("TOKEN_B_1", "AR", "EVP", "TOK-1", {
      uid: "TOK-1",
      type: "RFID",
      contract_id: "C-1",
      issuer: "LATAM EVP",
      valid: true,
      whitelist: "ALWAYS",
    });

    expect(result).toEqual(SAMPLE_TOKEN);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tokens/AR/EVP/TOK-1`,
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
      }),
    );
  });

  it("patchToken() hace PATCH con body parcial", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ ...SAMPLE_TOKEN, valid: false })));

    const result = await client.patchToken("TOKEN_B_1", "AR", "EVP", "TOK-1", { valid: false });

    expect(result.valid).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tokens/AR/EVP/TOK-1`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ valid: false }) }),
    );
  });

  it("getToken() hace GET y devuelve el token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_TOKEN)));

    const result = await client.getToken("TOKEN_B_1", "AR", "EVP", "TOK-1");

    expect(result).toEqual(SAMPLE_TOKEN);
  });

  it("getTokens() hace GET con paginación y devuelve tokens + total", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope([SAMPLE_TOKEN])));

    const result = await client.getTokens("TOKEN_B_1", 0, 10);

    expect(result.tokens).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tokens?offset=0&limit=10`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("deleteToken() hace DELETE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({})));

    await client.deleteToken("TOKEN_B_1", "AR", "EVP", "TOK-1");

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tokens/AR/EVP/TOK-1`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("authorizeToken() hace POST a .../authorize con locationReferences y devuelve {allowed}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ allowed: "ALLOWED" })));

    const result = await client.authorizeToken("TOKEN_B_1", "AR", "EVP", "TOK-1", {
      location_id: "LOC-1",
    });

    expect(result.allowed).toBe("ALLOWED");
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/tokens/AR/EVP/TOK-1/authorize`,
      expect.objectContaining({ method: "POST" }),
    );
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(callInit.body).toBe(JSON.stringify({ location_id: "LOC-1" }));
  });

  it("authorizeToken() manda {} como body cuando no se pasan locationReferences", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ allowed: "ALLOWED" })));

    await client.authorizeToken("TOKEN_B_1", "AR", "EVP", "TOK-1");

    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(callInit.body).toBe(JSON.stringify({}));
  });

  it("authorizeToken() nunca propaga error de negocio: {allowed: 'BLOCKED'} en vez de excepción", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ allowed: "BLOCKED" })));

    const result = await client.authorizeToken("TOKEN_B_1", "AR", "ZZZ", "DOES-NOT-EXIST");

    expect(result.allowed).toBe("BLOCKED");
  });

  it("getToken() lanza OcpiError cuando el Hub responde 404 con status_code de error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "Token no encontrado.",
          timestamp: new Date().toISOString(),
        },
        404,
      ),
    );

    await expect(client.getToken("TOKEN_B_1", "AR", "EVP", "DOES-NOT-EXIST")).rejects.toThrow(
      OcpiError,
    );
  });
});
