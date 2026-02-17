/**
 * Conductor PWA - Draft Manager
 *
 * Handles event draft persistence in IndexedDB:
 * - Save/update drafts (upsert with auto-generated IDs)
 * - List all drafts sorted by lastModified (newest first)
 * - Get/delete individual drafts
 *
 * Draft data stores editor state format (not EmbeddedEvent),
 * so loading a draft populates the editor directly.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const DRAFT_DB_NAME = 'conductor-drafts';
const DRAFT_DB_VERSION = 1;
const DRAFT_STORE = 'drafts';

// ─── IndexedDB helpers ──────────────────────────────────────────────────────

/**
 * Open the drafts database.
 * @returns {Promise<IDBDatabase>}
 */
function openDraftDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DRAFT_STORE)) {
                db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Get a value from the drafts IDB store.
 * @param {IDBDatabase} db
 * @param {string} key
 * @returns {Promise<*>}
 */
function draftIdbGet(db, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE, 'readonly');
        const req = tx.objectStore(DRAFT_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Get all values from the drafts IDB store.
 * @param {IDBDatabase} db
 * @returns {Promise<Array>}
 */
function draftIdbGetAll(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE, 'readonly');
        const req = tx.objectStore(DRAFT_STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ─── Draft Manager ──────────────────────────────────────────────────────────

/**
 * Create a DraftManager instance.
 * @returns {DraftManager}
 */
function createDraftManager() {
    /** @type {IDBDatabase|null} */
    let db = null;

    async function ensureDB() {
        if (!db) {
            db = await openDraftDB();
        }
        return db;
    }

    /**
     * Generate a unique ID for a draft.
     * @returns {string}
     */
    function generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        return 'draft-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Save (upsert) a draft. Generates id if missing, sets lastModified.
     * @param {Object} draft
     * @returns {Promise<Object>} The saved draft with id, createdAt, lastModified
     */
    async function saveDraft(draft) {
        const database = await ensureDB();
        const now = new Date().toISOString();

        const toSave = Object.assign({}, draft);
        if (!toSave.id) {
            toSave.id = generateId();
            toSave.createdAt = now;
        }
        if (!toSave.createdAt) {
            toSave.createdAt = now;
        }
        toSave.lastModified = now;

        return new Promise((resolve, reject) => {
            const tx = database.transaction(DRAFT_STORE, 'readwrite');
            tx.oncomplete = () => resolve(toSave);
            tx.onerror = () => reject(tx.error);
            tx.objectStore(DRAFT_STORE).put(toSave);
        });
    }

    /**
     * List all drafts, sorted newest-first by lastModified.
     * @returns {Promise<Object[]>}
     */
    async function listDrafts() {
        const database = await ensureDB();
        const all = await draftIdbGetAll(database);
        all.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
        return all;
    }

    /**
     * Get a single draft by ID.
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async function getDraft(id) {
        const database = await ensureDB();
        return draftIdbGet(database, id);
    }

    /**
     * Delete a draft by ID. Does not throw if the draft doesn't exist.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async function deleteDraft(id) {
        const database = await ensureDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(DRAFT_STORE, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.objectStore(DRAFT_STORE).delete(id);
        });
    }

    return {
        saveDraft,
        listDrafts,
        getDraft,
        deleteDraft,
    };
}
