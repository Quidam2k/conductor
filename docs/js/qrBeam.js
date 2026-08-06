/**
 * Conductor PWA - QR Beam codec
 *
 * Phone-to-phone payload transfer over animated QR codes using LT (Luby
 * Transform) fountain codes. The sender loops encoded frames on screen; the
 * receiver scans frames in any order, tolerating arbitrary frame loss, until
 * enough have arrived to reconstruct the payload.
 *
 * Frame string format: "CB1:" + base64(header + XOR'd block data)
 * Header (little-endian, 18 bytes):
 *   0  uint8   codec version (1)
 *   1  uint8   payload type (0=pack, 1=event, 2=any)
 *   2  uint16  k — number of source blocks
 *   4  uint16  block size in bytes
 *   6  uint32  payload length in bytes (gzipped)
 *   10 uint32  CRC32 of the RAW (pre-gzip) payload (also serves as transfer ID)
 *              — not the gzipped bytes: same-length incompressible payloads
 *              gzip to stored blocks ending in their own CRC, which collapses
 *              the stream CRC to a constant and can't discriminate transfers
 *   14 uint32  frame seed — seed < k means systematic (degree-1, block #seed);
 *              seed >= k seeds a PRNG that derives degree + block indices
 *              identically on both sides
 *
 * The payload is gzipped before splitting into blocks; after reassembly the
 * stream is inflated and the raw-payload CRC verified (per-frame integrity
 * is the QR code's job).
 *
 * LT encode/decode adapted from the `luby-transform` package in qifi-dev/qrs
 * (https://github.com/qifi-dev/qrs, MIT License) — robust soliton degree
 * distribution + peeling (belief propagation) decoder.
 *
 * Requires: pako.min.js (gzip/ungzip)
 */

const BEAM_FRAME_PREFIX = 'CB1:';
const BEAM_HEADER_SIZE = 18;
const BEAM_VERSION = 1;
const BEAM_DEFAULT_BLOCK_SIZE = 900;

const BEAM_PAYLOAD_TYPES = { pack: 0, event: 1, any: 2 };
const BEAM_PAYLOAD_TYPE_NAMES = ['pack', 'event', 'any'];

/**
 * Quick check whether a scanned string is a beam frame.
 * @param {string} text
 * @returns {boolean}
 */
function isBeamFrame(text) {
    return typeof text === 'string' && text.startsWith(BEAM_FRAME_PREFIX);
}

// ─── CRC32 ──────────────────────────────────────────────────────────────────
// Standalone copy (resourcePackManager's calculateCrc32 is closure-private).
// Vector: beamCrc32(bytes of "123456789") === 0xCBF43926

let _beamCrcTable = null;

