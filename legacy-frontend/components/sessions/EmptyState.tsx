import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className='rounded-[28px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_82%,transparent)] px-6 py-9 text-center shadow-[0_14px_38px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:px-10 sm:py-12'>
      <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]'>
        <Icon size={20} />
      </div>
      <h2 className='mt-4 text-xl font-semibold tracking-tight text-[var(--app-text-strong)]'>
        {title}
      </h2>
      <p className='mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--app-text-muted)]'>
        {description}
      </p>
      {action ? <div className='mt-5'>{action}</div> : null}
    </div>
  );
};

export default EmptyState;
