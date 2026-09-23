import { OcpiError, OcpiModuleNotAvailableError } from "./errors.js";
import { OCPI_STATUS } from "./types.js";
import type {
  OcpiCredentialsData,
  OcpiPartyRole,
  OcpiResponse,
  OcpiVersionDetails,
  OcpiVersionEntry,
} from "./types.js";
import type {
  OcpiCdr,
  OcpiChargingProfile,
  OcpiCommandName,
  OcpiInvoiceReconciliation,
  OcpiSession,
  OcpiToken,
} from "./roadmap-types.js";
import type {
  OcpiLocation,
  OcpiLocationInput,
} from "./locations.js";
import type { OcpiTariff, OcpiTariffInput } from "./tariffs.js";
import type { OcpiHubClientInfoEntry } from "./hubClientInfo.js";

export interface OcpiHubClientOptions {
  /**
   * URL base del Hub, ej. "https://hub.latam-evra.org". El cliente arma las
   * rutas OCPI 2.3.0 a partir de esta base:
   *   {baseUrl}/api/ocpi/2.3.0/versions
   *   {baseUrl}/api/ocpi/2.3.0/details
   *   {baseUrl}/api/ocpi/2.3.0/credentials
   */
  baseUrl: string;
  /** Implementación de fetch a usar. Por defecto, `globalThis.fetch` (Node 18+). */
  fetchImpl?: typeof fetch;
}

/**
 * Cliente Node.js/TypeScript del Hub de roaming OCPI 2.3.0 de
 * LATAM EV Roaming Alliance.
 *
 * Hoy los módulos Credentials & Registration, Locations, Tariffs y Hub
 * Client Info están implementados server-side en el Hub; el resto de los
 * métodos (Sessions, CDRs, Tokens, Commands, Charging Profiles,
 * Invoice Reconciliation) son stubs tipados que lanzan
 * `OcpiModuleNotAvailableError` hasta que el backend correspondiente exista.
 */
