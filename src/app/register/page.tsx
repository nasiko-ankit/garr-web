"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { ApiError, registerOwner, verifyOwner } from "@/lib/garr-api";
import { generateEd25519KeyPair, signHexBytes, downloadPem } from "@/lib/browser-crypto";
import type { AuthAlgorithm, EntityOwner, PendingChallengeResponse, RegisterPayload } from "@/lib/garr-types";

type KeySource = null | "fetched" | "generated";

type Step = "form" | "challenge" | "done";

const initialForm = {
  owner_id: "",
  display_name: "",
  domain: "",
  contact_email: "",
  rap_url: "",
  rap_fallback_url: "",
  auth_algorithm: "ed25519" as AuthAlgorithm,
  auth_public_key: "",
  auth_key_id: "",
  ttl_seconds: "86400",
};

function bufferToPem(buffer: ArrayBuffer, label: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function friendlyRegisterError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const msg = err.message.toLowerCase();
    if (msg.includes("serial_not_monotonic")) {
      return `${err.status}: serial collision — another registration completed at the same instant. Re-submit to retry.`;
    }
    if (msg.includes("signature_invalid")) {
      return `${err.status}: signature did not verify. Ensure you signed the raw nonce bytes (hex-decoded) with the private key matching the public key submitted in step 1.`;
    }
    return `${err.status}: ${err.message}`;
  }
  return fallback;
}

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<Step>("form");
  const [pending, setPending] = useState<PendingChallengeResponse | null>(null);
  const [challengeSig, setChallengeSig] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EntityOwner | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generated keypair — private key kept as CryptoKey for in-browser signing
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<CryptoKey | null>(null);
  const [generatedPrivateKeyPem, setGeneratedPrivateKeyPem] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);

  // RAP key fetch + sign-via-RAP
  const [fetchingRapKey, setFetchingRapKey] = useState(false);
  const [keySource, setKeySource] = useState<KeySource>(null);
  const [rapAdminKey, setRapAdminKey] = useState("");
  const [signingViaRap, setSigningViaRap] = useState(false);

  const canSubmitForm = useMemo(() => {
    return Boolean(
      form.owner_id &&
        form.display_name &&
        form.domain &&
        form.contact_email &&
        form.rap_url &&
        form.auth_public_key &&
        form.auth_key_id
    );
  }, [form]);

  function update<K extends keyof typeof initialForm>(
    key: K,
    value: (typeof initialForm)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function fetchRapKey() {
    const url = form.rap_url.trim();
    if (!url) { setError("Enter a RAP URL first, then fetch its key."); return; }
    setFetchingRapKey(true);
    setError(null);
    try {
      const res = await fetch(`${url}/.well-known/garr-public-key`, {
        headers: { "ngrok-skip-browser-warning": "true" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`RAP returned ${res.status}`);
      const data = await res.json() as { public_key: string; key_id: string; algorithm: string };
      update("auth_public_key", data.public_key);
      update("auth_key_id", data.key_id);
      update("auth_algorithm", data.algorithm as AuthAlgorithm);
      setKeySource("fetched");
      setGeneratedPrivateKey(null);
      setGeneratedPrivateKeyPem(null);
    } catch (err) {
      setError(`Could not fetch key from RAP: ${err instanceof Error ? err.message : "unreachable"}. Make sure the RAP server is running.`);
    } finally {
      setFetchingRapKey(false);
    }
  }

  async function signViaRap() {
    if (!pending || !form.rap_url.trim() || !rapAdminKey.trim()) return;
    setSigningViaRap(true);
    setError(null);
    try {
      const res = await fetch(`${form.rap_url.trim()}/.well-known/garr-sign-challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${rapAdminKey.trim()}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ nonce: pending.challenge_nonce }),
      });
      if (!res.ok) throw new Error(`RAP returned ${res.status}`);
      const data = await res.json() as { signature: string };
      setChallengeSig(data.signature);
    } catch (err) {
      setError(`Could not sign via RAP: ${err instanceof Error ? err.message : "failed"}. Check the RAP URL and admin key.`);
    } finally {
      setSigningViaRap(false);
    }
  }

  async function generateKeypair() {
    setGenerating(true);
    try {
      const kp = await generateEd25519KeyPair();
      setGeneratedPrivateKey(kp.privateKey);
      setGeneratedPrivateKeyPem(kp.privateKeyPem);
      update("auth_public_key", kp.publicKeyPem);
      update("auth_algorithm", "ed25519");
      setKeySource("generated");
    } catch {
      setError("Keypair generation failed — your browser may not support Ed25519 Web Crypto.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadPrivateKey() {
    if (!generatedPrivateKeyPem) return;
    downloadPem(generatedPrivateKeyPem, `${form.owner_id || "garr"}-private.pem`);
  }

  async function autoSign() {
    if (!generatedPrivateKey || !pending) return;
    setSigning(true);
    try {
      setChallengeSig(await signHexBytes(generatedPrivateKey, pending.challenge_nonce));
    } catch {
      setError("Auto-sign failed. Sign the nonce manually using the snippet below.");
    } finally {
      setSigning(false);
    }
  }

  async function onSubmitForm(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: RegisterPayload = {
      owner_id: form.owner_id.trim(),
      display_name: form.display_name.trim(),
      domain: form.domain.trim(),
      contact_email: form.contact_email.trim(),
      rap_url: form.rap_url.trim(),
      ...(form.rap_fallback_url.trim() ? { rap_fallback: form.rap_fallback_url.trim() } : {}),
      algorithm: form.auth_algorithm,
      public_key: form.auth_public_key.trim(),
      key_id: form.auth_key_id.trim(),
      ttl_seconds: Number(form.ttl_seconds),
    };

    try {
      const challenge = await registerOwner(payload);
      setPending(challenge);
      setStep("challenge");
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError("Something went wrong while submitting the registration.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitChallenge(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending) return;
    setSubmitting(true);
    setError(null);

    try {
      const owner = await verifyOwner(pending.owner_id, challengeSig.trim());
      setResult(owner);
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError("Verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && result) {
    return (
      <PageShell title="Register" description="Registration complete.">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <JsonPanel data={result} />
          <div className="space-y-4">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-lg font-semibold text-emerald-900">Registration complete</h2>
              <p className="mt-2 text-sm text-emerald-800">
                Serial: <span className="font-medium">{result.serial}</span>
              </p>
              <p className="text-sm text-emerald-800">
                Expires: <span className="font-medium">{result.signature.expires_at}</span>
              </p>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (step === "challenge" && pending) {
    return (
      <PageShell
        title="Register"
        description="Step 2 of 2 — sign the challenge nonce with your private key and paste the result."
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={onSubmitChallenge}
            className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm space-y-5"
          >
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Owner ID</p>
              <p className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm font-mono">
                {pending.owner_id}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Challenge nonce</p>
              <p className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm font-mono break-all select-all">
                {pending.challenge_nonce}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Sign these bytes with your ed25519 private key. The window expires at{" "}
                <span className="font-medium">{pending.challenge_expires_at}</span>.
              </p>
            </div>

            {keySource === "fetched" && form.rap_url && rapAdminKey && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-900 mb-2">
                  Key was fetched from your RAP — let the RAP sign automatically
                </p>
                <button
                  type="button"
                  onClick={signViaRap}
                  disabled={signingViaRap}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {signingViaRap ? "Signing..." : "Sign via RAP ✓"}
                </button>
                <p className="mt-2 text-xs text-emerald-700">
                  Sends the nonce to your RAP server, which signs it with its private key.
                </p>
              </div>
            )}

            {generatedPrivateKey && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm font-medium text-indigo-900 mb-2">
                  You generated your keypair in this browser
                </p>
                <button
                  type="button"
                  onClick={autoSign}
                  disabled={signing}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {signing ? "Signing..." : "Sign automatically"}
                </button>
                <p className="mt-2 text-xs text-indigo-700">
                  Or sign manually using the snippet on the right.
                </p>
              </div>
            )}

            <TextAreaField
              label="Base64 signature"
              value={challengeSig}
              onChange={setChallengeSig}
              placeholder="Paste your base64-encoded ed25519 signature here..."
            />

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !challengeSig.trim()}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Verifying..." : "Verify & complete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setError(null);
                  setPending(null);
                  setChallengeSig("");
                }}
                className="rounded-2xl border border-black/10 px-5 py-3 text-sm"
              >
                Back
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </form>

          <div className="rounded-3xl border border-black/10 bg-slate-50 p-6 text-sm text-slate-600">
            <p className="font-medium text-slate-800 mb-2">How to sign the nonce</p>
            <p className="mb-3">Using Node.js:</p>
            <pre className="rounded-xl bg-slate-100 p-3 text-xs leading-relaxed overflow-x-auto">{`const { sign } = require('crypto');
const nonce = Buffer.from('${pending.challenge_nonce}', 'hex');
const sig = sign(null, nonce, privateKey);
console.log(sig.toString('base64'));`}</pre>
            <p className="mt-3 mb-3">Using openssl:</p>
            <pre className="rounded-xl bg-slate-100 p-3 text-xs leading-relaxed overflow-x-auto">{`echo -n '${pending.challenge_nonce}' | xxd -r -p \\
  | openssl pkeyutl -sign -inkey private.pem \\
  | base64`}</pre>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Register"
      description="Step 1 of 2 — submit owner details. You will receive a challenge nonce to sign with your private key."
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={onSubmitForm}
          className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner ID" value={form.owner_id} onChange={(v) => update("owner_id", v)} />
            <Field label="Display Name" value={form.display_name} onChange={(v) => update("display_name", v)} />
            <Field label="Domain" value={form.domain} onChange={(v) => update("domain", v)} />
            <Field label="Contact Email" value={form.contact_email} onChange={(v) => update("contact_email", v)} />
            <Field label="RAP URL" value={form.rap_url} onChange={(v) => update("rap_url", v)} />
            <Field label="RAP Fallback URL" value={form.rap_fallback_url} onChange={(v) => update("rap_fallback_url", v)} />
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                RAP Admin Key{" "}
                <span className="font-normal text-slate-400">(needed to sign the challenge — kept only in this browser session)</span>
              </span>
              <input
                type="password"
                value={rapAdminKey}
                onChange={(e) => setRapAdminKey(e.target.value)}
                placeholder="Your ADMIN_API_KEY from the RAP .env"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <Field label="Key ID" value={form.auth_key_id} onChange={(v) => update("auth_key_id", v)} />
            <Field label="TTL Seconds" value={form.ttl_seconds} onChange={(v) => update("ttl_seconds", v)} />

            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Auth Algorithm</span>
              <select
                value={form.auth_algorithm}
                onChange={(e) => update("auth_algorithm", e.target.value as AuthAlgorithm)}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="ed25519">ed25519</option>
                <option value="rsa-sha256">rsa-sha256</option>
              </select>
            </label>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Public Key (PEM)</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fetchRapKey}
                    disabled={fetchingRapKey || !form.rap_url.trim()}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {fetchingRapKey ? "Fetching..." : "Fetch from RAP ✓"}
                  </button>
                  <button
                    type="button"
                    onClick={generateKeypair}
                    disabled={generating}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {generating ? "Generating..." : "Generate new keypair"}
                  </button>
                </div>
              </div>

              {/* Key source banner */}
              {keySource === "fetched" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-800">
                    ✓ Key fetched from RAP server — this key matches what your RAP uses to sign agent cards. Registration will succeed.
                  </p>
                </div>
              )}
              {keySource === "generated" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="text-xs font-medium text-amber-900">
                    ⚠ You generated a new browser keypair. This only works if your RAP server does NOT already have a key configured, or you update the RAP&apos;s SIGNING_PRIVATE_KEY to this new key. If your RAP is already running with its own key, use &quot;Fetch from RAP&quot; instead.
                  </p>
                  <button
                    type="button"
                    onClick={downloadPrivateKey}
                    className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    Download private key (.pem)
                  </button>
                </div>
              )}
              {keySource === null && (
                <p className="text-xs text-slate-500">
                  If your RAP server is already running, click <strong>Fetch from RAP</strong> — it reads the exact key the RAP uses to sign agent cards, guaranteeing they match.
                </p>
              )}

              <textarea
                rows={4}
                value={form.auth_public_key}
                placeholder={"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"}
                onChange={(e) => update("auth_public_key", e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !canSubmitForm}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit registration"}
            </button>
            <p className="text-sm text-slate-500">
              You will receive a challenge nonce to sign in step 2.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </form>

        <div className="rounded-3xl border border-black/10 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800 mb-2">Registration flow</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Fill in owner details and submit.</li>
            <li>GARR verifies DMARC and RAP reachability.</li>
            <li>A 64-byte hex nonce is returned (valid 15 min).</li>
            <li>Sign the nonce bytes with your ed25519 private key.</li>
            <li>Paste the base64 signature to complete registration.</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            Use <strong className="text-slate-700">Generate keypair</strong> to create a key in your browser — no CLI needed. Download and keep the private key; only the public key is sent to GARR.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        rows={4}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
      />
    </label>
  );
}