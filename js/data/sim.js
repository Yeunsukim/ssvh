// 시뮬레이션 자료: 검사 결과값, 영상 그림·판독문, 병리 판독문 만들기
(function () {
  const H = window.H;

  const roundLike = (v, lo, hi) => {
    const span = Math.abs((hi || 1) - (lo || 0));
    const d = span < 2 ? 2 : span < 20 ? 1 : 0;
    return Number(v.toFixed(d));
  };

  // 검사 항목 값: 환자 사례값이 있으면 그 값, 없으면 정상 범위 안의 값
  function labValue(p, item) {
    const sc = (p && p.scenario && p.scenario.labs) || {};
    if (sc[item.c] != null) return String(sc[item.c]);
    if (item.text) return item.normal;
    const lo = item.lo != null ? item.lo : 0;
    const hi = item.hi != null ? item.hi : lo * 2 || 1;
    const v = lo + (hi - lo) * (0.25 + Math.random() * 0.5);
    return String(roundLike(v, lo, hi));
  }

  const RAD_NORMAL = {
    cxr: { f: '양측 폐야에 활동성 병변 없음. 심장 크기 정상 범위 (심흉곽비 0.48). 늑골횡격막각 예리함.', i: '정상 흉부 X선' },
    axr: { f: '장 가스 분포 정상. 비정상 석회화 없음. 유리 공기 없음.', i: '특이 소견 없음' },
    bone: { f: '골절이나 탈구 소견 없음. 관절 간격 유지됨.', i: '골 이상 없음' },
    ctbrain: { f: '두개 내 출혈 없음. 뇌실 크기 정상. 정중선 이동 없음. 급성 경색 소견 뚜렷하지 않음.', i: '급성 두개 내 출혈 없음' },
    ctchest: { f: '폐실질에 결절이나 경화 없음. 종격동 림프절 비대 없음. 흉수 없음.', i: '특이 소견 없음' },
    ctabd: { f: '간, 담낭, 췌장, 비장, 양측 신장 정상. 복수 없음. 림프절 비대 없음.', i: '특이 소견 없음' },
    mribrain: { f: '확산강조영상에서 확산 제한 병변 없음. 백질 변화 경미.', i: '급성 뇌경색 없음' },
    usabd: { f: '간 실질 에코 정상. 담낭벽 두께 정상, 담석 없음. 총담관 확장 없음.', i: '특이 소견 없음' },
    mammo: { f: '양측 유방 불균질 치밀유방. 의심스러운 종괴나 미세석회화 없음.', i: 'BI-RADS 1 (음성)' },
    usbreast: { f: '양측 유방에 의심스러운 고형 종괴 없음.', i: 'BI-RADS 1 (음성)' },
    cag: { f: '관상동맥에 의미 있는 협착 없음.', i: '정상 관상동맥' },
    bmd: { f: '요추 1~4번 T-점수 -0.6, 대퇴골 목 T-점수 -0.8', i: '정상 골밀도' },
    fluoro: { f: '바륨이 식도·위·십이지장을 잘 통과함. 점막 이상·궤양·막힘 없음.', i: '정상 위장 조영' },
    angio: { f: '뇌혈관 협착·동맥류 없음.', i: '정상 뇌혈관 조영' },
    bonescan: { f: '비정상적인 방사성 동위원소 섭취 증가 없음.', i: '뼈 전이 소견 없음' },
    pet: { f: '비정상 포도당 대사 증가 병변 없음.', i: '악성 의심 병변 없음' },
    thyroid: { f: '양쪽 갑상선 섭취 고르고 정상 범위.', i: '정상 갑상선 스캔' },
    spect: { f: '부하·휴식 영상 모두 심근 관류 결손 없음.', i: '심근 허혈 소견 없음' },
    mriknee: { f: '반월상 연골·십자인대 정상. 관절액 소량.', i: '특이 소견 없음' },
  };
  function radReport(p, order) {
    const it = H.M.item(order.code);
    const sc = (p && p.scenario && p.scenario.rad && p.scenario.rad[it.kind]) || null;
    const n = it.nf || RAD_NORMAL[it.kind] ||{ f: '특이 소견 없음.', i: '특이 소견 없음' };
    return { findings: sc ? sc.f : n.f, impression: sc ? sc.i : n.i, lesion: sc ? sc.lesion : null };
  }

  const PATH_NORMAL = {
    gross: '받은 검체는 회백색의 작은 조직 조각들로, 모두 포매함.',
    micro: '염증 세포 침윤이 약간 있는 정상 조직 구조. 악성 세포 없음.',
    dx: '만성 염증, 악성 소견 없음',
  };
  function pathReport(p) {
    const sc = (p && p.scenario && p.scenario.path) || null;
    return sc ? Object.assign({}, PATH_NORMAL, sc) : Object.assign({}, PATH_NORMAL);
  }

  // ── 가짜 영상 그림 (SVG) ──
  const noise = (id, freq = 0.9, op = 0.18) => `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${op} 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

  function radImage(kind, lesion, slice = 0, o = {}) {
    const inv = o.invert ? ' style="filter:invert(1)"' : '';
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    let body = '';
    const L = lesion || null;
    switch (kind) {
      case 'cxr': {
        let ribs = '';
        for (let i = 0; i < 9; i++) {
          const y = 95 + i * 26;
          ribs += `<path d="M200 ${y} q-70 -10 -130 ${30 + i * 2}" stroke="#bbb" stroke-opacity=".35" stroke-width="7" fill="none"/><path d="M200 ${y} q70 -10 130 ${30 + i * 2}" stroke="#bbb" stroke-opacity=".35" stroke-width="7" fill="none"/>`;
        }
        body = `<defs><radialGradient id="${id}b" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#9a9a9a"/><stop offset="1" stop-color="#1a1a1a"/></radialGradient>${noise(id + 'n')}</defs>
          <rect width="400" height="400" fill="#050505"/>
          <path d="M60 70 Q200 30 340 70 L370 390 L30 390 Z" fill="url(#${id}b)"/>
          <ellipse cx="135" cy="210" rx="72" ry="135" fill="#151515"/><ellipse cx="268" cy="210" rx="70" ry="135" fill="#151515"/>
          ${ribs}
          <rect x="190" y="60" width="20" height="330" fill="#d8d8d8" opacity=".55"/>
          <path d="M200 200 q-45 10 -50 75 q30 45 95 35 q40 -35 15 -100 q-25 -20 -60 -10z" fill="#e8e8e8" opacity=".65"/>
          <path d="M70 85 q60 -20 120 5" stroke="#eee" stroke-width="10" opacity=".6" fill="none"/><path d="M330 85 q-60 -20 -120 5" stroke="#eee" stroke-width="10" opacity=".6" fill="none"/>
          <path d="M70 320 q65 35 120 15 M330 320 q-65 35 -120 15" stroke="#ddd" stroke-width="6" opacity=".5" fill="none"/>
          ${L ? `<ellipse cx="${L.x}" cy="${L.y}" rx="${L.rx}" ry="${L.ry || L.rx}" fill="#fff" opacity=".42" filter="url(#${id}n)"/><ellipse cx="${L.x}" cy="${L.y}" rx="${L.rx}" ry="${L.ry || L.rx}" fill="#fff" opacity=".22"/>` : ''}
          <rect width="400" height="400" fill="#888" filter="url(#${id}n)" opacity=".35"/>
          <text x="30" y="40" fill="#fff" font-size="22" font-family="monospace">R</text>`;
        break;
      }
      case 'axr':
        body = `<defs>${noise(id + 'n')}</defs><rect width="400" height="400" fill="#0b0b0b"/><path d="M50 40 L350 40 L360 380 L40 380Z" fill="#6d6d6d"/>
          <rect x="188" y="40" width="24" height="300" fill="#ddd" opacity=".7"/>
          ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${110 + i * 45}" cy="${150 + (i % 2) * 60}" rx="22" ry="14" fill="#222"/>`).join('')}
          <path d="M70 330 q130 -70 260 0 q-20 40 -130 50 q-110 -10 -130 -50z" fill="#cfcfcf" opacity=".6"/>
          <rect width="400" height="400" fill="#999" filter="url(#${id}n)" opacity=".3"/>`;
        break;
      case 'bone':
        body = `<defs>${noise(id + 'n')}</defs><rect width="400" height="400" fill="#060606"/>
          <rect x="${150 + slice * 8}" y="20" width="62" height="240" rx="18" fill="#cfcfcf"/><rect x="${228 + slice * 4}" y="40" width="26" height="230" rx="10" fill="#bdbdbd"/>
          <path d="M140 270 q60 -25 125 5 q15 30 -20 50 l-95 0 q-30 -25 -10 -55z" fill="#d8d8d8"/>
          <path d="M110 330 q100 -20 200 0 l20 50 l-240 0z" fill="#bcbcbc"/>
          <ellipse cx="240" cy="290" rx="${L ? 60 : 40}" ry="${L ? 34 : 22}" fill="#888" opacity=".35"/>
          <rect width="400" height="400" fill="#aaa" filter="url(#${id}n)" opacity=".25"/>`;
        break;
      case 'ctbrain':
      case 'mribrain': {
        const mri = kind === 'mribrain';
        const v = slice * 6;
        body = `<defs>${noise(id + 'n', 1.4, 0.25)}</defs><rect width="400" height="400" fill="#000"/>
          ${mri ? '' : '<ellipse cx="200" cy="205" rx="150" ry="178" fill="#f0f0f0"/>'}
          <ellipse cx="200" cy="205" rx="138" ry="166" fill="${mri ? '#3a3a3a' : '#7a7a7a'}"/>
          <path d="M200 60 L200 350" stroke="#555" stroke-width="3"/>
          <path d="M170 ${170 + v} q-25 30 0 70 q10 -35 0 -70z M230 ${170 + v} q25 30 0 70 q-10 -35 0 -70z" fill="${mri ? '#111' : '#2b2b2b'}"/>
          ${L ? `<ellipse cx="${L.x}" cy="${L.y + v / 2}" rx="${L.rx}" ry="${L.ry || L.rx}" fill="${mri ? '#fff' : L.dark ? '#4a4a4a' : '#fff'}" opacity="${mri ? 0.9 : 0.7}"/>` : ''}
          <rect width="400" height="400" fill="#aaa" filter="url(#${id}n)" opacity=".3"/>`;
        break;
      }
      case 'ctchest':
        body = `<defs>${noise(id + 'n', 1.2, 0.2)}</defs><rect width="400" height="400" fill="#000"/>
          <ellipse cx="200" cy="210" rx="180" ry="125" fill="#8a8a8a"/>
          <ellipse cx="125" cy="200" rx="68" ry="${90 - slice * 6}" fill="#0c0c0c"/><ellipse cx="275" cy="200" rx="68" ry="${90 - slice * 6}" fill="#0c0c0c"/>
          <ellipse cx="210" cy="230" rx="45" ry="40" fill="#b5b5b5"/><circle cx="200" cy="315" r="22" fill="#eee"/>
          ${L ? `<circle cx="${L.x}" cy="${L.y}" r="${L.rx}" fill="#ccc"/>` : ''}
          <rect width="400" height="400" fill="#999" filter="url(#${id}n)" opacity=".25"/>`;
        break;
      case 'ctabd':
        body = `<defs>${noise(id + 'n', 1.2, 0.2)}</defs><rect width="400" height="400" fill="#000"/>
          <ellipse cx="200" cy="210" rx="175" ry="130" fill="#5e5e5e"/>
          <path d="M60 170 q40 -80 130 -60 l-10 140 q-90 10 -120 -80z" fill="#9c9c9c"/>
          <ellipse cx="290" cy="170" rx="40" ry="28" fill="#8a8a8a"/>
          <ellipse cx="140" cy="270" rx="26" ry="36" fill="#bdbdbd"/><ellipse cx="260" cy="270" rx="26" ry="36" fill="#bdbdbd"/>
          <circle cx="200" cy="300" r="22" fill="#eee"/>
          ${L ? `<ellipse cx="${L.x}" cy="${L.y + slice * 4}" rx="${L.rx}" ry="${L.ry || L.rx}" fill="#d0d0d0"/>` : ''}
          <rect width="400" height="400" fill="#999" filter="url(#${id}n)" opacity=".25"/>`;
        break;
      case 'usabd':
      case 'usbreast':
        body = `<defs>${noise(id + 'n', 2.2, 0.55)}<clipPath id="${id}c"><path d="M200 30 L380 330 Q200 400 20 330 Z"/></clipPath></defs><rect width="400" height="400" fill="#000"/>
          <g clip-path="url(#${id}c)"><rect width="400" height="400" fill="#3c3c3c"/><rect width="400" height="400" fill="#bbb" filter="url(#${id}n)"/>
          ${kind === 'usabd'
            ? `<ellipse cx="200" cy="200" rx="85" ry="${48 + slice * 4}" fill="#060606" stroke="${L ? '#9a9a9a' : '#666'}" stroke-width="${L ? 9 : 3}"/>${L ? '<circle cx="230" cy="220" r="14" fill="#f4f4f4"/><circle cx="205" cy="226" r="11" fill="#eee"/><rect x="198" y="236" width="44" height="120" fill="#000" opacity=".75"/>' : ''}`
            : L ? `<path d="M${L.x} ${L.y - 30} l18 14 l22 -6 l-6 22 l16 18 l-24 4 l-8 22 l-16 -16 l-22 8 l4 -24 l-18 -16 l24 -4z" fill="#0a0a0a"/><rect x="${L.x - 10}" y="${L.y + 25}" width="30" height="110" fill="#000" opacity=".5"/>` : ''}
          </g>
          <text x="20" y="390" fill="#7ff" font-size="12" font-family="monospace">5.0MHz  깊이 16cm</text>`;
        break;
      case 'mammo':
        body = `<defs>${noise(id + 'n', 1.6, 0.4)}<radialGradient id="${id}m" cx="10%" cy="50%" r="90%"><stop offset="0" stop-color="#cfcfcf"/><stop offset="1" stop-color="#2a2a2a"/></radialGradient></defs><rect width="400" height="400" fill="#000"/>
          <path d="M20 20 L20 380 Q330 360 360 200 Q330 40 20 20z" fill="url(#${id}m)"/>
          <path d="M20 20 L20 380 Q330 360 360 200 Q330 40 20 20z" fill="#ddd" filter="url(#${id}n)" opacity=".5"/>
          ${L ? `<g transform="translate(${L.x} ${L.y})"><circle r="16" fill="#fff"/>${[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => `<line x1="0" y1="0" x2="${Math.cos(a * Math.PI / 180) * 34}" y2="${Math.sin(a * Math.PI / 180) * 34}" stroke="#fff" stroke-width="2"/>`).join('')}</g>` : ''}
          <text x="330" y="40" fill="#fff" font-size="18" font-family="monospace">${slice ? 'MLO' : 'CC'}</text>`;
        break;
      case 'bmd':
        body = `<rect width="400" height="400" fill="#000"/>${[0, 1, 2, 3].map((i) => `<rect x="150" y="${60 + i * 72}" width="100" height="58" rx="10" fill="#bfbfbf"/><text x="262" y="${95 + i * 72}" fill="#8fe6d8" font-size="14" font-family="monospace">L${i + 1}</text><rect x="148" y="${58 + i * 72}" width="104" height="62" fill="none" stroke="#3cb8c2" stroke-width="2"/>`).join('')}<text x="12" y="390" fill="#8fe6d8" font-size="12" font-family="monospace">요추 1~4번 관심 영역</text>`;
        break;
      case 'fluoro':
        body = `<defs>${noise(id + 'n')}</defs><rect width="400" height="400" fill="#3a3a3a"/><rect x="190" y="20" width="22" height="360" fill="#8a8a8a"/>
          <path d="M215 60 q-10 40 -5 60 q80 10 110 70 q20 70 -40 110 q-60 30 -95 -10 q-20 -30 10 -60 q30 -20 20 -60z" fill="#f2f2f2"/>
          <path d="M180 250 q-30 20 -20 60 q20 30 60 20" stroke="#e8e8e8" stroke-width="16" fill="none"/>${L ? `<circle cx="${L.x || 270}" cy="${L.y || 170}" r="12" fill="#3a3a3a"/>` : ''}
          <rect width="400" height="400" fill="#999" filter="url(#${id}n)" opacity=".2"/>`;
        break;
      case 'angio':
        body = `<rect width="400" height="400" fill="#0a0a0a"/><ellipse cx="200" cy="200" rx="160" ry="180" fill="#151515"/>
          <path d="M200 380 L200 260 Q140 220 110 140 M200 260 Q260 220 290 140 M110 140 Q90 100 70 90 M110 140 Q130 90 150 70 M290 140 Q310 100 330 90 M290 140 Q270 90 250 70 M200 260 Q200 200 200 130" stroke="#eaeaea" stroke-width="6" fill="none"/>
          ${L ? `<circle cx="${L.x || 290}" cy="${L.y || 140}" r="14" fill="#eaeaea"/>` : ''}`;
        break;
      case 'bonescan':
      case 'pet': {
        const hot = kind === 'pet' ? '#111' : '#222';
        body = `<rect width="400" height="400" fill="#fff"/><g fill="none" stroke="#666" stroke-width="5" opacity=".75">
          <circle cx="200" cy="50" r="28"/><path d="M200 80 L200 230 M150 100 L250 100 M150 100 L120 220 M250 100 L280 220 M200 230 L170 380 M200 230 L230 380"/>
          ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M200 ${110 + i * 16} q-40 6 -45 18 M200 ${110 + i * 16} q40 6 45 18"/>`).join('')}</g>
          <circle cx="200" cy="232" r="20" fill="#bbb"/>${kind === 'pet' ? '<circle cx="200" cy="50" r="22" fill="#555"/><ellipse cx="200" cy="215" rx="16" ry="10" fill="#444"/>' : ''}
          ${L ? `<circle cx="${L.x || 160}" cy="${L.y || 150}" r="${L.rx || 12}" fill="${hot}"/>` : ''}<text x="10" y="390" fill="#333" font-size="12" font-family="monospace">${kind === 'pet' ? 'PET 최대강도투사' : '전신 뼈 스캔 (앞)'}</text>`;
        break;
      }
      case 'thyroid':
        body = `<rect width="400" height="400" fill="#000"/><ellipse cx="160" cy="200" rx="45" ry="90" fill="#c84"/><ellipse cx="240" cy="200" rx="45" ry="90" fill="#c84"/><rect x="160" y="230" width="80" height="30" fill="#a63"/>${L ? `<circle cx="${L.x || 240}" cy="${L.y || 180}" r="22" fill="${L.hot ? '#ff4' : '#000'}"/>` : ''}<text x="12" y="390" fill="#8fe6d8" font-size="12" font-family="monospace">갑상선 섭취 (앞)</text>`;
        break;
      case 'spect':
        body = `<rect width="400" height="400" fill="#000"/>${[0, 1, 2].map((i) => `<g transform="translate(${70 + i * 130} 200)"><circle r="48" fill="none" stroke="#e33" stroke-width="20"/><circle r="48" fill="none" stroke="#fd3" stroke-width="8"/>${L && i === 1 ? '<path d="M-30 -38 A48 48 0 0 1 30 -38" stroke="#003" stroke-width="22" fill="none"/>' : ''}</g>`).join('')}<text x="12" y="390" fill="#8fe6d8" font-size="12" font-family="monospace">단축 단면 — 부하 / 휴식</text>`;
        break;
      case 'mriknee':
        body = `<defs>${noise(id + 'n', 1.4, 0.25)}</defs><rect width="400" height="400" fill="#000"/><path d="M150 0 L250 0 L240 170 Q200 200 160 170Z" fill="#888"/><path d="M160 230 Q200 200 240 230 L250 400 L150 400Z" fill="#888"/>
          <path d="M150 195 Q200 220 250 195" stroke="#333" stroke-width="10" fill="none"/>${L ? `<path d="M210 205 l12 6" stroke="#fff" stroke-width="4"/>` : ''}<rect width="400" height="400" fill="#aaa" filter="url(#${id}n)" opacity=".25"/>`;
        break;
      default:
        body = `<rect width="400" height="400" fill="#000"/><path d="M80 300 q60 -120 120 -150 q60 -40 120 -110" stroke="#ddd" stroke-width="10" fill="none"/><path d="M200 150 q20 60 80 90" stroke="#ccc" stroke-width="6" fill="none"/>`;
    }
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="교육용 가상 영상"${inv}>${body}</svg>`;
  }
  const SLICES = { cxr: ['정면'], axr: ['누운 자세'], bone: ['정면', '측면', '사면'], ctbrain: ['축상 1', '축상 2', '축상 3'], mribrain: ['DWI 1', 'DWI 2'], ctchest: ['축상 1', '축상 2'], ctabd: ['축상 1', '축상 2', '축상 3'], usabd: ['담낭 장축', '담낭 단축'], mammo: ['CC (위아래)', 'MLO (비스듬히)'], usbreast: ['횡단면', '종단면'], cag: ['좌관상동맥'], bmd: ['요추', '대퇴골'], fluoro: ['위 앞면', '위 비스듬히'], angio: ['경동맥 앞면', '경동맥 옆면'], bonescan: ['전신 앞', '전신 뒤'], pet: ['최대강도투사'], thyroid: ['앞면'], spect: ['단축 단면'], mriknee: ['T2 시상면', 'PD 관상면'] };

  H.sim = { labValue, radReport, pathReport, radImage, SLICES };
})();