export class OcpiHubClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OcpiHubClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;

    if (!this.fetchImpl) {
      throw new Error(
        "No hay implementación de fetch disponible. Usá Node.js 18+ o pasá `fetchImpl` en las opciones.",
      );
    }
  }

  private url(path: string): string {
    return `${this.baseUrl}/api/ocpi/2.3.0${path}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<OcpiResponse<T>> {
    const res = await this.fetchImpl(this.url(path), init);

    let body: OcpiResponse<T>;
    try {
      body = (await res.json()) as OcpiResponse<T>;
    } catch {
      throw new OcpiError(
        OCPI_STATUS.SERVER_ERROR,
        `Respuesta no-JSON del Hub (HTTP ${res.status}).`,
        res.status,
      );
    }

    if (body.status_code !== OCPI_STATUS.SUCCESS) {
      throw new OcpiError(body.status_code, body.status_message, res.status);
    }

    return body;
  }

  // -------------------------------------------------------------------
  // Credentials & Registration (implementado en el Hub)
  // -------------------------------------------------------------------

  /** GET /versions — lista de versiones OCPI soportadas por el Hub. */
  async getVersions(): Promise<OcpiVersionEntry[]> {
    const res = await this.request<OcpiVersionEntry[]>("/versions", {
      method: "GET",
    });
    return res.data;
  }

  /** GET /details — endpoints disponibles para la versión 2.3.0. */
  async getDetails(): Promise<OcpiVersionDetails> {
    const res = await this.request<OcpiVersionDetails>("/details", {
      method: "GET",
    });
    return res.data;
  }

  /**
   * POST /credentials — inicia el handshake de credenciales usando TOKEN_A.
   * Devuelve TOKEN_B y los datos de conexión del Hub en éxito.
   */
  async registerCredentials(
    tokenA: string,
    url: string,
    roles: OcpiPartyRole[],
  ): Promise<OcpiCredentialsData> {
    const res = await this.request<OcpiCredentialsData>("/credentials", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Token ${tokenA}`,
      },
      body: JSON.stringify({ token: tokenA, url, roles }),
    });
    return res.data;
  }

  /** PUT /credentials — renueva la conexión usando TOKEN_B, obtiene un nuevo TOKEN_B. */
  async renewCredentials(tokenB: string): Promise<OcpiCredentialsData> {
    const res = await this.request<OcpiCredentialsData>("/credentials", {
      method: "PUT",
      headers: {
        authorization: `Token ${tokenB}`,
      },
    });
    return res.data;
  }

  /** DELETE /credentials — termina la conexión usando TOKEN_B. */
  async terminateCredentials(tokenB: string): Promise<void> {
    await this.request<Record<string, never>>("/credentials", {
      method: "DELETE",
      headers: {
        authorization: `Token ${tokenB}`,
      },
    });
  }

  // -------------------------------------------------------------------
  // Locations (implementado en el Hub)
  // -------------------------------------------------------------------

  async getLocations(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ locations: OcpiLocation[]; total: number }> {
    const res = await this.request<OcpiLocation[]>(
      `/locations?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { locations: res.data, total: res.data.length };
  }

  async getLocation(
    tokenB: string,
    countryCode: string,
    partyId: string,
    locationId: string,
  ): Promise<OcpiLocation> {
    const res = await this.request<OcpiLocation>(
      `/locations/${countryCode}/${partyId}/${locationId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  async putLocation(
    tokenB: string,
    countryCode: string,
    partyId: string,
    locationId: string,
    body: OcpiLocationInput,
  ): Promise<OcpiLocation> {
    const res = await this.request<OcpiLocation>(
      `/locations/${countryCode}/${partyId}/${locationId}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Token ${tokenB}`,
        },
        body: JSON.stringify(body),
      },
    );
    return res.data;
  }

  async patchLocation(
    tokenB: string,
    countryCode: string,
    partyId: string,
    locationId: string,
    body: Partial<OcpiLocationInput>,
  ): Promise<OcpiLocation> {
    const res = await this.request<OcpiLocation>(
      `/locations/${countryCode}/${partyId}/${locationId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Token ${tokenB}`,
        },
        body: JSON.stringify(body),
      },
    );
    return res.data;
  }

  // -------------------------------------------------------------------
  // Tariffs (implementado en el Hub)
  // -------------------------------------------------------------------

  async getTariffs(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ tariffs: OcpiTariff[]; total: number }> {
    const res = await this.request<OcpiTariff[]>(
      `/tariffs?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { tariffs: res.data, total: res.data.length };
  }

  async getTariff(
    tokenB: string,
    countryCode: string,
    partyId: string,
    tariffId: string,
  ): Promise<OcpiTariff> {
    const res = await this.request<OcpiTariff>(
      `/tariffs/${countryCode}/${partyId}/${tariffId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  async putTariff(
    tokenB: string,
    countryCode: string,
    partyId: string,
    tariffId: string,
    body: OcpiTariffInput,
  ): Promise<OcpiTariff> {
    const res = await this.request<OcpiTariff>(
      `/tariffs/${countryCode}/${partyId}/${tariffId}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Token ${tokenB}`,
        },
        body: JSON.stringify(body),
      },
    );
    return res.data;
  }

  async deleteTariff(
    tokenB: string,
    countryCode: string,
    partyId: string,
    tariffId: string,
  ): Promise<void> {
    await this.request<Record<string, never>>(
      `/tariffs/${countryCode}/${partyId}/${tariffId}`,
      { method: "DELETE", headers: { authorization: `Token ${tokenB}` } },
    );
  }

  // -------------------------------------------------------------------
  // Stubs tipados — módulos en roadmap, aún no implementados en el Hub.
  // Ver docs/Roaming_hub_Latam.md y components/ModuleAccordion.tsx en el
  // repositorio del Hub.
  // -------------------------------------------------------------------

  /** Roadmap: módulo Sessions. */
  async getActiveSession(_sessionId: string): Promise<OcpiSession> {
    throw new OcpiModuleNotAvailableError("Sessions");
  }

  /** Roadmap: módulo CDRs. */
  async getCdr(_cdrId: string): Promise<OcpiCdr> {
    throw new OcpiModuleNotAvailableError("CDRs");
  }

  /** Roadmap: módulo Tokens & Authorisation. */
  async authorizeToken(_tokenUid: string): Promise<OcpiToken> {
    throw new OcpiModuleNotAvailableError("Tokens & Authorisation");
  }

  /** Roadmap: módulo Commands. */
  async sendCommand(
    _command: OcpiCommandName,
    _payload: unknown,
  ): Promise<void> {
    throw new OcpiModuleNotAvailableError("Commands & Charging Profiles");
  }

  /** Roadmap: módulo Charging Profiles. */
  async setChargingProfile(
    _sessionId: string,
    _profile: OcpiChargingProfile,
  ): Promise<void> {
    throw new OcpiModuleNotAvailableError("Commands & Charging Profiles");
  }

  // -------------------------------------------------------------------
  // Hub Client Info (implementado en el Hub)
  // -------------------------------------------------------------------

  async listHubClientInfo(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ entries: OcpiHubClientInfoEntry[]; total: number }> {
    const res = await this.request<OcpiHubClientInfoEntry[]>(
      `/hubclientinfo?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { entries: res.data, total: res.data.length };
  }

  async getHubClientInfo(
    tokenB: string,
    countryCode: string,
    partyId: string,
  ): Promise<OcpiHubClientInfoEntry[]> {
    const res = await this.request<OcpiHubClientInfoEntry[]>(
      `/hubclientinfo/${countryCode}/${partyId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  /** Roadmap: módulo Invoice Reconciliation. */
  async getInvoiceReconciliation(
    _cdrId: string,
  ): Promise<OcpiInvoiceReconciliation> {
    throw new OcpiModuleNotAvailableError("Invoice Reconciliation");
  }
}
