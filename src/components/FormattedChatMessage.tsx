import React from 'react';

export interface FormattedChatMessageProps {
  content: string;
  className?: string;
}

// Parses inline tokens: bold-italic, bold, italic, code, links
export function parseInlineText(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match:
  // 1. ***bold-italic***
  // 2. **bold**
  // 3. *italic*
  // 4. `code`
  // 5. [text](url)
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${match.index}-${token.length}`;

    if (token.startsWith('***') && token.endsWith('***') && token.length >= 6) {
      parts.push(
        <strong key={key}>
          <em>{parseInlineText(token.slice(3, -3))}</em>
        </strong>
      );
    } else if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      parts.push(<strong key={key}>{parseInlineText(token.slice(2, -2))}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      parts.push(<em key={key}>{parseInlineText(token.slice(1, -1))}</em>);
    } else if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      parts.push(
        <code key={key} className="chat-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const closingBracket = token.indexOf('](');
      const label = token.slice(1, closingBracket);
      const url = token.slice(closingBracket + 2, -1);
      if (/^(https?:|mailto:)/i.test(url)) {
        // The Electron main process routes target=_blank to the system browser
        parts.push(
          <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="chat-link">
            {label}
          </a>
        );
      } else {
        parts.push(label);
      }
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

interface BlockListItem {
  indent: number;
  text: string;
}

export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({ content, className }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  let elementIndex = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks: ```
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++; // Skip opening ```
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++; // Skip closing ```
      }
      elements.push(
        <pre key={`code-${elementIndex++}`} className="chat-code-block">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // 2. Empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 3. Headers: #, ##, ###
    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const parsed = parseInlineText(text);
      if (level === 1) {
        elements.push(
          <h4 key={`h1-${elementIndex++}`} className="chat-header h1">
            {parsed}
          </h4>
        );
      } else if (level === 2) {
        elements.push(
          <h5 key={`h2-${elementIndex++}`} className="chat-header h2">
            {parsed}
          </h5>
        );
      } else {
        elements.push(
          <h6 key={`h3-${elementIndex++}`} className="chat-header h3">
            {parsed}
          </h6>
        );
      }
      i++;
      continue;
    }

    // 4. Blockquotes: > quote
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${elementIndex++}`} className="chat-blockquote">
          {quoteLines.map((ql, qIdx) => (
            <React.Fragment key={qIdx}>
              {parseInlineText(ql)}
              {qIdx < quoteLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered list: - item or * item
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulMatch) {
      const items: BlockListItem[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)([-*+])\s+(.*)$/);
        if (!itemMatch) break;
        items.push({
          indent: Math.floor(itemMatch[1].length / 2),
          text: itemMatch[3],
        });
        i++;
      }
      elements.push(
        <ul key={`ul-${elementIndex++}`} className="chat-list chat-ul">
          {items.map((item, itemIdx) => (
            <li
              key={itemIdx}
              className="chat-list-item"
              style={item.indent > 0 ? { marginLeft: `${item.indent * 14}px` } : undefined}
            >
              {parseInlineText(item.text)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Ordered list: 1. item
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const items: BlockListItem[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (!itemMatch) break;
        items.push({
          indent: Math.floor(itemMatch[1].length / 2),
          text: itemMatch[3],
        });
        i++;
      }
      elements.push(
        <ol key={`ol-${elementIndex++}`} className="chat-list chat-ol">
          {items.map((item, itemIdx) => (
            <li
              key={itemIdx}
              className="chat-list-item"
              style={item.indent > 0 ? { marginLeft: `${item.indent * 14}px` } : undefined}
            >
              {parseInlineText(item.text)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Regular paragraph (gather consecutive non-empty lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].match(/^(#{1,3})\s+(.*)$/) &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].match(/^(\s*)([-*+])\s+(.*)$/) &&
      !lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      elements.push(
        <p key={`p-${elementIndex++}`} className="chat-paragraph">
          {paraLines.map((pl, pIdx) => (
            <React.Fragment key={pIdx}>
              {parseInlineText(pl)}
              {pIdx < paraLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return <div className={`formatted-chat-message ${className || ''}`}>{elements}</div>;
};

export default FormattedChatMessage;
