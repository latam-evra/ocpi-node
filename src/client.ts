import { OcpiError } from "./errors.js";
import { OCPI_STATUS } from "./types.js";
import type {
  OcpiCredentialsData,
  OcpiPartyRole,
  OcpiResponse,
  OcpiVersionDetails,
  OcpiVersionEntry,
} from "./types.js";
import type {
  OcpiLocation,
  OcpiLocationInput,
} from "./locations.js";
import type { OcpiTariff, OcpiTariffInput } from "./tariffs.js";
import type { OcpiHubClientInfoEntry } from "./hubClientInfo.js";
import type { OcpiSession, OcpiSessionInput } from "./sessions.js";
import type { OcpiCdr, OcpiCdrInput } from "./cdrs.js";
import type { OcpiToken, OcpiTokenInput, OcpiAuthorizeResult } from "./tokens.js";
import type {
  OcpiStartSessionCommand,
  OcpiReserveNowCommand,
  OcpiStopSessionCommand,
  OcpiUnlockConnectorCommand,
  OcpiCancelReservationCommand,
  OcpiCommandAck,
  OcpiCommand,
} from "./commands.js";
import type {
  OcpiInvoiceReconciliation,
  OcpiInvoiceReconciliationInput,
} from "./invoiceReconciliation.js";
import type {
  OcpiChargingProfile,
  OcpiChargingProfileAck,
  OcpiChargingProfileRequest,
} from "./chargingProfiles.js";

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
 * Implementa de verdad Credentials & Registration, Locations, Tariffs, Hub
 * Client Info, Sessions, CDRs, Tokens & Authorisation, Commands, Invoice
 * Reconciliation y Charging Profiles.
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
  // Sessions (implementado en el Hub)
  // -------------------------------------------------------------------

  async getSessions(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ sessions: OcpiSession[]; total: number }> {
    const res = await this.request<OcpiSession[]>(
      `/sessions?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { sessions: res.data, total: res.data.length };
  }

  async getSession(
    tokenB: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
  ): Promise<OcpiSession> {
    const res = await this.request<OcpiSession>(
      `/sessions/${countryCode}/${partyId}/${sessionId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  async putSession(
    tokenB: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
    body: OcpiSessionInput,
  ): Promise<OcpiSession> {
    const res = await this.request<OcpiSession>(
      `/sessions/${countryCode}/${partyId}/${sessionId}`,
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

  async patchSession(
    tokenB: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
    body: Partial<OcpiSessionInput>,
  ): Promise<OcpiSession> {
    const res = await this.request<OcpiSession>(
      `/sessions/${countryCode}/${partyId}/${sessionId}`,
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
  // CDRs (implementado en el Hub) — inmutables, sin PUT/PATCH/DELETE.
  // -------------------------------------------------------------------

  async getCdrs(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ cdrs: OcpiCdr[]; total: number }> {
    const res = await this.request<OcpiCdr[]>(
      `/cdrs?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { cdrs: res.data, total: res.data.length };
  }

  async getCdr(
    tokenB: string,
    countryCode: string,
    partyId: string,
    cdrId: string,
  ): Promise<OcpiCdr> {
    const res = await this.request<OcpiCdr>(
      `/cdrs/${countryCode}/${partyId}/${cdrId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  async postCdr(
    tokenB: string,
    countryCode: string,
    partyId: string,
    cdrId: string,
    body: OcpiCdrInput,
  ): Promise<OcpiCdr> {
    const res = await this.request<OcpiCdr>(
      `/cdrs/${countryCode}/${partyId}/${cdrId}`,
      {
        method: "POST",
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
  // Tokens & Authorisation (implementado en el Hub)
  // -------------------------------------------------------------------

  async getTokens(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ tokens: OcpiToken[]; total: number }> {
    const res = await this.request<OcpiToken[]>(
      `/tokens?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { tokens: res.data, total: res.data.length };
  }

  async getToken(
    tokenB: string,
    countryCode: string,
    partyId: string,
    uid: string,
  ): Promise<OcpiToken> {
    const res = await this.request<OcpiToken>(
      `/tokens/${countryCode}/${partyId}/${uid}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  async putToken(
    tokenB: string,
    countryCode: string,
    partyId: string,
    uid: string,
    body: OcpiTokenInput,
  ): Promise<OcpiToken> {
    const res = await this.request<OcpiToken>(
      `/tokens/${countryCode}/${partyId}/${uid}`,
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

  async patchToken(
    tokenB: string,
    countryCode: string,
    partyId: string,
    uid: string,
    body: Partial<OcpiTokenInput>,
  ): Promise<OcpiToken> {
    const res = await this.request<OcpiToken>(
      `/tokens/${countryCode}/${partyId}/${uid}`,
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

  async deleteToken(
    tokenB: string,
    countryCode: string,
    partyId: string,
    uid: string,
  ): Promise<void> {
    await this.request<Record<string, never>>(
      `/tokens/${countryCode}/${partyId}/${uid}`,
      { method: "DELETE", headers: { authorization: `Token ${tokenB}` } },
    );
  }

  /**
   * .../authorize — endpoint especial, no forma parte del CRUD de tokens.
   * Nunca propaga un error de negocio: el Hub siempre resuelve a
   * `{allowed: "..."}`, incluso ante fallos internos (token inexistente,
   * eMSP desconectado, timeout).
   */
  async authorizeToken(
    tokenB: string,
    countryCode: string,
    partyId: string,
    uid: string,
    locationReferences?: unknown,
  ): Promise<OcpiAuthorizeResult> {
    const res = await this.request<OcpiAuthorizeResult>(
      `/tokens/${countryCode}/${partyId}/${uid}/authorize`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Token ${tokenB}`,
        },
        body: JSON.stringify(locationReferences ?? {}),
      },
    );
    return res.data;
  }

  // -------------------------------------------------------------------
  // Commands (implementado en el Hub) — no es CRUD: 5 métodos tipados
  // para enviar cada tipo de comando más getCommand(), cuyo GET vive en
  // /commands/callback/{command_id} (no en /commands/{command_type}).
  // `response_url` no lo genera el SDK: el llamador (un eMSP externo)
  // debe pasar su propio callback público, se forwardea tal cual.
  // -------------------------------------------------------------------

  async startSession(
    tokenB: string,
    body: OcpiStartSessionCommand,
  ): Promise<OcpiCommandAck> {
    return this.sendCommandRequest(tokenB, "START_SESSION", body);
  }

  async reserveNow(
    tokenB: string,
    body: OcpiReserveNowCommand,
  ): Promise<OcpiCommandAck> {
    return this.sendCommandRequest(tokenB, "RESERVE_NOW", body);
  }

  async stopSession(
    tokenB: string,
    body: OcpiStopSessionCommand,
  ): Promise<OcpiCommandAck> {
    return this.sendCommandRequest(tokenB, "STOP_SESSION", body);
  }

  async unlockConnector(
    tokenB: string,
    body: OcpiUnlockConnectorCommand,
  ): Promise<OcpiCommandAck> {
    return this.sendCommandRequest(tokenB, "UNLOCK_CONNECTOR", body);
  }

  async cancelReservation(
    tokenB: string,
    body: OcpiCancelReservationCommand,
  ): Promise<OcpiCommandAck> {
    return this.sendCommandRequest(tokenB, "CANCEL_RESERVATION", body);
  }

  private async sendCommandRequest(
    tokenB: string,
    commandType: string,
    body: unknown,
  ): Promise<OcpiCommandAck> {
    const res = await this.request<OcpiCommandAck>(`/commands/${commandType}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Token ${tokenB}`,
      },
      body: JSON.stringify(body),
    });
    return res.data;
  }

  /** GET /commands/callback/{command_id} — estado actual del comando. */
  async getCommand(tokenB: string, commandId: string): Promise<OcpiCommand> {
    const res = await this.request<OcpiCommand>(
      `/commands/callback/${commandId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  // -------------------------------------------------------------------
  // Charging Profiles (implementado en el Hub) — no es CRUD simétrico: 3
  // métodos tipados para pedir una acción sobre una sesión existente más
  // getChargingProfile(), cuyo GET vive en
  // /chargingprofiles/callback/{id} (no en /chargingprofiles/{session_id}).
  // `response_url` no lo genera el SDK: el llamador (un eMSP externo)
  // debe pasar su propio callback público, se forwardea tal cual.
  // -------------------------------------------------------------------

  async getActiveChargingProfile(
    tokenB: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
    responseUrl: string,
  ): Promise<OcpiChargingProfileAck> {
    return this.requestChargingProfile(
      tokenB,
      "GET_ACTIVE_CHARGING_PROFILE",
      countryCode,
      partyId,
      sessionId,
      { response_url: responseUrl },
    );
  }

  async setChargingProfile(
    tokenB: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
    responseUrl: string,
    chargingProfile: OcpiChargingProfile,
  ): Promise<OcpiChargingProfileAck> {
    return this.requestChargingProfile(
      tokenB,
      "PUT_CHARGING_PROFILE",
      countryCode,
      partyId,
      sessionId,
      { response_url: responseUrl, charging_profile: chargingProfile },
    );
  }

  async deleteChargingProfile(
    tokenB: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
    responseUrl: string,
  ): Promise<OcpiChargingProfileAck> {
    return this.requestChargingProfile(
      tokenB,
      "DELETE_CHARGING_PROFILE",
      countryCode,
      partyId,
      sessionId,
      { response_url: responseUrl },
    );
  }

  private async requestChargingProfile(
    tokenB: string,
    action: string,
    countryCode: string,
    partyId: string,
    sessionId: string,
    body: unknown,
  ): Promise<OcpiChargingProfileAck> {
    const res = await this.request<OcpiChargingProfileAck>(
      `/chargingprofiles/${countryCode}/${partyId}/${sessionId}/${action}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Token ${tokenB}`,
        },
        body: JSON.stringify(body),
      },
    );
    return res.data;
  }

  /** GET /chargingprofiles/callback/{id} — estado actual de la solicitud. */
  async getChargingProfile(
    tokenB: string,
    chargingProfileId: string,
  ): Promise<OcpiChargingProfileRequest> {
    const res = await this.request<OcpiChargingProfileRequest>(
      `/chargingprofiles/callback/${chargingProfileId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
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

  // -------------------------------------------------------------------
  // Invoice Reconciliation (implementado en el Hub) — solo PUT (upsert),
  // sin POST, a diferencia de CDRs que es POST-only.
  // -------------------------------------------------------------------

  async getInvoiceReconciliations(
    tokenB: string,
    offset = 0,
    limit = 50,
  ): Promise<{ reconciliations: OcpiInvoiceReconciliation[]; total: number }> {
    const res = await this.request<OcpiInvoiceReconciliation[]>(
      `/invoicereconciliations?offset=${offset}&limit=${limit}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return { reconciliations: res.data, total: res.data.length };
  }

  async getInvoiceReconciliation(
    tokenB: string,
    countryCode: string,
    partyId: string,
    reconciliationId: string,
  ): Promise<OcpiInvoiceReconciliation> {
    const res = await this.request<OcpiInvoiceReconciliation>(
      `/invoicereconciliations/${countryCode}/${partyId}/${reconciliationId}`,
      { method: "GET", headers: { authorization: `Token ${tokenB}` } },
    );
    return res.data;
  }

  async putInvoiceReconciliation(
    tokenB: string,
    countryCode: string,
    partyId: string,
    reconciliationId: string,
    body: OcpiInvoiceReconciliationInput,
  ): Promise<OcpiInvoiceReconciliation> {
    const res = await this.request<OcpiInvoiceReconciliation>(
      `/invoicereconciliations/${countryCode}/${partyId}/${reconciliationId}`,
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

  async deleteInvoiceReconciliation(
    tokenB: string,
    countryCode: string,
    partyId: string,
    reconciliationId: string,
  ): Promise<void> {
    await this.request<Record<string, never>>(
      `/invoicereconciliations/${countryCode}/${partyId}/${reconciliationId}`,
      { method: "DELETE", headers: { authorization: `Token ${tokenB}` } },
    );
  }
}
