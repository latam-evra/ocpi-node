# @latam-evra/ocpi-client

Cliente Node.js/TypeScript para consumir el **Hub de roaming OCPI 2.3.0** de
**LATAM EV Roaming Alliance** (latam-evra.org).

> **Estado del paquete:** aún **no está publicado en npm**. Mientras tanto,
> instalalo directamente desde este repositorio (ver [Instalación](#instalación)).

## Instalación

### Cuando esté publicado en npm

```bash
npm install @latam-evra/ocpi-client
```

### Mientras tanto (desde el repositorio)

Este SDK vive en `sdks/node/` dentro del monorepo del Hub. Podés instalarlo
en otro proyecto de dos formas:

**Opción A — referencia directa a la carpeta (para desarrollo/pruebas):**

```bash
npm install /ruta/local/al/repo/latam-evra.org/sdks/node
```

**Opción B — instalar desde Git, apuntando al subdirectorio:**

```bash
npm install "github:latam-evra/latam-evra.org#path:sdks/node"
```

(Ajustá la URL del repo según corresponda. Si el repo es privado, necesitás
acceso vía SSH o un token configurado en tu `.npmrc`/git config.)

**Opción C — build local + `npm pack`:**

```bash
cd sdks/node
npm install
npm run build
npm pack   # genera latam-evra-ocpi-client-0.1.0.tgz
```

Luego, en el proyecto consumidor:

```bash
npm install /ruta/al/latam-evra-ocpi-client-0.1.0.tgz
```

Requiere **Node.js 18 o superior** (usa `fetch` nativo, sin dependencia de
`axios` ni `node-fetch`).

## Uso: handshake de Credentials completo

El único módulo que el Hub implementa hoy es **Credentials & Registration**.
Este es el flujo típico para un CPO o eMSP que se registra contra el Hub:

```ts
import { OcpiHubClient, OcpiError } from "@latam-evra/ocpi-client";

const client = new OcpiHubClient({
  baseUrl: "https://hub.latam-evra.org",
});

async function main() {
  // 1. Descubrir versiones soportadas por el Hub.
  const versions = await client.getVersions();
  console.log(versions);
  // [{ version: "2.3.0", url: "https://hub.latam-evra.org/api/ocpi/2.3.0/details" }]

  // 2. Obtener el detalle de endpoints de la versión 2.3.0.
  const details = await client.getDetails();
  console.log(details.endpoints);
  // [{ identifier: "credentials", role: "HUB", url: ".../credentials" }]

  // 3. Registrar credenciales usando el TOKEN_A entregado por el Hub
  //    (fuera de banda, ej. desde la consola de administración).
  try {
    const credentials = await client.registerCredentials(
      "TOKEN_A_RECIBIDO_DEL_HUB",
      "https://tu-csms.example.com/ocpi/versions",
      [{ role: "CPO", party_id: "CHG", country_code: "CL" }],
    );

    // Guardá `credentials.token` (TOKEN_B) de forma segura: es el token
    // que usarás para renovar o terminar la conexión más adelante.
    console.log("TOKEN_B recibido:", credentials.token);
  } catch (err) {
    if (err instanceof OcpiError) {
      // El Hub respondió con un status_code de error dentro del sobre OCPI
      // (convención 2000-3999), aunque el HTTP status pueda ser 200 OK.
      console.error(
        `Error OCPI ${err.statusCode}: ${err.statusMessage} (HTTP ${err.httpStatus})`,
      );
    } else {
      throw err;
    }
  }

  // 4. Renovar la conexión más adelante usando el TOKEN_B vigente.
  const renewed = await client.renewCredentials("TOKEN_B_VIGENTE");
  console.log("Nuevo TOKEN_B:", renewed.token);

  // 5. Terminar la conexión (baja definitiva).
  await client.terminateCredentials("TOKEN_B_VIGENTE");
}

main().catch(console.error);
```

### Manejo de errores

Todas las llamadas al Hub devuelven un sobre OCPI (`{ data, status_code,
status_message, timestamp }`). Cuando `status_code` indica error (por
convención OCPI, 2000-3999), el cliente lanza una `OcpiError`:

```ts
import { OcpiError, OCPI_STATUS } from "@latam-evra/ocpi-client";

try {
  await client.registerCredentials(tokenA, url, roles);
} catch (err) {
  if (err instanceof OcpiError) {
    switch (err.statusCode) {
      case OCPI_STATUS.UNKNOWN_TOKEN:
        // TOKEN_A inválido o ya usado
        break;
      case OCPI_STATUS.UNSUPPORTED_VERSION:
        // El CSMS remoto no soporta OCPI 2.3.0
        break;
      default:
        console.error(err.statusMessage);
    }
  }
}
```

## Módulos disponibles

Todos los módulos del roadmap OCPI 2.3.0 del Hub están implementados de
verdad, tanto server-side como en este SDK.

| Módulo | Método del SDK |
| --- | --- |
| Credentials & Registration | `getVersions()`, `getDetails()`, `registerCredentials()`, `renewCredentials()`, `terminateCredentials()` |
| Locations | `getLocations()`, `getLocation()`, `putLocation()`, `patchLocation()` |
| Tariffs | `getTariffs()`, `getTariff()`, `putTariff()`, `deleteTariff()` |
| Hub Client Info | `listHubClientInfo()`, `getHubClientInfo()` |
| Sessions | `getSessions()`, `getSession()`, `putSession()`, `patchSession()` |
| CDRs | `getCdrs()`, `getCdr()`, `postCdr()` |
| Tokens & Authorisation | `getTokens()`, `getToken()`, `putToken()`, `patchToken()`, `deleteToken()`, `authorizeToken()` |
| Commands | `startSession()`, `reserveNow()`, `stopSession()`, `unlockConnector()`, `cancelReservation()`, `getCommand()` |
| Charging Profiles | `getActiveChargingProfile()`, `setChargingProfile()`, `deleteChargingProfile()`, `getChargingProfile()` |
| Invoice Reconciliation | `getInvoiceReconciliations()`, `getInvoiceReconciliation()`, `putInvoiceReconciliation()`, `deleteInvoiceReconciliation()` |

Consultá `docs/Roaming_hub_Latam.md` y `components/ModuleAccordion.tsx` en
el repositorio del Hub para el detalle de cada módulo.

## Tests de integración

Los tests de integración corren contra el Hub real, no contra mocks.
El handshake de Credentials simula un CSMS corriendo en `localhost`
(el propio proceso de test), lo cual la protección SSRF del Hub
bloquea por diseño — por eso el Hub usado para estos tests necesita
levantarse con `OCPI_ALLOW_LOOPBACK=true`, una env var de solo
desarrollo que **nunca debe activarse en producción** (no se lee de
ninguna configuración persistida, solo de la env var explícita en el
proceso).

Antes de correr los tests, levantá una instancia del Hub dedicada a
esto desde la raíz del repo (no reutilices el server de producción de
pm2, que no debe tener esta env var activada):

```bash
OCPI_ALLOW_LOOPBACK=true PORT=3948 npm run dev
```

Después, desde `sdks/node/`:

```bash
OCPI_HUB_TEST_URL=http://localhost:3948 npm run test:integration
```

Por defecto (sin `OCPI_HUB_TEST_URL`) apuntan a `http://localhost:3947`
— solo válido si esa instancia también tiene `OCPI_ALLOW_LOOPBACK=true`.

## Desarrollo

```bash
cd sdks/node
npm install
npm run build       # compila a dist/ (ESM + CJS + .d.ts)
npm test            # corre la suite de vitest
npm run typecheck   # chequeo de tipos sin emitir
```

## Licencia

MIT
