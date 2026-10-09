import type { ImageSourcePropType } from 'react-native';
import type { MedicalAssetId } from './medical-models';

// Literal requires let Metro package the binary. The owner requested the skull
// for all slots until the actual brain and half-skull are supplied.
export const MEDICAL_ASSET_SOURCES: Record<MedicalAssetId, ImageSourcePropType> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  skull: require('../../../assets/medical/skull.glb'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  brain: require('../../../assets/medical/skull.glb'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'half-skull': require('../../../assets/medical/skull.glb'),
};
