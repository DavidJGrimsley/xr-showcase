const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [
  ...new Set([...config.resolver.assetExts, 'glb', 'gltf', 'bin', 'obj', 'mtl', 'vrx']),
];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
