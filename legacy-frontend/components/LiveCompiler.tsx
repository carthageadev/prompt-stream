import React, { useEffect, useRef, useState } from 'react';
import { PromptBlockData } from '../types';
import { Copy, Check, X } from 'lucide-react';
import gsap from 'gsap';

interface LiveCompilerProps {
  blocks: PromptBlockData[];
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const LiveCompiler: React.FC<LiveCompilerProps> = ({
  blocks,
  isOpen,
  onClose,
  onTriggerToast,
}) => {
  const [compiledText, setCompiledText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Compile prompt
  useEffect(() => {
    const text = blocks.map((b) => b.content).join('\n\n');
    setCompiledText(text);
  }, [blocks]);

  // "Fusion" Animation & Copy
  const handleCopy = () => {
    const tl = gsap.timeline();

    // 1. Button Press
    tl.to(btnRef.current, {
      scale: 0.98,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
    });

    // 2. Paper Flash
    tl.fromTo(
      outputRef.current,
      { backgroundColor: '#ffffff' },
      { backgroundColor: '#f0f9ff', duration: 0.2, yoyo: true, repeat: 1 }
    );

    navigator.clipboard.writeText(compiledText);
    setIsCopied(true);
    onTriggerToast('Fused prompt copied to clipboard', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Main Container */}
      <div
        className={`
        fixed lg:static inset-y-0 right-0 z-40
        h-full bg-stone-50 border-l border-stone-200 
        shadow-2xl lg:shadow-none
        transform transition-all duration-300 ease-in-out
        ${
          isOpen
            ? 'translate-x-0 w-96'
            : 'translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:overflow-hidden'
        }
        flex flex-col font-sans
      `}
      >
        {/* Wrapper for fixed width content */}
        <div className='w-96 h-full flex flex-col'>
          <div className='p-6 pb-4 border-b border-stone-200 bg-stone-50 flex justify-between items-start'>
            <div>
              <h2 className='text-3xl font-serif font-medium text-stone-900 tracking-tight flex items-center gap-2'>
                Compiler
              </h2>
              <p className='text-xs text-stone-500 mt-1 uppercase tracking-wider font-medium'>
                Live Output Preview
              </p>
            </div>
            <button
              onClick={onClose}
              className='lg:hidden p-2 -mr-2 text-stone-400 hover:text-stone-900 transition-colors'
            >
              <X size={20} />
            </button>
          </div>

          <div className='flex-1 flex flex-col p-6 overflow-hidden'>
            {/* Output Area */}
            <div className='flex-1 flex flex-col min-h-0'>
              <div className='flex justify-between items-center mb-2'>
                <span className='text-[10px] font-bold tracking-widest text-stone-400'>
                  SOURCE
                </span>
                <span className='text-xs font-mono text-stone-400'>
                  {blocks.length} BLOCKS
                </span>
              </div>

              <div
                ref={outputRef}
                className='flex-1 bg-white rounded-xl border border-stone-200 shadow-sm p-5 font-mono text-xs text-stone-700 leading-relaxed whitespace-pre-wrap overflow-y-auto custom-scrollbar select-text transition-colors'
              >
                {compiledText || (
                  <span className='text-stone-300 italic font-serif'>
                    Awaiting input stream...
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className='mt-6 flex flex-col gap-3'>
              <button
                ref={btnRef}
                onClick={handleCopy}
                disabled={!compiledText}
                className={`w-full py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  isCopied
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-900 hover:bg-black text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isCopied ? (
                  <>
                    <Check size={16} /> <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>FUSE & COPY</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LiveCompiler;
