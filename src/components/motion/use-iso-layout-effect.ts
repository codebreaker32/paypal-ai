import { useEffect, useLayoutEffect } from 'react';

/** useLayoutEffect in the browser (runs before paint), useEffect on the server (where layout effects warn). */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
