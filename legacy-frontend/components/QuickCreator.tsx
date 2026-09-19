import React, { useState, useRef, useEffect } from 'react';
import { X, CornerDownLeft, Sparkles } from 'lucide-react';
import gsap from 'gsap';

interface QuickCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
}

const QuickCreator: React.FC<QuickCreatorProps> = ({ isOpen, onClose, onSubmit }) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setContent('');
      if (textareaRef.current) textareaRef.current.focus();
      
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(containerRef.current, 
        { scale: 0.95, y: 10, opacity: 0 }, 
        { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }
      );
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
        onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        ref={backdropRef}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-2xl bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border)] bg-[var(--app-surface-2)]">
            <h2 className="text-lg font-bold text-[var(--app-text-strong)] flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--app-text-subtle)]" />
                Quick Prompt
            </h2>
            <button onClick={onClose} className="text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] p-1 rounded-md transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Input Area */}
        <textarea 
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your instruction, context, or persona here..."
            className="w-full h-64 p-8 text-xl font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)] focus:outline-none resize-none leading-relaxed bg-[var(--app-surface)]"
            spellCheck={false}
        />

        {/* Footer / Actions */}
        <div className="px-6 py-4 bg-[var(--app-surface-2)] border-t border-[var(--app-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--app-text-subtle)] uppercase tracking-widest font-bold">
                    Add tags after saving
                </span>
            </div>
            
            <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--app-text-subtle)] hidden sm:inline-block">Cmd + Enter to save</span>
                <button 
                    onClick={handleSubmit}
                    disabled={!content.trim()}
                    className="flex items-center gap-2 px-6 py-2 bg-[var(--app-accent)] text-[var(--app-inverse)] rounded-lg font-medium hover:bg-[var(--app-text-strong)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                    Add to Stream <CornerDownLeft size={16} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default QuickCreator;
