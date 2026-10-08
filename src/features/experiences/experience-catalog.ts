import type { Href } from 'expo-router';

export const experiences = [
  { route: 'arena-fighter', href: '/arena-fighter', title: 'Arena Fighter' },
  { route: 'medical-viewer', href: '/medical-viewer', title: 'Medical Viewer' },
  { route: 'guess-the-qubit', href: '/guess-the-qubit', title: 'Guess the Qubit' },
] as const satisfies readonly { route: string; href: Href; title: string }[];
