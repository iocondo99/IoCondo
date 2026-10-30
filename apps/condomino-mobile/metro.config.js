// Da SDK 52 Expo configura Metro in automatico per i monorepo (npm workspaces):
// watchFolders e nodeModulesPaths non vanno più impostati a mano.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
