const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'xml');
const destDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main');

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    if (file === 'AndroidManifest.xml') {
      const destFile = path.join(destDir, 'AndroidManifest.xml');
      if (fs.existsSync(destDir)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Copied ${file} to ${destFile}`);
      }
    } else {
      const destXmlDir = path.join(destDir, 'res', 'xml');
      if (!fs.existsSync(destXmlDir)) {
        fs.mkdirSync(destXmlDir, { recursive: true });
      }
      const destFile = path.join(destXmlDir, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied ${file} to ${destFile}`);
    }
  }
}
