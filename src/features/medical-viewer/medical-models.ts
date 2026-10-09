export type MedicalModelId = 'skull' | 'brain';
export type Point3 = [number, number, number];

export const MEDICAL_MODELS = [
  { id: 'skull', label: 'Skull', available: true },
  { id: 'brain', label: 'Brain', available: false },
] as const;

export function isMedicalModelAvailable(id: MedicalModelId) {
  return MEDICAL_MODELS.some((model) => model.id === id && model.available);
}
