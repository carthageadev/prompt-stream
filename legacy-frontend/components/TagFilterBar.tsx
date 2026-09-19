import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getTagColorClasses } from '../constants';
import { TagColor } from '../types';

interface TagFilterBarProps {
  allTags: string[];
  activeTags: string[];
  tagColors: Map<string, TagColor>;
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
}

const TagFilterBar: React.FC<TagFilterBarProps> = ({
  allTags,
  activeTags,
  tagColors,
  onToggleTag,
  onClearAll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollAffordance = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollAffordance();
    el.addEventListener('scroll', updateScrollAffordance, { passive: true });
    window.addEventListener('resize', updateScrollAffordance);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateScrollAffordance);
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', updateScrollAffordance);
      window.removeEventListener('resize', updateScrollAffordance);
      resizeObserver?.disconnect();
    };
  }, [updateScrollAffordance]);

  useEffect(() => {
    const raf = requestAnimationFrame(updateScrollAffordance);
    return () => cancelAnimationFrame(raf);
  }, [allTags.length, activeTags.length, updateScrollAffordance]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth',
    });
  };

  if (allTags.length === 0) return null;

  return (
    <div className='flex min-w-0 items-center gap-3 px-4 py-3 sm:px-6 bg-[var(--app-bg)] backdrop-blur-sm border-b border-[var(--app-border)] shrink-0'>
      {/* Left Label */}
      <div className='flex items-center gap-2 shrink-0'>
        <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
          Tags
        </span>
        <div className='w-px h-4 bg-[var(--app-border)]' />
      </div>

      {/* Scrollable Center */}
      <div className='relative flex-1 min-w-0'>
        <div
          ref={scrollRef}
          className='flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth'
        >
          <div className='flex items-center gap-2 flex-nowrap min-w-max pr-6'>
            {allTags.map((tag) => {
              const isActive = activeTags.includes(tag);
              const baseClasses = getTagColorClasses(tag, tagColors, isActive);

              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`
                    ${baseClasses} text-[10px] px-3 py-1 rounded-full border font-black uppercase tracking-wider 
                    transition-colors duration-200 whitespace-nowrap shrink-0
                    ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-90'}
                  `}
                >
                  <span className='leading-none'>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {canScrollLeft && (
          <div className='pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--app-bg)] to-transparent z-10' />
        )}
        {canScrollRight && (
          <div className='pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--app-bg)] to-transparent z-10' />
        )}

        <div className='pointer-events-none absolute inset-y-0 left-0 right-0 z-20 hidden sm:flex items-center justify-between px-1'>
          {canScrollLeft ? (
            <button
              onClick={() => scrollByAmount('left')}
              className='pointer-events-auto h-6 w-6 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)]/90 text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)] transition-colors flex items-center justify-center'
              aria-label='Scroll tags left'
            >
              <ChevronLeft size={12} />
            </button>
          ) : (
            <span />
          )}

          {canScrollRight && (
            <button
              onClick={() => scrollByAmount('right')}
              className='pointer-events-auto h-6 w-6 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)]/90 text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)] transition-colors flex items-center justify-center'
              aria-label='Scroll tags right'
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Right Reset (Fixed) */}
      <div className='shrink-0'>
        {activeTags.length > 0 && (
          <button
            onClick={onClearAll}
            className='flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] px-3 py-1.5 rounded-md hover:bg-[var(--app-surface-3)] transition-all'
          >
            <X size={12} className='opacity-50' />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default TagFilterBar;
