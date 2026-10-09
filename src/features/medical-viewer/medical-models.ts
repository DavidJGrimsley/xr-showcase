export type MedicalModelId = 'skull' | 'brain' | 'both';
export type MedicalAssetId = 'skull' | 'brain' | 'half-skull';
export type Point3 = [number, number, number];

export interface MedicalAssetTransform {
  position: Point3;
  rotation: Point3;
  scale: Point3;
}

export interface MedicalAsset {
  id: MedicalAssetId;
  label: string;
  placeholder: boolean;
  // Null keeps a mode unavailable if a replacement is awaiting alignment.
  transform: MedicalAssetTransform | null;
}

export const MEDICAL_ASSETS: Record<MedicalAssetId, MedicalAsset> = {
  skull: {
    id: 'skull',
    label: 'Skull',
    placeholder: false,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  },
  // Owner requested the prepared skull as both stand-ins during groundwork.
  // These identity transforms describe that skull, not anatomical registration.
  brain: {
    id: 'brain',
    label: 'Brain',
    placeholder: true,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  },
  'half-skull': {
    id: 'half-skull',
    label: 'Half-skull',
    placeholder: true,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  },
};

export const MEDICAL_MODEL_ASSETS: Record<MedicalModelId, readonly MedicalAssetId[]> = {
  skull: ['skull'],
  brain: ['brain'],
  both: ['half-skull', 'brain'],
};

export function isMedicalModelAvailable(
  id: MedicalModelId,
  isAssetAvailable: (assetId: MedicalAssetId) => boolean = (assetId) =>
    MEDICAL_ASSETS[assetId].transform !== null
) {
  return MEDICAL_MODEL_ASSETS[id].every(isAssetAvailable);
}

export const MEDICAL_MODELS = (['skull', 'brain', 'both'] as const).map((id) => ({
  id,
  label: id === 'both' ? 'Both' : MEDICAL_ASSETS[id].label,
  available: isMedicalModelAvailable(id),
}));

export function hasMedicalLabels(id: MedicalModelId) {
  // The existing calibration belongs only to the full skull.
  return id === 'skull';
}

export function medicalPlaceholderNotice(id: MedicalModelId) {
  if (!MEDICAL_MODEL_ASSETS[id].some((assetId) => MEDICAL_ASSETS[assetId].placeholder)) return '';
  return id === 'both'
    ? 'Preview: two overlapping skull stand-ins for the half-skull and brain.'
    : 'Preview: skull stand-in for the brain.';
}
