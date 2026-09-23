/**
 * Error lanzado cuando el Hub responde 200 OK a nivel HTTP pero el sobre
 * OCPI (`status_code`) indica un error, según convención OCPI 2000-3999.
 * Ver `lib/ocpi/response.ts` en el Hub.
 */
export class OcpiError extends Error {
  /** `status_code` OCPI del sobre de respuesta (ej. 2001, 3002, ...). */
  public readonly statusCode: number;
  /** `status_message` OCPI del sobre de respuesta. */
  public readonly statusMessage: string;
  /** Status HTTP real de la respuesta (puede diferir del status_code OCPI). */
  public readonly httpStatus: number;

  constructor(statusCode: number, statusMessage: string, httpStatus: number) {
    super(`OCPI error ${statusCode}: ${statusMessage}`);
    this.name = "OcpiError";
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
    this.httpStatus = httpStatus;
  }
}
