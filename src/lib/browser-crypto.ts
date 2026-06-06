function bufferToPem(buffer: ArrayBuffer, label: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export interface Ed25519KeyPair {
  privateKey: CryptoKey;
  privateKeyPem: string;
  publicKeyPem: string;
}

export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
  const keyPair = (await window.crypto.subtle.generateKey(
    { name: "Ed25519" } as AlgorithmIdentifier,
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const [privBuffer, pubBuffer] = await Promise.all([
    window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
    window.crypto.subtle.exportKey("spki", keyPair.publicKey),
  ]);

  return {
    privateKey: keyPair.privateKey,
    privateKeyPem: bufferToPem(privBuffer, "PRIVATE KEY"),
    publicKeyPem: bufferToPem(pubBuffer, "PUBLIC KEY"),
  };
}

export async function signHexBytes(privateKey: CryptoKey, hexNonce: string): Promise<string> {
  const nonceBytes = new Uint8Array(
    (hexNonce.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)),
  );
  const sigBuffer = await window.crypto.subtle.sign(
    { name: "Ed25519" } as AlgorithmIdentifier,
    privateKey,
    nonceBytes,
  );
  return btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
}

export function downloadPem(pem: string, filename: string): void {
  const blob = new Blob([pem], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
