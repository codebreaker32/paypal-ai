'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { feedback } from '@/lib/feedback';
import { setFeedbackOn, useFeedbackOn } from '@/lib/feedback/prefs';

/** The device's one sound and vibration switch, for people with no Settings page. Sellers have the same one in Settings. */
export function SoundToggle({ className }: { className?: string }) {
  const on = useFeedbackOn();
  return (
    <IconButton
      icon={on ? Volume2 : VolumeX}
      label="Sound"
      className={className}
      aria-pressed={on}
      onClick={() => {
        setFeedbackOn(!on);
        feedback('flip');
      }}
    />
  );
}
