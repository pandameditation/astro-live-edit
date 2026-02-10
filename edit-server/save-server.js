import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import TurndownService from 'turndown';

const app = express();
app.use(express.json());
app.use(cors());

// List of HTML void elements that are self-closing by nature
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr'
]);

// Finds the entire tag (opening + content + closing) at the given (line, column) position in sourceText
function findTagAtPosition(sourceText, line, column, expectedTagName) {
  console.log(`    [findTagAtPosition] Searching for <${expectedTagName}> at line ${line}, column ${column}`);
  const lines = sourceText.split('\n');
  const lineIndex = line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    console.log(`    [findTagAtPosition] ❌ Invalid line ${line} (lineIndex=${lineIndex}, total lines=${lines.length})`);
    return null;
  }

  const tagName = expectedTagName?.toLowerCase();
  const offset = lines
    .slice(0, lineIndex)
    .reduce((acc, l) => acc + l.length + 1, 0) + (column - 1);
  
  console.log(`    [findTagAtPosition] Calculated offset=${offset} from line ${line}, column ${column}`);
  console.log(`    [findTagAtPosition] Context at offset: "${sourceText.substring(offset, offset + 50)}..."`);

  const tagRegex = new RegExp(`<${tagName}\\b[^>]*?>`, 'gi');
  tagRegex.lastIndex = 0;

  let match;
  let matchCount = 0;

  // Scan through all opening tags matching expectedTagName
  while ((match = tagRegex.exec(sourceText)) !== null) {
    matchCount++;
    const openTagStart = match.index;
    const openTagEnd = tagRegex.lastIndex;

    const isSelfClosing = VOID_ELEMENTS.has(tagName) || match[0].endsWith('/>');

    if (isSelfClosing) {
      // If the tag is self-closing, check if the cursor falls inside its bounds
      if (offset >= openTagStart && offset <= openTagEnd) {
        console.log(`    [findTagAtPosition] ✅ Found self-closing tag (match ${matchCount}) at ${openTagStart}-${openTagEnd}`);
        return {
          tagName,
          outerStart: openTagStart,
          outerEnd: openTagEnd,
          selfClosing: true
        };
      }
    } else {
      // Find the matching close tag for non-void elements
      const closeTagOffset = findMatchingCloseTag(sourceText, openTagEnd, tagName);
      if (closeTagOffset === -1) {
        console.log(`    [findTagAtPosition] No matching close tag for match ${matchCount} at ${openTagStart}`);
        continue;
      }

      const closeTagEnd = closeTagOffset + `</${tagName}>`.length;

      // Check if the cursor offset is inside the opening/closing tag range
      if (offset >= openTagEnd && offset < closeTagOffset) {
        console.log(`    [findTagAtPosition] ✅ Found matching tag (match ${matchCount}) at ${openTagStart}-${closeTagEnd}`);
        console.log(`    [findTagAtPosition] Tag content: "${sourceText.substring(openTagStart, Math.min(openTagStart + 100, closeTagEnd))}..."`);
        return {
          tagName,
          outerStart: openTagStart,
          outerEnd: closeTagEnd
        };
      }
    }
  }

  console.log(`    [findTagAtPosition] ❌ No matching tag found (scanned ${matchCount} candidates)`);
  return null; // No tag found containing the position
}

// Replace the entire tag (outerHTML) in sourceText with newContent
function replaceOuterContent(sourceText, outerStart, outerEnd, newContent) {
  return sourceText.slice(0, outerStart) + newContent + sourceText.slice(outerEnd);
}

