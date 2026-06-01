/**
 * In-browser Ed25519 helpers built on Web Crypto.
 * Shared between /register (L1 — registry registration) and
 * /demo/agents/new (L2 — agent registration into a registry).
 */

export interface GeneratedKeyPair {
  privateKey: CryptoKey;
  privateKeyPem: string;
  publicKey: CryptoKey;
  publicKeyPem: string;
}

function bufferToPem(buffer: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const base64 = btoa(bin);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

/**
 * Generates a fresh Ed25519 keypair via Web Crypto and returns both
 * CryptoKey handles (for in-browser signing) and PEM-encoded strings
 * (for transmission / display).
 */
export async function generateEd25519KeyPair(): Promise<GeneratedKeyPair> {
  const keyPair = (await window.crypto.subtle.generateKey(
    { name: "Ed25519" } as AlgorithmIdentifier,
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;

  const [privBuffer, pubBuffer] = await Promise.all([
    window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
    window.crypto.subtle.exportKey("spki", keyPair.publicKey),
  ]);

  return {
    privateKey: keyPair.privateKey,
    privateKeyPem: bufferToPem(privBuffer, "PRIVATE KEY"),
    publicKey: keyPair.publicKey,
    publicKeyPem: bufferToPem(pubBuffer, "PUBLIC KEY"),
  };
}

/**
 * Signs the raw bytes that a hex string decodes to (NOT the hex string itself).
 * The GARR backend's /verify endpoint expects the signature over the 32 raw
 * nonce bytes the hex represents.
 */
export async function signHexBytes(
  privateKey: CryptoKey,
  hex: string
): Promise<string> {
  const nonceBytes = new Uint8Array(
    (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
  );
  const sigBuffer = await window.crypto.subtle.sign(
    { name: "Ed25519" } as AlgorithmIdentifier,
    privateKey,
    nonceBytes
  );
  const sigBytes = new Uint8Array(sigBuffer);
  let bin = "";
  for (let i = 0; i < sigBytes.length; i++) bin += String.fromCharCode(sigBytes[i]!);
  return btoa(bin);
}

/** Triggers a browser download of a PEM string. */
export function downloadPem(pem: string, filename: string): void {
  const blob = new Blob([pem], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
