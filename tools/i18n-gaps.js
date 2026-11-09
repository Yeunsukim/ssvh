// 개발용: 영어 화면에서 사전에 없는 한글(화면 점검 ko-screen.txt + 저장 자료 ko-data.txt)을 모아 번역할 목록(tools/_work/gaps.txt)을 만듦
// 이름·주소는 @, 숫자는 #로 바꿔 같은 틀은 하나로 합침 (i18n.js의 tr()과 같은 규칙)
const fs = require('fs');
const names = fs.readFileSync('tools/_work/names2.txt', 'utf8').split('\n').filter(Boolean).sort((a, b) => b.length - a.length);
const esc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nre = new RegExp(names.map(esc).join('|'), 'g');
const dict = JSON.parse(fs.readFileSync('tools/_work/dict-now.json', 'utf8'));
const norm = (t) => t.replace(/\s+/g, ' ').trim().replace(nre, '@').replace(/\d+(?:[.,:\-/]\d+)*/g, '#');
const out = new Map();
for (const f of ['ko-screen.txt', 'ko-data.txt']) {
  for (const line of fs.readFileSync('tools/_work/' + f, 'utf8').split('\n')) {
    const i = line.indexOf('\t'); if (i < 0) continue; const where = line.slice(0, i); const t = line.slice(i + 1).replace(/\s+/g, ' ').trim();
    if (!/[가-힣]/.test(t) || dict[t] !== undefined) continue;
    const k = norm(t); if (dict[k] !== undefined || !/[가-힣]/.test(k.replace(/@/g, ''))) continue;
    if (!out.has(k)) out.set(k, where);
  }
}
const list = [...out.keys()].sort();
fs.writeFileSync('tools/_work/gaps.txt', list.map((k, i) => `${i + 1}\t${k}`).join('\n'));
console.log('번역할 문구', list.length, '글자', list.join('').length);
