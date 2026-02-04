# Astro Live Edit System

A starter repository demonstrating live in-browser editing for Astro, Markdown, and MDX files with real-time file saving.

## Architecture Overview

This project consists of two main systems working together:

### 1. Astro Frontend (Main Project)
- **Purpose**: Serves the website with live-editable content
- **Key mechanism**: Injects `data-source-file` and `data-source-loc` attributes into rendered HTML elements during development
- **Live editing**: Client-side script (`/public/live-edit.js`) makes all editable elements contenteditable and tracks changes

### 2. Edit Server (Backend)
- **Location**: `edit-server/` directory (separate Node.js app)
- **Purpose**: Receives edited content from browser and writes it back to source files
- **Port**: Runs on `localhost:3000`
- **Handles**: .astro, .md, and .mdx file modifications

### Source Location Tracking System

The system tracks source locations through multiple layers:

1. **Remark plugin** (`astro.config.mjs`): Adds `data-source-file` and `data-source-loc` to markdown/MDX AST nodes during build
2. **Astro's built-in tracking**: Automatically adds `data-astro-source-file` and `data-astro-source-loc` to .astro components
3. **SourceMap component** (`src/components/SourceMap.astro`): Normalizes all tracking attributes to `data-source-file` and `data-source-loc`
4. **Live edit script**: Uses these attributes to locate content in source files when saving

### File Editing Logic

**For Markdown/MDX files** (`edit-server/save-server.js`):
- Preserves frontmatter (YAML between `---` delimiters)
- Converts HTML back to Markdown using Turndown
- Replaces entire blocks (paragraphs, lists, headings) rather than single lines
- Custom list handling preserves nesting and indentation

**For Astro files**:
- Finds the tag at the specified line/column using regex
- Replaces only the inner content of the tag, preserving the tag structure
- Handles nested tags and self-closing elements

## Build & Development Commands

```bash
# Install dependencies (both root and edit-server)
npm run install:all

# Development mode (Astro dev server only)
npm run dev

# Development with live editing (recommended)
npm run dev:edit  # Runs both Astro dev server and edit server concurrently

# Edit server only
npm run edit-server

# Production build
npm run build

# Preview production build
npm run preview
```

## Key File Locations

- **Live edit client**: `/public/live-edit.js` - Handles contenteditable, change tracking, and sending edits to server
- **Edit server**: `edit-server/save-server.js` - Receives POST requests and writes to source files
- **Remark plugin**: `astro.config.mjs` - Injects source tracking into markdown AST
- **SourceMap component**: `src/components/SourceMap.astro` - Normalizes source attributes, injected in BaseLayout
- **Content files**: 
  - Pages: `src/pages/` (.astro, .md)
  - Reusable content: `src/redactional/` (.md, .mdx)

## Important Conventions

### Development Mode Only
- Source tracking attributes are **only added in development** (`isDev` checks throughout)
- SourceMap component and live-edit.js are only loaded when `import.meta.env.DEV` is true
- The remark plugin is conditionally applied based on `process.env.NODE_ENV === 'development'`

### Source Location Format
- `data-source-loc`: Format is `"line:column"` (e.g., `"15:3"`)
- Line numbers are 1-indexed
- Used to locate exact position in source files for targeted replacements

### Editable Element Types
Configured in `/public/live-edit.js`:
```javascript
const editableTags = 'p, span, ul, ol, div, blockquote, h1, h2, h3, h4, h5, h6';
```

### List Indentation
- Lists get a `data-indentable` class automatically
- Tab/Shift+Tab indent/outdent list items
- Maintains proper nesting when moving items between levels

### Change Detection
- Uses WeakMap to track last saved state
- Only sends changed elements to server on blur
- Batches multiple edits, sending all changes when "💾 Save" button is clicked

### HTML Cleaning
Before sending to server, the client:
1. Removes `data-source-*` and `contenteditable` attributes
2. Removes `data-indentable` class
3. Converts `<div>` wrappers to `<br/>` (browser editing artifact)
4. Beautifies HTML with indentation

### Markdown Block Detection
The server identifies block boundaries using these rules:
- **Headings**: Single line only
- **Lists**: Consecutive lines starting with `- ` or `1. `
- **Code fences**: Between ` ``` ` markers
- **Blockquotes**: Lines starting with `>`
- **Paragraphs**: Until blank line or another block type starts

### Tag Finding Algorithm
For .astro files, the server:
1. Converts line:column to character offset
2. Searches for opening tags matching expected tag name
3. For void elements (br, img, etc.) or self-closing tags: matches the tag itself
4. For regular elements: finds matching closing tag with nesting awareness
5. Replaces only the inner content between tags

## API Contract

**POST** `http://localhost:3000/save`

Request body (array of edits):
```json
[
  {
    "file": "/absolute/path/to/file.md",
    "loc": "15:3",
    "tagName": "p",
    "content": "<p>New HTML content</p>"
  }
]
```

Response: 
- `200` on success
- `400` for invalid data
- `500` for file system errors

## MDX Support

MDX files are treated like Markdown files:
- Same frontmatter preservation
- Same block detection logic
- Turndown conversion from HTML back to Markdown
- Can include JSX components in content

## Troubleshooting

### Changes not saving
- Ensure edit server is running (`npm run edit-server` or `npm run dev:edit`)
- Check browser console for fetch errors
- Verify `data-source-file` and `data-source-loc` attributes are present on elements

### Wrong content being replaced
- Source location tracking depends on file not being modified outside the browser during session
- If file is edited externally, locations become stale—restart dev server

### Lists losing structure
- The Turndown service has custom rules for nested lists
- Ensure list items maintain proper HTML structure before saving
- Check `renderList` function in `save-server.js` for nesting logic
