import React, { useRef, useEffect } from 'react';
import { Template } from '../types';
import { ICON_MAP, CATEGORY_COLORS } from '../constants';
import { X, Search } from 'lucide-react';
import gsap from 'gsap';

interface LibraryOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  onSelect: (t: Template) => void;
}

const LibraryOverlay: React.FC<LibraryOverlayProps> = ({ isOpen, onClose, templates, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      gsap.fromTo(containerRef.current, 
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" }
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end lg:items-center justify-center p-0 lg:p-8">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        ref={containerRef}
        className="relative w-full max-w-4xl bg-stone-50 rounded-t-[2rem] lg:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl h-[85vh]"
      >
        <div className="px-10 py-8 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-4xl font-serif italic text-stone-900">Add Module</h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900"><X size={32} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((template, idx) => {
                const Icon = ICON_MAP[template.icon] || ICON_MAP['Sparkles'];
                return (
                  <button
                    key={idx}
                    onClick={() => onSelect(template)}
                    className="group flex items-start gap-6 p-6 bg-white border border-stone-200 rounded-3xl text-left transition-all hover:border-stone-400 hover:shadow-xl hover:-translate-y-1 active:scale-95"
                  >
                    <div className="p-4 bg-stone-50 rounded-2xl text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <Icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif text-2xl text-stone-900 group-hover:italic transition-all">{template.title}</h4>
                      <p className="text-sm text-stone-500 mt-1">{template.description}</p>
                      <div className="mt-3">
                         <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 border rounded-lg ${CATEGORY_COLORS[template.category]}`}>
                           {template.category}
                         </span>
                      </div>
                    </div>
                  </button>
                );
              })}
           </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryOverlay;