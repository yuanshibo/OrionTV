const path = require('path');
const fs = require('fs/promises');
const { withDangerousMod } = require('expo/config-plugins');

const PLUGIN_ID = 'expo-module-gradle-plugin';

const BUILD_GRADLE_KTS = `plugins {
  groovy
}

repositories {
  google()
  mavenCentral()
}

dependencies {
  implementation(gradleApi())
  implementation(localGroovy())
}
`;

const PLUGIN_CLASS_SOURCE = `package expo.modules.gradle

import groovy.lang.Closure
import org.gradle.api.Plugin
import org.gradle.api.Project

class ExpoModuleGradlePlugin implements Plugin<Project> {
  @Override
  void apply(Project project) {
    def coreProject = project.rootProject.findProject(':expo-modules-core')
    if (coreProject == null) {
      project.logger.warn("expo-module-gradle-plugin: ':expo-modules-core' project not found. Skipping plugin application.")
      return
    }

    def pluginFile = new File(coreProject.projectDir, 'ExpoModulesCorePlugin.gradle')
    project.apply([from: pluginFile])

    invokeClosure(project, 'applyKotlinExpoModulesCorePlugin')
    invokeClosure(project, 'useDefaultAndroidSdkVersions')
    invokeClosure(project, 'useExpoPublishing')
    invokeClosure(project, 'useCoreDependencies')
  }

  private static void invokeClosure(Project project, String name) {
    def extraProperties = project.extensions.extraProperties
    if (!extraProperties.has(name)) {
      return
    }
    def closure = extraProperties.get(name)
    if (closure instanceof Closure) {
      closure.call()
    }
  }
}
`;

const PLUGIN_DESCRIPTOR = `implementation-class=expo.modules.gradle.ExpoModuleGradlePlugin
`;

async function ensureFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let current = null;
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (current !== contents) {
    await fs.writeFile(filePath, contents, 'utf8');
  }
}

const withExpoModuleGradlePlugin = (config) => {
  return withDangerousMod(config, ['android', async (config) => {
    const projectRoot = config.modRequest.platformProjectRoot;
    const buildSrcDir = path.join(projectRoot, 'buildSrc');

    await ensureFile(path.join(buildSrcDir, 'build.gradle.kts'), BUILD_GRADLE_KTS);
    await ensureFile(
      path.join(buildSrcDir, 'src', 'main', 'groovy', 'expo', 'modules', 'gradle', 'ExpoModuleGradlePlugin.groovy'),
      PLUGIN_CLASS_SOURCE
    );
    await ensureFile(
      path.join(buildSrcDir, 'src', 'main', 'resources', 'META-INF', 'gradle-plugins', `${PLUGIN_ID}.properties`),
      PLUGIN_DESCRIPTOR
    );

    return config;
  }]);
};

module.exports = withExpoModuleGradlePlugin;
module.exports.withExpoModuleGradlePlugin = withExpoModuleGradlePlugin;
module.exports.default = withExpoModuleGradlePlugin;
