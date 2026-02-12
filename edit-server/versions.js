import fs from 'fs';
import path from 'path';
import { diffLines } from './diff.js';

const VERSIONS_DIR = path.resolve('edit-server', '.versions');
const MANIFEST_PATH = path.join(VERSIONS_DIR, 'manifest.json');
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
 * Create or refresh baseline (v0) version from a list of file paths.
 * Always re-snapshots files so baseline stays fresh across page navigations
 * and server restarts.
 */
export function createBaseline(filePaths) {
  const manifest = readManifest();

  // Remove existing v0 snapshot directory if present
  const v0Dir = path.join(VERSIONS_DIR, 'v0');
  if (fs.existsSync(v0Dir)) {
    fs.rmSync(v0Dir, { recursive: true, force: true });
  }

  const snapshotted = snapshotFiles(0, filePaths);
  const entry = {
    id: 0,
    timestamp: new Date().toISOString(),
    label: 'Baseline',
    files: snapshotted,
    fileCount: snapshotted.length
  };

  // Replace or add v0 in manifest
  const idx = manifest.findIndex(v => v.id === 0);
  if (idx !== -1) {
    manifest[idx] = entry;
  } else {
    manifest.push(entry);
  }
  writeManifest(manifest);
  return entry;
}

/**
 * Create a new version snapshot after a save.
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
  return readManifest();
}

/**
 * Get version details including file-by-file diffs against previous version.
 */
export function getVersionDetails(id) {
  const manifest = readManifest();
  const version = manifest.find(v => v.id === id);
  if (!version) return null;

  const versionDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
  if (!fs.existsSync(versionDir)) return null;

  // Find previous version for diffing
  const sorted = [...manifest].sort((a, b) => a.id - b.id);
  const idx = sorted.findIndex(v => v.id === id);
  const prevVersion = idx > 0 ? sorted[idx - 1] : null;
  const prevDir = prevVersion
    ? path.join(VERSIONS_DIR, `v${prevVersion.id}`, 'files')
    : null;

  // Compute diffs per file
  const diffs = [];
  for (const relPath of version.files) {
    const currentPath = path.join(versionDir, relPath);
    const currentContent = fs.existsSync(currentPath)
      ? fs.readFileSync(currentPath, 'utf-8')
      : '';

    let oldContent = '';
    if (prevDir) {
      const prevPath = path.join(prevDir, relPath);
      if (fs.existsSync(prevPath)) {
        oldContent = fs.readFileSync(prevPath, 'utf-8');
      }
    }

    const diff = diffLines(oldContent, currentContent);

    // Only include files that actually have changes (or this is baseline)
    if (diff.hunks.length > 0 || id === 0) {
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
 * Creates a new version (capturing current state) before restoring,
 * unless current state is identical to the previous version.
 */
export function restoreVersion(id) {
  const manifest = readManifest();
  const version = manifest.find(v => v.id === id);
  if (!version) return null;

  const versionDir = path.join(VERSIONS_DIR, `v${id}`, 'files');
  if (!fs.existsSync(versionDir)) return null;

  // Snapshot current state of the files we're about to overwrite
  const currentFiles = version.files.map(f => path.resolve(f));
  const backupVersion = createVersion(currentFiles);
  let backupVersionId = null;

  if (backupVersion) {
    backupVersion.label = `Before restore to v${id}`;
    const updatedManifest = readManifest();
    const backupIdx = updatedManifest.findIndex(v => v.id === backupVersion.id);
    if (backupIdx !== -1) {
      updatedManifest[backupIdx].label = backupVersion.label;
      writeManifest(updatedManifest);
    }
    backupVersionId = backupVersion.id;
  }

  // Restore files from the snapshot
  const restored = [];
  for (const relPath of version.files) {
    const srcPath = path.join(versionDir, relPath);
    const destPath = path.resolve(relPath);

    if (!fs.existsSync(srcPath)) continue;

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    restored.push(relPath);
  }

  return {
    restored,
    backupVersionId
  };
}

/**
 * Get diff of current live files on disk vs the latest version snapshot.
 * Used by the "Currently editing" card to show unsaved changes.
 */
export function getCurrentDiff() {
  const manifest = readManifest();
  if (manifest.length === 0) return { comparedTo: null, diffs: [] };

  const sorted = [...manifest].sort((a, b) => a.id - b.id);
  const latest = sorted[sorted.length - 1];
  const latestDir = path.join(VERSIONS_DIR, `v${latest.id}`, 'files');

  if (!fs.existsSync(latestDir)) return { comparedTo: latest.id, diffs: [] };

  const diffs = [];
  for (const relPath of latest.files) {
    const snapshotPath = path.join(latestDir, relPath);
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

  return { comparedTo: latest.id, diffs };
}
