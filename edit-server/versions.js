import fs from 'fs';
import path from 'path';
import { diffLines } from './diff.js';

const VERSIONS_DIR = path.resolve('edit-server', '.versions');
const MANIFEST_PATH = path.join(VERSIONS_DIR, 'manifest.json');
const CHECKPOINT_PATH = path.join(VERSIONS_DIR, 'checkpoint.json');
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB limit

// Ensure .versions directory exists
function ensureVersionsDir() {
  if (!fs.existsSync(VERSIONS_DIR)) {
    fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  }
}

// Read global manifest (array of version entries)
function readManifest() {
  ensureVersionsDir();
  if (!fs.existsSync(MANIFEST_PATH)) return [];
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
}

// Write global manifest
function writeManifest(manifest) {
  ensureVersionsDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

// Read checkpoint (version ID used as reference for "Currently editing" diff)
function readCheckpoint() {
  ensureVersionsDir();
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')).id;
}

// Write checkpoint
function writeCheckpoint(id) {
  ensureVersionsDir();
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({ id }), 'utf-8');
}

// Get next version ID
function getNextId(manifest) {
  if (manifest.length === 0) return 0;
  return Math.max(...manifest.map(v => v.id)) + 1;
}

// Snapshot files to a version directory
function snapshotFiles(versionId, filePaths) {
  const versionDir = path.join(VERSIONS_DIR, `v${versionId}`, 'files');
  fs.mkdirSync(versionDir, { recursive: true });

  const snapshotted = [];
  for (const filePath of filePaths) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) continue;

    // Preserve relative path structure inside snapshot
    const relPath = path.relative(process.cwd(), fullPath);
    const destPath = path.join(versionDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(fullPath, destPath);
    snapshotted.push(relPath);
  }

  return snapshotted;
}

// Calculate total storage size of .versions directory
function getStorageSize(dir = VERSIONS_DIR) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      total += getStorageSize(full);
    } else {
      total += stat.size;
    }
  }
  return total;
}

/**
 * Create origin (v0) version from a list of file paths.
 * Origin is immutable — only created once. Subsequent calls are no-ops
 * so that saves/restores don't overwrite the original snapshot.
 */
export function createBaseline(filePaths) {
  const manifest = readManifest();
  const existing = manifest.find(v => v.id === 0);

  // If origin already exists, return it unchanged
  if (existing) return existing;

  const snapshotted = snapshotFiles(0, filePaths);
  const entry = {
    id: 0,
    timestamp: new Date().toISOString(),
    label: 'Origin',
    files: snapshotted,
    fileCount: snapshotted.length
  };

  manifest.push(entry);
  writeManifest(manifest);
  writeCheckpoint(0);
  return entry;
}

/**
 * Create a new version snapshot after a save.
 * Snapshots ALL tracked files (from origin) so each version is a complete,
 * self-contained snapshot of the world state. Only the changedFiles list
 * is used for the auto-label.
 * Sets checkpoint to this version.
 * @param {string[]} changedFiles - absolute paths of files that were just saved
 * @returns {object} the new version entry
 */
export function createVersion(changedFiles) {
  const manifest = readManifest();
  const id = getNextId(manifest);

  // Get the full set of tracked files from origin
  const origin = manifest.find(v => v.id === 0);
  const allTrackedFiles = origin ? origin.files.map(f => path.resolve(f)) : [];

  // Merge: all origin files + any new files from this save
  const fullSet = new Set(allTrackedFiles);
  for (const f of changedFiles) fullSet.add(path.resolve(f));

  const snapshotted = snapshotFiles(id, [...fullSet]);

  // Check if anything actually changed vs previous version
  const sorted = [...manifest].sort((a, b) => a.id - b.id);
  const prevVersion = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  if (prevVersion) {
    const prevDir = path.join(VERSIONS_DIR, `v${prevVersion.id}`, 'files');
    const currDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
    const hasAnyChange = snapshotted.some(relPath => {
      const currFile = path.join(currDir, relPath);
      const prevFile = path.join(prevDir, relPath);
      if (!fs.existsSync(prevFile)) return true;
      return fs.readFileSync(currFile, 'utf-8') !== fs.readFileSync(prevFile, 'utf-8');
    });
    if (!hasAnyChange) {
      fs.rmSync(path.join(VERSIONS_DIR, `v${id}`), { recursive: true, force: true });
      return null;
    }
  }

  // Auto-label based on which files were actually changed in this save
  const changedRelPaths = changedFiles.map(f => path.relative(process.cwd(), path.resolve(f)));
  const label = changedRelPaths.length === 1
    ? `Updated ${path.basename(changedRelPaths[0])}`
    : `Updated ${changedRelPaths.length} files`;

  const entry = {
    id,
    timestamp: new Date().toISOString(),
    label,
    files: snapshotted,
    fileCount: snapshotted.length
  };

  manifest.push(entry);
  writeManifest(manifest);
  writeCheckpoint(id);

  // Check storage limit
  const size = getStorageSize();
  if (size > MAX_STORAGE_BYTES) {
    console.warn(`⚠️  Version storage is ${(size / 1024 / 1024).toFixed(2)}MB (limit: 5MB)`);
  }

  return entry;
}

