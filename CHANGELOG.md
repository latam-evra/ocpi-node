# Changelog

Todos los cambios notables de este paquete se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## 0.3.1

- Fix: agrega `@types/node` como devDependency explícita. Faltaba
  desde siempre, pero pasaba desapercibido porque `tsc`/`tsup`
  encontraban una copia hoisteada desde el monorepo raíz
  (`latam-evra.org/node_modules/@types/node`) al compilar ahí adentro.
  Instalado standalone (como lo hace cualquier consumidor real del
  paquete), `tsc --noEmit` fallaba con `Cannot find name 'fetch'` /
  `Cannot find name 'RequestInit'` porque esos tipos globales vienen
  de `@types/node`, no de `lib: ["ES2022"]`. Detectado al publicar
  `sdks/node` como repo standalone (`latam-evra/ocpi-node`).

## 0.3.0

- Hub Client Info implementado de verdad contra el Hub
  (`listHubClientInfo(tokenB, offset, limit)`,
  `getHubClientInfo(tokenB, countryCode, partyId)`). Reemplaza el stub
  `getHubClientInfo()` (sin argumentos) de versiones anteriores —
  breaking change de firma.
- Tipos `OcpiHubClientStatus`/`OcpiHubClientInfoEntry` movidos de
  `src/roadmap-types.ts` a `src/hubClientInfo.ts`, con `status` ahora
  usando `"STOPPED"` en vez de `"DISCONNECTED"` y con `role`/
  `last_updated` agregados, para reflejar el objeto real que emite el
  Hub (`lib/ocpi/hubClientInfo.ts`).

## 0.2.0

- Locations y Tariffs implementados de verdad contra el Hub
  (`getLocations`, `getLocation`, `putLocation`, `patchLocation`,
  `getTariffs`, `getTariff`, `putTariff`, `deleteTariff`). Reemplazan
  los stubs `getLocations()`/`getTariffs()` de la v0.1.0, que ahora
  lanzan un error de compilación en vez de en runtime si se usa la
  firma vieja (breaking change de firma).
- Limitación conocida: `getLocations`/`getTariffs` no exponen aún el
  total real de resultados que devuelve el Hub vía el header
  `X-Total-Count` — `total` es un valor aproximado igual al tamaño de
  la página actual.

## [0.1.0] - 2026-09-22

### Agregado

- Cliente `OcpiHubClient` con soporte real para el módulo **Credentials &
  Registration** del Hub OCPI 2.3.0 de LATAM EV Roaming Alliance:
  `getVersions()`, `getDetails()`, `registerCredentials()`,
  `renewCredentials()`, `terminateCredentials()`.
- Tipos TypeScript completos del sobre OCPI genérico (`OcpiResponse<T>`),
  roles (`OcpiRole`), y payloads/respuestas de Credentials.
- Clase `OcpiError` para errores de sobre OCPI (status_code 2000-3999 con
  HTTP 200 u otro código).
- Stubs tipados para los módulos del roadmap aún no implementados en el Hub:
  Locations, Sessions, CDRs, Tariffs, Tokens & Authorisation, Commands,
  Charging Profiles, Hub Client Info e Invoice Reconciliation. Cada stub
  lanza `OcpiModuleNotAvailableError` con un mensaje claro.
- Build dual ESM + CJS con `tsup`, tipado con declaraciones `.d.ts`/`.d.cts`.
- Suite de tests con `vitest` cubriendo Credentials (éxito y error) y todos
  los stubs de roadmap.
