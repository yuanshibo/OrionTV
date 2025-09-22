const path = require('path');
const fs = require('fs/promises');
const { withDangerousMod } = require('expo/config-plugins');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeDirectory(targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(sourcePath);
      await fs.symlink(link, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

const withExpoModuleGradlePlugin = (config) =>
  withDangerousMod(config, ['android', async (config) => {
    const { projectRoot, platformProjectRoot } = config.modRequest;
    const sourceDir = path.join(
      projectRoot,
      'node_modules',
      'expo-modules-core',
      'expo-module-gradle-plugin'
    );

    if (!(await pathExists(sourceDir))) {
      throw new Error(
        `Unable to locate Expo module Gradle plugin at "${sourceDir}". Make sure the ` +
          'expo-modules-core package is installed before running prebuild.'
      );
    }

    const targetDir = path.join(platformProjectRoot, 'buildSrc');
    await removeDirectory(targetDir);
    await copyDirectory(sourceDir, targetDir);

    return config;
  }]);

module.exports = withExpoModuleGradlePlugin;
module.exports.withExpoModuleGradlePlugin = withExpoModuleGradlePlugin;
module.exports.default = withExpoModuleGradlePlugin;
