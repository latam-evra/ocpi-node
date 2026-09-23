import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OcpiHubClient } from "../../src/index.js";

const HUB_URL = process.env.OCPI_HUB_TEST_URL ?? "http://localhost:3947";
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function createTestRegistration(role: "CPO" | "EMSP", countryCode: string, partyId: string) {
  const output = execFileSync(
    "npx",
    [
      "tsx",
      "scripts/create-test-registration.ts",
      "--role",
      role,
      "--country-code",
      countryCode,
      "--party-id",
      partyId,
    ],
    { cwd: REPO_ROOT, encoding: "utf-8" },
  );
  return JSON.parse(output.trim()) as { registrationId: string; rawTokenA: string };
}

function cleanupRegistration(registrationId: string) {
  execFileSync("npx", ["tsx", "scripts/create-test-registration.ts", "--cleanup", registrationId], {
    cwd: REPO_ROOT,
  });
}

describe("Locations & Tariffs — integración contra el Hub real", () => {
  const client = new OcpiHubClient({ baseUrl: HUB_URL });
  let registrationId: string;
  let tokenB: string;

  beforeAll(async () => {
    const { registrationId: id, rawTokenA } = createTestRegistration("CPO", "CL", "ND2");
    registrationId = id;

    const details = await client.getDetails();
    const credentialsEndpoint = details.endpoints.find((e) => e.identifier === "credentials");
    if (!credentialsEndpoint) throw new Error("Hub no declaró endpoint de credentials");

    const credentials = await client.registerCredentials(rawTokenA, `${HUB_URL}/api/ocpi/2.3.0/versions`, [
      { role: "CPO", party_id: "ND2", country_code: "CL" },
    ]);
    tokenB = credentials.token;
  });

  afterAll(() => {
    cleanupRegistration(registrationId);
  });

  it("publishes a location, reads it back, and patches it", async () => {
    const created = await client.putLocation(tokenB, "CL", "ND2", "LOC-SDK-1", {
      id: "LOC-SDK-1",
      publish: true,
      address: "Av. Test 123",
      city: "Santiago",
      country: "CHL",
      coordinates: { latitude: "-33.4", longitude: "-70.6" },
    });
    expect(created.id).toBe("LOC-SDK-1");

    const fetched = await client.getLocation(tokenB, "CL", "ND2", "LOC-SDK-1");
    expect(fetched.address).toBe("Av. Test 123");

    const patched = await client.patchLocation(tokenB, "CL", "ND2", "LOC-SDK-1", {
      city: "Valparaíso",
    });
    expect(patched.city).toBe("Valparaíso");

    const { locations } = await client.getLocations(tokenB, 0, 100);
    expect(locations.some((l) => l.id === "LOC-SDK-1")).toBe(true);
  });

  it("publishes a tariff, reads it back, and deletes it", async () => {
    await client.putTariff(tokenB, "CL", "ND2", "TAR-SDK-1", {
      id: "TAR-SDK-1",
      currency: "USD",
      elements: [{ price_components: [{ type: "ENERGY", price: 0.4, step_size: 1 }] }],
    });

    const fetched = await client.getTariff(tokenB, "CL", "ND2", "TAR-SDK-1");
    expect(fetched.currency).toBe("USD");

    await client.deleteTariff(tokenB, "CL", "ND2", "TAR-SDK-1");

    await expect(client.getTariff(tokenB, "CL", "ND2", "TAR-SDK-1")).rejects.toThrow();
  });
});
