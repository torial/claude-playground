// node build.cjs
//   dist/index.html     standalone page
//   dist/artifact.html  fragment for a host that supplies <html>, <head> and <body>
const fs = require('fs');
const read = (p) => fs.readFileSync(p, 'utf8');
const css = read('src/style.css');
const body = read('src/body.html');
const core = read('src/core.js');
const app = read('src/app.js');
const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">';
const scripts = `<script>\n${core}\n</script>\n<script>\n${app}\n</script>`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', `<title>Rewrite</title>\n${fonts}\n<style>\n${css}\n</style>\n${body}\n${scripts}\n`);
fs.writeFileSync(
  'dist/index.html',
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>Rewrite</title>\n${fonts}\n<style>\n${css}\nbody { margin: 0; }\n</style>\n</head>\n<body>\n${body}\n${scripts}\n</body>\n</html>\n`,
);
console.log('built', fs.statSync('dist/index.html').size, 'bytes');
