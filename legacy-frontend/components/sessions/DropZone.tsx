import React from 'react';
import { ImagePlus } from 'lucide-react';

interface DropZoneProps {
  active: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ active }) => {
  return (
    <div
      aria-hidden={!active}
      className={`pointer-events-none fixed inset-0 z-[90] transition-opacity duration-[180ms] motion-reduce:transition-none ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className='absolute inset-0 bg-black/40 backdrop-blur-[2px]' />
      <div className='absolute inset-x-4 top-4 bottom-[88px] rounded-[28px] border border-dashed border-[color-mix(in_srgb,var(--app-accent)_44%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-surface)_82%,transparent)] shadow-[0_18px_56px_rgba(0,0,0,0.22)]'>
        <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
          <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]'>
            <ImagePlus size={22} />
          </div>
          <div>
            <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
              Drop images to attach
            </p>
            <p className='mt-2 text-sm text-[var(--app-text-muted)]'>
              Screenshots stay local to this browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
