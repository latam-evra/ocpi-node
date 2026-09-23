// Módulo Commands (mod_commands), implementado server-side en el Hub. Field
// shapes mirror lib/ocpi/commands.ts y lib/ocpi/schemas/command.ts.
//
// El módulo más asimétrico de los 5: no es CRUD. El SDK expone 5 métodos
// tipados para enviar cada tipo de comando (uno por command_type) más
// getCommand(), cuyo GET vive en /commands/callback/{command_id} (no en
// /commands/{command_type}) — ver client.ts.
//
// `response_url` NO lo genera el SDK: a diferencia del Hub (que arma la URL
// de callback interna hacia sí mismo), el llamador del SDK es un eMSP
// externo real y debe pasar su propio response_url público; el SDK solo lo
// forwardea tal cual en el body.

import type { OcpiTokenType } from "./sessions.js";

/** Subconjunto de OcpiCdrToken usado en comandos — sin country_code/party_id. */
export interface OcpiCommandTokenRef {
  uid: string;
  type: OcpiTokenType;
  contract_id: string;
}

interface OcpiCommandBase {
  response_url: string;
  country_code: string;
  party_id: string;
}

export interface OcpiStartSessionCommand extends OcpiCommandBase {
  token: OcpiCommandTokenRef;
  location_id: string;
  evse_uid?: string;
}

export interface OcpiReserveNowCommand extends OcpiCommandBase {
  token: OcpiCommandTokenRef;
  expiry_date: string;
  reservation_id: string;
  location_id: string;
  evse_uid?: string;
}

export interface OcpiStopSessionCommand extends OcpiCommandBase {
  session_id: string;
}

export interface OcpiUnlockConnectorCommand extends OcpiCommandBase {
  session_id: string;
}

export interface OcpiCancelReservationCommand extends OcpiCommandBase {
  session_id: string;
}

export type OcpiCommandAckResult =
  | "ACCEPTED"
  | "REJECTED"
  | "NOT_SUPPORTED"
  | "UNKNOWN_SESSION";

export interface OcpiCommandAck {
  result: OcpiCommandAckResult;
  timeout: number;
  message?: Record<string, unknown>;
}

export type OcpiCommandFinalResult =
  | "ACCEPTED"
  | "REJECTED"
  | "FAILED"
  | "TIMEOUT"
  | "UNKNOWN_RESERVATION";

export type OcpiCommandType =
  | "CANCEL_RESERVATION"
  | "RESERVE_NOW"
  | "START_SESSION"
  | "STOP_SESSION"
  | "UNLOCK_CONNECTOR";

/** Respuesta de GET /commands/callback/{command_id}. */
export interface OcpiCommand {
  id: string;
  type: OcpiCommandType;
  payload: unknown;
  ack_result?: OcpiCommandAckResult;
  ack_message?: Record<string, unknown>;
  final_result?: OcpiCommandFinalResult;
  final_result_received_at?: string;
  last_updated: string;
}