app.post('/save', (req, res) => {
  const edits = req.body;
  if (!Array.isArray(edits)) {
    return res.status(400).send('Invalid data: expected an array');
  }

  // Debug: Request received
  console.log('\n📥 ========================================');
  console.log('📥 Save request received');
  console.log('📊 Number of edits:', edits.length);
  console.log('========================================\n');

  // Show preview of each edit
  edits.forEach((edit, idx) => {
    const preview = edit.content?.length > 150 
      ? edit.content.substring(0, 150) + '...'
      : edit.content;
    console.log(`Edit ${idx + 1}:`);
    console.log(`  File: ${edit.file}`);
    console.log(`  Location: ${edit.loc}`);
    console.log(`  Tag: ${edit.tagName}`);
    console.log(`  Content preview: ${preview}\n`);
  });

  // Group edits by file path
  const changesByFile = {};

  for (const { file, loc, content, tagName, outerContent } of edits) {
    if (!loc || typeof loc !== 'string') {
      console.warn(`⚠️  Skipping edit with invalid loc: ${loc}`);
      continue;
    }

    const [lineStr, colStr] = loc.split(':');
    const line = parseInt(lineStr, 10);
    const column = parseInt(colStr, 10);

    if (isNaN(line) || isNaN(column)) {
      console.warn(`⚠️  Skipping edit with invalid loc format: ${loc}`);
      continue;
    }

    // Normalize file path to relative from cwd
    const relPath = file.replace(process.cwd() + path.sep, '');

    if (!changesByFile[relPath]) changesByFile[relPath] = [];

    changesByFile[relPath].push({ start: { line, column }, content, tagName, outerContent });
  }

  try {
    for (const [file, changes] of Object.entries(changesByFile)) {
      console.log('\n📝 ----------------------------------------');
      console.log(`📝 Processing file: ${file}`);
      
      const fullPath = path.resolve(file);
      let sourceText = fs.readFileSync(fullPath, 'utf-8');

      const isMarkdown = fullPath.endsWith('.md') || fullPath.endsWith('.mdx');
      const isAstro = fullPath.endsWith('.astro');
      
      const fileType = isMarkdown ? (fullPath.endsWith('.mdx') ? 'MDX' : 'Markdown') : (isAstro ? 'Astro' : 'Unknown');
      console.log(`📋 File type: ${fileType}`);
      console.log(`📊 Number of changes: ${changes.length}`);
      
      const lines = sourceText.split('\n');

      if (isMarkdown) {
        const { frontmatter, offset } = extractFrontmatter(lines);
        let body = extractFrontmatter(lines).body; // Use 'let' to allow reassignment
        
        // For HTML path: work with full sourceText string
        // For Markdown path: work with body line array
        let bodyAsString = null;
        let needsStringMode = false;
        
        // Check if any change needs HTML mode
        console.log(`\n🔍 CHECKING ${changes.length} CHANGE(S) FOR ATTRIBUTES:`);
        changes.forEach(({ start, content, tagName }, i) => {
          const hasAttrs = hasAttributes(content, tagName);
          console.log(`  Change ${i + 1}: <${tagName}> hasAttributes=${hasAttrs}`);
          if (hasAttrs) {
            console.log(`    → Content preview: ${content.substring(0, 80)}...`);
            needsStringMode = true;
          }
        });
        
        if (needsStringMode) {
          console.log(`\n🔄 SWITCHING TO HTML MODE (string-based processing)`);
          // Convert body to string for findTagAtPosition
          bodyAsString = body.join('\n');
          console.log(`  Body converted to string: ${bodyAsString.length} characters`);
        } else {
          console.log(`\n📝 USING MARKDOWN MODE (line-based processing)`);
        }
        
        changes
          .sort((a, b) => b.start.line - a.start.line)
          .forEach(({ start, content, tagName }, idx) => {
            console.log(`\n  Change ${idx + 1}:`);
            console.log(`  🔍 Tag search: line ${start.line}, column ${start.column}, tag <${tagName}>`);
            
            const idx_line = start.line - 1 - offset;
            if (idx_line < 0 || idx_line >= body.length) {
              console.warn(`  ❌ Invalid line index ${idx_line} for file ${file}`);
              return;
            }

            // Check if content has HTML attributes
            const keepAsHTML = hasAttributes(content, tagName);
            const isHeading = /^h[1-6]$/i.test(tagName);
            
            if (keepAsHTML && !isHeading) {
              // HTML PATH: Use Astro-style tag finding
              console.log(`  🏷️  Tag has attributes - using Astro logic for HTML`);
              console.log(`    keepAsHTML=${keepAsHTML}, isHeading=${isHeading}`);
              console.log(`    idx_line=${idx_line}, offset=${offset}, body.length=${body.length}`);
              
              // Line number relative to body (not full file)
              const bodyLine = idx_line + 1; // Convert to 1-indexed
              console.log(`    Looking for tag at bodyLine=${bodyLine}, column=${start.column}`);
              
              const tagRange = findTagAtPosition(bodyAsString, bodyLine, start.column, tagName);
              if (!tagRange) {
                console.warn(`  ❌ Could not find tag at body line ${bodyLine}:${start.column}`);
                console.warn(`    bodyAsString length: ${bodyAsString?.length || 0}`);
                console.warn(`    First 200 chars: ${bodyAsString?.substring(0, 200) || 'NULL'}`);
                return;
              }
              
              console.log(`  ✅ Tag found at position ${tagRange.outerStart}-${tagRange.outerEnd}`);
              
              const oldContent = bodyAsString.slice(tagRange.outerStart, tagRange.outerEnd);
              const oldPreview = oldContent.length > 100 ? oldContent.substring(0, 100) + '...' : oldContent;
              
              // Collapse to single line for MDX compatibility
              const singleLineHTML = content.replace(/\n\s*/g, ' ').trim();
              const newPreview = singleLineHTML.length > 100 ? singleLineHTML.substring(0, 100) + '...' : singleLineHTML;
              
              console.log(`  🔴 OLD: ${oldPreview}`);
              console.log(`  🟢 NEW: ${newPreview}`);
              
              console.log(`    Replacing content in bodyAsString...`);
              const beforeLength = bodyAsString.length;
              // Replace in string
              bodyAsString = replaceOuterContent(bodyAsString, tagRange.outerStart, tagRange.outerEnd, singleLineHTML);
              const afterLength = bodyAsString.length;
              console.log(`    bodyAsString length: ${beforeLength} → ${afterLength} (diff: ${afterLength - beforeLength})`);
              
            } else {
              // MARKDOWN PATH: Convert to markdown syntax
              console.log(`  📝 No attributes - converting to markdown`);
              
              const innerContent = stripOuterTag(content, tagName);
              const wrapped = `<${tagName}>${innerContent}</${tagName}>`;
              const markdown = turndownWithListContext(wrapped, tagName);
              const newLines = markdown.split('\n');

              if (isHeading) {
                // Only replace the line of the heading
                const oldContent = body[idx_line];
                const oldPreview = oldContent.length > 100 ? oldContent.substring(0, 100) + '...' : oldContent;
                const newPreview = markdown.length > 100 ? markdown.substring(0, 100) + '...' : markdown;
                
                console.log(`  ✅ Tag found at line ${idx_line + offset + 1}`);
                console.log(`  🔴 OLD: ${oldPreview}`);
                console.log(`  🟢 NEW: ${newPreview}`);
                
                body.splice(idx_line, 1, ...newLines);
              } else {
                // Replace entire markdown block
                const { start: blockStart, end: blockEnd } = findMarkdownBlock(body, idx_line);
                const oldContent = body.slice(blockStart, blockEnd + 1).join('\n');
                const oldPreview = oldContent.length > 100 ? oldContent.substring(0, 100) + '...' : oldContent;
                const newPreview = markdown.length > 100 ? markdown.substring(0, 100) + '...' : markdown;
                
                console.log(`  ✅ Tag found at block lines ${blockStart + offset + 1}-${blockEnd + offset + 1}`);
                console.log(`  🔴 OLD: ${oldPreview}`);
                console.log(`  🟢 NEW: ${newPreview}`);
                
                body.splice(blockStart, blockEnd - blockStart + 1, ...newLines);
              }
            }
          });
        
        // If we used string mode, convert back to lines
        if (needsStringMode && bodyAsString !== null) {
          console.log(`\n🔄 CONVERTING BACK TO LINES (string → array)`);
          console.log(`  bodyAsString length: ${bodyAsString.length}`);
          const linesBefore = body.length;
          body = bodyAsString.split('\n');
          console.log(`  body lines: ${linesBefore} → ${body.length}`);
          console.log(`  First 3 lines after conversion:`);
          body.slice(0, 3).forEach((line, i) => {
            console.log(`    ${i + 1}: ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
          });
        }
        
        const finalOutput = [...frontmatter, ...body].join('\n');
        console.log(`\n📦 FINAL OUTPUT: ${finalOutput.length} characters, ${frontmatter.length + body.length} lines`);
        console.log(`  Frontmatter lines: ${frontmatter.length}`);
        console.log(`  Body lines: ${body.length}`);
        
        fs.writeFileSync(fullPath, finalOutput, 'utf-8');
        console.log(`\n💾 File saved: ${file}`);
        
        // Verify write
        const verifyContent = fs.readFileSync(fullPath, 'utf-8');
        console.log(`✅ Verification: File on disk is ${verifyContent.length} characters`);
        if (verifyContent === finalOutput) {
          console.log(`✅ Write verified: Content matches what we wrote`);
        } else {
          console.error(`❌ Write mismatch: Disk content differs from what we tried to write!`);
        }
      } else if (isAstro) {
        // For Astro files: find tag by start line/column and replace entire tag (outerHTML)
        changes
          .sort((a, b) => b.start.line - a.start.line)
          .forEach(({ start, content, tagName }, idx) => {
            console.log(`\n  Change ${idx + 1}:`);
            console.log(`  🔍 Tag search: line ${start.line}, column ${start.column}, tag <${tagName}>`);
            
            const tagRange = findTagAtPosition(sourceText, start.line, start.column, tagName);
            if (!tagRange) {
              console.warn(`  ❌ Could not find tag at ${file}:${start.line}:${start.column}`);
              return;
            }

            console.log(`  ✅ Tag found at position ${tagRange.outerStart}-${tagRange.outerEnd}`);
            
            const oldContent = sourceText.slice(tagRange.outerStart, tagRange.outerEnd);
            
            // Safety net: skip if original content contains {…} template expressions
            const innerContent = oldContent.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');
            if (/\{[^}]+\}/.test(innerContent)) {
              console.log(`  ⚠️  SKIPPED: original content contains dynamic expression: ${innerContent.substring(0, 80)}`);
              return;
            }
            
            const oldPreview = oldContent.length > 100 ? oldContent.substring(0, 100) + '...' : oldContent;
            const newPreview = content.length > 100 ? content.substring(0, 100) + '...' : content;
            
            console.log(`  🔴 OLD: ${oldPreview}`);
            console.log(`  🟢 NEW: ${newPreview}`);

            sourceText = replaceOuterContent(sourceText, tagRange.outerStart, tagRange.outerEnd, content);
          });

        fs.writeFileSync(fullPath, sourceText, 'utf-8');
        console.log(`\n💾 File saved: ${file}`);
      }
      
      console.log('----------------------------------------');
    }

    console.log('\n✅ ========================================');
    console.log('✅ All changes saved successfully!');
    console.log('========================================\n');
    res.sendStatus(200);
  } catch (err) {
    console.error('\n❌ ========================================');
    console.error('❌ Error saving file:');
    console.error(err);
    console.error('========================================\n');
    res.status(500).send('Failed to save');
  }
});

app.listen(3000, () => {
  console.log('Edit server running at http://localhost:3000');
});

//###########################
//**** UTILITY FONCTIONS ****
//###########################

// Strip outer tag from outerHTML to get innerHTML
function stripOuterTag(outerHTML, tagName) {
  const openTagRegex = new RegExp(`^<${tagName}\\b[^>]*>`, 'i');
  const closeTagRegex = new RegExp(`</${tagName}>$`, 'i');
  
  let result = outerHTML.trim();
  result = result.replace(openTagRegex, '');
  result = result.replace(closeTagRegex, '');
  
  return result;
}

// Check if outerHTML has any attributes
function hasAttributes(outerHTML, tagName) {
  const openTagRegex = new RegExp(`^<${tagName}\\b([^>]*?)(/?)>`, 'i');
  const match = outerHTML.trim().match(openTagRegex);
  
  if (!match) {
    console.log(`    [hasAttributes] No match for <${tagName}> in: ${outerHTML.substring(0, 50)}...`);
    return false;
  }
  
  const attributesPart = match[1].trim();
  const hasAttrs = attributesPart.length > 0;
  console.log(`    [hasAttributes] <${tagName}> attributes="${attributesPart}" → ${hasAttrs}`);
  // If there's anything between tag name and closing >, it's an attribute
  return hasAttrs;
}

function preserveMarkdownPrefix(originalLine, newContent) {
  // Regex to capture common Markdown prefixes (headers, lists, blockquotes)
  const mdPrefixMatch = originalLine.match(/^(\s*(#{1,6}\s|[-*+]\s|>\s))/);
  if (mdPrefixMatch) {
    const prefix = mdPrefixMatch[1];
    return prefix + newContent;
  }
  // No markdown prefix found, just replace whole line
  return newContent;
}


function cleanHtmlToMarkdown(html) {
  if (typeof html !== 'string') return html;

  // Decode HTML entities
  html = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Replace <div><br></div> or any <div> with only whitespace and <br> inside with a double line break
  html = html.replace(/<div>\s*(<br\s*\/?>)?\s*<\/div>/gi, '\n\n');

  // Replace <div>some content</div> with \n + content + \n
  html = html.replace(/<div>(.*?)<\/div>/gis, (_, inner) => {
    return '\n' + inner.trim() + '\n';
  });

  // Strip all remaining HTML tags (but preserve inner text)
  html = html.replace(/<\/?[^>]+>/g, '');

  // Collapse multiple line breaks to max two
  html = html.replace(/\n{3,}/g, '\n\n');

  // Final trim
  return html.trim();
}

// Nesting-aware search for matching close tag
function findMatchingCloseTag(sourceText, startOffset, tagName) {
  const tagRegex = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}>`, 'gi');
  tagRegex.lastIndex = startOffset;

  let depth = 1;
  let match;

  while ((match = tagRegex.exec(sourceText)) !== null) {
    if (match[0].startsWith('</')) {
      depth--;
      if (depth === 0) return match.index;
    } else {
      depth++;
    }
  }

  return -1; // Not found
}

function turndownWithListContext(html, parentTag) {
  const turndown = new TurndownService({
    headingStyle: 'atx',         // Use `## Heading` style
    bulletListMarker: '-',       // Use dash for bullet lists
    codeBlockStyle: 'fenced',    // Use triple-backtick code blocks
    emDelimiter: '*',            // Use `*italic*`
    strongDelimiter: '**',       // Use `**bold**`
    hr: '---',                   // Horizontal rule style
    br: '  \n',                  // Line break: double space + newline
  });

  // Disable default list handling for nesting support
  turndown.remove('list');
  turndown.remove('listItem');

  // Custom rendering for <ul> and <ol>
  turndown.addRule('customList', {
    filter: ['ul', 'ol'],
    replacement: function (_content, node) {
      return renderList(node, 0);
    }
  });


  // Recursive rendering of lists with depth
  function renderList(node, depth) {
    const isOrdered = node.nodeName.toLowerCase() === 'ol';
    const items = Array.from(node.children).filter(c => c.nodeName.toLowerCase() === 'li');

    return items
      .map((li, i) => {
        const bullet = isOrdered ? `${i + 1}. ` : '- ';
        const indent = '    '.repeat(depth);

        const chunks = [];
        let hasNonListContent = false;

        for (const child of li.childNodes) {
          const tag = child.nodeName.toLowerCase();

          if (tag === 'ul' || tag === 'ol') {
            // Recursive nested list
            const nested = renderList(child, depth + 1);
            if (nested.trim()) {
              chunks.push('\n' + nested);
            }
          } else {
            const rendered = turndown.turndown(child.outerHTML || child.textContent || '');
            if (rendered.trim()) {
              hasNonListContent = true;
              chunks.push(rendered.trim());
            }
          }
        }

        if (!hasNonListContent && chunks.length === 0) {
          // ❌ skip empty <li> (no text content and no nested list)
          return '';
        }

        const body = chunks.join('').trim();
        return `${indent}${bullet}${body}`;
      })
      .filter(Boolean) // Remove empty strings
      .join('\n');
  }



  turndown.addRule('smartBrHandling', {
    filter: 'br',
    replacement: function (content, node, options) {
      const prev = node.previousSibling;
      const next = node.nextSibling;

      const prevIsText = prev && prev.nodeType === 3 && prev.textContent.trim().length > 0;
      const nextIsText = next && next.nodeType === 3 && next.textContent.trim().length > 0;

      if (prevIsText || nextIsText) {
        // Inline <br/>
        return '<br/>';
      } else {
        // Block-level break (e.g. <div><br/></div>)
        return '\n\n';
      }
    }
  });


  return turndown.turndown(html);
}

function findMarkdownBlock(lines, startIndex) {
  const isBlank = line => line.trim() === '';
  const isListItem = line => /^(\s*)([-+*]|\d+\.)\s+/.test(line);
  const isHeading = line => /^#{1,6}\s+/.test(line);
  const isCodeFence = line => /^```/.test(line);
  const isIndentedCode = line => /^ {4,}\S/.test(line);
  const isBlockquote = line => /^\s*>/.test(line);
  const isHtmlTag = line => /^\s*<[^ >]+.*?>/.test(line); // naive HTML/JSX block start
  const isMDXComponent = line => /^\s*<[A-Z][A-Za-z0-9]*\b/.test(line); // <Component>

  const currentLine = lines[startIndex];

  // Detect block type
  let blockType = 'paragraph';

  if (isListItem(currentLine)) blockType = 'list';
  else if (isHeading(currentLine)) blockType = 'heading';
  else if (isCodeFence(currentLine)) blockType = 'codeFence';
  else if (isIndentedCode(currentLine)) blockType = 'codeIndent';
  else if (isBlockquote(currentLine)) blockType = 'blockquote';
  else if (isMDXComponent(currentLine)) blockType = 'mdx';
  else if (isHtmlTag(currentLine)) blockType = 'html';

  let start = startIndex;
  let end = startIndex;

  // Helper to check if a line belongs to the same block
  function belongsToBlock(line) {
    if (isBlank(line)) return false;

    switch (blockType) {
      case 'list': return isListItem(line);
      case 'heading': return false; // headings are single-line
      case 'codeFence': return !isCodeFence(line);
      case 'codeIndent': return isIndentedCode(line);
      case 'blockquote': return isBlockquote(line);
      case 'html': return isHtmlTag(line) || !isBlank(line);
      case 'mdx': return isMDXComponent(line) || !isBlank(line);
      case 'paragraph':
      default:
        return (
          !isListItem(line) &&
          !isHeading(line) &&
          !isCodeFence(line) &&
          !isIndentedCode(line) &&
          !isBlockquote(line) &&
          !isMDXComponent(line) &&
          !isHtmlTag(line)
        );
    }
  }

  // Go backward
  for (let i = startIndex - 1; i >= 0; i--) {
    if (!belongsToBlock(lines[i])) break;
    start = i;
  }

  // Go forward
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (!belongsToBlock(lines[i])) break;
    end = i;
  }

  return { start, end, blockType };
}

function extractFrontmatter(lines) {
  if (lines[0].trim() === '---') {
    const endIndex = lines.slice(1).findIndex(line => line.trim() === '---');
    if (endIndex !== -1) {
      const frontmatterEnd = endIndex + 1;
      return {
        frontmatter: lines.slice(0, frontmatterEnd + 1),
        body: lines.slice(frontmatterEnd + 1),
        offset: frontmatterEnd + 1
      };
    }
  }
  return { frontmatter: [], body: lines, offset: 0 };
}

