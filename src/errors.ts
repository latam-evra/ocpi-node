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

/**
 * Error lanzado por los métodos "stub" de módulos aún no implementados
 * server-side en el Hub (ver roadmap en docs/Roaming_hub_Latam.md del
 * repositorio del Hub).
 */
export class OcpiModuleNotAvailableError extends Error {
  public readonly module: string;

  constructor(module: string) {
    super(
      `El módulo ${module} aún no está disponible en el Hub — ver roadmap en docs/Roaming_hub_Latam.md`,
    );
    this.name = "OcpiModuleNotAvailableError";
    this.module = module;
  }
}
