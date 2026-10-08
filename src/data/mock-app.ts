export interface AppTask {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
}

export interface AppSnapshot {
  name: string;
  audience: string;
  tasks: AppTask[];
}

export const appSnapshot: AppSnapshot = {
  name: 'XR Showcase',
  audience: 'Tabletop AR for fighting, anatomy, and quantum exploration.',
  tasks: [
    { id: 'task-1', title: 'Shape the first user flow', status: 'doing' },
    { id: 'task-2', title: 'Replace mock data with the real data layer', status: 'todo' },
    { id: 'task-3', title: 'Run mds doctor before pushing', status: 'todo' },
  ] satisfies AppTask[],
};
