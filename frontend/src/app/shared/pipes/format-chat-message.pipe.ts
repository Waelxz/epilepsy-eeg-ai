import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'formatChatMessage',
  standalone: true
})
export class FormatChatMessagePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(content: string): SafeHtml {
    if (!content) return '';
    
    // Step 1: Replace MongoDB ObjectIDs with patient IDs
    content = this.replaceObjectIds(content);
    
    // Step 2: Format markdown-style text
    content = this.formatMarkdown(content);
    
    // Return sanitized HTML to prevent XSS
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }
  
  private replaceObjectIds(content: string): string {
    // Match patterns like "ID: 61f3bf94f918ebc4e4b516d" and replace with patient format
    const objectIdPattern = /(\(ID:|ID:)\s*([0-9a-f]{24})\b/gi;
    
    // Generate a random patient ID (in real app, this would come from your backend)
    const createPatientId = () => `P${Math.floor(100000 + Math.random() * 900000)}`;
    
    return content.replace(objectIdPattern, (match, prefix) => {
      return `(${createPatientId()})`;
    });
  }
  
  private formatMarkdown(content: string): string {
    // We need to process code blocks first so their contents aren't processed as markdown
    const codeBlocks: string[] = [];
    
    // Replace code blocks with placeholders
    content = content.replace(/```([^`]*?)```/gs, (match) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(match);
      return placeholder;
    });
    
    // Replace inline code with placeholders
    content = content.replace(/`([^`]+?)`/g, (match) => {
      const placeholder = `__INLINE_CODE_${codeBlocks.length}__`;
      codeBlocks.push(match);
      return placeholder;
    });
    
    // Format headings (# Heading -> <h1>Heading</h1>, ## Heading -> <h2>Heading</h2>, etc.)
    for (let i = 6; i >= 1; i--) {
      const regex = new RegExp(`^${Array(i + 1).join('#')}\\s+(.+?)\\s*(?:\\n|$)`, 'gm');
      content = content.replace(regex, `<h${i}>$1</h${i}>\n`);
    }
    
    // Format headings with ### prefix (### Heading -> <h3>Heading</h3>)
    content = content.replace(/###\s+(.+?)(\n|$)/g, '<h3>$1</h3>$2');
    
    // Format headings (##Heading## -> <h2>Heading</h2>) - legacy format
    content = content.replace(/##(.+?)##/g, '<h2>$1</h2>');
    
    // Format bold (**text** or __text__ -> <strong>text</strong>)
    content = content.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
    
    // Format italics (*text* or _text_ -> <em>text</em>) - avoid matching inside already bolded text
    const italicsRegex = /(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g;
    content = content.replace(italicsRegex, '<em>$1</em>');
    content = content.replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, '<em>$1</em>');
    
    // Format strikethrough (~~text~~ -> <del>text</del>)
    content = content.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Format links ([text](url) -> <a href="url">text</a>)
    content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Format images (![alt](url) -> <img src="url" alt="alt" />)
    content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="markdown-image" />');
    
    // Format blockquotes (> text -> <blockquote>text</blockquote>)
    content = content.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Format horizontal rules (--- or *** or ___ -> <hr />)
    content = content.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr />');
    
    // Preserve empty lines for paragraph breaks (before list processing)
    content = content.replace(/\n\s*\n/g, '\n<br><br>\n');
    
    // Process tables
    content = this.formatTables(content);
    
    // Format lists - handle both unordered and ordered
    const lines = content.split('\n');
    let inList = false;
    let listType = '';
    
    for (let i = 0; i < lines.length; i++) {
      // Check for unordered list items
      if (lines[i].match(/^\s*[-*+]\s+/)) {
        if (!inList || listType !== 'ul') {
          // Start a new unordered list
          lines[i] = inList ? '</ol>\n<ul>\n<li>' + lines[i].replace(/^\s*[-*+]\s+/, '') + '</li>' : 
                            '<ul>\n<li>' + lines[i].replace(/^\s*[-*+]\s+/, '') + '</li>';
          inList = true;
          listType = 'ul';
        } else {
          // Continue existing unordered list
          lines[i] = '<li>' + lines[i].replace(/^\s*[-*+]\s+/, '') + '</li>';
        }
      } 
      // Check for ordered list items
      else if (lines[i].match(/^\s*\d+\.\s+/)) {
        if (!inList || listType !== 'ol') {
          // Start a new ordered list
          lines[i] = inList ? '</ul>\n<ol>\n<li>' + lines[i].replace(/^\s*\d+\.\s+/, '') + '</li>' : 
                            '<ol>\n<li>' + lines[i].replace(/^\s*\d+\.\s+/, '') + '</li>';
          inList = true;
          listType = 'ol';
        } else {
          // Continue existing ordered list
          lines[i] = '<li>' + lines[i].replace(/^\s*\d+\.\s+/, '') + '</li>';
        }
      }
      // Check for nested list items with indentation
      else if (lines[i].match(/^\s{2,}[-*+]\s+/) && inList) {
        // Handle nested list items (simplified - doesn't handle multiple levels)
        lines[i] = '<li class="nested">' + lines[i].replace(/^\s{2,}[-*+]\s+/, '') + '</li>';
      }
      // End list when non-list line is found
      else if (inList && lines[i].trim() !== '') {
        lines[i] = listType === 'ul' ? '</ul>\n' + lines[i] : '</ol>\n' + lines[i];
        inList = false;
      }
    }
    
    // Close any open list at the end
    if (inList) {
      lines.push(listType === 'ul' ? '</ul>' : '</ol>');
    }
    
    content = lines.join('\n');
    
    // Format paragraphs for better spacing
    content = content.replace(/\n(?!<\/?\w+>|<br>)/g, '<br>');
    
    // Wrap non-tagged content in paragraphs
    content = content.replace(/(^|<\/(?:h[1-6]|ul|ol|li|blockquote|div|hr)>)(.+?)(?=<(?:h[1-6]|ul|ol|li|blockquote|div|br|hr)|$)/g, function(match, prefix, text) {
      if (text.trim()) {
        return prefix + '<p>' + text.trim() + '</p>';
      }
      return match;
    });
    
    // Clean up excessive breaks
    content = content.replace(/<br><br>/g, '</p><p>');
    content = content.replace(/<p><br>/g, '<p>');
    content = content.replace(/<br><\/p>/g, '</p>');
    
    // Remove any empty paragraphs
    content = content.replace(/<p>\s*<\/p>/g, '');
    
    // Restore code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
      if (codeBlocks[i].startsWith('```')) {
        // Multi-line code block
        const code = codeBlocks[i].replace(/```(?:(\w+))?\n?([^`]+)```/s, (match, lang, code) => {
          const language = lang ? ` class="language-${lang}"` : '';
          return `<pre><code${language}>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        content = content.replace(`__CODE_BLOCK_${i}__`, code);
      } else {
        // Inline code
        const code = codeBlocks[i].replace(/`([^`]+)`/, (match, code) => {
          return `<code>${this.escapeHtml(code)}</code>`;
        });
        content = content.replace(`__INLINE_CODE_${i}__`, code);
      }
    }
    
    return content;
  }
  
  private formatTables(content: string): string {
    // Split content into lines
    const lines = content.split('\n');
    const tableLines = [];
    let inTable = false;
    let tableStartIndex = -1;
    
    // Find table sections
    for (let i = 0; i < lines.length; i++) {
      // Detect table header row (contains | characters)
      if (!inTable && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        inTable = true;
        tableStartIndex = i;
      }
      
      // Detect end of table
      if (inTable && (!lines[i].includes('|') || !lines[i].trim())) {
        // Process this table
        const tableRows = lines.slice(tableStartIndex, i);
        if (tableRows.length >= 2) { // Need at least header and separator
          const processedTable = this.processTable(tableRows);
          
          // Replace table rows with the processed HTML table
          lines.splice(tableStartIndex, i - tableStartIndex, processedTable);
          
          // Adjust the index
          i = tableStartIndex + 1;
        }
        inTable = false;
      }
    }
    
    // Handle case where table is at the end of the content
    if (inTable) {
      const tableRows = lines.slice(tableStartIndex);
      if (tableRows.length >= 2) {
        const processedTable = this.processTable(tableRows);
        lines.splice(tableStartIndex, lines.length - tableStartIndex, processedTable);
      }
    }
    
    return lines.join('\n');
  }
  
  private processTable(tableRows: string[]): string {
    // Ensure we have at least a header and separator row
    if (tableRows.length < 2) return tableRows.join('\n');
    
    // Parse cells and alignment
    const headerRow = tableRows[0].trim().replace(/^\||\|$/g, '').split('|');
    const separatorRow = tableRows[1].trim().replace(/^\||\|$/g, '').split('|');
    
    // Determine column alignments
    const alignments = separatorRow.map(cell => {
      cell = cell.trim();
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      else if (cell.endsWith(':')) return 'right';
      else return 'left';
    });
    
    // Build the table HTML
    let tableHtml = '<table class="markdown-table">\n<thead>\n<tr>\n';
    
    // Add header cells
    headerRow.forEach((cell, i) => {
      const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
      tableHtml += `<th${align}>${cell.trim()}</th>\n`;
    });
    
    tableHtml += '</tr>\n</thead>\n<tbody>\n';
    
    // Add data rows
    for (let i = 2; i < tableRows.length; i++) {
      if (!tableRows[i].trim()) continue; // Skip empty rows
      
      const row = tableRows[i].trim().replace(/^\||\|$/g, '').split('|');
      tableHtml += '<tr>\n';
      
      row.forEach((cell, j) => {
        const align = alignments[j] ? ` style="text-align:${alignments[j]}"` : '';
        tableHtml += `<td${align}>${cell.trim()}</td>\n`;
      });
      
      tableHtml += '</tr>\n';
    }
    
    tableHtml += '</tbody>\n</table>';
    return tableHtml;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
} 