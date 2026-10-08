# Inline a Vite build (dist-single/) into one self-contained HTML page, without <html>/<head>/<body>,
# ready to publish as a claude.ai artifact. Usage: python3 scripts/pack-single.py <build dir> <output file>
import re, sys, pathlib
d = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
html = (d / 'index.html').read_text()
title = re.search(r'<title>.*?</title>', html).group(0)
fonts = '\n'.join(re.findall(r'<link rel="preconnect"[^>]*>|<link\s+href="https://fonts.googleapis.com[^"]*"\s+rel="stylesheet"\s*/?>', html, re.S))
css = ''.join((d / m).read_text() for m in re.findall(r'<link rel="stylesheet"[^>]*href="\./([^"]+\.css)"', html))
js = ''.join((d / m).read_text() for m in re.findall(r'<script type="module"[^>]*src="\./([^"]+\.js)"', html))
js = js.replace('</script', '<\\/script')
out.write_text(f'{title}\n{fonts}\n<style>\n{css}\n</style>\n<div id="root"></div>\n<script type="module">\n{js}\n</script>\n')
print(out, out.stat().st_size, 'bytes', 'css', len(css), 'js', len(js))
