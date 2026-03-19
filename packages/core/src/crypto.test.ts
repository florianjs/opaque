import { describe, it, expect } from "vitest";
import { signRequest, verifySignature } from "./crypto";

describe("signRequest / verifySignature", () => {
  // Ed25519 test keypair (generated deterministically for tests)
  const testPrivateKeyJwk = JSON.stringify({
    kty: "OKP",
    crv: "Ed25519",
    d: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
    x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  });

  const testPublicKeyJwk = JSON.stringify({
    kty: "OKP",
    crv: "Ed25519",
    x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  });

  it("signs a request and verifies the signature", async () => {
    const params = {
      method: "GET",
      url: "http://localhost:4200/v1/secrets?env=production",
      privateKey: testPrivateKeyJwk,
      projectId: "my-app",
    };

    const headers = await signRequest(params);

    expect(headers.signature).toMatch(/^sig1=:/);
    expect(headers["signature-input"]).toMatch(/^sig1=/);
    expect(headers["signature-agent"]).toContain("my-app.agents.opaque.local");

    const valid = await verifySignature({
      method: params.method,
      url: params.url,
      headers: {},
      publicKey: testPublicKeyJwk,
      signature: headers.signature,
      signatureInput: headers["signature-input"],
    });

    expect(valid).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const params = {
      method: "GET",
      url: "http://localhost:4200/v1/secrets?env=production",
      privateKey: testPrivateKeyJwk,
      projectId: "my-app",
    };

    const headers = await signRequest(params);

    // Tamper with the signature
    const tamperedSig = headers.signature.replace(/[A-Za-z]/, "X");

    const valid = await verifySignature({
      method: params.method,
      url: params.url,
      headers: {},
      publicKey: testPublicKeyJwk,
      signature: tamperedSig,
      signatureInput: headers["signature-input"],
    });

    expect(valid).toBe(false);
  });
});
