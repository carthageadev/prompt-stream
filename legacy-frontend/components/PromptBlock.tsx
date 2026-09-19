import React, { useEffect, useRef, useState } from 'react';
import { PromptBlockData } from '../types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Tag, PenLine, Plus, Copy, Trash2 } from 'lucide-react';
import gsap from 'gsap';

interface PromptBlockProps {
  block: PromptBlockData;
  onUpdateContent: (id: string, newContent: string) => void;
  onUpdateTitle: (id: string, newTitle: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const PromptBlock: React.FC<PromptBlockProps> = ({ 
    block, 
    onUpdateContent, 
    onUpdateTitle, 
    onAddTag, 
    onRemoveTag,
    onRemove, 
    onDuplicate 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tempTitle, setTempTitle] = useState(block.title);
  const [newTag, setNewTag] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [block.content]);

  // Gravity Entry Animation
  useEffect(() => {
    if (block.isNew && blockRef.current) {
      gsap.fromTo(blockRef.current, 
        { y: -60, scale: 0.95, opacity: 0 },
        { 
          y: 0, 
          scale: 1, 
          opacity: 1, 
          duration: 0.5, 
          ease: "back.out(1.2)",
          clearProps: "all"
        }
      );
    }
  }, [block.isNew]);

  const handleTitleSubmit = () => {
    if (tempTitle.trim()) {
      onUpdateTitle(block.id, tempTitle);
    } else {
      setTempTitle(block.title); // Revert if empty
    }
    setIsEditingTitle(false);
  };

  const handleTagSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newTag.trim()) {
      onAddTag(block.id, newTag.trim());
      setNewTag('');
      setIsAddingTag(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group mb-6 transition-opacity touch-action-none ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      {/* Block Container */}
      <div 
        ref={blockRef}
        className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      >
        {/* Header / Toolbar */}
        <div className="flex items-start justify-between p-3 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <div 
              {...attributes} 
              {...listeners} 
              className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 p-2 -ml-2 rounded touch-none"
            >
              <GripVertical size={18} />
            </div>

            <div className="flex flex-col min-w-0">
               {/* Editable Title */}
               {isEditingTitle ? (
                 <input 
                   autoFocus
                   value={tempTitle}
                   onChange={(e) => setTempTitle(e.target.value)}
                   onBlur={handleTitleSubmit}
                   onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                   className="font-serif font-medium text-lg text-stone-900 bg-white border border-stone-300 rounded px-1 -ml-1 focus:ring-1 focus:ring-stone-400 outline-none w-full max-w-[200px]"
                 />
               ) : (
                 <div className="flex items-center gap-2 group/title">
                    <h3 
                      onDoubleClick={() => setIsEditingTitle(true)}
                      className="font-serif font-medium text-lg text-stone-900 cursor-text truncate"
                    >
                      {block.title}
                    </h3>
                    <button 
                      onClick={() => setIsEditingTitle(true)}
                      className="opacity-0 group-hover/title:opacity-100 text-stone-400 hover:text-stone-600 transition-opacity"
                    >
                      <PenLine size={12} />
                    </button>
                 </div>
               )}
               
               <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 truncate">
                  {block.type} Module
               </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
                onClick={() => onDuplicate(block.id)}
                className="text-stone-400 hover:text-stone-700 p-2 rounded-md hover:bg-stone-100 transition-all"
                title="Duplicate Block"
            >
                <Copy size={14} />
            </button>
            <button 
                onClick={() => onRemove(block.id)}
                className="text-stone-400 hover:text-red-500 p-2 rounded-md hover:bg-stone-100 transition-all"
                title="Remove Block"
            >
                <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 relative bg-white">
            <textarea
              ref={textareaRef}
              value={block.content}
              onChange={(e) => onUpdateContent(block.id, e.target.value)}
              className="w-full bg-transparent text-stone-800 text-sm font-mono focus:outline-none resize-none min-h-[60px] leading-relaxed placeholder:text-stone-300"
              placeholder="Enter your prompt instructions..."
              spellCheck={false}
            />
        </div>

        {/* Footer / Tags */}
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center flex-wrap gap-2 min-h-[40px]">
            {block.tags && block.tags.map((tag, idx) => (
                <button 
                    key={idx} 
                    onClick={() => onRemoveTag(block.id, tag)}
                    className="group/tag inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-200 text-stone-600 hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer"
                    title="Remove tag"
                >
                    {tag}
                    <X size={8} className="opacity-0 group-hover/tag:opacity-100" />
                </button>
            ))}
            
            {isAddingTag ? (
                <form onSubmit={handleTagSubmit} className="flex items-center">
                    <input 
                        autoFocus
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onBlur={() => !newTag ? setIsAddingTag(false) : handleTagSubmit()}
                        placeholder="Tag..."
                        className="w-20 bg-white border border-stone-300 rounded px-1.5 py-0.5 text-xs text-stone-700 outline-none focus:border-stone-500"
                    />
                </form>
            ) : (
                <button 
                    onClick={() => setIsAddingTag(true)}
                    className="flex items-center gap-1 text-[10px] font-medium text-stone-400 hover:text-stone-700 transition-colors px-1.5 py-0.5 rounded hover:bg-stone-200/50"
                >
                    <Plus size={10} /> Add Tag
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default PromptBlock;