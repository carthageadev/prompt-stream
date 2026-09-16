import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PromptBlockData } from '../types';
import { Copy, X, Disc, Loader2, Trash2, Sparkles, Server, Plus } from 'lucide-react';
import { optimizePrompt } from '../services/optimizeService';
import { DndContext, rectIntersection, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CATEGORY_COLORS } from '../constants';

interface MixerProps {
  isOpen: boolean;
  onClose: () => void;
  blocks: PromptBlockData[];
  setMixerIds: React.Dispatch<React.SetStateAction<string[]>>;
  onReorder: (newOrder: string[]) => void;
  onTriggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onCreateTemp: () => void;
  onUpdateBlock: (id: string, updates: Partial<PromptBlockData>) => void;
  onDeleteBlock: (id: string) => void;
  onSaveAsNote: (content: string) => void;
  isOverlay?: boolean;
}

interface SortableMixerItemProps {
  block: PromptBlockData;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, val: string) => void;
}

// Optimized Item Component using React.memo
const SortableMixerItem = React.memo(({ block, index, onRemove, onUpdate }: SortableMixerItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  // Auto-focus new temp blocks
  useEffect(() => {
    if (block.isTemp && block.isNew && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [block.isNew, block.isTemp]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(block.id, e.target.value);
    // Auto-grow
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const isTemp = !!block.isTemp;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative group flex items-stretch gap-0 rounded-md overflow-hidden select-none border transition-all
        ${isDragging
          ? 'border-stone-500 bg-[#252525] shadow-2xl scale-[1.02] z-50 ring-1 ring-white/10'
          : isTemp
            ? 'border-stone-900 bg-black hover:border-stone-800' // Temp Styling: Darker than normal, subtle border
            : 'border-stone-800 bg-[#1c1c1c] hover:border-stone-600 hover:bg-[#222222]' // Standard Styling
        }
      `}
    >
      {/* DRAG HANDLE */}
      <div
        {...attributes}
        {...listeners}
        className={`w-10 border-r flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-colors
            ${isTemp ? 'bg-[#050505] border-stone-900' : 'bg-[#111111] border-stone-800 hover:bg-stone-800'}
        `}
      >
        <div className="flex flex-col gap-1 opacity-20 group-hover:opacity-50">
          <div className="w-1 h-1 bg-white rounded-full" />
          <div className="w-1 h-1 bg-white rounded-full" />
          <div className="w-1 h-1 bg-white rounded-full" />
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold tracking-tight ${isTemp ? 'text-stone-600' : 'text-stone-600'}`}>
              {isTemp ? 'STUB' : `NODE 0${index + 1}`}
            </span>
            {block.tags?.[0] && !isTemp && (
              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${CATEGORY_COLORS[block.tags[0]] || 'text-stone-500 border-stone-800'}`}>
                {block.tags[0]}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
            className="text-stone-500 hover:text-red-500 transition-colors p-1"
            title={isTemp ? "Delete Stub" : "Unmount Node"}
          >
            <X size={12} />
          </button>
        </div>

        {isTemp ? (
          <textarea
            ref={textareaRef}
            value={block.content}
            onChange={handleTextChange}
            placeholder="Type temporary instruction..."
            className="w-full bg-transparent text-[11px] font-mono text-stone-300 font-medium resize-none focus:outline-none placeholder:text-stone-700 overflow-hidden leading-tight"
            rows={2}
            spellCheck={false}
          />
        ) : (
          <p className="text-[11px] font-mono text-stone-400 font-medium line-clamp-2 leading-tight tracking-tight cursor-text select-text pointer-events-auto">
            {block.content}
          </p>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.block.id === next.block.id &&
    prev.index === next.index &&
    prev.block.content === next.block.content &&
    prev.block.tags === next.block.tags;
});

const Mixer: React.FC<MixerProps> = ({
  isOpen,
  onClose,
  blocks,
  setMixerIds,
  onReorder,
  onTriggerToast,
  onCreateTemp,
  onUpdateBlock,
  onDeleteBlock,
  onSaveAsNote,
  isOverlay = false
}) => {
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      const newOrder = (arrayMove(blocks, oldIndex, newIndex) as PromptBlockData[]).map(b => b.id);
      onReorder(newOrder);
    }
  };

  const handleRemoveItem = (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (block?.isTemp) {
      // If it's a temp block, delete it entirely from the app state
      onDeleteBlock(id);
    } else {
      // If standard block, just remove from rack (keep in library)
      setMixerIds(prev => prev.filter(mid => mid !== id));
    }
  };

  const compiledPrompt = useMemo(() => blocks.map(b => b.content).join('\n\n'), [blocks]);

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledPrompt);
    onTriggerToast("Signal copied", 'success');
  };

  const handleOptimize = async () => {
    if (!compiledPrompt) return;
    setIsCompiling(true);
    setResult(null);
    onTriggerToast('Generating optimized prompt...', 'info');
    const res = await optimizePrompt(compiledPrompt);
    if (res.error) {
      onTriggerToast('Optimization failed', 'error');
    } else {
      setResult(res.text);
      setShowResultModal(true);
      onTriggerToast('Master prompt generated!', 'success');
    }
    setIsCompiling(false);
  };

  const handleSaveAsNote = () => {
    if (result) {
      onSaveAsNote(result);
      setShowResultModal(false);
      setResult(null);
      onTriggerToast('Saved as new note!', 'success');
    }
  };

  const handleCopyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      onTriggerToast('Copied to clipboard!', 'success');
    }
  };

  return (
    <div className={`
      fixed lg:absolute top-0 right-0 h-full w-[85vw] lg:w-[420px] z-50 
      transform transition-all duration-300 ease-out bg-[#161616] text-stone-300 flex flex-col font-sans border-l border-stone-800
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      ${isOverlay ? 'shadow-[-20px_0_60px_rgba(0,0,0,0.8)]' : 'lg:shadow-none shadow-[0_0_80px_rgba(0,0,0,0.9)]'}
    `}>
      {/* RACK HEADER - Exact Card Grey (#161616) */}
      <div className="h-16 px-6 border-b border-stone-800 flex items-center justify-between shrink-0 bg-[#161616]">
        <div className="flex items-center gap-3">
          {isOverlay && (
            <button
              onClick={onClose}
              className="mr-2 p-2 -ml-2 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/10"
              title="Close Rack"
            >
              <X size={18} />
            </button>
          )}
          <Server size={18} className={blocks.length > 0 ? "text-white" : "text-stone-700"} />
          <h2 className="text-sm font-bold text-stone-200 uppercase tracking-widest">Rack</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateTemp}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-[#0a0a0a] text-stone-500 hover:text-stone-300 hover:border-stone-700 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border border-stone-900"
          >
            <Plus size={10} /> Stub
          </button>
          <div className="w-px h-4 bg-stone-800 mx-1"></div>
          <button
            onClick={() => setMixerIds([])}
            className="p-2 text-stone-600 hover:text-red-500 transition-colors"
            title="Wipe Rack"
          >
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="lg:hidden p-2 text-stone-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* COMPONENT BAY - Darker core area for depth */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0f0f0f]">
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 px-8">
            <Disc size={40} className="text-stone-800 mb-4 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-700">Rack Standby</p>
            <p className="text-[10px] text-stone-800 mt-2">Mount nodes to activate stream.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 pb-6">
                {blocks.map((block, idx) => (
                  <SortableMixerItem
                    key={block.id}
                    block={block}
                    index={idx}
                    onRemove={handleRemoveItem}
                    onUpdate={(id, val) => onUpdateBlock(id, { content: val })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* CONTROL UNIT - Card Grey (#161616) */}
      <div className="p-6 bg-[#161616] border-t border-stone-800 shrink-0 space-y-5 shadow-[0_-20px_50px_rgba(0,0,0,0.7)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Preview Buffer</span>
            <span className="text-[9px] font-mono text-stone-600">{compiledPrompt.length} chars</span>
          </div>
          <textarea
            readOnly
            value={compiledPrompt}
            className="w-full h-24 p-3 bg-[#0a0a0a] rounded-md border border-stone-800 font-mono text-[10px] text-stone-500 focus:outline-none focus:border-stone-700 resize-none custom-scrollbar leading-tight selection:bg-stone-800 selection:text-white"
            placeholder="// Awaiting signal mount..."
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={handleCopy}
            disabled={blocks.length === 0}
            className="w-full py-4 bg-white text-black rounded-md text-xs font-bold uppercase tracking-widest hover:bg-stone-200 transition-all disabled:opacity-10 disabled:grayscale flex items-center justify-center gap-2 shadow-lg"
          >
            <Copy size={14} /> Commit Signal
          </button>

          <button
            onClick={handleOptimize}
            disabled={blocks.length === 0 || isCompiling}
            className="w-full py-2 bg-[#222] border border-stone-700 text-stone-500 rounded-md text-[10px] font-bold uppercase tracking-widest hover:text-white hover:border-stone-500 transition-all flex items-center justify-center gap-2"
          >
            {isCompiling ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={14} />}
            {isCompiling ? "Generating..." : "Generate Prompt"}
          </button>
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && result && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          onClick={() => { setShowResultModal(false); setResult(null); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal Card - styled like PromptCard */}
          <div
            className="relative w-full max-w-2xl bg-[#161616] border border-stone-800 rounded-lg shadow-[0_25px_80px_rgba(0,0,0,0.8)] flex flex-col max-h-[85vh] transition-all duration-500 ease-out opacity-100 scale-100 animate-flash-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Minimal */}
            <div className="flex items-center justify-between p-5 border-b border-stone-900">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Optimized Output</span>
              <button
                onClick={() => { setShowResultModal(false); setResult(null); }}
                className="p-1 text-stone-600 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <p className="text-sm font-mono text-stone-300 whitespace-pre-wrap leading-relaxed">{result}</p>
              {/* Subtle fade at bottom */}
              <div className="sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#161616] to-transparent pointer-events-none" />
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-stone-900 flex gap-3">
              <button
                onClick={handleCopyResult}
                className="flex-1 py-3 bg-white text-black rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={handleSaveAsNote}
                className="flex-1 py-3 bg-[#0a0a0a] border border-stone-800 text-stone-400 rounded-md text-[10px] font-bold uppercase tracking-widest hover:text-white hover:border-stone-600 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={12} /> Create Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mixer;
