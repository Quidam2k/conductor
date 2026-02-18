/**
 * Conductor PWA - Resource Pack Manager
 *
 * Handles resource pack import, storage, and playback:
 * - Zip file parsing (central directory, deflate via DecompressionStream/pako)
 * - IndexedDB: store manifests + audio ArrayBuffers persistently
 * - AudioBuffer cache: decode on demand for low-latency playback
 * - Resolver: synchronous (cueId, packId) → boolean for audioService integration
 *
 * Requires: pako.min.js (fallback decompression)
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const RPM_DB_NAME = 'conductor-packs';
const RPM_DB_VERSION = 1;
const RPM_STORE_MANIFESTS = 'manifests';
const RPM_STORE_AUDIO = 'audio';

// ─── Zip parsing helpers ────────────────────────────────────────────────────

/**
 * Parse a zip file's central directory and extract file entries.
 * @param {ArrayBuffer} buffer - The zip file contents
 * @returns {Array<{name: string, compressedSize: number, uncompressedSize: number, compressionMethod: number, offset: number}>}
 */
function parseZipCentralDirectory(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Find End of Central Directory record (scan backward)
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset === -1) throw new Error('Invalid zip: EOCD not found');

    const centralDirOffset = view.getUint32(eocdOffset + 16, true);
    const entryCount = view.getUint16(eocdOffset + 10, true);

    const entries = [];
    let pos = centralDirOffset;

    for (let i = 0; i < entryCount; i++) {
        if (view.getUint32(pos, true) !== 0x02014b50) {
            throw new Error('Invalid zip: bad central directory entry');
        }

        const compressionMethod = view.getUint16(pos + 10, true);
        const compressedSize = view.getUint32(pos + 20, true);
        const uncompressedSize = view.getUint32(pos + 24, true);
        const nameLen = view.getUint16(pos + 28, true);
        const extraLen = view.getUint16(pos + 30, true);
        const commentLen = view.getUint16(pos + 32, true);
        const localHeaderOffset = view.getUint32(pos + 42, true);

        const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
        const name = new TextDecoder().decode(nameBytes);

        entries.push({
            name,
            compressedSize,
            uncompressedSize,
            compressionMethod,
            offset: localHeaderOffset,
        });

        pos += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
}

/**
 * Extract raw file data from a zip entry (reads local file header to find data start).
 * @param {ArrayBuffer} buffer - The zip file
 * @param {{name: string, compressedSize: number, compressionMethod: number, offset: number}} entry
 * @returns {Uint8Array} Compressed (or stored) file data
 */
function extractZipEntryData(buffer, entry) {
    const view = new DataView(buffer);
    const pos = entry.offset;

    if (view.getUint32(pos, true) !== 0x04034b50) {
        throw new Error('Invalid zip: bad local file header for ' + entry.name);
    }

    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const dataStart = pos + 30 + nameLen + extraLen;

    return new Uint8Array(buffer, dataStart, entry.compressedSize);
}

/**
 * Decompress deflate data. Tries native DecompressionStream first, falls back to pako.
 * @param {Uint8Array} compressed
 * @returns {Promise<Uint8Array>}
 */
async function decompressDeflate(compressed) {
    // Try native DecompressionStream (raw deflate)
    if (typeof DecompressionStream !== 'undefined') {
        try {
            const ds = new DecompressionStream('raw');
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();

            writer.write(compressed);
            writer.close();

            const chunks = [];
            let totalLen = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                totalLen += value.length;
            }

            const result = new Uint8Array(totalLen);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }
            return result;
        } catch (e) {
            // Fall through to pako
        }
    }

    // Fallback: pako (raw inflate)
    if (typeof pako !== 'undefined') {
        return pako.inflateRaw(compressed);
    }

    throw new Error('No decompression available (need DecompressionStream or pako)');
}

/**
 * Extract a file from a zip as Uint8Array.
 * @param {ArrayBuffer} zipBuffer
 * @param {{name: string, compressedSize: number, uncompressedSize: number, compressionMethod: number, offset: number}} entry
 * @returns {Promise<Uint8Array>}
 */
async function extractZipFile(zipBuffer, entry) {
    const data = extractZipEntryData(zipBuffer, entry);

    if (entry.compressionMethod === 0) {
        // Stored (no compression)
        return data;
    } else if (entry.compressionMethod === 8) {
        // Deflate
        return await decompressDeflate(data);
    } else {
        throw new Error('Unsupported compression method: ' + entry.compressionMethod);
    }
}

// ─── IndexedDB helpers ──────────────────────────────────────────────────────

/**
 * Open the resource pack database.
 * @returns {Promise<IDBDatabase>}
 */
function openPackDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(RPM_DB_NAME, RPM_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(RPM_STORE_MANIFESTS)) {
                db.createObjectStore(RPM_STORE_MANIFESTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(RPM_STORE_AUDIO)) {
                db.createObjectStore(RPM_STORE_AUDIO);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Run an IDB transaction and return a promise.
 * @param {IDBDatabase} db
 * @param {string|string[]} stores
 * @param {'readonly'|'readwrite'} mode
 * @param {function(IDBTransaction): void} fn
 * @returns {Promise<void>}
 */
function idbTransaction(db, stores, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        fn(tx);
    });
}

/**
 * Get a value from IDB.
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {*} key
 * @returns {Promise<*>}
 */
function idbGet(db, store, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Get all values from an IDB store.
 * @param {IDBDatabase} db
 * @param {string} store
 * @returns {Promise<Array>}
 */
function idbGetAll(db, store) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ─── Resource Pack Manager ──────────────────────────────────────────────────

/**
 * Create a ResourcePackManager instance.
 * @returns {ResourcePackManager}
 */
function createResourcePackManager() {
    /** @type {IDBDatabase|null} */
    let db = null;

    /** @type {AudioContext|null} */
    let audioCtx = null;

    /** @type {Map<string, AudioBuffer>} key = "packId:cueId" */
    const bufferCache = new Map();

    /** @type {Set<string>} Pack IDs that have been fully loaded into bufferCache */
    const loadedPacks = new Set();

    // ─── DB lifecycle ────────────────────────────────────────────

    async function ensureDB() {
        if (!db) {
            db = await openPackDB();
        }
        return db;
    }

    // ─── AudioContext ────────────────────────────────────────────

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    // ─── Import pipeline ─────────────────────────────────────────

    /**
     * Import a resource pack from a zip ArrayBuffer.
     * Parses zip, validates manifest, decodes audio, stores in IDB.
     *
     * @param {ArrayBuffer} arrayBuffer - The zip file contents
     * @param {function(string): void} [onProgress] - Progress callback
     * @returns {Promise<Object>} The pack manifest
     */
    async function importPack(arrayBuffer, onProgress) {
        const progress = onProgress || (() => {});

        // 1. Parse zip
        progress('Parsing zip...');
        const entries = parseZipCentralDirectory(arrayBuffer);

        // 2. Find and parse manifest
        const manifestEntry = entries.find(e => e.name === 'manifest.json');
        if (!manifestEntry) {
            throw new Error('Invalid pack: missing manifest.json');
        }

        const manifestBytes = await extractZipFile(arrayBuffer, manifestEntry);
        const manifestText = new TextDecoder().decode(manifestBytes);
        let manifest;
        try {
            manifest = JSON.parse(manifestText);
        } catch (e) {
            throw new Error('Invalid pack: manifest.json is not valid JSON');
        }

        // 3. Validate manifest
        if (!manifest.id || typeof manifest.id !== 'string') {
            throw new Error('Invalid pack: manifest missing "id"');
        }
        if (!manifest.name || typeof manifest.name !== 'string') {
            throw new Error('Invalid pack: manifest missing "name"');
        }
        if (!manifest.cues || typeof manifest.cues !== 'object') {
            throw new Error('Invalid pack: manifest missing "cues" map');
        }

        // Default version
        if (!manifest.version) manifest.version = '1.0.0';

        // 4. Extract and store audio files
        const database = await ensureDB();
        const cueIds = Object.keys(manifest.cues);
        let processed = 0;

        // Build a map of zip filename → entry for quick lookup
        const entryMap = new Map();
        for (const entry of entries) {
            entryMap.set(entry.name, entry);
        }

        // Extract all audio files first (IDB transactions auto-commit on idle,
        // so we extract everything before opening the write transaction)
        progress('Extracting audio...');
        const audioData = new Map(); // cueId → ArrayBuffer

        for (const cueId of cueIds) {
            const filePath = manifest.cues[cueId];
            const entry = entryMap.get(filePath);
            if (!entry) {
                console.warn(`Pack ${manifest.id}: cue "${cueId}" references missing file "${filePath}"`);
                continue;
            }

            const fileData = await extractZipFile(arrayBuffer, entry);
            audioData.set(cueId, fileData.buffer.slice(
                fileData.byteOffset,
                fileData.byteOffset + fileData.byteLength
            ));

            processed++;
            progress(`Extracting: ${processed}/${cueIds.length} cues`);
        }

        // Now write everything to IDB in one transaction
        progress('Storing in database...');
        const database2 = await ensureDB();
        await new Promise((resolve, reject) => {
            const tx = database2.transaction(
                [RPM_STORE_MANIFESTS, RPM_STORE_AUDIO],
                'readwrite'
            );
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);

            // Store manifest
            tx.objectStore(RPM_STORE_MANIFESTS).put(manifest);

            // Store audio
            const audioStore = tx.objectStore(RPM_STORE_AUDIO);
            for (const [cueId, buffer] of audioData) {
                const key = manifest.id + ':' + cueId;
                audioStore.put(buffer, key);
            }
        });

        // Clear any stale cache for this pack
        loadedPacks.delete(manifest.id);
        for (const [key] of bufferCache) {
            if (key.startsWith(manifest.id + ':')) {
                bufferCache.delete(key);
            }
        }

        progress('Import complete!');
        return manifest;
    }

    /**
     * Delete a resource pack and all its audio data.
     * @param {string} packId
     * @returns {Promise<void>}
     */
    async function deletePack(packId) {
        const database = await ensureDB();

        // Get manifest to know which cues to delete
        const manifest = await idbGet(database, RPM_STORE_MANIFESTS, packId);

        await new Promise((resolve, reject) => {
            const tx = database.transaction(
                [RPM_STORE_MANIFESTS, RPM_STORE_AUDIO],
                'readwrite'
            );
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);

            tx.objectStore(RPM_STORE_MANIFESTS).delete(packId);

            // Delete all audio entries for this pack
            if (manifest && manifest.cues) {
                const audioStore = tx.objectStore(RPM_STORE_AUDIO);
                for (const cueId of Object.keys(manifest.cues)) {
                    audioStore.delete(packId + ':' + cueId);
                }
            }
        });

        // Clear cache
        loadedPacks.delete(packId);
        for (const [key] of bufferCache) {
            if (key.startsWith(packId + ':')) {
                bufferCache.delete(key);
            }
        }
    }

    /**
     * List all installed pack manifests.
     * @returns {Promise<Object[]>}
     */
    async function listPacks() {
        const database = await ensureDB();
        return idbGetAll(database, RPM_STORE_MANIFESTS);
    }

    /**
     * Check if a pack is installed.
     * @param {string} packId
     * @returns {Promise<boolean>}
     */
    async function hasPack(packId) {
        const database = await ensureDB();
        const manifest = await idbGet(database, RPM_STORE_MANIFESTS, packId);
        return !!manifest;
    }

    // ─── Audio loading ───────────────────────────────────────────

    /**
     * Pre-load all audio from a pack into AudioBuffer cache.
     * Call this before playback starts (e.g. entering practice/live mode).
     *
     * @param {string} packId
     * @returns {Promise<void>}
     */
    async function ensurePackLoaded(packId) {
        if (loadedPacks.has(packId)) return;

        const database = await ensureDB();
        const manifest = await idbGet(database, RPM_STORE_MANIFESTS, packId);
        if (!manifest) return;

        const ctx = getAudioContext();
        const cueIds = Object.keys(manifest.cues);

        for (const cueId of cueIds) {
            const key = packId + ':' + cueId;
            if (bufferCache.has(key)) continue;

            const arrayBuffer = await idbGet(database, RPM_STORE_AUDIO, key);
            if (!arrayBuffer) continue;

            try {
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
                bufferCache.set(key, audioBuffer);
            } catch (e) {
                console.warn(`Failed to decode audio: ${key}`, e);
            }
        }

        loadedPacks.add(packId);
    }

    // ─── Playback ────────────────────────────────────────────────

    /**
     * Play an AudioBuffer from the cache.
     * @param {string} cacheKey - "packId:cueId"
     * @returns {boolean} true if played
     */
    async function playBuffer(cacheKey) {
        const buffer = bufferCache.get(cacheKey);
        if (!buffer) return false;

        try {
            const ctx = getAudioContext();
            // Resume if suspended (iOS requires user gesture)
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
            return true;
        } catch (e) {
            console.warn('Pack audio playback failed:', e);
            return false;
        }
    }

    // ─── Resolver ────────────────────────────────────────────────

    /**
     * Get a synchronous resolver function for use with audioService.
     * The resolver checks the AudioBuffer cache and plays if available.
     *
     * @returns {function(string, string): boolean} (cueId, packId) → true if played
     */
    function getResolver() {
        return function resolvePackCue(cueId, packId) {
            const key = packId + ':' + cueId;
            if (!bufferCache.has(key)) return false;
            playBuffer(key); // fire-and-forget async playback
            return true;
        };
    }

    // ─── Public API ──────────────────────────────────────────────

    /**
     * Get pack manifest + cue count for UI display.
     * @param {string} packId
     * @returns {Promise<{id: string, name: string, version: string, cueCount: number}|null>}
     */
    async function getPackInfo(packId) {
        const database = await ensureDB();
        const manifest = await idbGet(database, RPM_STORE_MANIFESTS, packId);
        if (!manifest) return null;
        return {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version || '1.0.0',
            cueCount: manifest.cues ? Object.keys(manifest.cues).length : 0,
            url: manifest.url || null,
        };
    }

    /**
     * Get array of cue IDs from a pack's manifest (for Plan 10 dropdowns).
     * @param {string} packId
     * @returns {Promise<string[]>}
     */
    async function getCueList(packId) {
        const database = await ensureDB();
        const manifest = await idbGet(database, RPM_STORE_MANIFESTS, packId);
        if (!manifest || !manifest.cues) return [];
        return Object.keys(manifest.cues);
    }

    // ─── Pack validation ────────────────────────────────────────

    /**
     * Validate event coverage against a pack manifest.
     * Checks which actions have full cues, grain coverage, or no coverage.
     *
     * @param {Object} manifest - Pack manifest with cues and optional grains
     * @param {Array<{name: string, event: Object}>} events - Parsed event objects
     * @returns {{covered: number, grainCovered: number, uncovered: Array, total: number}}
     */
    function validatePackEvents(manifest, events) {
        const cueSet = new Set(Object.keys(manifest.cues || {}));
        const grainSet = new Set(Object.keys(manifest.grains || {}));
        const hasGrains = grainSet.size > 0;

        let covered = 0;
        let grainCovered = 0;
        const uncovered = [];
        let total = 0;

        for (const { name, event } of events) {
            if (!event.timeline) continue;

            for (const action of event.timeline) {
                // Only check actions that reference this pack
                if (action.pack !== manifest.id) continue;
                total++;

                const cueId = action.cue;
                const actionText = action.action || '';

                // 1. Full cue match
                if (cueId && cueSet.has(cueId)) {
                    covered++;
                    continue;
                }

                // 2. Grain coverage — all words present?
                if (hasGrains) {
                    const words = actionText.toLowerCase().split(/\s+/).filter(Boolean);
                    const allGrains = words.length > 0 && words.every(w => grainSet.has(w));
                    if (allGrains) {
                        grainCovered++;
                        continue;
                    }
                }

                // 3. Uncovered — will fall back to TTS
                const words = actionText.toLowerCase().split(/\s+/).filter(Boolean);
                const missingGrains = hasGrains
                    ? words.filter(w => !grainSet.has(w))
                    : [];

                // Compute relative timestamp for display
                let timeLabel = '';
                if (action.time && event.startTime) {
                    const offsetMs = new Date(action.time) - new Date(event.startTime);
                    const secs = Math.round(offsetMs / 1000);
                    const m = Math.floor(secs / 60);
                    const s = secs % 60;
                    timeLabel = m + ':' + String(s).padStart(2, '0');
                }

                uncovered.push({
                    event: name,
                    time: timeLabel,
                    action: actionText,
                    cue: cueId || '(none)',
                    missingGrains,
                });
            }
        }

        return { covered, grainCovered, uncovered, total };
    }

    /**
     * Import a pack and validate bundled events.
     * Extends importPack by also extracting event files and running validation.
     *
     * @param {ArrayBuffer} arrayBuffer - The zip file contents
     * @param {function(string): void} [onProgress]
     * @returns {Promise<{manifest: Object, validation: Object|null}>}
     */
    async function importPackWithValidation(arrayBuffer, onProgress) {
        const progress = onProgress || (() => {});

        // Run the normal import first
        const manifest = await importPack(arrayBuffer, onProgress);

        // If no bundled events, skip validation
        if (!manifest.events || manifest.events.length === 0) {
            return { manifest, validation: null };
        }

        // Extract and parse event files from the zip
        progress('Validating event coverage...');
        const entries = parseZipCentralDirectory(arrayBuffer);
        const entryMap = new Map();
        for (const entry of entries) {
            entryMap.set(entry.name, entry);
        }

        const events = [];
        for (const eventRef of manifest.events) {
            const entry = entryMap.get(eventRef.file);
            if (!entry) {
                console.warn(`Pack ${manifest.id}: event "${eventRef.name}" references missing file "${eventRef.file}"`);
                continue;
            }
            try {
                const fileData = await extractZipFile(arrayBuffer, entry);
                const text = new TextDecoder().decode(fileData);
                const event = JSON.parse(text);
                events.push({ name: eventRef.name || eventRef.file, event });
            } catch (e) {
                console.warn(`Pack ${manifest.id}: failed to parse event "${eventRef.file}":`, e);
            }
        }

        const validation = events.length > 0
            ? validatePackEvents(manifest, events)
            : null;

        return { manifest, validation };
    }

    return {
        importPack,
        importPackWithValidation,
        validatePackEvents,
        deletePack,
        listPacks,
        hasPack,
        ensurePackLoaded,
        getResolver,
        getAudioContext,
        getPackInfo,
        getCueList,

        // For testing/debugging
        getBufferCache: () => bufferCache,
        getLoadedPacks: () => loadedPacks,
    };
}
