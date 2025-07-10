const fs = require('fs');
const path = require('path');

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found, skipping patch: ${filePath}`);
    return;
  }
  console.log(`Patching ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  patches.forEach(patch => {
    content = content.replace(patch.find, patch.replace);
  });
  fs.writeFileSync(filePath, content, 'utf8');
}

// --- Patch build.gradle ---
const gradleFile = path.resolve(__dirname, '..', 'node_modules', 'react-native-http-bridge', 'android', 'build.gradle');
patchFile(gradleFile, [
  {
    find: /jcenter\(\)/g,
    replace: 'google()\n        mavenCentral()'
  },
  {
    find: "classpath 'com.android.tools.build:gradle:2.2.0'",
    replace: "classpath 'com.android.tools.build:gradle:7.3.1'"
  },
  {
    find: 'compileSdkVersion 23',
    replace: 'compileSdkVersion 33'
  },
  {
    find: 'buildToolsVersion "23.0.1"',
    replace: 'buildToolsVersion "33.0.0"'
  },
  {
    find: /compile /g,
    replace: 'implementation '
  },
  {
    find: /android {/,
    replace: 'android {\n    namespace "me.alwx.HttpServer"'
  }
]);

// --- Patch AndroidManifest.xml ---
const manifestFile = path.resolve(__dirname, '..', 'node_modules', 'react-native-http-bridge', 'android', 'src', 'main', 'AndroidManifest.xml');
patchFile(manifestFile, [
  {
    find: /package="me.alwx.HttpServer"/,
    replace: ''
  }
]);

// --- Patch Server.java ---
const serverJavaFile = path.resolve(__dirname, '..', 'node_modules', 'react-native-http-bridge', 'android', 'src', 'main', 'java', 'me', 'alwx', 'HttpServer', 'Server.java');
patchFile(serverJavaFile, [
  {
    find: 'import android.support.annotation.Nullable;',
    replace: 'import androidx.annotation.Nullable;'
  }
]);

// --- Patch HttpServerReactPackage.java ---
const packageJavaFile = path.resolve(__dirname, '..', 'node_modules', 'react-native-http-bridge', 'android', 'src', 'main', 'java', 'me', 'alwx', 'HttpServer', 'HttpServerReactPackage.java');
patchFile(packageJavaFile, [
  {
    find: '@Override\n  public List<Class<? extends JavaScriptModule>> createJSModules()',
    replace: 'public List<Class<? extends JavaScriptModule>> createJSModules()'
  }
]);

// --- Patch HttpServerModule.java for better logging ---
const moduleJavaFile = path.resolve(__dirname, '..', 'node_modules', 'react-native-http-bridge', 'android', 'src', 'main', 'java', 'me', 'alwx', 'HttpServer', 'HttpServerModule.java');
patchFile(moduleJavaFile, [
  {
    find: 'Log.e(MODULE_NAME, e.getMessage());',
    replace: 'Log.e(MODULE_NAME, "Failed to start server", e);'
  }
]);

console.log('Finished patching react-native-http-bridge.');