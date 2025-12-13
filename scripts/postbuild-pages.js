const fs = require("fs");
const path = require("path");

const distDir = path.resolve(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");
const ghPagesPath = path.join(distDir, "gh-pages.html");
const notFoundPath = path.join(distDir, "404.html");

if (!fs.existsSync(indexPath) && fs.existsSync(ghPagesPath)) {
  fs.copyFileSync(ghPagesPath, indexPath);
  console.log("postbuild-pages: renamed dist/gh-pages.html -> dist/index.html");
}

if (!fs.existsSync(indexPath)) {
  console.error(`postbuild-pages: missing ${indexPath} (and no ${ghPagesPath})`);
  process.exit(1);
}

fs.copyFileSync(indexPath, notFoundPath);
console.log("postbuild-pages: wrote dist/404.html (SPA fallback)");
