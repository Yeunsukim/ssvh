// 개발용: tools/_work/ko-all.txt(원문, 줄 번호 = 1부터) + tools/i18n/en-*.txt("번호<TAB>영어") → js/i18n/dict-en.js
const fs = require('fs'); const path = require('path');
const ko = fs.readFileSync('tools/_work/ko-all.txt', 'utf8').split('\n');
const dir = 'tools/i18n'; const dict = {}; let n = 0, bad = 0;
for (const f of fs.readdirSync(dir).filter((x) => /^en-.*\.txt$/.test(x)).sort()) {
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    const m = line.match(/^(\d+)\t(.*)$/); if (!m) continue;
    const k = ko[Number(m[1]) - 1]; const v = m[2].trim();
    if (!k || !v || (k + v).includes('�')) { bad++; continue; }
    const c = (s, ch) => (s.match(new RegExp(ch, 'g')) || []).length;
    if (c(k, '#') !== c(v, '#') || c(k, '@') !== c(v, '@')) { bad++; console.log('자리표 수가 다름', m[1], k, '→', v); continue; }
    dict[k] = v; n++;
  }
}
// 사람이 따로 적은 용어 (tools/i18n/terms.txt: "한글<TAB>영어")
if (fs.existsSync(path.join(dir, 'terms.txt'))) for (const line of fs.readFileSync(path.join(dir, 'terms.txt'), 'utf8').split('\n')) { const [k, v] = line.split('\t'); if (k && v && !dict[k.trim()]) { dict[k.trim()] = v.trim(); n++; } }
fs.writeFileSync('js/i18n/dict-en.js', `// 영어 사전 — tools/i18n-build.js로 자동 생성 (직접 고치지 말고 tools/i18n/*.txt를 고친 뒤 다시 만듦)\nwindow.H.I18N_EN = ${JSON.stringify(dict)};\n`);
console.log('사전', n, '개 / 건너뜀', bad, '/ 원문', ko.length, '/ 번역 안 된 원문', ko.filter((k) => k && !dict[k]).length);
