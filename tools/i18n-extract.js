// 개발용: 코드 속 메시지(알림·확인 창·제목) 한글 문구를 뽑아 tools/_work/ko-extra.txt에 저장
const fs = require('fs');
const files = [...fs.readdirSync('js/modules').map((f) => 'js/modules/' + f), ...fs.readdirSync('js/core').map((f) => 'js/core/' + f)].filter((f) => f.endsWith('.js'));
const ko = /[가-힣]/; const out = new Set();
const names = fs.readFileSync('tools/_work/names.txt', 'utf8').split('\n').filter(Boolean);
const esc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nre = new RegExp(names.map(esc).join('|'), 'g');
const norm = (t) => t.replace(nre, '@').replace(/\d+(?:[.,:\-/]\d+)*/g, '#').replace(/\s+/g, ' ').trim();
const LIT = /(?:toast\(|title:|text:|ok:|label:|l:|empty:|notify\([^,]+,)\s*([`'])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(LIT)) {
    m[2].split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/).forEach((p) => { p.replace(/<[^>]*>/g, '\n').split(/\n|\s{2,}/).forEach((q) => { q = norm(q.replace(/\\n/g, ' ')); if (ko.test(q) && q.length > 1) out.add(q); }); });
  }
}
const rt = fs.readFileSync('tools/_work/ko-runtime.txt', 'utf8').split('\n');
const set = new Set(rt); const extra = [...out].filter((x) => !set.has(x));
fs.writeFileSync('tools/_work/ko-extra.txt', extra.join('\n'));
console.log('코드에서 더한 문구', extra.length, '글자', extra.join('').length, '/ 화면 목록', rt.length, '글자', rt.join('').length);
