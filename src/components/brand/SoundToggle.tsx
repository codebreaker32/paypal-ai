'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { feedback } from '@/lib/feedback';
import { setFeedbackOn, useFeedbackOn } from '@/lib/feedback/prefs';
import { cn } from '@/lib/utils';

/**
 * The device's one sound and vibration switch, for people with no Settings page. Sellers have the same one in Settings.
 * It reads "Sound on" or "Sound off"; its accessible name is "Sound" and aria-pressed carries the state, so a screen
 * reader hears "Sound, toggle button, pressed" rather than the state twice.
 */
export function SoundToggle({ className }: { className?: string }) {
  const on = useFeedbackOn();
  return (
    <button
      type="button"
      data-slot="sound-toggle"
      aria-pressed={on}
      onClick={() => {
        setFeedbackOn(!on);
        feedback('flip');
      }}
      className={cn(
        'press-icon inline-flex min-h-tap min-w-[7.25rem] shrink-0 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink-soft ring-1 ring-line ring-inset hover:bg-surface-sunken hover:text-ink',
        className,
      )}
    >
      <Icon icon={on ? Volume2 : VolumeX} size="sm" />
      <span>
        Sound<span aria-hidden="true">{on ? ' on' : ' off'}</span>
      </span>
    </button>
  );
}
