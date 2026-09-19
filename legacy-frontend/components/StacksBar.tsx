import React, { useState } from 'react';
import { Plus, X, Layers, Check } from 'lucide-react';
import { Stack } from '../types';

interface StacksBarProps {
  stacks: Stack[];
  activeStackId: string | null;
  onSelectStack: (stackId: string | null) => void;
  onCreateStack: (name: string) => void;
  onDeleteStack: (stackId: string) => void;
  onRenameStack: (stackId: string, name: string) => void;
}

const StacksBar: React.FC<StacksBarProps> = ({
  stacks,
  activeStackId,
  onSelectStack,
  onCreateStack,
  onDeleteStack,
  onRenameStack,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newStackName, setNewStackName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = () => {
    if (newStackName.trim()) {
      onCreateStack(newStackName.trim());
      setNewStackName('');
      setIsCreating(false);
    }
  };

  const handleStartEdit = (stack: Stack) => {
    setEditingId(stack.id);
    setEditName(stack.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameStack(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className='flex min-w-0 items-center gap-2 px-4 sm:px-6 py-2 bg-[var(--app-bg)] border-b border-[var(--app-border)] overflow-x-auto custom-scrollbar shrink-0'>
      {/* Stacks Label */}
      <div className='flex items-center gap-1.5 text-[var(--app-text-subtle)] shrink-0'>
        <Layers size={14} />
        <span className='text-[10px] font-bold uppercase tracking-widest'>
          Stacks
        </span>
      </div>

      <div className='w-px h-4 bg-[var(--app-border)] shrink-0' />

      {/* All Prompts Tab */}
      <button
        onClick={() => onSelectStack(null)}
        className={`
          text-[10px] px-4 py-2 rounded-lg font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 border
          ${
            activeStackId === null
              ? 'bg-[var(--app-accent)] text-[var(--app-inverse)] border-[var(--app-accent)] shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105'
              : 'text-[var(--app-text-subtle)] border-[var(--app-border)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-3)]'
          }
        `}
      >
        All
      </button>

      {/* Stacks */}
      {stacks.map((stack) => (
        <div key={stack.id} className='relative group shrink-0'>
          {editingId === stack.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') setEditingId(null);
              }}
              className='text-[10px] px-4 py-2 rounded-lg font-black uppercase tracking-widest bg-[var(--app-surface-3)] border border-[var(--app-border-strong)] text-[var(--app-text-strong)] outline-none w-32'
            />
          ) : (
            <button
              onClick={() => onSelectStack(stack.id)}
              onDoubleClick={() => handleStartEdit(stack)}
              className={`
                text-[10px] px-4 py-2 rounded-lg font-black uppercase tracking-widest transition-all whitespace-nowrap border
                ${
                  activeStackId === stack.id
                    ? 'bg-[var(--app-text-strong)] text-[var(--app-inverse)] border-[var(--app-text-strong)] shadow-xl scale-105'
                    : 'text-[var(--app-text-subtle)] border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]'
                }
              `}
            >
              {stack.name}
            </button>
          )}

          {/* Delete button on hover */}
          {activeStackId === stack.id && editingId !== stack.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteStack(stack.id);
              }}
              className='absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-10'
              title='Purge Stack'
            >
              <X size={10} className='text-white' />
            </button>
          )}
        </div>
      ))}

      {/* Create New Stack */}
      {isCreating ? (
        <div className='flex items-center gap-2 shrink-0 bg-[var(--app-surface-2)] border border-[var(--app-border)] px-2.5 py-1.5 rounded-lg'>
          <input
            autoFocus
            value={newStackName}
            onChange={(e) => setNewStackName(e.target.value)}
            onBlur={() => {
              if (!newStackName.trim()) setIsCreating(false);
              else handleCreate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewStackName('');
              }
            }}
            placeholder='Stack name'
            className='text-[11px] bg-transparent text-[var(--app-text-strong)] outline-none w-28 placeholder:text-[var(--app-text-subtle)]'
          />
          <button
            onClick={handleCreate}
            className='p-1 rounded-md bg-[var(--app-accent)] text-[var(--app-inverse)] hover:bg-[var(--app-text-strong)] transition-colors'
            title='Create Stack'
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] px-2 py-1 rounded border border-dashed border-[var(--app-border-strong)] hover:border-[var(--app-border-strong)] transition-all shrink-0'
        >
          <Plus size={12} />
          New Stack
        </button>
      )}
    </div>
  );
};

export default StacksBar;