function beamCrc32(data) {
    if (!_beamCrcTable) {
        _beamCrcTable = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            _beamCrcTable[i] = c >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ _beamCrcTable[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Base64 helpers ─────────────────────────────────────────────────────────

function beamBytesToBase64(bytes) {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

function beamBase64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// ─── Deterministic PRNG + robust soliton distribution ───────────────────────
// Both sides derive identical (degree, indices) from a frame's seed, so no
// index list travels in the frame.

function beamMakeRng(seed) {
    let s = (Math.imul(seed, 2654435761) ^ 0x9E3779B9) >>> 0;
    if (s === 0) s = 0x6D2B79F5;
    return function () {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

/**
 * Build the robust soliton CDF for k source blocks (c=0.03, delta=0.5).
 * Deterministic given k — computed once per encoder/decoder.
 * @returns {Float64Array} cdf where cdf[d-1] = P(degree <= d)
 */
function beamRobustSolitonCdf(k) {
    const cdf = new Float64Array(k);
    if (k === 1) { cdf[0] = 1; return cdf; }
    const c = 0.03, delta = 0.5;
    const R = c * Math.log(k / delta) * Math.sqrt(k);
    const pivot = Math.max(1, Math.min(k, Math.floor(k / R)));

    let total = 0;
    const p = new Float64Array(k);
    for (let d = 1; d <= k; d++) {
        // Ideal soliton rho
        const rho = (d === 1) ? 1 / k : 1 / (d * (d - 1));
        // Robust correction tau
        let tau = 0;
        if (d < pivot) tau = R / (d * k);
        else if (d === pivot) tau = Math.max(0, R * Math.log(R / delta) / k);
        p[d - 1] = rho + tau;
        total += p[d - 1];
    }
    let acc = 0;
    for (let d = 0; d < k; d++) {
        acc += p[d] / total;
        cdf[d] = acc;
    }
    cdf[k - 1] = 1;  // absorb float error
    return cdf;
}

/**
 * Derive the source-block indices a frame seed combines.
 * seed < k → systematic degree-1 frame for block #seed.
 * @returns {number[]} distinct indices in [0, k)
 */
function beamFrameIndices(seed, k, cdf) {
    if (seed < k) return [seed];
    const rng = beamMakeRng(seed);

    // Sample degree from the CDF
    const r = rng();
    let degree = 1;
    while (degree < k && cdf[degree - 1] < r) degree++;

    // Pick `degree` distinct indices — sparse Fisher-Yates (O(degree))
    const indices = [];
    const swap = new Map();
    for (let i = 0; i < degree; i++) {
        const j = i + Math.floor(rng() * (k - i));
        const vj = swap.has(j) ? swap.get(j) : j;
        const vi = swap.has(i) ? swap.get(i) : i;
        swap.set(j, vi);
        indices.push(vj);
    }
    return indices;
}

function beamXorInto(target, source) {
    for (let i = 0; i < target.length; i++) target[i] ^= source[i];
}

// ─── Encoder ────────────────────────────────────────────────────────────────

/**
 * Create a beam encoder for a payload.
 *
 * The frame sequence is deterministic: seeds 0..k-1 are the systematic pass
 * (each source block once — a lossless receiver finishes in exactly k frames),
 * seeds k..cycleLength-1 are fountain repair frames. nextFrame() loops the
 * cycle forever; receivers that missed frames pick them up on later loops,
 * with repair frames recovering gaps early.
 *
 * @param {Uint8Array|ArrayBuffer} payload - raw payload (gzipped internally)
 * @param {object} [opts]
 * @param {number} [opts.blockSize=900] - block bytes per frame (~1228 QR chars)
 * @param {string} [opts.payloadType='pack'] - 'pack' | 'event' | 'any'
 */
function createBeamEncoder(payload, opts) {
    opts = opts || {};
    const blockSize = opts.blockSize || BEAM_DEFAULT_BLOCK_SIZE;
    const typeName = opts.payloadType || 'pack';
    if (!(typeName in BEAM_PAYLOAD_TYPES)) {
        throw new Error('Unknown payload type: ' + typeName);
    }
    const raw = (payload instanceof ArrayBuffer) ? new Uint8Array(payload) : payload;

    const data = pako.gzip(raw);
    const crc = beamCrc32(raw);
    const k = Math.max(1, Math.ceil(data.length / blockSize));
    if (k > 65535) {
        throw new Error('Payload too large to beam: ' + data.length + ' bytes → ' + k + ' blocks (max 65535)');
    }

    // Pre-split into zero-padded blocks
    const blocks = [];
    for (let i = 0; i < k; i++) {
        const block = new Uint8Array(blockSize);
        block.set(data.subarray(i * blockSize, (i + 1) * blockSize));
        blocks.push(block);
    }

    const cdf = beamRobustSolitonCdf(k);
    // Systematic pass + ~50% repair frames per loop
    const cycleLength = k + Math.max(4, Math.ceil(k / 2));
    let cursor = 0;

    function frameAt(seed) {
        const indices = beamFrameIndices(seed, k, cdf);
        const frame = new Uint8Array(BEAM_HEADER_SIZE + blockSize);
        const view = new DataView(frame.buffer);
        view.setUint8(0, BEAM_VERSION);
        view.setUint8(1, BEAM_PAYLOAD_TYPES[typeName]);
        view.setUint16(2, k, true);
        view.setUint16(4, blockSize, true);
        view.setUint32(6, data.length, true);
        view.setUint32(10, crc, true);
        view.setUint32(14, seed, true);

        const body = frame.subarray(BEAM_HEADER_SIZE);
        for (let i = 0; i < indices.length; i++) {
            beamXorInto(body, blocks[indices[i]]);
        }
        return BEAM_FRAME_PREFIX + beamBytesToBase64(frame);
    }

    return {
        k,
        blockSize,
        cycleLength,
        payloadType: typeName,
        compressedLength: data.length,
        rawLength: raw.length,
        crc,
        frameAt,
        nextFrame: function () {
            const s = cursor;
            cursor = (cursor + 1) % cycleLength;
            return frameAt(s);
        },
        /** 0..1 position within the current loop (drives the progress ring) */
        cyclePosition: function () { return cursor / cycleLength; },
        reset: function () { cursor = 0; },
    };
}

// ─── Decoder ────────────────────────────────────────────────────────────────

/**
 * Create a beam decoder. Feed scanned strings to addFrame(); frames may
 * arrive in any order, with any loss, and duplicates are cheap no-ops.
 * The first accepted frame latches the transfer parameters — frames from a
 * different transfer (mismatched payload CRC) are rejected, not mixed in.
 */
function createBeamDecoder() {
    let params = null;       // { version, type, k, blockSize, length, crc }
    let cdf = null;
    let known = null;        // Array(k): decoded source blocks (Uint8Array | null)
    let decodedCount = 0;
    let pending = [];        // coded frames not yet reduced to degree 1
    const seenSeeds = new Set();
    let receivedCount = 0;
    let redundantCount = 0;
    let payloadBytes = null; // set on successful completion
    let failed = null;       // { reason } — terminal error state

    function progress() {
        return {
            k: params ? params.k : 0,
            decoded: decodedCount,
            received: receivedCount,
            redundant: redundantCount,
            ratio: params ? decodedCount / params.k : 0,
            payloadType: params ? BEAM_PAYLOAD_TYPE_NAMES[params.type] : null,
        };
    }

    function result(status, extra) {
        const r = progress();
        r.status = status;
        if (extra) for (const key in extra) r[key] = extra[key];
        return r;
    }

    /** Reduce a coded frame by all currently-known blocks, then absorb it. */
    function absorb(indices, body) {
        const unknown = [];
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            if (known[idx]) beamXorInto(body, known[idx]);
            else if (unknown.indexOf(idx) === -1) unknown.push(idx);
        }
        if (unknown.length === 0) { redundantCount++; return; }
        if (unknown.length === 1) { solve(unknown[0], body); return; }
        pending.push({ indices: unknown, data: body });
    }

    /** Record a solved block and peel it out of pending frames (worklist). */
    function solve(index, data) {
        const queue = [[index, data]];
        while (queue.length > 0) {
            const item = queue.shift();
            const idx = item[0];
            if (known[idx]) continue;  // solved twice via different paths
            known[idx] = item[1];
            decodedCount++;

            const stillPending = [];
            for (let i = 0; i < pending.length; i++) {
                const p = pending[i];
                const pos = p.indices.indexOf(idx);
                if (pos === -1) { stillPending.push(p); continue; }
                beamXorInto(p.data, item[1]);
                p.indices.splice(pos, 1);
                if (p.indices.length === 1) queue.push([p.indices[0], p.data]);
                else if (p.indices.length > 1) stillPending.push(p);
                // length 0 can't happen: idx appeared once and sets were deduped
            }
            pending = stillPending;
        }
    }

    /** All k blocks known — inflate and verify the raw-payload CRC. */
    function finish() {
        const assembled = new Uint8Array(params.k * params.blockSize);
        for (let i = 0; i < params.k; i++) {
            assembled.set(known[i], i * params.blockSize);
        }
        const data = assembled.subarray(0, params.length);
        // Corruption surfaces either as an inflate failure (gzip's internal
        // integrity check) or as a raw-CRC mismatch — same terminal state.
        let inflated;
        try {
            inflated = pako.ungzip(data);
        } catch (e) {
            failed = { reason: 'crc-mismatch' };
            return result('error', failed);
        }
        if (beamCrc32(inflated) !== params.crc) {
            failed = { reason: 'crc-mismatch' };
            return result('error', failed);
        }
        payloadBytes = inflated;
        return result('complete');
    }

    return {
        addFrame: function (text) {
            if (failed) return result('error', failed);
            if (payloadBytes) return result('complete');
            if (!isBeamFrame(text)) return result('rejected', { reason: 'not-beam' });

            let frame;
            try {
                frame = beamBase64ToBytes(text.slice(BEAM_FRAME_PREFIX.length));
            } catch (e) {
                return result('rejected', { reason: 'bad-base64' });
            }
            if (frame.length <= BEAM_HEADER_SIZE) {
                return result('rejected', { reason: 'truncated' });
            }
            const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
            const version = view.getUint8(0);
            if (version !== BEAM_VERSION) {
                return result('rejected', { reason: 'bad-version' });
            }
            const type = view.getUint8(1);
            const k = view.getUint16(2, true);
            const blockSize = view.getUint16(4, true);
            const length = view.getUint32(6, true);
            const crc = view.getUint32(10, true);
            const seed = view.getUint32(14, true);

            if (params === null) {
                // First frame latches the transfer — sanity-check the header
                if (k < 1 || blockSize < 1 || type >= BEAM_PAYLOAD_TYPE_NAMES.length ||
                    frame.length !== BEAM_HEADER_SIZE + blockSize ||
                    k !== Math.max(1, Math.ceil(length / blockSize))) {
                    return result('rejected', { reason: 'bad-header' });
                }
                params = { version: version, type: type, k: k, blockSize: blockSize, length: length, crc: crc };
                cdf = beamRobustSolitonCdf(k);
                known = new Array(k).fill(null);
            } else if (crc !== params.crc || k !== params.k || blockSize !== params.blockSize) {
                return result('rejected', { reason: 'mixed-payload' });
            }

            if (seenSeeds.has(seed)) {
                redundantCount++;
                return result('duplicate');
            }
            seenSeeds.add(seed);
            receivedCount++;

            // Copy the body — absorb/solve mutate it and the frame buffer is transient
            const body = frame.slice(BEAM_HEADER_SIZE);
            absorb(beamFrameIndices(seed, params.k, cdf), body);

            if (decodedCount === params.k) return finish();
            return result('accepted');
        },
        isComplete: function () { return payloadBytes !== null; },
        hasFailed: function () { return failed !== null; },
        getProgress: progress,
        /** @returns {{bytes: Uint8Array, type: string}|null} inflated payload */
        getPayload: function () {
            if (!payloadBytes) return null;
            return { bytes: payloadBytes, type: BEAM_PAYLOAD_TYPE_NAMES[params.type] };
        },
    };
}
