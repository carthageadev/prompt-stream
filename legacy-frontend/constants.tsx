import { Template, PromptBlockData, StackThemeKey, TagColor } from './types';
import {
  User,
  Shield,
  Terminal,
  FileJson,
  Sparkles,
  MessageSquare,
  Quote,
  Braces,
  Settings2,
  Bookmark,
  Code2,
} from 'lucide-react';

export const SEED_BLOCKS: PromptBlockData[] = [
  {
    id: 'seed-1',
    type: 'persona',
    title: 'Senior React Architect',
    content:
      'Act as a Senior Software Architect specializing in React, TypeScript, and Scalable Front-end Systems. You prioritize clean architecture, performance optimization, and maintainability.',
    tags: ['Role'],
    isNew: false,
  },
  {
    id: 'seed-2',
    type: 'context',
    title: 'Modern Stack Context',
    content:
      'The project uses Next.js 14 (App Router), Tailwind CSS for styling, and Zustand for state management. Strictly adhere to modern React patterns (Server Components where applicable).',
    tags: ['Context', 'React', 'Next.js'],
    isNew: false,
  },
  {
    id: 'seed-3',
    type: 'format',
    title: 'Markdown Output',
    content:
      'Provide the response in clean Markdown. Use standard code blocks for all examples. Briefly explain the "Why" before showing the "How".',
    tags: ['Output'],
    isNew: false,
  },
];

export const DEFAULT_TEMPLATES: Template[] = [
  {
    type: 'persona',
    title: 'Expert Persona',
    defaultContent:
      'You are a Senior Software Architect with 15 years of experience in distributed systems.',
    icon: 'User',
    description: 'Define who the AI is.',
    category: 'Role',
  },
  {
    type: 'context',
    title: 'Project Context',
    defaultContent:
      'I am building a React web application using Tailwind CSS and TypeScript. The goal is to create a high-performance dashboard.',
    icon: 'MessageSquare',
    description: 'Background info for the task.',
    category: 'Context',
  },
  {
    type: 'instruction',
    title: 'Core Task',
    defaultContent:
      'Write a comprehensive analysis of the provided code snippet. Identify performance bottlenecks.',
    icon: 'Sparkles',
    description: 'What the AI should actually do.',
    category: 'Logic',
  },
  {
    type: 'constraint',
    title: 'Constraints',
    defaultContent:
      '- Do not use external libraries.\n- Keep function complexity under O(n).\n- Use functional programming patterns.',
    icon: 'Shield',
    description: 'Rules the AI must follow.',
    category: 'Rules',
  },
  {
    type: 'format',
    title: 'Output Format',
    defaultContent:
      'Respond in Markdown format. Use code blocks for all implementation details.',
    icon: 'Terminal',
    description: 'How the response looks.',
    category: 'Output',
  },
];

export const ICON_MAP: Record<string, any> = {
  User,
  Shield,
  Terminal,
  FileJson,
  Sparkles,
  MessageSquare,
  Quote,
  Braces,
  Settings2,
  Bookmark,
  Code2,
};

export const CATEGORIES = [
  'Role',
  'Context',
  'Logic',
  'Code',
  'Rules',
  'Output',
];

// Built-in category colors (dark mode optimized)
export const CATEGORY_COLORS: Record<string, string> = {
  // Core Categories
  Role: 'bg-blue-950 text-blue-400 border-blue-900',
  Context: 'bg-amber-950 text-amber-400 border-amber-900',
  Logic: 'bg-purple-950 text-purple-400 border-purple-900',
  Code: 'bg-cyan-950 text-cyan-400 border-cyan-900',
  Rules: 'bg-rose-950 text-rose-400 border-rose-900',
  Output: 'bg-emerald-950 text-emerald-400 border-emerald-900',
  All: 'bg-stone-800 text-stone-300 border-stone-700',
  Temp: 'bg-stone-900 text-stone-500 border-stone-800',

  // Language Specifics
  Python: 'bg-yellow-950 text-yellow-400 border-yellow-900',
  React: 'bg-sky-950 text-sky-400 border-sky-900',
  TypeScript: 'bg-blue-900 text-blue-300 border-blue-800',
  JavaScript: 'bg-yellow-900 text-yellow-300 border-yellow-800',
  'Next.js': 'bg-stone-950 text-white border-stone-600',
  'C#': 'bg-violet-950 text-violet-400 border-violet-900',
  Unity: 'bg-zinc-900 text-zinc-300 border-zinc-700',
  'C++': 'bg-indigo-950 text-indigo-400 border-indigo-900',
  Unreal: 'bg-slate-900 text-slate-300 border-slate-700',
  SQL: 'bg-orange-950 text-orange-400 border-orange-900',
};

export const CATEGORY_ACTIVE_COLORS: Record<string, string> = {
  Role: 'bg-blue-600 text-white border-blue-600',
  Context: 'bg-amber-600 text-white border-amber-600',
  Logic: 'bg-purple-600 text-white border-purple-600',
  Code: 'bg-cyan-600 text-white border-cyan-600',
  Rules: 'bg-rose-600 text-white border-rose-600',
  Output: 'bg-emerald-600 text-white border-emerald-600',
  All: 'bg-stone-200 text-black border-stone-200',
};

// ============ TAG COLOR UTILITIES ============

export const DEFAULT_TAG_LIGHTNESS = 32;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Generate a unique hue using the golden angle for maximum visual separation.
 * This ensures even with many tags, colors are distinguishable.
 */
