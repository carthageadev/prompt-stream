import React, { useRef, useLayoutEffect, useState, useMemo, useEffect } from 'react';
import { ICON_MAP, CATEGORIES, CATEGORY_COLORS, CATEGORY_ACTIVE_COLORS } from '../constants';
import { Template } from '../types';
import { Plus, Search, X, Settings2 } from 'lucide-react';
import gsap from 'gsap';

interface BlockLibraryProps {
  onAddBlock: (template: Template) => void;
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  onOpenManager: () => void;
}

const BlockLibrary: React.FC<BlockLibraryProps> = ({ 
    onAddBlock, 
    isOpen, 
    onClose, 
    templates,
    onOpenManager 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // CMD+K Hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (isOpen) {
             e.preventDefault();
             searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, templates]);

  // Animate items when category changes
  useLayoutEffect(() => {
    // Only animate if the container is visible/mounted
    if (!isOpen) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(".library-item", 
        { y: 15, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.03,
          duration: 0.3,
          ease: "power2.out"
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [activeCategory, searchQuery, isOpen, templates]);

  return (
    <>
      {/* Backdrop for mobile only */}
      <div 
        className={`fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Main Container - Collapsible on Desktop, Off-canvas on Mobile */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        h-full bg-stone-50 border-r border-stone-200 
        shadow-2xl lg:shadow-none
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-80' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:overflow-hidden'}
      `}>
        {/* Content Wrapper to maintain width during transition */}
        <div className="w-80 h-full flex flex-col">
            {/* Header */}
            <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-serif font-medium text-stone-900 tracking-tight">
                Library
                </h2>
                <div className="flex items-center gap-1">
                    <button 
                    onClick={onOpenManager}
                    className="p-2 text-stone-400 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-200/50"
                    title="Manage Library Presets"
                    >
                    <Settings2 size={18} />
                    </button>
                    <button 
                    onClick={onClose}
                    className="lg:hidden p-2 text-stone-400 hover:text-stone-900 transition-colors"
                    >
                    <X size={20} />
                    </button>
                </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-4 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-800 transition-colors" size={14} />
                <input 
                ref={searchInputRef}
                type="text"
                placeholder="Search (Cmd+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-lg py-2 pl-9 pr-3 text-xs font-medium text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 transition-all shadow-sm placeholder:text-stone-400"
                />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar mask-gradient">
                <button
                    onClick={() => setActiveCategory('All')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-all whitespace-nowrap ${
                    activeCategory === 'All' 
                        ? CATEGORY_ACTIVE_COLORS['All']
                        : CATEGORY_COLORS['All']
                    }`}
                >
                    All
                </button>
                {CATEGORIES.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-all whitespace-nowrap ${
                    activeCategory === cat 
                        ? CATEGORY_ACTIVE_COLORS[cat]
                        : CATEGORY_COLORS[cat]
                    }`}
                >
                    {cat}
                </button>
                ))}
            </div>
            </div>

            <div className="h-px bg-stone-200 mx-6 mb-2"></div>

            {/* List */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-6 pt-2 space-y-3 custom-scrollbar">
            {filteredTemplates.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm italic">
                No blocks found matching filters.
                </div>
            ) : (
                filteredTemplates.map((template, idx) => {
                const Icon = ICON_MAP[template.icon] || ICON_MAP['Sparkles'];
                const badgeColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS['Logic'];
                
                return (
                    <button
                    key={`${template.title}-${idx}`}
                    onClick={() => {
                        onAddBlock(template);
                        // On mobile, close drawer after adding
                        if (window.innerWidth < 1024) onClose(); 
                    }}
                    className="library-item w-full group relative flex flex-col items-start p-3.5 rounded-xl bg-white border border-stone-200 hover:border-stone-400 hover:shadow-md transition-all duration-300 text-left overflow-hidden active:scale-[0.98]"
                    >
                    <div className="flex items-center w-full justify-between mb-2">
                        <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-stone-50 rounded-md text-stone-600 group-hover:bg-stone-100 transition-colors">
                            <Icon size={16} />
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${badgeColor}`}>
                            {template.category}
                        </span>
                        </div>
                        <Plus size={16} className="text-stone-300 group-hover:text-stone-900 transition-colors" />
                    </div>
                    
                    <h3 className="font-serif text-lg text-stone-900 mb-0.5 group-hover:text-black leading-tight">
                        {template.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2">
                        {template.description}
                    </p>
                    </button>
                );
                })
            )}
            </div>
        </div>
      </div>
    </>
  );
};

export default BlockLibrary;