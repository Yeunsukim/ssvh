// 기능검사 — 실별 (심전도실, 심초음파실, 폐기능검사실, 신경생리검사실)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const pick = (name, opts, v) => UI.pick(name, opts.map((x) => (typeof x === 'object' ? x : { v: x, l: x })), v);
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const num = (v) => H.num(v);
  const enc = (p) => H.activeEnc(p.id) || {};
  const hasDx = (p, re) => re.test(`${p.hx || ''} ${enc(p).cc || ''} ${(enc(p).dx || []).map((d) => d.name).join(' ')}`);

  const ROOM = { ecg: '심전도실', echo: '심초음파실', pft: '폐기능검사실', neuro: '신경생리검사실' };
  const roomOf = (o) => (H.M.item(o.code) || {}).room;
  const wait = (room) => S.where('orders', (o) => o.cat === 'PROC' && roomOf(o) === room && o.status === '전송').sort((a, b) => b.stat - a.stat || a.at - b.at);
  const pHead = (o) => { const p = H.pat(o.patientId); return `<div class="row between"><div><b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · 키 ${p.height || '-'}cm · 몸무게 ${p.weight || '-'}kg</span> ${o.stat ? UI.chip('응급', 'stat') : ''}</div><b>${esc(o.name)}</b></div>${o.note ? `<p class="small muted" style="margin:.2rem 0 0">처방 메모: ${esc(o.note)}</p>` : ''}`; };
  const resultBox = (o) => `${UI.textarea('find', '소견', '', { h: '3.5rem' })}${UI.textarea('impr', '결론', '', { h: '2.5rem' })}
    <div class="btn-row end">${UI.btn('측정값으로 판정 계산', 'fx.calc', { icon: 'refresh', data: { code: o.code } })}${UI.btn('결과 보고', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div>`;

  // ── 심전도 ──
  const ecgPat = (p) => /흉통|가슴/.test(enc(p).cc || '') || p.name === '정순자' ? 'ste' : /심방세동/.test(p.hx || '') ? 'af' : (enc(p).dx || []).some((d) => d.code === 'I50.0') ? 'lvh' : 'normal';
  const BRUCE = [[1, '2.7km/시 · 경사 10%'], [2, '4.0km/시 · 12%'], [3, '5.5km/시 · 14%'], [4, '6.8km/시 · 16%'], [5, '8.0km/시 · 18%']];
  function ecgWork(o) {
    const p = H.pat(o.patientId); const v = H.lastVs(p.id) || {}; const pat = ecgPat(p); const age = H.age(p.birth); const thr = Math.round((220 - age) * 0.85);
    if (o.code === 'C7011' && !(o.holter && o.holter.off)) {
      if (!o.holter) return `<form data-submit="fx.holterOn" class="gap-m"><input type="hidden" name="id" value="${o.id}">${UI.note('홀터: 작은 기록기를 24시간 차고 평소처럼 생활하며 심장 리듬을 계속 기록합니다. 증상이 있으면 일지에 시각과 증상을 적게 합니다. 샤워·전기담요·MRI는 피합니다.', 'info')}
        ${checks('c', ['환자 확인 (이름·생년월일)', '가슴 피부 닦기·털 제거 (전극 잘 붙게)', '전극 5~7개 부착·기록기 시작', '증상 일지 쓰는 방법 설명', '내일 같은 시각 반납 안내'])}<div class="btn-row end">${UI.btn('부착 완료 (기록 시작)', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      return `<div class="gap-m">${UI.note(`${T.mdhm(o.holter.on)} 부착 — 24시간 기록 중입니다.`, 'info')}<div class="btn-row end">${UI.btn('실습: 24시간 지남 → 기록기 회수', 'fx.holterOff', { kind: 'pri', data: { id: o.id } })}</div></div>`;
    }
    let f = '';
    if (o.code === 'C7001') f = `${H.ecgSvg ? H.ecgSvg(pat, v.hr || 75) : ''}<div class="form-grid">${UI.input('hr', '심박 (회/분)', String(pat === 'af' ? 128 : v.hr || 75), { type: 'number' })}${UI.input('pr', 'PR 간격 (ms, 120~200)', pat === 'af' ? '' : '160', { type: 'number' })}${UI.input('qrs', 'QRS 폭 (ms, 120 미만)', '92', { type: 'number' })}${UI.input('qtc', '교정 QT (QTc, ms)', '430', { type: 'number' })}${UI.select('rhythm', '리듬', ['정상 동리듬', '동성 빈맥', '심방세동', '심실 조기 수축'], { ste: '동성 빈맥', af: '심방세동', lvh: '동성 빈맥', normal: '정상 동리듬' }[pat])}${UI.select('st', 'ST 분절', ['변화 없음', 'ST 상승 (V2~V4)', 'ST 하강'], pat === 'ste' ? 'ST 상승 (V2~V4)' : '변화 없음')}</div>
      ${checks('c', ['환자 확인 (이름·생년월일)', '가슴 전극 V1~V6 위치 (V1·V2 4번째 갈비사이)', '팔다리 전극 4개', '움직이거나 말하지 않게 안내'])}`;
    else if (o.code === 'C7011') f = `<div class="form-grid">${UI.input('avg', '평균 심박', pat === 'af' ? '104' : '74', { type: 'number' })}${UI.input('min', '최저 심박', '48', { type: 'number' })}${UI.input('max', '최고 심박', pat === 'af' ? '162' : '128', { type: 'number' })}${UI.input('pvc', '심실 조기 수축 (개/24시간)', '320', { type: 'number' })}${UI.input('pause', '가장 긴 멈춤 (초)', '1.8', { type: 'number', step: 'any' })}${UI.select('afb', '심방세동 부담', ['없음', '일부 (발작성)', '계속 (지속성)'], pat === 'af' ? '계속 (지속성)' : '없음')}</div>
      ${UI.textarea('diary', '환자 증상 일지', '오후 3시 계단 오를 때 가슴 두근거림', { h: '2.5rem' })}${checks('c', ['환자 확인 (이름·생년월일)', '기록기 회수·자료 내려받기', '증상 일지 시각과 기록 대조'])}`;
    else f = `${UI.note(`운동부하(트레드밀) 검사: 브루스 방법으로 3분마다 속도·경사를 올립니다. 목표 심박 = (220 − 나이 ${age}) × 85% = <b>${thr}회</b>. 가슴 통증, ST 2mm 넘는 하강, 수축기 혈압 떨어짐, 심한 부정맥, 환자가 원하면 즉시 중단. 응급 카트·제세동기를 옆에 둡니다.`, 'warn')}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>단계</th><th>속도·경사 (3분씩)</th></tr></thead><tbody>${BRUCE.map(([s, t]) => `<tr><td>${s}단계</td><td>${t}</td></tr>`).join('')}</tbody></table></div>
      <div class="form-grid">${UI.input('etime', '운동 시간 (분)', '9.5', { type: 'number', step: 'any' })}${UI.select('stage', '도달 단계', BRUCE.map(([s]) => `${s}단계`), '4단계')}${UI.input('mhr', `최대 심박 (목표 ${thr})`, String(thr + 4), { type: 'number' })}${UI.input('msbp', '최대 수축기 혈압', '182', { type: 'number' })}${UI.select('st', 'ST 변화', ['없음', '수평·하향 ST 하강 1mm 이상', 'ST 상승'], hasDx(p, /협심|관상/) ? '수평·하향 ST 하강 1mm 이상' : '없음')}${UI.select('stop', '중단 이유', ['목표 심박 도달', '다리 피로', '가슴 통증', '숨참', '혈압 떨어짐'], '목표 심박 도달')}</div>
      ${checks('c', ['환자 확인 (이름·생년월일)', '금기 확인 (불안정 협심증·심한 대동맥판 협착 없음)', '검사 3시간 전 금식·편한 신발', '응급 카트·제세동기 확인', '회복기 6분 관찰'])}`;
    return `<form data-submit="fx.save" class="gap-m"><input type="hidden" name="id" value="${o.id}">${f}${resultBox(o)}</form>`;
  }

  // ── 심초음파 ──
  function echoSvg(ef) {
    const s = Math.max(0.55, Math.min(1, ef / 65));
    return `<svg viewBox="0 0 320 240" style="width:100%;max-width:22rem;background:#000;border-radius:6px" role="img" aria-label="가상 심초음파 4방 단면"><path d="M160 10 L20 230 A220 220 0 0 0 300 230 Z" fill="#141414"/>
      <ellipse cx="125" cy="150" rx="${38 + (1 - s) * 18}" ry="${55 + (1 - s) * 18}" fill="#000" stroke="#9a9a9a" stroke-width="5"/><ellipse cx="200" cy="155" rx="30" ry="48" fill="#000" stroke="#8a8a8a" stroke-width="4"/>
      <ellipse cx="125" cy="70" rx="30" ry="22" fill="#000" stroke="#777" stroke-width="3"/><ellipse cx="198" cy="72" rx="26" ry="20" fill="#000" stroke="#777" stroke-width="3"/>
      <text x="125" y="155" fill="#ccc" font-size="11" text-anchor="middle">좌심실</text><text x="200" y="160" fill="#ccc" font-size="11" text-anchor="middle">우심실</text><text x="125" y="74" fill="#aaa" font-size="10" text-anchor="middle">좌심방</text><text x="198" y="76" fill="#aaa" font-size="10" text-anchor="middle">우심방</text>
      <text x="8" y="18" fill="#7fd" font-size="11" font-family="monospace">심첨부 4방 단면 · 박출률 ${ef}%</text></svg>`;
  }
  function echoWork(o) {
    const p = H.pat(o.patientId); const hf = (enc(p).dx || []).some((d) => d.code === 'I50.0') || hasDx(p, /심부전/); const ef = hf ? 32 : hasDx(p, /심근경색|흉통/) ? 45 : 62;
    const tee = o.code === 'C7016';
    return `<form data-submit="fx.save" class="gap-m"><input type="hidden" name="id" value="${o.id}">${tee ? UI.note('경식도 심초음파: 식도로 탐촉자를 넣어 심장 뒤쪽(좌심방 혈전·판막)을 자세히 봅니다. 6시간 금식, 틀니 제거, 목 안 마취(리도카인 분무), 진정제 사용. 검사 뒤 <b>목 마취가 풀릴 때까지 1~2시간 금식</b>(사레·흡인 위험).', 'warn') : ''}
      <div class="grid2">${echoSvg(ef)}<div class="form-grid">${UI.input('ef', '좌심실 박출률 EF (%, 정상 50 이상)', String(ef), { type: 'number' })}${UI.input('lvedd', '좌심실 이완기 직경 (mm, 55 이하)', hf ? '64' : '48', { type: 'number' })}${UI.input('lvesd', '좌심실 수축기 직경 (mm)', hf ? '54' : '30', { type: 'number' })}${UI.input('rvsp', '우심실 수축기압 (mmHg, 35 이하)', hf ? '48' : '26', { type: 'number' })}</div></div>
      <div class="form-grid">${UI.select('wall', '벽 운동', ['정상', '전벽·중격 운동 저하', '전반적 운동 저하'], hf ? '전반적 운동 저하' : ef < 50 ? '전벽·중격 운동 저하' : '정상')}${UI.select('mv', '승모판', ['정상', '경도 역류', '중등도 역류', '중증 역류', '협착'], hf ? '중등도 역류' : '정상')}${UI.select('av', '대동맥판', ['정상', '경화 (석회화)', '협착', '역류'], '정상')}${UI.select('pe', '심낭 삼출', ['없음', '소량', '중등도 이상 (압전 의심)'], '없음')}${tee ? UI.select('laa', '좌심방이 혈전', ['없음', '있음'], '없음') : ''}</div>
      ${checks('c', tee ? ['환자 확인 (이름·생년월일)', '6시간 금식·틀니 제거', '동의서·정맥 주사 경로', '목 마취·진정 후 산소포화도 감시', '검사 후 1~2시간 금식 안내'] : ['환자 확인 (이름·생년월일)', '왼쪽으로 눕게 함 (심장이 가슴벽에 가까워짐)', '심전도 전극 연결', '젤이 차가울 수 있다고 안내'])}${resultBox(o)}</form>`;
  }

  // ── 폐기능 ──
  function pred(p) { const h = p.height || 165; const a = H.age(p.birth); const m = p.sex === 'M'; return { fvc: m ? 0.0576 * h - 0.0269 * a - 4.34 : 0.0443 * h - 0.026 * a - 2.89, fev1: m ? 0.0414 * h - 0.0244 * a - 2.19 : 0.0342 * h - 0.0255 * a - 1.578 }; }
  function fvSvg(obs) {
    const pts = []; for (let i = 0; i <= 40; i++) { const x = i / 40; const y = obs ? (x < 0.08 ? x / 0.08 * 0.7 : 0.7 * Math.pow(1 - (x - 0.08) / 0.92, 2.2)) : (x < 0.12 ? x / 0.12 : 1 - (x - 0.12) / 0.88); pts.push(`${30 + x * 270},${150 - y * 120}`); }
    const nrm = []; for (let i = 0; i <= 40; i++) { const x = i / 40; const y = x < 0.12 ? x / 0.12 : 1 - (x - 0.12) / 0.88; nrm.push(`${30 + x * 300},${150 - y * 125}`); }
    return `<svg viewBox="0 0 340 200" class="chart" role="img" aria-label="유량-용적 곡선"><line x1="30" y1="150" x2="335" y2="150" stroke="var(--line)"/><line x1="30" y1="20" x2="30" y2="150" stroke="var(--line)"/><polyline points="${nrm.join(' ')}" fill="none" stroke="var(--fg-3)" stroke-dasharray="4 3"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
      <text x="34" y="16" font-size="11" fill="var(--fg-2)">유량 (L/초)</text><text x="335" y="168" font-size="11" text-anchor="end" fill="var(--fg-2)">용적 (L)</text><text x="200" y="40" font-size="11" fill="var(--fg-3)">점선 = 예측 정상</text>${obs ? '<text x="140" y="110" font-size="11" fill="var(--accent)">숟가락 모양으로 오목 (폐쇄성)</text>' : ''}</svg>`;
  }
  function pftWork(o) {
    const p = H.pat(o.patientId); const pr = pred(p); const copd = hasDx(p, /COPD|만성 폐쇄|폐기종|천식|흡연/) || o.code === 'C7017';
    const fvc = (pr.fvc * (copd ? 0.82 : 0.97)).toFixed(2); const fev1 = (fvc * (copd ? 0.58 : 0.8)).toFixed(2); const bd = o.code === 'C7017';
    return `<form data-submit="fx.save" class="gap-m"><input type="hidden" name="id" value="${o.id}">${UI.note(`폐기능검사(폐활량 측정): 코를 막고 입에 관을 물고 숨을 끝까지 들이마신 뒤 <b>최대한 세게, 6초 넘게</b> 내쉽니다. 3번 이상 해서 가장 좋은 두 번의 차이가 150mL 이내여야 믿을 수 있습니다. 예측치(키 ${p.height || '-'}cm·나이·성별 기준): 노력성 폐활량(FVC) ${pr.fvc.toFixed(2)}L, 1초 노력성 호기량(FEV1) ${pr.fev1.toFixed(2)}L.`, 'info')}
      ${bd ? UI.note('기관지 확장제 반응 검사: 먼저 측정 → 살부타몰 400마이크로그램 흡입 → 15분 뒤 다시 측정. FEV1이 12% 이상 그리고 200mL 이상 늘면 "양성"(천식을 시사). 검사 전 흡입제 사용을 중단했는지 확인합니다.', 'warn') : ''}
      <div class="grid2"><div>${fvSvg(copd)}</div><div class="form-grid">${UI.input('fvc', 'FVC 측정 (L)', fvc, { type: 'number', step: 'any' })}${UI.input('fev1', 'FEV1 측정 (L)', fev1, { type: 'number', step: 'any' })}${UI.input('tries', '반복 횟수', '3', { type: 'number' })}${UI.input('rep', '가장 좋은 두 번 차이 (mL)', '90', { type: 'number' })}${bd ? UI.input('fev1post', '흡입 후 FEV1 (L)', (fev1 * 1.16).toFixed(2), { type: 'number', step: 'any' }) : ''}</div></div>
      ${checks('c', ['환자 확인 (이름·생년월일)', '키·몸무게 측정 (예측치 계산)', '코 집게 사용', '검사 전 1시간 금연·과식 피함', bd ? '흡입 기관지 확장제 중단 확인 (짧은 것 6시간)' : '어지러우면 바로 앉아 쉬게 함'])}${resultBox(o)}</form>`;
  }

  // ── 신경생리 ──
  function eegSvg(kind) { let g = ''; for (let ch = 0; ch < 6; ch++) { const pts = []; for (let x = 0; x <= 300; x += 3) { let y = Math.sin(x / (kind === 'slow' && ch < 3 ? 14 : 4.5) + ch) * 6 + Math.sin(x / 2.1 + ch * 2) * 2; if (kind === 'spike' && x > 140 && x < 160) y -= (x < 150 ? (x - 140) : (160 - x)) * 3; pts.push(`${40 + x},${20 + ch * 30 + y}`); } g += `<text x="4" y="${24 + ch * 30}" font-size="10" fill="#555" font-family="monospace">${['Fp1', 'F3', 'C3', 'P3', 'O1', 'T3'][ch]}</text><polyline points="${pts.join(' ')}" fill="none" stroke="#123" stroke-width="1"/>`; } return `<svg viewBox="0 0 350 195" style="width:100%;background:#f7f9fb;border-radius:6px;border:1px solid #ccd" role="img" aria-label="뇌파 그래프">${g}</svg>`; }
  function neuroWork(o) {
    const p = H.pat(o.patientId); let f = '';
    if (o.code === 'C7012') { const k = hasDx(p, /경련|뇌전증|발작/) ? 'spike' : hasDx(p, /뇌경색|뇌출혈/) ? 'slow' : 'normal'; f = `${UI.note('뇌파: 머리에 국제 10-20 방법으로 전극 21개를 붙이고 30분 이상 기록합니다. 눈 감기·뜨기, 과호흡(3분), 빛 깜빡임 자극으로 이상파를 유발합니다. 전날 머리를 감되 기름·스프레이는 바르지 않게, 처방에 따라 수면 부족 상태로 오게 합니다.', 'info')}${eegSvg(k)}
      <div class="form-grid">${UI.select('bg', '배경파', ['정상 (뒤쪽 알파파 9~10Hz)', '전반적 서파', '한쪽 서파'], k === 'slow' ? '한쪽 서파' : '정상 (뒤쪽 알파파 9~10Hz)')}${UI.select('epi', '뇌전증 모양 방전', ['없음', '국소 극파', '전반 극서파'], k === 'spike' ? '국소 극파' : '없음')}${UI.select('act', '유발 검사', ['과호흡·광자극 모두 시행', '과호흡 못 함 (협조 안 됨)'], '과호흡·광자극 모두 시행')}</div>
      ${checks('c', ['환자 확인 (이름·생년월일)', '전극 21개 부착·저항 확인', '경련 시 대처 준비 (흡인기·산소·옆으로 눕히기)', '검사 후 전극 풀 닦아 드림'])}`; }
    else if (o.code === 'C7013') { const cts = hasDx(p, /손목|저림|당뇨/); f = `${UI.note('신경전도 검사: 피부에 약한 전기 자극을 주어 신경이 신호를 전달하는 속도를 잽니다. 근전도: 가는 바늘을 근육에 넣어 근육 전기 신호를 봅니다 (조금 아픔). 항응고제를 먹으면 바늘 검사 때 출혈 주의. 로션은 바르지 않습니다.', 'info')}
      <div class="form-grid">${UI.input('mlat', '정중신경 운동 원위 잠시 (ms, 4.2 이하)', cts ? '5.6' : '3.6', { type: 'number', step: 'any' })}${UI.input('mcv', '정중신경 운동 전도속도 (m/초, 50 이상)', cts ? '52' : '57', { type: 'number', step: 'any' })}${UI.input('scv', '정중신경 감각 전도속도 (m/초, 45 이상)', cts ? '36' : '52', { type: 'number', step: 'any' })}${UI.select('emg', '바늘 근전도', ['정상', '탈신경 전위 (신경 손상)', '근육병 양상'], cts ? '정상' : '정상')}</div>
      ${checks('c', ['환자 확인 (이름·생년월일)', '항응고제 복용 확인', '피부 온도 32℃ 이상 (차가우면 느리게 측정됨)', '바늘 찌른 곳 지혈'])}`; }
    else f = `${UI.note('수면다원검사: 저녁에 입원해 밤새 뇌파·눈 움직임·턱 근육·코 공기 흐름·가슴·배 움직임·산소포화도·다리 움직임을 함께 기록합니다. 당일 낮잠·카페인·술 금지. 무호흡-저호흡 지수(AHI, 1시간당 숨 멈춤 횟수)로 수면무호흡 정도를 판정합니다.', 'info')}
      <div class="form-grid">${UI.input('ahi', '무호흡-저호흡 지수 AHI (회/시간)', '34', { type: 'number', step: 'any' })}${UI.input('minsat', '최저 산소포화도 (%)', '78', { type: 'number' })}${UI.input('eff', '수면 효율 (%)', '76', { type: 'number' })}${UI.input('plm', '주기성 다리 움직임 (회/시간)', '4', { type: 'number' })}</div>
      ${checks('c', ['환자 확인 (이름·생년월일)', '낮잠·카페인·술 안 함 확인', '센서 부착·밤새 관찰 (적외선 카메라)', '아침 설문·센서 제거'])}`;
    return `<form data-submit="fx.save" class="gap-m"><input type="hidden" name="id" value="${o.id}">${f}${resultBox(o)}</form>`;
  }

  // ── 판정 계산 ──
  function judge(code, d, p) {
    const n = (k) => num(d[k]);
    if (code === 'C7001') { const im = d.st === 'ST 상승 (V2~V4)' ? '급성 전벽 ST 분절 상승 심근경색 의심 — 즉시 순환기내과 보고' : d.rhythm === '심방세동' ? '심방세동 (빠른 심실 반응) — 항응고 치료 검토' : n('qtc') > 470 ? `QTc 연장 (${n('qtc')}ms) — QT 연장 약 확인` : d.rhythm === '정상 동리듬' && d.st === '변화 없음' ? '정상 심전도' : `${d.rhythm}, ${d.st}`; return [`${d.rhythm}, 심박 ${d.hr}회, PR ${d.pr || '-'}ms, QRS ${d.qrs}ms, QTc ${d.qtc}ms, ST ${d.st}`, im]; }
    if (code === 'C7011') return [`평균 ${d.avg}회 (최저 ${d.min}·최고 ${d.max}), 심실 조기 수축 ${d.pvc}개, 가장 긴 멈춤 ${d.pause}초, 심방세동 ${d.afb}. 일지: ${d.diary}`, d.afb !== '없음' ? `심방세동 (${d.afb}) — 항응고 치료 검토` : n('pause') >= 3 ? '3초 넘는 멈춤 — 심박조율기 검토' : n('pvc') > 10000 ? '심실 조기 수축 많음 — 심장 기능 확인' : '의미 있는 부정맥 없음'];
    if (code === 'C7015') { const thr = Math.round((220 - H.age(p.birth)) * 0.85); const pos = /하강|상승/.test(d.st) && d.st !== '없음'; return [`브루스 ${d.stage}, 운동 ${d.etime}분, 최대 심박 ${d.mhr}회 (목표 ${thr}회 ${n('mhr') >= thr ? '도달' : '미도달'}), 최대 혈압 ${d.msbp}, ST ${d.st}, 중단: ${d.stop}`, pos ? '운동부하 검사 양성 — 허혈 의심, 관상동맥 검사 권고' : n('mhr') < thr ? '목표 심박 미도달 — 판정 불충분 (약물 부하 검사 고려)' : '운동부하 검사 음성']; }
    if (code === 'C7010' || code === 'C7016') { const ef = n('ef'); const g = ef >= 50 ? '정상 수축 기능' : ef >= 41 ? '경계성 수축 기능 저하' : '좌심실 수축 기능 저하 (박출률 감소 심부전)'; return [`EF ${ef}%, 좌심실 직경 ${d.lvedd}/${d.lvesd}mm, 벽 운동 ${d.wall}, 승모판 ${d.mv}, 대동맥판 ${d.av}, 우심실압 ${d.rvsp}mmHg, 심낭 삼출 ${d.pe}${d.laa ? `, 좌심방이 혈전 ${d.laa}` : ''}`, `${g}${n('lvedd') > 55 ? ', 좌심실 확장' : ''}${d.mv !== '정상' ? `, 승모판 ${d.mv}` : ''}${n('rvsp') > 35 ? ', 폐고혈압 의심' : ''}${d.laa === '있음' ? ' — 좌심방이 혈전: 심율동전환 금기' : ''}${/압전/.test(d.pe) ? ' — 심장눌림증 의심, 즉시 보고' : ''}`]; }
    if (code === 'C7009' || code === 'C7017') {
      const pr = pred(p); const fvc = n('fvc'); const fev1 = n('fev1'); const ratio = fev1 / fvc; const fvcP = Math.round(fvc / pr.fvc * 100); const fevP = Math.round(fev1 / pr.fev1 * 100);
      const ok = n('tries') >= 3 && n('rep') <= 150; let im = ratio < 0.7 ? `폐쇄성 환기 장애 — GOLD ${fevP >= 80 ? 1 : fevP >= 50 ? 2 : fevP >= 30 ? 3 : 4}단계 (FEV1 예측치 ${fevP}%)` : fvcP < 80 ? '제한성 환기 장애 의심 — 폐용적 검사 권고' : '정상 폐기능';
      let bd = ''; if (d.fev1post) { const dv = n('fev1post') - fev1; const pc = dv / fev1 * 100; const posi = pc >= 12 && dv >= 0.2; bd = `, 흡입 후 FEV1 ${d.fev1post}L (+${Math.round(dv * 1000)}mL, +${pc.toFixed(0)}%)`; im += posi ? ' · 기관지 확장제 반응 양성 (천식 시사)' : ' · 기관지 확장제 반응 음성'; }
      return [`FVC ${fvc}L (예측치 ${fvcP}%), FEV1 ${fev1}L (예측치 ${fevP}%), FEV1/FVC ${ratio.toFixed(2)}${bd}. 검사 신뢰도 ${ok ? '좋음' : '낮음 (반복 3회·차이 150mL 기준 미달)'}`, im];
    }
    if (code === 'C7012') return [`배경파 ${d.bg}, 뇌전증 모양 방전 ${d.epi}, 유발 검사 ${d.act}`, d.epi !== '없음' ? `비정상 뇌파 — ${d.epi} (뇌전증 시사)` : d.bg.startsWith('정상') ? '정상 뇌파' : `비정상 뇌파 — ${d.bg} (뇌 기능 저하)`];
    if (code === 'C7013') { const cts = n('mlat') > 4.2 || n('scv') < 45; return [`정중신경 운동 원위 잠시 ${d.mlat}ms, 운동 전도 ${d.mcv}m/초, 감각 전도 ${d.scv}m/초, 바늘 근전도 ${d.emg}`, cts ? '손목굴 증후군 (정중신경 손목 부위 압박) 소견' : d.emg !== '정상' ? `근전도 이상 — ${d.emg}` : '정상 신경전도·근전도']; }
    const ahi = n('ahi'); return [`AHI ${ahi}회/시간, 최저 산소포화도 ${d.minsat}%, 수면 효율 ${d.eff}%, 주기성 다리 움직임 ${d.plm}회/시간`, `${ahi < 5 ? '정상' : ahi < 15 ? '경증' : ahi < 30 ? '중등도' : '중증'} 폐쇄성 수면무호흡${ahi >= 15 ? ' — 양압기(CPAP) 치료 권고' : ''}`];
  }

  function roomView(room, work, help) {
    const list = wait(room); const sel = ms('sel_' + room, ''); const cur = list.find((o) => o.id === sel) || list[0];
    return `<div class="gap-m">${UI.note(help, 'info')}<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,2.2fr)"><div class="gap-s">${UI.sec(`대기 ${list.length}건`)}${list.map((o) => `<button class="prow ${cur && o.id === cur.id ? 'on' : ''}" style="border:1px solid var(--line);border-radius:6px" data-act="fx.sel" data-room="${room}" data-id="${o.id}"><span class="nm">${esc(H.pat(o.patientId).name)}</span><span class="mk">${o.stat ? UI.chip('응급', 'stat') : ''}</span><span class="sub">${esc(o.name)}${o.holter && !o.holter.off ? ' · 기록 중' : ''}</span></button>`).join('') || '<p class="muted small">대기 없음</p>'}</div>
      <div class="box" style="background:var(--surface)">${cur ? `${pHead(cur)}<div style="margin-top:.6rem">${work(cur)}</div>` : UI.empty('검사 대기가 없습니다', '처방 화면의 처치 탭에서 냅니다.')}</div></div></div>`;
  }
  function tabDone() {
    const l = S.where('orders', (o) => o.cat === 'PROC' && roomOf(o) && o.status === '시행완료' && o.result).sort((a, b) => b.result.at - a.result.at).slice(0, 30);
    return UI.table([{ h: '보고' }, { h: '실' }, { h: '환자' }, { h: '검사' }, { h: '결론' }], l.map((o) => [`<span class="num small">${T.mdhm(o.result.at)}</span>`, esc(ROOM[roomOf(o)]), esc(H.pat(o.patientId).name), esc(o.name), esc(o.result.impression)]), { empty: UI.empty('보고된 결과가 없습니다') });
  }

  H.reg({
    id: 'func', title: '기능검사실', actor: '기능검사 담당 (임상병리사)', layout: 'full', channels: () => ['func'],
    render() {
      const tab = ms('tab', 'ecg');
      const tabs = Object.entries(ROOM).map(([id, label]) => ({ id, label, cnt: wait(id).length || '' })).concat([{ id: 'done', label: '보고 완료', icon: 'list' }]);
      const BODY = { ecg: () => roomView('ecg', ecgWork, '심전도실: 12유도 심전도(5분), 24시간 홀터, 운동부하(트레드밀) 검사를 합니다. 응급 심전도(가슴 통증)는 10분 안에 찍고 의사에게 바로 보여 줍니다.'),
        echo: () => roomView('echo', echoWork, '심초음파실: 초음파로 심장 크기·벽 움직임·판막·박출률(EF, 한 번 뛸 때 내보내는 피의 비율)을 봅니다. 경흉부(가슴 위)와 경식도(식도 안) 두 가지가 있습니다.'),
        pft: () => roomView('pft', pftWork, '폐기능검사실: 폐활량을 재서 폐쇄성(COPD·천식, FEV1/FVC 0.7 미만)인지 제한성(폐섬유화 등, FVC 감소)인지 구분합니다. 환자의 노력이 결과를 좌우하므로 크게 격려합니다.'),
        neuro: () => roomView('neuro', neuroWork, '신경생리검사실: 뇌파(뇌전증·의식 저하), 근전도·신경전도(손발 저림·근력 저하), 수면다원(수면무호흡)을 합니다.'), done: tabDone }; const body = (BODY[tab] || Object.values(BODY)[0])();
      return `<div class="panel">${UI.tabs('fx.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'fx.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'fx.sel': (el) => { set('sel_' + el.dataset.room, el.dataset.id); A.render(); },
      'fx.calc': (el) => { const f = el.closest('form'); const d = H.formData(f); const o = S.get('orders', d.id); const [a, b] = judge(o.code, d, H.pat(o.patientId)); f.querySelector('[name=find]').value = a; f.querySelector('[name=impr]').value = b; },
      'fx.holterOn': (f, d) => { if (arr(d.c).length < 5) return UI.toast('다섯 가지를 확인하세요', 'warn'); const o = S.get('orders', d.id); o.holter = { on: Date.now(), by: H.who() }; S.save(); if (o.ward) H.notify('ward:' + o.ward, `${H.pat(o.patientId).name} 홀터 부착 — 24시간, 샤워 금지, 증상 일지 기록 도와주세요`, { patientId: o.patientId }); UI.toast('홀터 부착 — 24시간 기록', 'ok'); A.render(); },
      'fx.holterOff': (el) => { const o = S.get('orders', el.dataset.id); o.holter.off = Date.now(); S.save(); UI.toast('기록기 회수 — 분석하세요', 'ok'); A.render(); },
      'fx.save': (f, d) => {
        if (!arr(d.c).length || !arr(d.c).some((x) => /환자 확인/.test(x))) return UI.toast('환자 확인을 하세요', 'err'); if (!d.impr) return UI.toast('"측정값으로 판정 계산"을 누르거나 결론을 써 주세요', 'warn');
        const o = S.get('orders', d.id); const p = H.pat(o.patientId); const data = Object.assign({}, d); delete data.c; delete data.find; delete data.impr; delete data.id;
        F.advance(o, '시행완료', { result: { at: Date.now(), by: H.who(), findings: d.find, impression: d.impr, data, room: ROOM[roomOf(o)] } });
        const urgent = /ST 분절 상승|심근경색|심방세동|양성 —|심장눌림|혈전|멈춤/.test(d.impr);
        H.notify('doctor', `기능검사 결과: ${p.name} ${o.name} — ${d.impr}`, { patientId: p.id, level: urgent ? 'stat' : '' });
        if (o.ward) H.notify('ward:' + o.ward, `기능검사 결과: ${p.name} ${o.name}${o.code === 'C7016' ? ' — 1~2시간 금식 후 물부터 시작' : ''}`, { patientId: p.id });
        UI.toast(urgent ? '중요 소견 — 의사에게 바로 알렸습니다' : '결과 보고', urgent ? 'warn' : 'ok'); A.render();
      },
    },
  });
})();
