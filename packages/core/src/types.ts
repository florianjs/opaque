export interface OpaqueConfig {
  vaultUrl: string;
  privateKey: string; // Ed25519 private key JWK — from OPAQUE_PRIVATE_KEY
  project: string;
  env?: string; // defaults to process.env.NODE_ENV
}

export type SecretsRecord = Record<string, string>;
