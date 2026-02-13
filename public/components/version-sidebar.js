// Version Sidebar Component
// Right-side panel showing version history cards with lazy-loading.

import { createVersionCard, renderDiffDetails } from './version-card.js';

const API_BASE = 'http://localhost:3000';

export function createVersionSidebar({ getChanges } = {}) {
  const sidebar = document.createElement('div');
  Object.assign(sidebar.style, {
    position: 'fixed',
    top: '0',
    right: '-320px',        // hidden by default
    width: '300px',
    height: '100vh',
    background: '#1e1e1e',
    borderLeft: '1px solid #444',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    transition: 'right 0.25s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#ddd',
    boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
  });

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, {
    padding: '12px 14px',
    borderBottom: '1px solid #444',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: '0',
  });

  const title = document.createElement('span');
  title.textContent = '📜 Version History';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '14px';

  // "⋮" menu button
  const menuBtn = document.createElement('button');
  menuBtn.textContent = '⋮';
  Object.assign(menuBtn.style, {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 6px',
  });
  menuBtn.title = 'Manage versions';
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showManageMenu(menuBtn);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 4px',
  });
  closeBtn.addEventListener('click', () => hide());

  const headerRight = document.createElement('div');
  headerRight.style.display = 'flex';
  headerRight.style.gap = '4px';
  headerRight.appendChild(menuBtn);
  headerRight.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(headerRight);
  sidebar.appendChild(header);

  // Card list (scrollable)
  const cardList = document.createElement('div');
  Object.assign(cardList.style, {
    flex: '1',
    overflowY: 'auto',
    padding: '10px',
  });
  sidebar.appendChild(cardList);

  document.body.appendChild(sidebar);

  let isOpen = false;
  // Cache of fetched version details
  const detailsCache = {};
  let updatePendingRef = null;

  function show() {
    sidebar.style.right = '0';
    isOpen = true;
    loadVersions();
  }

  function hide() {
    sidebar.style.right = '-320px';
    isOpen = false;
  }

  function toggle() {
    if (isOpen) hide(); else show();
  }

  async function loadVersions() {
    cardList.innerHTML = '';
    const loading = document.createElement('div');
    loading.textContent = 'Loading...';
    loading.style.color = '#888';
    loading.style.padding = '20px';
    loading.style.textAlign = 'center';
    cardList.appendChild(loading);

    try {
      const res = await fetch(`${API_BASE}/api/versions`);
      const data = await res.json();
      const versionsList = data.versions;
      const checkpointId = data.checkpointId;
      cardList.innerHTML = '';

      // "Currently editing" card — always at top
      const currentCard = document.createElement('div');
      Object.assign(currentCard.style, {
        padding: '10px 12px',
        marginBottom: '8px',
        background: '#1a2a3a',
        borderRadius: '6px',
        borderLeft: '3px solid #68f',
        cursor: 'pointer',
        transition: 'background 0.15s',
        fontSize: '13px',
        color: '#8af',
        fontWeight: 'bold',
      });
      currentCard.addEventListener('mouseenter', () => { currentCard.style.background = '#2a3a4a'; });
      currentCard.addEventListener('mouseleave', () => { currentCard.style.background = '#1a2a3a'; });

      const currentLabel = document.createElement('span');
      currentLabel.textContent = '✏️ Currently editing';
      currentCard.appendChild(currentLabel);

      // Pending changes summary
      const pendingBadge = document.createElement('span');
      Object.assign(pendingBadge.style, {
        marginLeft: '8px',
        background: '#68f',
        color: '#fff',
        padding: '1px 6px',
        borderRadius: '8px',
        fontSize: '10px',
        fontWeight: 'bold',
        display: 'none',
      });
      currentCard.appendChild(pendingBadge);

      const currentDiffContainer = document.createElement('div');
      currentDiffContainer.style.display = 'none';
      currentCard.appendChild(currentDiffContainer);

      function updatePendingBadge() {
        const changes = getChanges ? getChanges() : [];
        if (changes.length === 0) {
          pendingBadge.style.display = 'none';
          return;
        }
        pendingBadge.textContent = `${changes.length} unsaved`;
        pendingBadge.style.display = 'inline';
      }
      updatePendingRef = updatePendingBadge;
      updatePendingBadge();

      currentCard.addEventListener('click', () => {
        if (currentDiffContainer.style.display !== 'none') {
          currentDiffContainer.style.display = 'none';
          return;
        }
        currentDiffContainer.style.display = 'block';
        currentDiffContainer.innerHTML = '';
        Object.assign(currentDiffContainer.style, {
          marginTop: '8px',
          borderTop: '1px solid #444',
          paddingTop: '8px',
        });

        const changes = getChanges ? getChanges() : [];
        if (changes.length === 0) {
          currentDiffContainer.innerHTML = '<div style="color:#888;font-size:11px">No unsaved changes</div>';
          return;
        }

        // Group by file
        const byFile = {};
        for (const c of changes) {
          const name = c.file.split('/').pop();
          if (!byFile[name]) byFile[name] = [];
          byFile[name].push(c);
        }

        for (const [fileName, edits] of Object.entries(byFile)) {
          const row = document.createElement('div');
          Object.assign(row.style, {
            padding: '4px 0',
            fontSize: '12px',
          });

          const nameSpan = document.createElement('span');
          nameSpan.textContent = fileName;
          nameSpan.style.color = '#8cf';

          const countSpan = document.createElement('span');
          countSpan.textContent = ` ${edits.length} edit${edits.length !== 1 ? 's' : ''}`;
          Object.assign(countSpan.style, { fontSize: '11px', color: '#999' });

          row.appendChild(nameSpan);
          row.appendChild(countSpan);
          currentDiffContainer.appendChild(row);

          // Show tag + preview for each edit
          for (const edit of edits) {
            const detail = document.createElement('div');
            const preview = edit.content.replace(/<[^>]*>/g, '').substring(0, 60);
            detail.textContent = `‹${edit.tagName}› ${preview}${edit.content.length > 60 ? '…' : ''}`;
            Object.assign(detail.style, {
              fontSize: '11px',
              color: '#777',
              paddingLeft: '8px',
              lineHeight: '1.5',
            });
            currentDiffContainer.appendChild(detail);
          }
        }
      });

      cardList.appendChild(currentCard);

      if (versionsList.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No versions yet. Save to create one.';
        empty.style.color = '#888';
        empty.style.padding = '20px';
        empty.style.textAlign = 'center';
        cardList.appendChild(empty);
        return;
      }

      // Show newest first
      const sorted = [...versionsList].sort((a, b) => b.id - a.id);
      for (const version of sorted) {
        const { card } = createVersionCard(version, {
          onRestore: restoreVersion,
          onDelete: deleteAndReload,
          onRename: renameVersion,
          onToggleDiff: (id, container) => loadDiffDetails(id, container, id === checkpointId),
          isCheckpoint: version.id === checkpointId,
        });
        cardList.appendChild(card);
      }
    } catch (err) {
      cardList.innerHTML = '';
      const errEl = document.createElement('div');
      errEl.textContent = `Error: ${err.message}`;
      errEl.style.color = '#c66';
      errEl.style.padding = '20px';
      cardList.appendChild(errEl);
    }
  }

  async function loadDiffDetails(id, container, isCheckpoint = false) {
    // Check cache
    if (detailsCache[id]) {
      renderDiffDetails(container, detailsCache[id], { onRestore: restoreVersion, onDelete: deleteAndReload, isCheckpoint });
      return;
    }

    container.innerHTML = '<div style="color:#888;font-size:11px;padding:4px">Loading diffs...</div>';
    try {
      const res = await fetch(`${API_BASE}/api/versions/${id}`);
      const details = await res.json();
      detailsCache[id] = details;
      renderDiffDetails(container, details, { onRestore: restoreVersion, onDelete: deleteAndReload, isCheckpoint });
    } catch (err) {
      container.innerHTML = `<div style="color:#c66;font-size:11px">Failed to load: ${err.message}</div>`;
    }
  }

  async function restoreVersion(id) {
    try {
      await fetch(`${API_BASE}/api/versions/${id}/restore`, { method: 'POST' });
      // Clear cache — Vite HMR will detect the restored files and full-reload the page
      Object.keys(detailsCache).forEach(k => delete detailsCache[k]);
    } catch (err) {
      console.error(`Restore failed: ${err.message}`);
    }
  }

  async function deleteAndReload(id) {
    try {
      await fetch(`${API_BASE}/api/versions/${id}`, { method: 'DELETE' });
      delete detailsCache[id];
      loadVersions();
    } catch (err) {
      console.error(`Delete failed: ${err.message}`);
    }
  }

  async function renameVersion(id, label) {
    try {
      await fetch(`${API_BASE}/api/versions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      delete detailsCache[id];
    } catch (err) {
      console.error('Rename failed:', err);
    }
  }

  function showManageMenu(anchor) {
    // Remove existing menu if any
    const existing = document.querySelector('[data-ale-manage-menu]');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.dataset.aleManageMenu = 'true';
    Object.assign(menu.style, {
      position: 'absolute',
      top: '40px',
      right: '10px',
      background: '#333',
      border: '1px solid #555',
      borderRadius: '6px',
      padding: '4px 0',
      zIndex: '10001',
      minWidth: '160px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    });

    const items = [
      { text: '🗑 Delete all versions', action: async () => {
        if (confirm('Delete ALL versions? This cannot be undone.')) {
          await fetch(`${API_BASE}/api/versions`, { method: 'DELETE' });
          Object.keys(detailsCache).forEach(k => delete detailsCache[k]);
          loadVersions();
        }
      }},
      { text: '🔄 Reset to git HEAD', action: async () => {
        if (confirm('Reset origin to latest git commit? All versions and unsaved changes will be lost.')) {
          const files = getTrackedFiles();
          if (files.length === 0) return;
          await fetch(`${API_BASE}/api/versions/reset-origin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files }),
          });
          Object.keys(detailsCache).forEach(k => delete detailsCache[k]);
          loadVersions();
        }
      }},
    ];

    for (const item of items) {
      const row = document.createElement('div');
      row.textContent = item.text;
      Object.assign(row.style, {
        padding: '6px 14px',
        cursor: 'pointer',
        fontSize: '12px',
        color: '#ddd',
      });
      row.addEventListener('mouseenter', () => { row.style.background = '#444'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'none'; });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        item.action();
      });
      menu.appendChild(row);
    }

    sidebar.appendChild(menu);

    // Close on outside click
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  return {
    show,
    hide,
    toggle,
    refresh: loadVersions,
    updatePending: () => { if (typeof updatePendingRef === 'function') updatePendingRef(); },
  };
}

/**
 * Collect all unique source files referenced on the current page.
 */
function getTrackedFiles() {
  const files = new Set();
  document.querySelectorAll('[data-source-file]').forEach(el => {
    files.add(el.getAttribute('data-source-file'));
  });
  return [...files];
}

/**
 * Create origin (v0) from files currently on the page.
 * Called once on page load.
 */
export async function createBaselineFromPage() {
  const files = getTrackedFiles();
  if (files.length === 0) return;

  try {
    await fetch(`${API_BASE}/api/versions/baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
  } catch (err) {
    console.warn('Failed to create origin:', err);
  }
}