export const generateUniqueHue = (existingHues: number[]): number => {
  const goldenAngle = 137.5;
  const used = new Set(existingHues.map((h) => Math.round(h)));
  let idx = existingHues.length;
  let hue = Math.round((idx * goldenAngle) % 360);
  while (used.has(hue)) {
    idx += 1;
    hue = Math.round((idx * goldenAngle) % 360);
  }
  return hue;
};

/**
 * Convert a hue (0-360) to Tailwind-compatible inline style classes.
 * Uses HSL for precise control with dark mode optimized values.
 */
export const hueToColorClasses = (
  hue: number,
  lightness: number = DEFAULT_TAG_LIGHTNESS,
  isActive: boolean = false
): string => {
  const baseL = clamp(lightness, 12, 85);
  const bgL = isActive ? clamp(baseL + 8, 12, 90) : baseL;
  const textL =
    bgL >= 55 ? clamp(bgL - 35, 10, 35) : clamp(bgL + 45, 60, 92);
  const borderL = isActive ? clamp(bgL - 10, 8, 80) : clamp(bgL - 6, 8, 80);
  return `bg-[hsl(${hue},35%,${bgL}%)] text-[hsl(${hue},70%,${textL}%)] border-[hsl(${hue},45%,${borderL}%)]`;
};

/**
 * Get tag color classes - checks custom colors first, then built-in, then generates.
 */
export const getTagColorClasses = (
  tagName: string,
  customColors: Map<string, TagColor>,
  isActive: boolean = false
): string => {
  // Check if there's a custom color for this tag
  if (customColors.has(tagName)) {
    const color = customColors.get(tagName)!;
    return hueToColorClasses(
      color.hue,
      color.lightness ?? DEFAULT_TAG_LIGHTNESS,
      isActive,
    );
  }

  // Check built-in colors
  if (isActive && CATEGORY_ACTIVE_COLORS[tagName]) {
    return CATEGORY_ACTIVE_COLORS[tagName];
  }
  if (CATEGORY_COLORS[tagName]) {
    return CATEGORY_COLORS[tagName];
  }

  // Return default styling for unknown tags
  return isActive && CATEGORY_ACTIVE_COLORS['All']
    ? CATEGORY_ACTIVE_COLORS['All']
    : CATEGORY_COLORS['All'];
};

export const STACK_THEMES: Record<
  StackThemeKey,
  {
    label: string;
    description: string;
    vars: Record<string, string>;
  }
> = {
  'midnight-grid': {
    label: 'Midnight Grid',
    description: 'High-contrast noir with clean steel accents.',
    vars: {
      '--app-bg': '#0c0a09',
      '--app-surface': '#111111',
      '--app-surface-2': '#161616',
      '--app-surface-3': '#1a1a1a',
      '--app-surface-4': '#0f0f0f',
      '--app-border': '#292524',
      '--app-border-strong': '#57534e',
      '--app-text': '#e7e5e4',
      '--app-text-muted': '#a8a29e',
      '--app-text-subtle': '#78716c',
      '--app-text-strong': '#fafaf9',
      '--app-inverse': '#0c0a09',
      '--app-accent': '#ffffff',
      '--app-soft': '#1c1917',
    },
  },
  'signal-sunset': {
    label: 'Signal Sunset',
    description: 'Copper red accents with warm editorial contrast.',
    vars: {
      '--app-bg': '#130d0c',
      '--app-surface': '#1c1311',
      '--app-surface-2': '#241816',
      '--app-surface-3': '#2f1e1b',
      '--app-surface-4': '#17100f',
      '--app-border': '#4b2e28',
      '--app-border-strong': '#8e4f43',
      '--app-text': '#f4e9e4',
      '--app-text-muted': '#d0b4aa',
      '--app-text-subtle': '#a47769',
      '--app-text-strong': '#fff6f1',
      '--app-inverse': '#130d0c',
      '--app-accent': '#f6c59f',
      '--app-soft': '#241816',
    },
  },
  'oxide-paper': {
    label: 'Oxide Paper',
    description: 'Light canvas with copper-black structure.',
    vars: {
      '--app-bg': '#f7f2ea',
      '--app-surface': '#fffaf4',
      '--app-surface-2': '#f1e6d9',
      '--app-surface-3': '#eadac9',
      '--app-surface-4': '#f5ece1',
      '--app-border': '#d7c0aa',
      '--app-border-strong': '#b78f72',
      '--app-text': '#251814',
      '--app-text-muted': '#5f463b',
      '--app-text-subtle': '#8b6b58',
      '--app-text-strong': '#130d0c',
      '--app-inverse': '#fffaf4',
      '--app-accent': '#251814',
      '--app-soft': '#efe2d5',
    },
  },
  'sea-glass': {
    label: 'Sea Glass',
    description: 'Teal slate atmosphere for research-heavy stacks.',
    vars: {
      '--app-bg': '#071317',
      '--app-surface': '#0e1d22',
      '--app-surface-2': '#13272d',
      '--app-surface-3': '#18343c',
      '--app-surface-4': '#0b171b',
      '--app-border': '#264954',
      '--app-border-strong': '#4a7b86',
      '--app-text': '#dfeef0',
      '--app-text-muted': '#9ec0c6',
      '--app-text-subtle': '#7098a0',
      '--app-text-strong': '#f3fcfd',
      '--app-inverse': '#071317',
      '--app-accent': '#8bd3d6',
      '--app-soft': '#102126',
    },
  },
};

export const getStackThemeStyle = (themeKey?: string): Record<string, string> =>
  STACK_THEMES[(themeKey as StackThemeKey) || 'midnight-grid']?.vars ||
  STACK_THEMES['midnight-grid'].vars;
