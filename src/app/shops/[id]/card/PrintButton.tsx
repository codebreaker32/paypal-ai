'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The counter card's one primary action: the browser's print dialog (print styles show the card alone). */
export function PrintButton() {
  return (
    <Button size="lg" icon={Printer} onClick={() => window.print()} className="w-full sm:w-auto sm:self-start">
      Print card
    </Button>
  );
}
