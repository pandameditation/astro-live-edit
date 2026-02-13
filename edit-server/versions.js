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
 * Sets checkpoint to this version.
 * @param {string[]} changedFiles - absolute paths of files that were just saved
 * @returns {object} the new version entry
 */
export function createVersion(changedFiles) {
  const manifest = readManifest();
  const id = getNextId(manifest);

  const snapshotted = snapshotFiles(id, changedFiles);

  // Check if anything actually changed vs previous version
  const sorted = [...manifest].sort((a, b) => a.id - b.id);
  const prevVersion = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  if (prevVersion) {
    const prevDir = path.join(VERSIONS_DIR, `v${prevVersion.id}`, 'files');
    const currDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
    const hasAnyChange = snapshotted.some(relPath => {
      const currFile = path.join(currDir, relPath);
      const prevFile = path.join(prevDir, relPath);
      if (!fs.existsSync(prevFile)) return true; // new file = change
      return fs.readFileSync(currFile, 'utf-8') !== fs.readFileSync(prevFile, 'utf-8');
    });
    if (!hasAnyChange) {
      // No actual changes — clean up and skip
      fs.rmSync(path.join(VERSIONS_DIR, `v${id}`), { recursive: true, force: true });
      return null;
    }
  }

  // Auto-label
  const label = snapshotted.length === 1
    ? `Updated ${path.basename(snapshotted[0])}`
    : `Updated ${snapshotted.length} files`;

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
 * The checkpoint version itself will naturally show no diffs.
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
  const checkpointVersion = checkpointId !== null
    ? manifest.find(v => v.id === checkpointId)
    : null;
  const refDir = checkpointVersion
    ? path.join(VERSIONS_DIR, `v${checkpointId}`, 'files')
    : null;

  // Use union of files from this version and the checkpoint
  const allFiles = new Set(version.files);
  if (checkpointVersion) {
    for (const f of checkpointVersion.files) allFiles.add(f);
  }

  // Compute diffs per file
  const diffs = [];
  for (const relPath of allFiles) {
    const currentPath = path.join(versionDir, relPath);
    const currentContent = fs.existsSync(currentPath)
      ? fs.readFileSync(currentPath, 'utf-8')
      : '';

    let refContent = '';
    if (refDir) {
      const refPath = path.join(refDir, relPath);
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
 * Also reverts any files that were changed in later versions but not in this one,
 * by restoring them from the origin (v0) snapshot.
 * Sets checkpoint to the restored version (no backup snapshot created).
 */
export function restoreVersion(id) {
  const manifest = readManifest();
  const version = manifest.find(v => v.id === id);
  if (!version) return null;

  const versionDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
  if (!fs.existsSync(versionDir)) return null;

  // Collect all files that any version has ever tracked
  const allTrackedFiles = new Set();
  for (const v of manifest) {
    for (const f of v.files) allTrackedFiles.add(f);
  }

  const restored = [];
  const versionFiles = new Set(version.files);

  for (const relPath of allTrackedFiles) {
    let srcPath;
    if (versionFiles.has(relPath)) {
      // File exists in target version — use it
      srcPath = path.join(versionDir, relPath);
    } else {
      // File not in target version — fall back to origin (v0)
      srcPath = path.join(VERSIONS_DIR, 'v0', 'files', relPath);
    }

    if (!fs.existsSync(srcPath)) continue;

    const destPath = path.resolve(relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    restored.push(relPath);
  }

  // Set checkpoint to the restored version
  writeCheckpoint(id);

  return { restored };
}

/**
 * Get diff of current live files on disk vs the checkpoint version.
 * Checkpoint = latest save or latest restore (whichever happened most recently).
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
    const livePath = path.resolve(relPath);

    const snapshotContent = fs.existsSync(snapshotPath)
      ? fs.readFileSync(snapshotPath, 'utf-8')
      : '';
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
