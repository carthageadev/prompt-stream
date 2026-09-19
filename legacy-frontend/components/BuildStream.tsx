import React from 'react';
import { PromptBlockData } from '../types';
import PromptBlock from './PromptBlock';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Trash2, Menu, PanelRight } from 'lucide-react';

interface BuildStreamProps {
  blocks: PromptBlockData[];
  setBlocks: React.Dispatch<React.SetStateAction<PromptBlockData[]>>;
  onUpdateBlockContent: (id: string, newContent: string) => void;
  onUpdateBlockTitle: (id: string, newTitle: string) => void;
  onAddBlockTag: (id: string, tag: string) => void;
  onRemoveBlockTag: (id: string, tag: string) => void;
  onRemoveBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onClearAll: () => void;
  // Toggles
  isLibraryOpen: boolean;
  toggleLibrary: () => void;
  isCompilerOpen: boolean;
  toggleCompiler: () => void;
}

const BuildStream: React.FC<BuildStreamProps> = ({ 
  blocks, 
  setBlocks, 
  onUpdateBlockContent, 
  onUpdateBlockTitle, 
  onAddBlockTag, 
  onRemoveBlockTag,
  onRemoveBlock,
  onDuplicateBlock,
  onClearAll,
  isLibraryOpen,
  toggleLibrary,
  isCompilerOpen,
  toggleCompiler
}) => {
  // Use TouchSensor for mobile drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags on click)
      },
    }),
    useSensor(TouchSensor, {
        activationConstraint: {
            delay: 250, // Slight delay for touch to differentiate scroll vs drag
            tolerance: 5,
        }
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="flex-1 h-full bg-[#FAFAF9] flex flex-col relative overflow-hidden">
      {/* Background Dot Pattern */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" style={{
        backgroundImage: `radial-gradient(#d6d3d1 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }}></div>

      {/* Header Toolbar (Visible on Desktop, hidden on Mobile in favor of App header) */}
      <div className="hidden lg:flex items-center justify-between px-6 py-4 z-10 sticky top-0 bg-[#FAFAF9]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleLibrary}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${isLibraryOpen ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-200 hover:text-stone-800'}`}
                title="Toggle Library"
            >
                <Menu size={20} />
                <span className={isLibraryOpen ? 'hidden xl:inline' : 'hidden'}>Library</span>
            </button>
        </div>
        
        <div className="text-center">
            {/* Center Logo/Title can go here if desired, or kept in the main scroll area */}
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={toggleCompiler}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${isCompilerOpen ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-200 hover:text-stone-800'}`}
                title="Toggle Compiler"
            >
                <span className={isCompilerOpen ? 'hidden xl:inline' : 'hidden'}>Compiler</span>
                <PanelRight size={20} />
            </button>
        </div>
      </div>

      {/* Stream Container */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-0">
        <div className="max-w-3xl mx-auto min-h-[500px] pb-32 pt-4 lg:pt-12">
          
          <div className="text-center mb-8 lg:mb-12 flex flex-col items-center">
            <h1 className="text-4xl lg:text-6xl font-serif text-stone-900 tracking-tight mb-3">PromptStream</h1>
            <p className="text-stone-500 text-sm font-medium tracking-wide uppercase">Architecture for Intelligence</p>
            
            {blocks.length > 0 && (
                <button 
                    onClick={onClearAll}
                    className="mt-6 text-xs flex items-center gap-1 text-stone-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 size={12} /> Clear Canvas
                </button>
            )}
          </div>

          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={blocks.map(b => b.id)} 
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6 lg:px-4">
                {blocks.map((block) => (
                    <PromptBlock
                    key={block.id}
                    block={block}
                    onUpdateContent={onUpdateBlockContent}
                    onUpdateTitle={onUpdateBlockTitle}
                    onAddTag={onAddBlockTag}
                    onRemoveTag={onRemoveBlockTag}
                    onRemove={onRemoveBlock}
                    onDuplicate={onDuplicateBlock}
                    />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {blocks.length === 0 && (
            <div className="mx-4 lg:mx-0 border border-dashed border-stone-300 bg-stone-50/50 rounded-xl p-8 lg:p-20 text-center transition-all hover:border-stone-400">
              <p className="font-serif italic text-2xl text-stone-400 mb-4">The canvas is empty.</p>
              <div className="flex flex-col gap-3 items-center">
                  <p className="text-sm text-stone-500">Paste text to create a block instantly (Ctrl+V)</p>
                  <span className="text-stone-300 text-xs">- OR -</span>
                  <button 
                    onClick={toggleLibrary}
                    className="text-stone-800 font-medium underline underline-offset-4 decoration-stone-300 hover:decoration-stone-800 transition-all"
                  >
                    Open Library
                  </button>
              </div>
            </div>
          )}
          
          {/* Connector to bottom (visual flair) */}
          {blocks.length > 0 && (
             <div className="w-px h-16 bg-gradient-to-b from-stone-300 to-transparent mx-auto mt-2"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuildStream;