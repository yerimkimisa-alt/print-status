# 현재 화면을 파일 하나(HTML)로 묶어 더블클릭으로 열 수 있게 만듦. 서버·인터넷 없이 동작(글꼴만 인터넷 필요, 없으면 기본 글꼴).
# 실행: python 설치/로컬테스트_만들기.py  →  현황시스템/인쇄물제작관리시스템_로컬테스트.html
import base64, re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
inline = lambda name: (root / name).read_text(encoding="utf-8").replace("</script", "<\\/script")
datauri = lambda name: "data:image/png;base64," + base64.b64encode((root / name).read_bytes()).decode()

html = re.sub(r'<script src="schedule\.js[^"]*"></script>', lambda m: f"<script>\n{inline('schedule.js')}\n</script>", html)
html = re.sub(r'<script src="app\.js[^"]*"></script>', lambda m: f"<script>\n{inline('app.js')}\n</script>", html)
for png in ("assets/yerim-logo-white.png", "assets/yerim-logo.png", "assets/icon-192.png"):
    html = html.replace(f'"{png}"', f'"{datauri(png)}"')
# 파일로 열면 앱 설치(manifest·서비스워커)는 쓸 수 없으므로 뺌
html = re.sub(r'<link rel="manifest"[^>]*>\n?', "", html)
html = html.replace('<button class="btn sec" id="install" hidden>앱 설치</button>', '<button class="btn sec" id="install" hidden style="display:none">앱 설치</button>')
html = html.replace("<title>YERIM 인쇄물 제작관리시스템</title>", "<title>[로컬 테스트] YERIM 인쇄물 제작관리시스템</title>")

out = root / "인쇄물제작관리시스템_로컬테스트.html"
out.write_text(html, encoding="utf-8")
assert 'src="schedule.js' not in html and 'src="app.js' not in html and 'src="assets/' not in html
print(out, f"{out.stat().st_size // 1024} KB")
