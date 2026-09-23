import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcpiError, OcpiHubClient, OCPI_STATUS } from "../src/index.js";
import type { OcpiInvoiceReconciliation } from "../src/index.js";

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

const SAMPLE_RECORD_NO_FX: OcpiInvoiceReconciliation = {
  country_code: "CL",
  party_id: "TST",
  id: "REC-1",
  cdr_id: "CDR-1",
  status: "PENDING",
  last_updated: "2026-09-23T10:00:00Z",
};

const SAMPLE_RECORD_WITH_FX: OcpiInvoiceReconciliation = {
  country_code: "CL",
  party_id: "TST",
  id: "REC-2",
  cdr_id: "CDR-2",
  status: "DISPUTED",
  discrepancy_amount: { excl_vat: 1000 },
  discrepancy_currency: "CLP",
  discrepancy_amount_usd: { excl_vat: 1.05 },
  exchange_rate_used: 950.5,
  last_updated: "2026-09-23T10:00:00Z",
};

describe("OcpiHubClient — Invoice Reconciliation", () => {
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

  it("putInvoiceReconciliation() hace PUT con el body y devuelve el registro creado (sin discrepancy_amount → sin campos FX)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_RECORD_NO_FX), 201));

    const result = await client.putInvoiceReconciliation("TOKEN_B_1", "CL", "TST", "REC-1", {
      id: "REC-1",
      cdr_id: "CDR-1",
      status: "PENDING",
    });

    expect(result).toEqual(SAMPLE_RECORD_NO_FX);
    expect(result.discrepancy_currency).toBeUndefined();
    expect(result.discrepancy_amount_usd).toBeUndefined();
    expect(result.exchange_rate_used).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/invoicereconciliations/CL/TST/REC-1`,
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ authorization: "Token TOKEN_B_1" }),
      }),
    );
  });

  it("putInvoiceReconciliation() con discrepancy_amount trae discrepancy_currency/discrepancy_amount_usd/exchange_rate_used", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_RECORD_WITH_FX), 201));

    const result = await client.putInvoiceReconciliation("TOKEN_B_1", "CL", "TST", "REC-2", {
      id: "REC-2",
      cdr_id: "CDR-2",
      status: "DISPUTED",
      discrepancy_amount: { excl_vat: 1000 },
    });

    expect(result.discrepancy_currency).toBe("CLP");
    expect(result.discrepancy_amount_usd).toEqual({ excl_vat: 1.05 });
    expect(result.exchange_rate_used).toBe(950.5);
  });

  it("getInvoiceReconciliation() hace GET y devuelve el registro", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope(SAMPLE_RECORD_NO_FX)));

    const result = await client.getInvoiceReconciliation("TOKEN_B_1", "CL", "TST", "REC-1");

    expect(result).toEqual(SAMPLE_RECORD_NO_FX);
  });

  it("getInvoiceReconciliations() hace GET con paginación y devuelve reconciliations + total", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope([SAMPLE_RECORD_NO_FX])));

    const result = await client.getInvoiceReconciliations("TOKEN_B_1", 0, 10);

    expect(result.reconciliations).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/invoicereconciliations?offset=0&limit=10`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("deleteInvoiceReconciliation() hace DELETE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope({})));

    await client.deleteInvoiceReconciliation("TOKEN_B_1", "CL", "TST", "REC-1");

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/ocpi/2.3.0/invoicereconciliations/CL/TST/REC-1`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("putInvoiceReconciliation() lanza OcpiError cuando el cdr_id no resuelve (400)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {},
          status_code: 2001,
          status_message: "CDR referenciado (CDR-X) no encontrado.",
          timestamp: new Date().toISOString(),
        },
        400,
      ),
    );

    await expect(
      client.putInvoiceReconciliation("TOKEN_B_1", "CL", "TST", "REC-3", {
        id: "REC-3",
        cdr_id: "CDR-X",
        status: "PENDING",
        discrepancy_amount: { excl_vat: 10 },
      }),
    ).rejects.toThrow(OcpiError);
  });
});
