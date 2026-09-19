import React, { useState } from 'react';
import { PromptBlockData, TagColor } from '../types';
import { Check, Copy, Maximize2, GitBranch, Layers, Plus, Minus } from 'lucide-react';
import { getTagColorClasses } from '../constants';

interface PromptCardProps {
  block: PromptBlockData;
  isVisible: boolean;
  tagColors: Map<string, TagColor>;
  stackName?: string;
  showStackOrder: boolean;
  semanticReason?: string;
  onClick: () => void;
  isInRack?: boolean;
  onToggleRack?: (id: string) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  block,
  isVisible,
  tagColors,
  stackName,
  showStackOrder,
  semanticReason,
  onClick,
  isInRack = false,
  onToggleRack,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(block.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Combine visibility and deleting for the visual state
  const isActive = isVisible && !block.isDeleting;

  return (
    <button
      type='button'
      className={`
        break-inside-avoid w-full group relative bg-[var(--app-surface-2)] border rounded-lg 
        transition-all duration-500 ease-in-out cursor-pointer flex flex-col gap-2 overflow-hidden
        ${
          isActive
            ? 'opacity-100 scale-100 max-h-[800px] p-4 mb-4'
            : 'opacity-0 scale-90 max-h-0 p-0 mb-0 border-0 pointer-events-none translate-y-4 shadow-none'
        }
        ${
          'border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:shadow-lg hover:-translate-y-1 hover:bg-[var(--app-surface-3)]'
        }
        ${block.isNew && isVisible ? 'animate-flash-border' : ''}
      `}
      onClick={onClick}
    >
      {/* HEADER: Tags + Stack Order */}
      <div className='flex items-center justify-between min-h-[24px]'>
        <div className='flex flex-wrap gap-1.5 max-w-[80%]'>
          {/* Stack Order Badge */}
          {showStackOrder &&
            block.stackId &&
            block.stackOrder !== undefined && (
            <span className='text-[9px] px-2 py-0.5 rounded border bg-[var(--app-surface-3)] text-[var(--app-text-strong)] border-[var(--app-border-strong)] font-bold'>
              #{block.stackOrder}
            </span>
          )}

          {block.parentPromptId && (
            <span className='text-[9px] px-2 py-0.5 rounded border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text-subtle)] font-bold uppercase tracking-wider inline-flex items-center gap-1'>
              <GitBranch size={10} />
              Fork
            </span>
          )}

          {block.tags && block.tags.length > 0 ? (
            block.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getTagColorClasses(
                  tag,
                  tagColors
                )}`}
              >
                {tag}
              </span>
            ))
          ) : (
            <span className='text-[9px] px-2 py-0.5 rounded border border-[var(--app-border)] text-[var(--app-text-subtle)] font-bold uppercase tracking-wider'>
              Untagged
            </span>
          )}
        </div>

        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={handleCopy}
            className='p-1.5 text-[var(--app-text-subtle)] opacity-80 transition-all hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text-strong)] group-hover:opacity-100'
            title='Copy to Clipboard'
          >
            {copied ? (
              <Check size={16} className='text-emerald-500' />
            ) : (
              <Copy size={16} />
            )}
          </button>

          {onToggleRack && (
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                onToggleRack(block.id);
              }}
              className={`p-1.5 transition-all hover:bg-[var(--app-surface-3)] group-hover:opacity-100 ${
                isInRack
                  ? 'text-emerald-500 opacity-100'
                  : 'text-[var(--app-text-subtle)] opacity-80 hover:text-[var(--app-text-strong)]'
              }`}
              title={isInRack ? 'Unmount from Rack' : 'Mount to Rack'}
            >
              {isInRack ? <Minus size={16} /> : <Plus size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* CONTENT PREVIEW */}
      <div className='relative'>
        <p
          className='text-sm font-mono font-medium leading-relaxed text-[var(--app-text)] line-clamp-[8] whitespace-pre-wrap opacity-80'
        >
          {block.content || (
            <span className='text-[var(--app-text-subtle)] italic'>
              Empty note...
            </span>
          )}
        </p>
        {/* Subtle Fade for dark mode */}
        <div className='absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--app-surface-2)] to-transparent pointer-events-none'></div>
      </div>

      {/* FOOTER */}
      {stackName && (
        <div className='pt-2 mt-auto flex items-center justify-between border-t border-[var(--app-border)]'>
          <div className='flex items-center gap-2'>
            <span className='flex items-center gap-1 text-[9px] text-[var(--app-text-subtle)]'>
              <Layers size={10} />
              {stackName}
            </span>
            {semanticReason && (
              <span className='text-[9px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
                {semanticReason}
              </span>
            )}
          </div>
          <Maximize2
            size={12}
            className='text-[var(--app-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity'
          />
        </div>
      )}

      {!stackName && semanticReason && (
        <div className='pt-2 mt-auto border-t border-[var(--app-border)]'>
          <span className='text-[9px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
            {semanticReason}
          </span>
        </div>
      )}
    </button>
  );
};

export default PromptCard;
