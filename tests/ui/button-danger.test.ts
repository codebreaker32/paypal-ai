// The danger Button (brief S1): the delete sheet's last step, the only filled button in the error colour.
import { describe, expect, it } from 'vitest';
import { buttonClasses } from '@/components/ui/button';

describe('danger button', () => {
  it('fills with the danger tokens and has an active fill, like every variant', () => {
    const cls = buttonClasses({ variant: 'danger' });
    expect(cls).toContain('bg-(--button-danger-bg)');
    expect(cls).toContain('text-(--button-danger-fg)');
    expect(cls).toContain('active:bg-(--button-danger-bg-active)');
    expect(cls).toContain('data-pressed:bg-(--button-danger-bg-active)');
  });
});
