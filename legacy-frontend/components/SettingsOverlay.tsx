import React, { useState } from 'react';
import { X, Palette, RotateCcw } from 'lucide-react';
import gsap from 'gsap';
import { TagColor } from '../types';
import {
  hueToColorClasses,
  CATEGORY_COLORS,
  DEFAULT_TAG_LIGHTNESS,
} from '../constants';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
  tagColors: TagColor[];
  onUpdateTagColor: (name: string, hue: number, lightness: number) => void;
  onResetTagColor: (name: string) => void;
  radiusMode: 'rounded' | 'sharp';
  onUpdateRadiusMode: (mode: 'rounded' | 'sharp') => void;
  themeMode: 'dark' | 'light';
  onUpdateThemeMode: (mode: 'dark' | 'light') => void;
  isAutoTaggingEnabled: boolean;
  onToggleAutoTagging: (value: boolean) => void;
}

const PRESET_HUES = [
  0, 20, 40, 60, 80, 100, 140, 160, 190, 210, 230, 260, 285, 310, 330, 350,
];
const PRESET_LIGHTNESS = [36, 58];
const PRESET_COLORS = PRESET_LIGHTNESS.flatMap((lightness) =>
  PRESET_HUES.map((hue) => ({ hue, lightness })),
);

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  isOpen,
  onClose,
  allTags,
  tagColors,
  onUpdateTagColor,
  onResetTagColor,
  radiusMode,
  onUpdateRadiusMode,
  themeMode,
  onUpdateThemeMode,
  isAutoTaggingEnabled,
  onToggleAutoTagging,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [colorConflict, setColorConflict] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      gsap.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2 },
      );
      gsap.fromTo(
        containerRef.current,
        { scale: 0.95, opacity: 0, y: 10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' },
      );
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (selectedTag && !allTags.includes(selectedTag)) {
      setSelectedTag(null);
    }
  }, [allTags, selectedTag]);

  React.useEffect(() => {
    void selectedTag;
    setColorConflict(null);
  }, [selectedTag]);

  const handleClose = () => {
    gsap.to(containerRef.current, {
      scale: 0.95,
      opacity: 0,
      duration: 0.2,
      onComplete: onClose,
    });
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 });
  };

  if (!isOpen) return null;

  const colorMap = new Map<string, TagColor>(tagColors.map((tc) => [tc.name, tc]));
  const usedColorKeys = new Set(
    tagColors
      .filter((tc) => tc.name !== selectedTag)
      .map(
        (tc) =>
          `${tc.hue}-${tc.lightness ?? DEFAULT_TAG_LIGHTNESS}`.toLowerCase(),
      ),
  );

  const getTagColor = (tagName: string): TagColor | null => {
    return colorMap.get(tagName) ?? null;
  };

  const getTagHue = (tagName: string): number | null => {
    const color = getTagColor(tagName);
    return typeof color?.hue === 'number' ? color.hue : null;
  };

  const selectedColor = selectedTag ? getTagColor(selectedTag) : null;
  const selectedColorKey = selectedColor
    ? `${selectedColor.hue}-${selectedColor.lightness ?? DEFAULT_TAG_LIGHTNESS}`.toLowerCase()
    : null;

  const canUseColor = (hue: number, lightness: number) => {
    const key = `${hue}-${lightness}`.toLowerCase();
    return !usedColorKeys.has(key) || key === selectedColorKey;
  };

  const applyColor = (hue: number, lightness: number) => {
    if (!selectedTag) return;
    if (!canUseColor(hue, lightness)) {
      setColorConflict('That color is already used by another tag.');
      return;
    }
    setColorConflict(null);
    onUpdateTagColor(selectedTag, hue, lightness);
  };

  const isBuiltInTag = (tagName: string): boolean => {
    return CATEGORY_COLORS[tagName] !== undefined;
  };

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center p-4'>
      <button
        type='button'
        ref={backdropRef}
        className='absolute inset-0 bg-black/80 backdrop-blur-sm'
        onClick={handleClose}
        aria-label='Close tag settings overlay'
      />

      <div
        ref={containerRef}
        className='relative w-full max-w-4xl bg-[var(--app-surface)] rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-[var(--app-border)] h-[80vh]'
      >
        {/* HEADER */}
        <div className='flex items-center justify-between px-8 py-6 border-b border-[var(--app-border)] bg-[var(--app-surface-2)] shrink-0'>
          <div className='flex items-center gap-4'>
            <div className='p-2 bg-[var(--app-surface-3)] rounded-lg text-[var(--app-text-strong)]'>
              <Palette size={24} />
            </div>
            <div>
              <h2 className='text-xl font-bold text-[var(--app-text-strong)] uppercase tracking-tight'>
                Tag Settings
              </h2>
              <p className='text-xs text-[var(--app-text-subtle)] font-medium'>
                Adjust tag colors and corners.
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='p-2 text-[var(--app-inverse)] bg-[var(--app-accent)] hover:bg-[var(--app-text-strong)] rounded-lg transition-all hover:scale-105'
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className='flex-1 flex overflow-hidden'>
          {/* TAG LIST GRID */}
          <div className='flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--app-bg)]'>
            <div className='grid grid-cols-2 gap-3 pb-8'>
              {allTags.map((tag) => {
                const customColor = getTagColor(tag);
                const hasCustomColor = customColor !== null;
                const isSelected = selectedTag === tag;
                const displayClasses = hasCustomColor
                  ? hueToColorClasses(
                      customColor!.hue,
                      customColor!.lightness ?? DEFAULT_TAG_LIGHTNESS,
                    )
                  : CATEGORY_COLORS[tag] || CATEGORY_COLORS['All'];

                return (
                  <button
                    key={tag}
                    type='button'
                    onClick={() => setSelectedTag(tag)}
                    className={`
                                    flex items-center gap-3 p-3 rounded-xl border transition-all relative group
                                    ${
                                      isSelected
                                        ? 'bg-[var(--app-surface-3)] border-white/20 shadow-xl ring-1 ring-white/10 scale-[1.02]'
                                        : 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-border-strong)]'
                                    }
                                `}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${displayClasses}`}
                    >
                      <span className='text-[10px] font-bold'>
                        {tag.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className='text-left min-w-0'>
                      <div
                        className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--app-text-strong)]' : 'text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]'}`}
                      >
                        {tag}
                      </div>
                      <div className='text-[9px] uppercase tracking-widest text-[var(--app-text-subtle)] mt-0.5 font-bold'>
                        {isBuiltInTag(tag) ? 'Core' : 'Custom'}
                      </div>
                    </div>
                    {isSelected && (
                      <div className='absolute top-2 right-2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_white]' />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* EDITOR PANEL */}
          <div className='w-[380px] bg-[var(--app-surface-2)] border-l border-[var(--app-border)] p-6 flex flex-col'>
            <div className='space-y-3 shrink-0'>
              <div className='rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3'>
                <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                  About
                </span>
                <p className='text-xs text-[var(--app-text)] mt-1'>
                  Made by ashref.tn
                </p>
              </div>

              <div className='grid grid-cols-2 gap-2'>
                <div className='rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3'>
                  <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                    Theme
                  </span>
                  <div className='mt-2 grid grid-cols-2 gap-2'>
                    <button
                      type='button'
                      onClick={() => onUpdateThemeMode('dark')}
                      className={`py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-md transition-all ${
                        themeMode === 'dark'
                          ? 'bg-[var(--app-accent)] text-[var(--app-inverse)] border-[var(--app-accent)]'
                          : 'bg-[var(--app-surface-3)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      Dark
                    </button>
                    <button
                      type='button'
                      onClick={() => onUpdateThemeMode('light')}
                      className={`py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-md transition-all ${
                        themeMode === 'light'
                          ? 'bg-[var(--app-accent)] text-[var(--app-inverse)] border-[var(--app-accent)]'
                          : 'bg-[var(--app-surface-3)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      Light
                    </button>
                  </div>
                </div>

                <div className='rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3'>
                  <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                    Auto Tagging
                  </span>
                  <button
                    type='button'
                    onClick={() => onToggleAutoTagging(!isAutoTaggingEnabled)}
                    className={`mt-2 w-full py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-md transition-all ${
                      isAutoTaggingEnabled
                        ? 'bg-[var(--app-accent)] text-[var(--app-inverse)] border-[var(--app-accent)]'
                        : 'bg-[var(--app-surface-3)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    {isAutoTaggingEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              <div className='rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3'>
                <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                  Corner Radius
                </span>
                <div className='mt-2 grid grid-cols-2 gap-2'>
                  <button
                    type='button'
                    onClick={() => onUpdateRadiusMode('rounded')}
                    className={`py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-md transition-all ${
                      radiusMode === 'rounded'
                        ? 'bg-[var(--app-accent)] text-[var(--app-inverse)] border-[var(--app-accent)]'
                        : 'bg-[var(--app-surface-3)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    Rounded
                  </button>
                  <button
                    type='button'
                    onClick={() => onUpdateRadiusMode('sharp')}
                    className={`py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-md transition-all ${
                      radiusMode === 'sharp'
                        ? 'bg-[var(--app-accent)] text-[var(--app-inverse)] border-[var(--app-accent)]'
                        : 'bg-[var(--app-surface-3)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    Sharp
                  </button>
                </div>
              </div>
            </div>

            <div className='h-px bg-[var(--app-border)] my-4' />

            <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar'>
              {selectedTag ? (
                <div className='animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col gap-5'>
                  <div className='flex items-center gap-4'>
                    <div
                      className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center shadow-2xl transition-all duration-300
                        ${
                          getTagColor(selectedTag) !== null
                            ? hueToColorClasses(
                                getTagColor(selectedTag)!.hue,
                                getTagColor(selectedTag)!.lightness ??
                                  DEFAULT_TAG_LIGHTNESS,
                              )
                            : CATEGORY_COLORS[selectedTag] ||
                              CATEGORY_COLORS['All']
                        }
                      `}
                    >
                      <span className='text-2xl font-black italic'>
                        {selectedTag.substring(0, 1)}
                      </span>
                    </div>
                    <div className='min-w-0'>
                      <h3 className='text-lg font-bold text-[var(--app-text-strong)] truncate'>
                        {selectedTag}
                      </h3>
                      <p className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)] mt-1'>
                        {selectedColor ? 'Custom Color' : 'Default Color'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)] mb-3 block'>
                      Pick a Unique Color
                    </span>
                    <div className='grid grid-cols-4 gap-2'>
                      {PRESET_COLORS.map((preset) => {
                        const key = `${preset.hue}-${preset.lightness}`.toLowerCase();
                        const isUsed = usedColorKeys.has(key);
                        const isActive = key === selectedColorKey;
                        return (
                          <button
                            key={key}
                            type='button'
                            onClick={() =>
                              applyColor(preset.hue, preset.lightness)
                            }
                            disabled={isUsed && !isActive}
                            className={`h-10 rounded-md border transition-all relative ${
                              isActive
                                ? 'ring-2 ring-[var(--app-text-strong)]'
                                : ''
                            } ${isUsed && !isActive ? 'opacity-30 cursor-not-allowed' : 'hover:scale-[1.03]'}`}
                          >
                            <div
                              className={`absolute inset-0 rounded-md ${hueToColorClasses(
                                preset.hue,
                                preset.lightness,
                              )}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <p className='text-[9px] text-[var(--app-text-subtle)] mt-2'>
                      Colors already assigned to other tags are disabled.
                    </p>
                    {colorConflict && (
                      <p className='text-[9px] text-red-500 mt-1'>
                        {colorConflict}
                      </p>
                    )}
                  </div>

                  <div className='space-y-4'>
                    <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                      Fine-tune (optional)
                    </span>
                    <div>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]'>
                          Hue
                        </span>
                        <span className='text-xs font-mono text-[var(--app-text-subtle)]'>
                          {getTagHue(selectedTag) ?? '—'}°
                        </span>
                      </div>
                      <div className='relative h-6 group'>
                        <input
                          type='range'
                          min='0'
                          max='360'
                          value={
                            selectedColor?.hue ??
                            PRESET_COLORS[0].hue
                          }
                          onChange={(e) =>
                            applyColor(
                              parseInt(e.target.value),
                              selectedColor?.lightness ??
                                PRESET_COLORS[0].lightness,
                            )
                          }
                          className='absolute inset-0 w-full h-2 rounded-full appearance-none cursor-pointer mt-2 bg-transparent'
                          style={{
                            backgroundImage: `linear-gradient(to right, 
                              hsl(0, 100%, 50%), 
                              hsl(60, 100%, 50%), 
                              hsl(120, 100%, 50%), 
                              hsl(180, 100%, 50%), 
                              hsl(240, 100%, 50%), 
                              hsl(300, 100%, 50%), 
                              hsl(360, 100%, 50%)
                            )`,
                          }}
                        />
                        <style>{`
                          input[type=range]::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            appearance: none;
                            width: 16px;
                            height: 16px;
                            background: white;
                            border-radius: 50%;
                            cursor: pointer;
                            border: 2px solid #000;
                            box-shadow: 0 0 10px rgba(255,255,255,0.4);
                          }
                        `}</style>
                      </div>
                    </div>

                    <div>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]'>
                          Lightness
                        </span>
                        <span className='text-xs font-mono text-[var(--app-text-subtle)]'>
                          {selectedColor?.lightness ?? PRESET_COLORS[0].lightness}%
                        </span>
                      </div>
                      <div className='relative h-6 group'>
                        <input
                          type='range'
                          min='10'
                          max='85'
                          value={
                            selectedColor?.lightness ??
                            PRESET_COLORS[0].lightness
                          }
                          onChange={(e) =>
                            applyColor(
                              selectedColor?.hue ?? PRESET_COLORS[0].hue,
                              parseInt(e.target.value),
                            )
                          }
                          className='absolute inset-0 w-full h-2 rounded-full appearance-none cursor-pointer mt-2 bg-gradient-to-r from-black via-stone-400 to-white'
                        />
                      </div>
                    </div>

                    {getTagColor(selectedTag) !== null && (
                      <button
                        type='button'
                        onClick={() => {
                          setColorConflict(null);
                          onResetTagColor(selectedTag);
                        }}
                        className='w-full py-3 bg-[var(--app-surface-3)] hover:bg-red-950/20 text-[var(--app-text-subtle)] hover:text-red-500 border border-[var(--app-border)] rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all'
                      >
                        <RotateCcw size={12} className='inline mr-2 mb-0.5' />
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center h-full text-center'>
                  <div className='w-12 h-12 border-2 border-[var(--app-border)] border-dashed rounded-xl mb-4 flex items-center justify-center text-[var(--app-text-subtle)]'>
                    <Palette size={20} />
                  </div>
                  <p className='text-xs text-[var(--app-text-subtle)] font-medium px-4'>
                    Select a tag from the left to adjust its color.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className='px-8 py-5 border-t border-[var(--app-border)] bg-[var(--app-surface-2)] shrink-0 flex justify-between items-center'>
          <span className='text-[10px] font-bold text-[var(--app-text-subtle)] uppercase tracking-widest'>
            {allTags.length} Unique Tags Detected
          </span>
          <button
            type='button'
            onClick={handleClose}
            className='px-8 py-2.5 bg-[var(--app-accent)] text-[var(--app-inverse)] rounded-lg text-sm font-bold hover:bg-[var(--app-text-strong)] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95'
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsOverlay;
