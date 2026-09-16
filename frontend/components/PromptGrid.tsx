import React from 'react';
import { PromptBlockData, Stack, TagColor } from '../types';
import PromptCard from './PromptCard';
import { Clipboard } from 'lucide-react';

interface PromptGridProps {
  blocks: PromptBlockData[];
  visibleBlockIds: Set<string>;
  columnCount: number;
  tagColors: Map<string, TagColor>;
  stacks: Stack[];
  activeStackId: string | null;
  semanticReasons?: Map<string, string>;
  onFocus: (id: string) => void;
  onAdd: () => void;
  mixerIds?: string[];
  onToggleRack?: (id: string) => void;
}

const PromptGrid: React.FC<PromptGridProps> = ({
  blocks,
  visibleBlockIds,
  columnCount,
  tagColors,
  stacks,
  activeStackId,
  semanticReasons,
  onFocus,
  onAdd,
  mixerIds = [],
  onToggleRack,
}) => {
  // Create a map for stack id -> name lookup
  const stackMap = new Map(stacks.map((s) => [s.id, s.name]));

  // Even with seed data, if user deletes all, show empty state
  if (blocks.length === 0) {
    return (
      <div
        className='h-full flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in duration-700 fill-mode-forwards'
        style={{ minHeight: '60vh' }}
      >
        <div className='w-16 h-16 bg-[var(--app-surface-3)] border border-[var(--app-border)] rounded-2xl flex items-center justify-center mb-6 text-[var(--app-text-subtle)]'>
          <Clipboard size={32} />
        </div>
        <h2 className='text-3xl font-serif font-medium text-[var(--app-text)] mb-3'>
          Canvas Empty
        </h2>
        <p className='text-[var(--app-text-subtle)] max-w-sm leading-relaxed mb-8'>
          Paste text directly (
          <code className='bg-[var(--app-surface-3)] px-1 py-0.5 rounded text-[var(--app-text-muted)] font-mono text-xs font-bold'>
            Cmd+V
          </code>
          ) or click below.
        </p>
        <button
          type='button'
          onClick={onAdd}
          className='text-sm font-bold text-[var(--app-text-muted)] border-b border-[var(--app-border-strong)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] transition-colors pb-0.5'
        >
          Create First Prompt
        </button>
      </div>
    );
  }

  // Map number to specific Tailwind class to ensure PurgeCSS/JIT includes them
  const getColumnsClass = (count: number) => {
    switch (count) {
      case 1:
        return 'sm:columns-1 max-w-3xl'; // Keep single column centered and readable
      case 2:
        return 'lg:columns-2'; // Full width
      case 3:
        return 'lg:columns-3'; // Full width
      case 4:
        return 'xl:columns-4'; // Full width
      case 5:
        return '2xl:columns-5'; // Full width
      default:
        return 'xl:columns-4';
    }
  };

  return (
    <div
      className={`mx-auto gap-6 space-y-6 pb-32 pt-4 transition-all duration-300 columns-1 ${getColumnsClass(
        columnCount
      )}`}
    >
      {blocks.map((block) => (
        <PromptCard
          key={block.id}
          block={block}
          isVisible={visibleBlockIds.has(block.id)}
          tagColors={tagColors}
          stackName={block.stackId ? stackMap.get(block.stackId) : undefined}
          showStackOrder={activeStackId !== null}
          semanticReason={semanticReasons?.get(block.id)}
          onClick={() => onFocus(block.id)}
          isInRack={mixerIds.includes(block.id)}
          onToggleRack={onToggleRack}
        />
      ))}
    </div>
  );
};

export default PromptGrid;
