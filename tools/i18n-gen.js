// 개발용: 결과를 자동으로 만드는 코드(가상 판독·병리·기능검사 결과 등)의 한글 문장을 모아 tools/_work/ko-gen.txt에 저장
const fs = require('fs');
const files = ['js/data/sim.js', 'js/modules/p8-func.js', 'js/modules/p8-lab.js', 'js/modules/p8-rad.js', 'js/modules/pathology.js', 'js/modules/radiology.js', 'js/modules/lab.js', 'js/modules/or.js', 'js/modules/p5-cath.js', 'js/modules/p5-endo-inj.js', 'js/modules/ward.js', 'js/modules/ward-icu.js', 'js/modules/ward-ob.js', 'js/modules/dialysis.js', 'js/modules/ocs.js'];
const out = new Set();
const LIT = /(['`])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(LIT)) {
    m[2].split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/).forEach((p) => {
      p.replace(/<[^>]*>/g, '\n').split(/\n|\\n/).forEach((q) => { q = q.replace(/\s+/g, ' ').trim(); if (/[가-힣]/.test(q) && q.length >= 4) out.add(q); });
    });
  }
}
fs.writeFileSync('tools/_work/ko-gen.txt', [...out].join('\n'));
console.log('모은 문장', out.size);
