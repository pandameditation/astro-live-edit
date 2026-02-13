// Save Button Component
// A "menu button" with a main Save action and a chevron to open version history.
// Replaces the old plain save button from live-edit.js.

export function createSaveButton({ onSave, onToggleVersions }) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '10000',
    display: 'flex',
    alignItems: 'stretch',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    transition: 'box-shadow 0.3s ease',
  });

  // Main save button
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 Save';
  Object.assign(saveBtn.style, {
    padding: '10px 16px',
    background: '#222',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
  });
  saveBtn.addEventListener('click', onSave);

  // Chevron button for version history
  const chevronBtn = document.createElement('button');
  chevronBtn.textContent = '▸';
  let panelOpen = false;
  Object.assign(chevronBtn.style, {
    padding: '10px 10px',
    background: '#333',
    color: '#fff',
    border: 'none',
    borderLeft: '1px solid #555',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    transition: 'transform 0.3s ease',
    display: 'inline-block',
  });
  chevronBtn.title = 'Version history';
  chevronBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    chevronBtn.style.transform = panelOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    onToggleVersions();
  });

  container.appendChild(saveBtn);
  container.appendChild(chevronBtn);
  document.body.appendChild(container);

  return {
    container,
    saveBtn,
    chevronBtn,
    setUnsaved(hasChanges) {
      if (hasChanges) {
        saveBtn.textContent = '💾 Save •';
        container.style.boxShadow = '0 0 8px 2px rgba(255, 200, 0, 0.6)';
      } else {
        saveBtn.textContent = '💾 Save';
        container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      }
    }
  };
}
