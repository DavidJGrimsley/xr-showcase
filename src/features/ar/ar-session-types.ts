import type { ReactNode } from 'react';

export interface ARSceneContext {
  sessionId: number;
  onReady: () => void;
  onInstruction: (instruction: string) => void;
  onError: () => void;
}

export interface ARSessionBoundaryProps {
  // A feature can supply a Viro or Studio navigator. The boundary owns its lifecycle.
  renderNavigator?: (context: ARSceneContext) => ReactNode;
}
