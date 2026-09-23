import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";

const BASE_URL = "https://hub.latam-evra.org";

function jsonResponse(body: unknown, httpStatus = 200): Response {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
}

describe("OcpiHubClient — Credentials & Registration", () => {
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

  it("getVersions() devuelve la lista de versiones en éxito", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ version: "2.3.0", url: `${BASE_URL}/api/ocpi/2.3.0/details` }],
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const versions = await client.getVersions();

    expect(versions).toEqual([
      { version: "2.3.0", url: `${BASE_URL}/api/ocpi/2.3.0/details` },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/versions`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getDetails() devuelve version y endpoints en éxito", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          version: "2.3.0",
          endpoints: [
            {
              identifier: "credentials",
              role: "HUB",
              url: `${BASE_URL}/api/ocpi/2.3.0/credentials`,
            },
          ],
        },
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const details = await client.getDetails();

    expect(details.version).toBe("2.3.0");
    expect(details.endpoints).toHaveLength(1);
    expect(details.endpoints[0]).toEqual({
      identifier: "credentials",
      role: "HUB",
      url: `${BASE_URL}/api/ocpi/2.3.0/credentials`,
    });
  });

  it("registerCredentials() hace POST con el header Authorization: Token <TOKEN_A> y body correcto", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          token: "TOKEN_B_abc123",
          url: `${BASE_URL}/api/ocpi/2.3.0/versions`,
          roles: [{ role: "HUB", party_id: "LEA", country_code: "ZZ" }],
        },
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const roles = [
      { role: "CPO" as const, party_id: "CHG", country_code: "CL" },
    ];
    const result = await client.registerCredentials(
      "TOKEN_A_xyz",
      "https://csms.example.com/ocpi/versions",
      roles,
    );

    expect(result.token).toBe("TOKEN_B_abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${BASE_URL}/api/ocpi/2.3.0/credentials`);
    expect(calledInit.method).toBe("POST");
    expect(calledInit.headers.authorization).toBe("Token TOKEN_A_xyz");
    expect(JSON.parse(calledInit.body)).toEqual({
      token: "TOKEN_A_xyz",
      url: "https://csms.example.com/ocpi/versions",
      roles,
    });
  });

  it("renewCredentials() hace PUT con Authorization: Token <TOKEN_B>", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          token: "TOKEN_B_new",
          url: `${BASE_URL}/api/ocpi/2.3.0/versions`,
          roles: [{ role: "HUB", party_id: "LEA", country_code: "ZZ" }],
        },
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    const result = await client.renewCredentials("TOKEN_B_old");

    expect(result.token).toBe("TOKEN_B_new");
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${BASE_URL}/api/ocpi/2.3.0/credentials`);
    expect(calledInit.method).toBe("PUT");
    expect(calledInit.headers.authorization).toBe("Token TOKEN_B_old");
  });

  it("terminateCredentials() hace DELETE con Authorization: Token <TOKEN_B>", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {},
        status_code: OCPI_STATUS.SUCCESS,
        status_message: "Success",
        timestamp: new Date().toISOString(),
      }),
    );

    await expect(
      client.terminateCredentials("TOKEN_B_old"),
    ).resolves.toBeUndefined();

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${BASE_URL}/api/ocpi/2.3.0/credentials`);
    expect(calledInit.method).toBe("DELETE");
    expect(calledInit.headers.authorization).toBe("Token TOKEN_B_old");
  });

  it("lanza OcpiError cuando el Hub responde 200 OK con status_code de error (TOKEN_A inválido)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: OCPI_STATUS.UNKNOWN_TOKEN,
          status_message: "TOKEN_A inválido.",
          timestamp: new Date().toISOString(),
        },
        401,
      ),
    );

    const roles = [
      { role: "CPO" as const, party_id: "CHG", country_code: "CL" },
    ];

    await expect(
      client.registerCredentials(
        "TOKEN_A_bad",
        "https://csms.example.com/ocpi/versions",
        roles,
      ),
    ).rejects.toMatchObject({
      name: "OcpiError",
      statusCode: OCPI_STATUS.UNKNOWN_TOKEN,
      statusMessage: "TOKEN_A inválido.",
      httpStatus: 401,
    });
  });

  it("OcpiError es instancia de Error y expone statusCode/statusMessage", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: OCPI_STATUS.UNSUPPORTED_VERSION,
          status_message: "El CSMS no soporta OCPI 2.3.0.",
          timestamp: new Date().toISOString(),
        },
        422,
      ),
    );

    try {
      await client.registerCredentials("TOKEN_A_x", "https://csms.example.com/versions", [
        { role: "EMSP", party_id: "EVP", country_code: "AR" },
      ]);
      expect.unreachable("debería haber lanzado OcpiError");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(OcpiError);
      const ocpiErr = err as OcpiError;
      expect(ocpiErr.statusCode).toBe(OCPI_STATUS.UNSUPPORTED_VERSION);
      expect(ocpiErr.statusMessage).toBe("El CSMS no soporta OCPI 2.3.0.");
      expect(ocpiErr.httpStatus).toBe(422);
    }
  });
});
