// Version Card Component
// Renders a single version entry with timestamp, label, file count,
// and expandable diff detail.

export function createVersionCard(version, { onRestore, onDelete, onRename, onToggleDiff }) {
  const card = document.createElement('div');
  card.dataset.versionId = version.id;
  Object.assign(card.style, {
    padding: '10px 12px',
    marginBottom: '8px',
    background: version.id === 0 ? '#1a2a1a' : '#2a2a2a',
    borderRadius: '6px',
    borderLeft: '3px solid ' + (version.id === 0 ? '#4a8' : '#666'),
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontSize: '13px',
    color: '#ddd',
  });

  card.addEventListener('mouseenter', () => { card.style.background = '#3a3a3a'; });
  card.addEventListener('mouseleave', () => { card.style.background = version.id === 0 ? '#1a2a1a' : '#2a2a2a'; });

  // Header row: version ID + timestamp
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  });

  const idBadge = document.createElement('span');
  idBadge.textContent = `v${version.id}`;
  Object.assign(idBadge.style, {
    background: '#555',
    color: '#fff',
    padding: '1px 6px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
  });

  const time = document.createElement('span');
  const date = new Date(version.timestamp);
  time.textContent = formatTime(date);
  time.title = date.toLocaleString();
  Object.assign(time.style, {
    fontSize: '11px',
    color: '#999',
  });

  header.appendChild(idBadge);
  header.appendChild(time);
  card.appendChild(header);

  // Label (editable on double-click)
  const label = document.createElement('div');
  label.textContent = version.label;
  Object.assign(label.style, {
    fontSize: '13px',
    marginBottom: '4px',
    color: '#eee',
  });
  label.title = 'Double-click to rename';
  label.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = version.label;
    Object.assign(input.style, {
      width: '100%',
      background: '#444',
      border: '1px solid #666',
      color: '#fff',
      padding: '2px 4px',
      borderRadius: '3px',
      fontSize: '13px',
      boxSizing: 'border-box',
    });
    label.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newLabel = input.value.trim() || version.label;
      version.label = newLabel;
      label.textContent = newLabel;
      input.replaceWith(label);
      if (newLabel !== version.label) onRename(version.id, newLabel);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') commit();
      if (ev.key === 'Escape') { input.replaceWith(label); }
    });
  });
  card.appendChild(label);

  // File count
  const meta = document.createElement('div');
  meta.textContent = `${version.fileCount} file${version.fileCount !== 1 ? 's' : ''}`;
  Object.assign(meta.style, {
    fontSize: '11px',
    color: '#888',
  });
  card.appendChild(meta);

  // Diff container (expandable, initially hidden)
  const diffContainer = document.createElement('div');
  diffContainer.style.display = 'none';
  card.appendChild(diffContainer);

  // Click to expand/collapse diffs
  card.addEventListener('click', () => {
    if (diffContainer.style.display === 'none') {
      onToggleDiff(version.id, diffContainer);
      diffContainer.style.display = 'block';
    } else {
      diffContainer.style.display = 'none';
    }
  });

  return { card, diffContainer };
}

/**
 * Render diff details into a container
 */
export function renderDiffDetails(container, details, { onRestore, onDelete }) {
  container.innerHTML = '';
  Object.assign(container.style, {
    marginTop: '8px',
    borderTop: '1px solid #444',
    paddingTop: '8px',
  });

  if (!details.diffs || details.diffs.length === 0) {
    const noChanges = document.createElement('div');
    noChanges.textContent = 'No changes in this version';
    noChanges.style.color = '#888';
    noChanges.style.fontSize = '11px';
    container.appendChild(noChanges);
    return;
  }

  // List files with diffs
  for (const fileDiff of details.diffs) {
    const fileRow = document.createElement('div');
    Object.assign(fileRow.style, {
      padding: '4px 0',
      cursor: 'pointer',
      fontSize: '12px',
    });

    const fileName = document.createElement('span');
    fileName.textContent = fileDiff.file;
    fileName.style.color = '#8cf';

    const stats = document.createElement('span');
    stats.textContent = ` +${fileDiff.stats.added} -${fileDiff.stats.removed}`;
    Object.assign(stats.style, {
      fontSize: '11px',
      color: fileDiff.stats.added > 0 ? '#6c6' : '#c66',
    });

    fileRow.appendChild(fileName);
    fileRow.appendChild(stats);

    // Expandable diff lines
    const diffLines = document.createElement('pre');
    Object.assign(diffLines.style, {
      display: 'none',
      background: '#1a1a1a',
      padding: '6px',
      borderRadius: '4px',
      fontSize: '11px',
      lineHeight: '1.4',
      overflowX: 'auto',
      margin: '4px 0',
      maxHeight: '200px',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    });

    // Render hunk lines
    for (const hunk of fileDiff.hunks) {
      for (const line of hunk.lines) {
        const span = document.createElement('span');
        span.style.display = 'block';
        if (line.type === 'add') {
          span.textContent = `+ ${line.line}`;
          span.style.color = '#6c6';
          span.style.background = 'rgba(0,100,0,0.15)';
        } else if (line.type === 'remove') {
          span.textContent = `- ${line.line}`;
          span.style.color = '#c66';
          span.style.background = 'rgba(100,0,0,0.15)';
        } else {
          span.textContent = `  ${line.line}`;
          span.style.color = '#888';
        }
        diffLines.appendChild(span);
      }
    }

    fileRow.addEventListener('click', (e) => {
      e.stopPropagation();
      diffLines.style.display = diffLines.style.display === 'none' ? 'block' : 'none';
    });

    container.appendChild(fileRow);
    container.appendChild(diffLines);
  }

  // Action buttons row
  const actionsRow = document.createElement('div');
  Object.assign(actionsRow.style, {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  });

  // Restore button
  const restoreBtn = document.createElement('button');
  restoreBtn.textContent = '↩ Restore this version';
  Object.assign(restoreBtn.style, {
    flex: '1',
    padding: '4px 10px',
    background: '#3a5a3a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  });
  restoreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Restore to v${details.id}? Current files will be saved as a new version first.`)) {
      onRestore(details.id);
    }
  });

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '🗑';
  Object.assign(deleteBtn.style, {
    padding: '4px 10px',
    background: '#5a2a2a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  });
  deleteBtn.title = 'Delete this version';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Delete v${details.id}? This cannot be undone.`)) {
      onDelete(details.id);
    }
  });

  actionsRow.appendChild(restoreBtn);
  actionsRow.appendChild(deleteBtn);
  container.appendChild(actionsRow);
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}
