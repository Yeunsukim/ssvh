// 개발용: gen-left.txt(사전으로 영어가 안 되는 자동 생성 문장)에서 코드 조각을 걸러 번역할 목록(gen-todo.txt)을 만듦
// 코드 속 ${...} 자리는 #로 바꿈 (화면에서는 숫자 등이 들어가는 자리)
const fs = require('fs');
const done = new Set();
for (const f of fs.readdirSync('tools/i18n').filter((x) => /^pairs-.*\.txt$/.test(x))) fs.readFileSync('tools/i18n/' + f, 'utf8').split('\n').forEach((l) => { const i = l.indexOf('\t'); if (i > 0) done.add(l.slice(0, i)); });
const out = new Set();
for (let t of fs.readFileSync('tools/_work/gen-left.txt', 'utf8').split('\n')) {
  if (!t || /=>|UI\.|\bif \(|\)\s*\{|;\s*$|\|\||&&|\.map\(|\.join\(|H\.|esc\(|data-|class=/.test(t)) continue; // 코드 조각
  t = t.replace(/\d+(?:[.,:\-/]\d+)*/g, '#').replace(/\s+/g, ' ').trim();
  if (!/[가-힣]{2,}/.test(t) || t.length < 2 || done.has(t)) continue;
  out.add(t);
}
const list = [...out].sort();
fs.writeFileSync('tools/_work/gen-todo.txt', list.join('\n'));
console.log('번역할 문장', list.length, '글자', list.join('').length);
