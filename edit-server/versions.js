import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { diffLines } from './diff.js';

const VERSIONS_DIR = path.resolve('edit-server', '.versions');
const MANIFEST_PATH = path.join(VERSIONS_DIR, 'manifest.json');
const CHECKPOINT_PATH = path.join(VERSIONS_DIR, 'checkpoint.json');
const ORIGIN_PATH = path.join(VERSIONS_DIR, 'origin.json');
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
 * Try to read a file's content from the latest git commit.
 * Returns null if git is unavailable or file is untracked.
 */
function readFileFromGit(relPath) {
  try {
    return execSync(`git show HEAD:${relPath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/**
 * Read stored origin data (survives deleteAllVersions).
 */
function readOriginData() {
  if (!fs.existsSync(ORIGIN_PATH)) return null;
  return JSON.parse(fs.readFileSync(ORIGIN_PATH, 'utf-8'));
}

/**
 * Write origin data to persistent storage.
 */
function writeOriginData(data) {
  ensureVersionsDir();
  fs.writeFileSync(ORIGIN_PATH, JSON.stringify(data), 'utf-8');
}

/**
 * Rebuild v0 snapshot directory from stored origin data.
 */
function rebuildOriginSnapshot(originData) {
  const v0Dir = path.join(VERSIONS_DIR, 'v0', 'files');
  fs.mkdirSync(v0Dir, { recursive: true });
  for (const [relPath, content] of Object.entries(originData.contents)) {
    const destPath = path.join(v0Dir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, 'utf-8');
  }
}

/**
 * Create origin (v0) version from a list of file paths.
 * Uses git content when available, falls back to disk content.
 * Origin data is stored persistently in origin.json and survives deleteAllVersions.
 */
export function createBaseline(filePaths) {
  const manifest = readManifest();
  const existing = manifest.find(v => v.id === 0);

  // If origin already exists in manifest, ensure snapshot dir exists and return
  if (existing) {
    const v0Dir = path.join(VERSIONS_DIR, 'v0', 'files');
    if (!fs.existsSync(v0Dir)) {
      const originData = readOriginData();
      if (originData) rebuildOriginSnapshot(originData);
    }
    return existing;
  }

  // Capture origin content: git first, disk fallback
  const contents = {};
  const files = [];
  for (const filePath of filePaths) {
    const fullPath = path.resolve(filePath);
    const relPath = path.relative(process.cwd(), fullPath);

    const gitContent = readFileFromGit(relPath);
    const content = gitContent !== null
      ? gitContent
      : (fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : null);

    if (content === null) continue;
    contents[relPath] = content;
    files.push(relPath);
  }

  // Persist origin data (survives deleteAllVersions)
  writeOriginData({ contents, timestamp: new Date().toISOString() });

  // Write v0 snapshot directory
  const v0Dir = path.join(VERSIONS_DIR, 'v0', 'files');
  fs.mkdirSync(v0Dir, { recursive: true });
  for (const [relPath, content] of Object.entries(contents)) {
    const destPath = path.join(v0Dir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, 'utf-8');
  }

  const entry = {
    id: 0,
    timestamp: new Date().toISOString(),
    label: 'Origin',
    files,
    fileCount: files.length
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
 * Delete a specific version. Cannot delete origin (v0).
 */
export function deleteVersion(id) {
  if (id === 0) return false; // Origin is immutable
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
 * Delete all versions except origin (v0).
 * Origin data in origin.json is always preserved.
 */
export function deleteAllVersions() {
  const originData = readOriginData();
  const manifest = readManifest();
  const originEntry = manifest.find(v => v.id === 0);

  // Wipe the entire directory
  if (fs.existsSync(VERSIONS_DIR)) {
    fs.rmSync(VERSIONS_DIR, { recursive: true, force: true });
  }
  ensureVersionsDir();

  // Restore origin data file
  if (originData) writeOriginData(originData);

  // Rebuild v0 from stored origin data
  if (originEntry && originData) {
    rebuildOriginSnapshot(originData);
    writeManifest([originEntry]);
    writeCheckpoint(0);
  } else {
    writeManifest([]);
  }

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
 * Reset origin to latest git HEAD.
 * Wipes all versions, restores tracked files to git content, rebuilds origin from git.
 */
export function resetOrigin(filePaths) {
  // Wipe everything including origin.json
  if (fs.existsSync(VERSIONS_DIR)) {
    fs.rmSync(VERSIONS_DIR, { recursive: true, force: true });
  }
  ensureVersionsDir();
  writeManifest([]);

  // Restore files on disk to git HEAD content
  for (const filePath of filePaths) {
    const fullPath = path.resolve(filePath);
    const relPath = path.relative(process.cwd(), fullPath);
    const gitContent = readFileFromGit(relPath);
    if (gitContent !== null) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, gitContent, 'utf-8');
    }
  }

  // Recreate baseline from git
  return createBaseline(filePaths);
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
