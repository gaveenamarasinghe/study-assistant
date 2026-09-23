import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlightTerms?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  highlightTerms = false,
}) => {
  if (!content) return null;

  // Split into paragraphs / blocks
  const blocks = content.split(/\n\s*\n/);

  return (
    <div className={`space-y-3.5 text-stone-800 leading-relaxed text-[15px] ${className}`}>
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Check for blockquote
        if (trimmed.startsWith('>')) {
          const quoteText = trimmed.replace(/^>\s*/gm, '');
          return (
            <blockquote
              key={index}
              className="border-l-3 border-amber-600 pl-4 py-1 text-stone-700 italic bg-amber-50/50 rounded-r-md"
            >
              {renderInline(quoteText, highlightTerms)}
            </blockquote>
          );
        }

        // Check for numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const lines = trimmed.split('\n');
          return (
            <ol key={index} className="list-decimal pl-5 space-y-1.5 marker:text-amber-700 marker:font-medium">
              {lines.map((line, lIdx) => {
                const itemText = line.replace(/^\d+\.\s*/, '');
                return <li key={lIdx}>{renderInline(itemText, highlightTerms)}</li>;
              })}
            </ol>
          );
        }

        // Check for unordered list
        if (/^[-*]\s/.test(trimmed)) {
          const lines = trimmed.split('\n');
          return (
            <ul key={index} className="list-disc pl-5 space-y-1.5 marker:text-amber-700">
              {lines.map((line, lIdx) => {
                const itemText = line.replace(/^[-*]\s*/, '');
                return <li key={lIdx}>{renderInline(itemText, highlightTerms)}</li>;
              })}
            </ul>
          );
        }

        // Check for code / formula block
        if (trimmed.startsWith('```')) {
          const codeContent = trimmed.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
          return (
            <div key={index} className="my-2 p-3 bg-stone-900 text-stone-100 rounded-lg text-xs font-mono-code overflow-x-auto shadow-sm">
              <code>{codeContent}</code>
            </div>
          );
        }

        // Check for heading 3 or 4
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={index} className="text-base font-semibold text-stone-900 pt-2 font-display">
              {trimmed.replace(/^###\s+/, '')}
            </h4>
          );
        }

        // Standard paragraph
        return <p key={index}>{renderInline(trimmed, highlightTerms)}</p>;
      })}
    </div>
  );
};

function renderInline(text: string, highlightTerms: boolean): React.ReactNode {
  // Process bold: **text**
  // Process inline code: `code`
  // Process italic: *text*
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const boldText = token.slice(2, -2);
      parts.push(
        <strong
          key={match.index}
          className={`font-semibold text-stone-900 ${
            highlightTerms ? 'bg-amber-100/90 px-1 py-0.5 rounded text-amber-950 font-bold' : ''
          }`}
        >
          {boldText}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="font-mono-code text-xs bg-stone-100 text-amber-900 px-1.5 py-0.5 rounded border border-stone-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic text-stone-800">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