/**
 * List all versions (lightweight — no diffs).
 */
export function listVersions() {
  return { versions: readManifest(), checkpointId: readCheckpoint() };
}

/**
 * Get version details including file-by-file diffs against the checkpoint.
 * Each version is a complete snapshot, so diffs are straightforward file comparisons.
 */
export function getVersionDetails(id) {
  const manifest = readManifest();
  const version = manifest.find(v => v.id === id);
  if (!version) return null;

  const versionDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
  if (!fs.existsSync(versionDir)) return null;

  // Checkpoint version has no diffs (it's the reference point)
  const checkpointId = readCheckpoint();
  if (checkpointId === id) {
    return { ...version, diffs: [], storageSize: getStorageSize() };
  }

  // Diff against the checkpoint version
  const checkpointDir = checkpointId !== null
    ? path.join(VERSIONS_DIR, `v${checkpointId}`, 'files')
    : null;

  // Compute diffs per file
  const diffs = [];
  for (const relPath of version.files) {
    const currentContent = fs.readFileSync(path.join(versionDir, relPath), 'utf-8');

    let refContent = '';
    if (checkpointDir) {
      const refPath = path.join(checkpointDir, relPath);
      if (fs.existsSync(refPath)) {
        refContent = fs.readFileSync(refPath, 'utf-8');
      }
    }

    const diff = diffLines(refContent, currentContent);
    if (diff.hunks.length > 0) {
      diffs.push({
        file: relPath,
        stats: diff.stats,
        hunks: diff.hunks
      });
    }
  }

  return {
    ...version,
    diffs,
    storageSize: getStorageSize()
  };
}

/**
 * Delete a specific version.
 */
export function deleteVersion(id) {
  const manifest = readManifest();
  const idx = manifest.findIndex(v => v.id === id);
  if (idx === -1) return false;

  // Remove directory
  const versionDir = path.join(VERSIONS_DIR, `v${id}`);
  if (fs.existsSync(versionDir)) {
    fs.rmSync(versionDir, { recursive: true, force: true });
  }

  manifest.splice(idx, 1);
  writeManifest(manifest);

  // If we deleted the checkpoint, fall back to latest remaining version
  if (readCheckpoint() === id) {
    const sorted = [...manifest].sort((a, b) => a.id - b.id);
    writeCheckpoint(sorted.length > 0 ? sorted[sorted.length - 1].id : null);
  }

  return true;
}

/**
 * Delete all versions.
 */
export function deleteAllVersions() {
  if (fs.existsSync(VERSIONS_DIR)) {
    fs.rmSync(VERSIONS_DIR, { recursive: true, force: true });
  }
  ensureVersionsDir();
  writeManifest([]);
  // Checkpoint is cleared since the directory was wiped
  return true;
}

/**
 * Update a version's label.
 */
export function updateLabel(id, label) {
  const manifest = readManifest();
  const entry = manifest.find(v => v.id === id);
  if (!entry) return false;
  entry.label = label;
  writeManifest(manifest);
  return true;
}

/**
 * Restore files from a version snapshot back to their original locations.
 * Each version is a complete snapshot, so all tracked files are restored.
 * Sets checkpoint to the restored version (no backup snapshot created).
 */
export function restoreVersion(id) {
  const manifest = readManifest();
  const version = manifest.find(v => v.id === id);
  if (!version) return null;

  const versionDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
  if (!fs.existsSync(versionDir)) return null;

  const restored = [];
  for (const relPath of version.files) {
    const srcPath = path.join(versionDir, relPath);
    if (!fs.existsSync(srcPath)) continue;

    const destPath = path.resolve(relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    restored.push(relPath);
  }

  writeCheckpoint(id);
  return { restored };
}

/**
 * Get diff of current live files on disk vs the checkpoint version.
 * Each version is a complete snapshot, so just compare directly.
 */
export function getCurrentDiff() {
  const manifest = readManifest();
  if (manifest.length === 0) return { comparedTo: null, diffs: [] };

  const checkpointId = readCheckpoint();
  const checkpoint = checkpointId !== null
    ? manifest.find(v => v.id === checkpointId)
    : null;

  if (!checkpoint) return { comparedTo: null, diffs: [] };

  const checkpointDir = path.join(VERSIONS_DIR, `v${checkpoint.id}`, 'files');
  if (!fs.existsSync(checkpointDir)) return { comparedTo: checkpoint.id, diffs: [] };

  const diffs = [];
  for (const relPath of checkpoint.files) {
    const snapshotPath = path.join(checkpointDir, relPath);
    const snapshotContent = fs.existsSync(snapshotPath)
      ? fs.readFileSync(snapshotPath, 'utf-8')
      : '';

    const livePath = path.resolve(relPath);
    const liveContent = fs.existsSync(livePath)
      ? fs.readFileSync(livePath, 'utf-8')
      : '';

    const diff = diffLines(snapshotContent, liveContent);
    if (diff.hunks.length > 0) {
      diffs.push({
        file: relPath,
        stats: diff.stats,
        hunks: diff.hunks
      });
    }
  }

  return { comparedTo: checkpoint.id, diffs };
}
