import { useEffect, useSyncExternalStore } from 'react';
import { Image, NativeModules, TurboModuleRegistry } from 'react-native';
import {
  ViroBox,
  ViroImage,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  type ViroShaderUniform,
} from '@reactvision/react-viro';
import type { MedicalSceneProps } from './medical-scene.native';
import { canManipulateVolume, type MedicalVolumeScope } from './medical-controller';
import { medicalVolumeSource } from './medical-volume-assets.native';
import { VOLUME_ATLASES } from './medical-volumes';
import { volumeExtent, volumeUniforms } from './medical-volume-uniforms';
import { VOLUME_SHADER_BODY, VOLUME_SHADER_UNIFORMS } from './medical-volume-shader';

const MATERIAL = 'medicalVolume';
function uniforms(values: Record<string, number | number[]>): ViroShaderUniform[] {
  return Object.entries(values).map(([name, value]) => ({
    name,
    value,
    type: typeof value === 'number' ? 'float' : value.length === 3 ? 'vec3' : 'vec4',
  }));
}
export default function MedicalVolume({ context, controller }: MedicalSceneProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { volume } = state;
  const series = controller.getVolumeSeries();
  const dataset = controller.volumeDataset;
  const scope: MedicalVolumeScope = {
    sessionId: context.sessionId,
    placementRevision: state.placementRevision,
    requestId: volume.requestId,
  };
  const active = !!state.anchorId && ['binding', 'ready'].includes(volume.loadStatus);
  const pending = ['loading', 'binding'].includes(volume.loadStatus);
  useEffect(() => {
    if (!state.anchorId || !pending) return;
    const timeout = setTimeout(() => controller.finishVolumeBinding(scope, 'error'), 30000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    controller,
    context.sessionId,
    state.anchorId,
    state.placementRevision,
    volume.requestId,
    pending,
  ]);
  useEffect(() => {
    if (!active || !series) return;
    const manager =
      NativeModules.VRTMaterialManager ?? TurboModuleRegistry.get('VRTMaterialManager');
    if (!manager || typeof manager.updateShaderUniform !== 'function') {
      controller.finishVolumeBinding(scope, 'unsupported');
      return;
    }
    try {
      const textures: ViroShaderUniform[] = VOLUME_ATLASES.map((key) => {
        const resolved = Image.resolveAssetSource(medicalVolumeSource(volume.modality, key));
        if (!resolved?.uri) throw new Error(`Missing ${key} atlas`);
        return {
          name: `u_${key}`,
          type: 'sampler2D',
          value: { ...resolved, format: 'RGBA8', mipmap: false },
        };
      });
      ViroMaterials.createMaterials({
        [MATERIAL]: {
          lightingModel: 'Constant',
          blendMode: 'Alpha',
          cullMode: 'Front',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
          shaderModifiers: {
            surface: { uniforms: VOLUME_SHADER_UNIFORMS, body: VOLUME_SHADER_BODY },
          },
          materialUniforms: [...textures, ...uniforms(volumeUniforms(dataset, series, volume))],
        },
      });
      controller.finishVolumeBinding(scope, 'ready');
    } catch {
      controller.finishVolumeBinding(scope, 'error');
    }
    return () => ViroMaterials.deleteMaterials([MATERIAL]);
    // Scalar controls update uniforms below, without recreating texture resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    controller,
    context.sessionId,
    state.placementRevision,
    volume.requestId,
    volume.modality,
    active,
    series,
  ]);
  useEffect(() => {
    if (!active || !series || volume.loadStatus !== 'ready') return;
    const frame = requestAnimationFrame(() => {
      const current = controller.getSnapshot();
      if (
        current.mode !== 'volume' ||
        current.sessionId !== scope.sessionId ||
        current.placementRevision !== scope.placementRevision ||
        current.volume.requestId !== scope.requestId ||
        current.volume.loadStatus !== 'ready'
      )
        return;
      try {
        for (const uniform of uniforms(volumeUniforms(dataset, series, current.volume)))
          ViroMaterials.updateShaderUniform(MATERIAL, uniform.name, uniform.type, uniform.value);
      } catch {
        controller.finishVolumeBinding(scope, 'error');
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    controller,
    active,
    series,
    volume.appearance,
    volume.crop,
    volume.cropping,
    volume.quality,
    volume.loadStatus,
    volume.requestId,
  ]);
  if (!state.anchorId || !series) return null;
  const extent = volumeExtent(dataset),
    interactive = canManipulateVolume(state);
  const box = volume.crop.map((value, index) => {
    const axis = Math.floor(index / 2),
      midpoint = (dataset.boundsRasMm[axis * 2] + dataset.boundsRasMm[axis * 2 + 1]) / 2;
    return (
      ((value - midpoint) * extent[axis]) /
      (dataset.boundsRasMm[axis * 2 + 1] - dataset.boundsRasMm[axis * 2])
    );
  });
  const corners = Array.from({ length: 8 }, (_, i): [number, number, number] => [
    box[i & 1],
    box[4 + ((i >> 2) & 1)],
    -box[2 + ((i >> 1) & 1)],
  ]);
  return (
    <ViroNode
      position={[0, volume.height, 0]}
      rotation={[0, volume.yaw, 0]}
      scale={[volume.scale, volume.scale, volume.scale]}
      onPinch={
        interactive
          ? (gesture, value) => controller.volumeGesture(scope, 'pinch', gesture, value)
          : undefined
      }
      onRotate={
        interactive
          ? (gesture, value) => controller.volumeGesture(scope, 'rotate', gesture, value)
          : undefined
      }>
      {volume.loadStatus === 'loading'
        ? VOLUME_ATLASES.map((key) => (
            <ViroImage
              key={`${scope.sessionId}:${scope.placementRevision}:${scope.requestId}:${key}`}
              source={medicalVolumeSource(volume.modality, key)}
              width={0.001}
              height={0.001}
              opacity={0}
              ignoreEventHandling
              mipmap={false}
              format="RGBA8"
              onLoadEnd={(event) =>
                controller.finishVolumeAtlas(scope, key, event.nativeEvent.success)
              }
              onError={() => controller.finishVolumeAtlas(scope, key, false)}
            />
          ))
        : null}
      {volume.loadStatus === 'ready' ? (
        <ViroBox
          width={extent[0]}
          height={extent[2]}
          length={extent[1]}
          // iOS's materials clone omits custom sampler textures; shaderOverrides copies them.
          shaderOverrides={[MATERIAL]}
          onError={() => controller.finishVolumeBinding(scope, 'error')}
        />
      ) : null}
      {volume.cropBoxVisible && volume.cropping
        ? corners.flatMap((point, i) =>
            [1, 2, 4]
              .filter((bit) => (i & bit) === 0)
              .map((bit) => (
                <ViroPolyline
                  key={`${i}:${bit}`}
                  points={[point, corners[i | bit]]}
                  thickness={0.001}
                  materials={['medicalLeader']}
                  ignoreEventHandling
                />
              ))
          )
        : null}
    </ViroNode>
  );
}
