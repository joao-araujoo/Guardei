import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export const DEFAULT_MAX_DOWNLOAD_BYTES = 1_500_000;
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_TIMEOUT_MS = 8_000;
export const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "application/json",
];

export class UnsafeUrlError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "UnsafeUrlError";
    this.code = code;
    this.status = 400;
  }
}

export function parseAndValidateUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new UnsafeUrlError("INVALID_URL", "Informe uma URL HTTP ou HTTPS valida.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UnsafeUrlError("INVALID_PROTOCOL", "Somente URLs HTTP ou HTTPS sao permitidas.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URL_CREDENTIALS_BLOCKED", "URLs com credenciais nao sao permitidas.");
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (!["80", "443"].includes(port)) {
    throw new UnsafeUrlError("PORT_BLOCKED", "A porta informada nao e permitida.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new UnsafeUrlError("PRIVATE_HOST_BLOCKED", "Destinos locais ou internos nao sao permitidos.");
  }
  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    throw new UnsafeUrlError("PRIVATE_IP_BLOCKED", "Enderecos privados ou reservados nao sao permitidos.");
  }
  return url;
}

export async function resolvePublicAddress(hostname, lookup = dns.lookup) {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new UnsafeUrlError("PRIVATE_IP_BLOCKED", "Endereco IP nao permitido.");
    return { address: hostname, family: net.isIP(hostname) };
  }

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("DNS_LOOKUP_FAILED", "Nao foi possivel resolver o destino informado.");
  }
  if (!addresses?.length) throw new UnsafeUrlError("DNS_LOOKUP_FAILED", "O destino nao possui endereco publico.");
  if (addresses.some(({ address }) => isBlockedIp(address))) {
    throw new UnsafeUrlError("PRIVATE_IP_BLOCKED", "O destino resolve para um endereco privado ou reservado.");
  }
  return addresses[0];
}

export async function fetchTextWithRedirects(input, options = {}) {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestImpl = options.requestImpl || requestOnce;
  const resolveImpl = options.resolveImpl || resolvePublicAddress;
  let currentUrl = parseAndValidateUrl(input);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const target = await validateResolvedTarget(currentUrl, resolveImpl);
    const response = await requestImpl(target.url, target.address, { maxBytes, timeoutMs });

    if (isRedirect(response.statusCode)) {
      if (redirectCount >= maxRedirects) {
        throw new UnsafeUrlError("TOO_MANY_REDIRECTS", "O destino excedeu o limite de redirecionamentos.");
      }
      if (!response.headers.location) {
        throw new UnsafeUrlError("INVALID_REDIRECT", "O destino retornou um redirecionamento invalido.");
      }
      currentUrl = parseAndValidateUrl(new URL(response.headers.location, currentUrl).toString());
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const error = new Error("O conteudo remoto nao esta disponivel.");
      error.code = "REMOTE_HTTP_ERROR";
      error.statusCode = response.statusCode;
      throw error;
    }

    const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new UnsafeUrlError("CONTENT_TYPE_BLOCKED", "O tipo de conteudo remoto nao pode ser processado.");
    }

    return {
      finalUrl: currentUrl.toString(),
      contentType,
      body: response.body,
      truncated: Boolean(response.truncated),
      bytes: response.bytes,
    };
  }

  throw new UnsafeUrlError("TOO_MANY_REDIRECTS", "O destino excedeu o limite de redirecionamentos.");
}

export async function validateResolvedTarget(url, resolveImpl = resolvePublicAddress) {
  const parsed = parseAndValidateUrl(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const resolved = await resolveImpl(hostname);
  if (!resolved?.address || isBlockedIp(resolved.address)) {
    throw new UnsafeUrlError("PRIVATE_IP_BLOCKED", "O destino resolve para um endereco nao permitido.");
  }
  return { url: parsed, address: resolved };
}

export function isBlockedIp(address) {
  const version = net.isIP(address);
  if (!version) return true;
  if (version === 4) return isBlockedIpv4(address);

  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("2001:db8")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

function isBlockedIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isRedirect(statusCode) {
  return [301, 302, 303, 307, 308].includes(statusCode);
}

function requestOnce(url, resolved, { maxBytes, timeoutMs }) {
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.8",
          "Accept-Encoding": "identity",
          "User-Agent": "GuardeiContentCapsule/1.0 (+safe-content-fetch)",
        },
        lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
        timeout: timeoutMs,
      },
      (response) => {
        if (isRedirect(response.statusCode)) {
          response.resume();
          return resolve({ statusCode: response.statusCode, headers: response.headers, body: "", bytes: 0, truncated: false });
        }

        const chunks = [];
        let total = 0;
        let settled = false;
        response.on("data", (chunk) => {
          if (settled) return;
          total += chunk.length;
          if (total > maxBytes) {
            settled = true;
            request.destroy();
            return resolve({
              statusCode: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks).toString("utf8"),
              bytes: total,
              truncated: true,
            });
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ statusCode: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8"), bytes: total, truncated: false });
        });
        response.on("error", reject);
      },
    );

    request.on("timeout", () => request.destroy(new Error("REMOTE_TIMEOUT")));
    request.on("error", (error) => {
      if (error.message === "REMOTE_TIMEOUT") error.code = "REMOTE_TIMEOUT";
      reject(error);
    });
    request.end();
  });
}
