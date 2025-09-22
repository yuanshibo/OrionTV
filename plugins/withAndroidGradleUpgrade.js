const { createRunOncePlugin, withProjectBuildGradle } = require('@expo/config-plugins');

const PLUGIN_NAME = 'withAndroidGradleUpgrade';
const PLUGIN_VERSION = '1.0.0';
const DEFAULT_AGP_VERSION = '8.5.2';

function updateAndroidGradlePluginVersion(buildGradle, agpVersion) {
  const pattern = /classpath\(['"]com\.android\.tools\.build:gradle(?::[^'"]+)?['"]\)/;
  if (!pattern.test(buildGradle)) {
    return buildGradle;
  }
  return buildGradle.replace(
    pattern,
    `classpath('com.android.tools.build:gradle:${agpVersion}')`
  );
}

const withAndroidGradleUpgrade = (config, { androidGradlePluginVersion = DEFAULT_AGP_VERSION } = {}) => {
  return withProjectBuildGradle(config, (config) => {
    const current = config.modResults.contents;
    const updated = updateAndroidGradlePluginVersion(current, androidGradlePluginVersion);
    config.modResults.contents = updated;
    return config;
  });
};

module.exports = createRunOncePlugin(withAndroidGradleUpgrade, PLUGIN_NAME, PLUGIN_VERSION);
