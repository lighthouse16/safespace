/**
 * SafeSpace Request Guard & Transport Hardening
 *
 * Enforces:
 * 1. Exact origin validation (rejects unauthorized origins with 403).
 * 2. Streaming byte bounding before JSON deserialization (prevents memory exhaustion DOS).
 * 3. Binary magic bytes and image dimension verification.
 */

import { validateOrigin, jsonResponse } from "./cors";
import { NextResponse } from "next/server";

export interface BoundedReadResult<T> {
  success: boolean;
  data?: T;
  response?: NextResponse;
}

/**
 * Validates request origin and reads body within strict byte bounds.
 */
export async function readBoundedJson<T>(
  request: Request,
  maxBytes: number
): Promise<BoundedReadResult<T>> {
  // 1. Independent Origin check on POST routes
  const originCheck = validateOrigin(request);
  if (!originCheck.allowed) {
    return {
      success: false,
      response: jsonResponse(
        { error: "Forbidden: Origin is not permitted to access SafeSpace AI routes." },
        403,
        request
      ),
    };
  }

  // 2. Transport Content-Length check
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = parseInt(contentLength, 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      return {
        success: false,
        response: jsonResponse(
          { error: `Payload too large. Request body exceeds maximum allowed size of ${maxBytes} bytes.` },
          413,
          request
        ),
      };
    }
  }

  // 3. Bounded streaming read
  if (!request.body) {
    return {
      success: false,
      response: jsonResponse({ error: "Empty request body." }, 400, request),
    };
  }

  const reader = request.body.getReader();
  let totalBytes = 0;
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          await reader.cancel("Payload limit exceeded");
          return {
            success: false,
            response: jsonResponse(
              { error: `Payload too large. Request body exceeds maximum allowed size of ${maxBytes} bytes.` },
              413,
              request
            ),
          };
        }
        chunks.push(value);
      }
    }
  } catch (err: unknown) {
    return {
      success: false,
      response: jsonResponse(
        { error: `Failed to read request stream: ${err instanceof Error ? err.message : String(err)}` },
        400,
        request
      ),
    };
  }

  // 4. Combine chunks and parse JSON
  let text = "";
  try {
    const totalBuffer = Buffer.concat(chunks);
    text = totalBuffer.toString("utf-8");
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch {
    return {
      success: false,
      response: jsonResponse({ error: "Invalid JSON request body." }, 400, request),
    };
  }
}

export interface ImageBinaryVerification {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  width?: number;
  height?: number;
  byteLength?: number;
}

/**
 * Validates binary signature (magic bytes) and dimensions of base64 uploaded image.
 */
export function verifyImageBinary(
  base64Data: string,
  declaredMimeType: string
): ImageBinaryVerification {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return { valid: false, error: "Image data is not valid base64." };
  }

  // Maximum decoded size: 6MB
  if (buffer.length > 6 * 1024 * 1024) {
    return { valid: false, error: "Decoded image exceeds maximum allowed size of 6MB." };
  }

  if (buffer.length < 16) {
    return { valid: false, error: "Image file too small or corrupted." };
  }

  // Detect signature
  let detectedMime: string | undefined;
  let width: number | undefined;
  let height: number | undefined;

  // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = "image/png";
    if (buffer.length >= 24) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    }
  }
  // JPEG magic bytes: 0xFF 0xD8 0xFF
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = "image/jpeg";
    // Quick scan for SOF0 marker (0xFF, 0xC0) or SOF2 (0xFF, 0xC2)
    let idx = 2;
    while (idx < buffer.length - 8) {
      if (buffer[idx] === 0xff) {
        const marker = buffer[idx + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          height = buffer.readUInt16BE(idx + 5);
          width = buffer.readUInt16BE(idx + 7);
          break;
        }
      }
      idx++;
    }
  }
  // WebP magic bytes: "RIFF" .... "WEBP"
  else if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    detectedMime = "image/webp";
  }

  if (!detectedMime) {
    return {
      valid: false,
      error: "Unrecognized or corrupted image binary format. Must be PNG, JPEG, or WebP.",
    };
  }

  if (detectedMime !== declaredMimeType) {
    return {
      valid: false,
      error: `Declared MIME type '${declaredMimeType}' contradicts detected binary signature '${detectedMime}'.`,
    };
  }

  // Dimension bounds check
  if (width !== undefined && (width <= 0 || width > 8192)) {
    return { valid: false, error: `Image width (${width}px) exceeds safe boundary of 8192px.` };
  }
  if (height !== undefined && (height <= 0 || height > 8192)) {
    return { valid: false, error: `Image height (${height}px) exceeds safe boundary of 8192px.` };
  }

  return {
    valid: true,
    detectedMime,
    width,
    height,
    byteLength: buffer.length,
  };
}
