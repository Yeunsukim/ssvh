// 처방 목록(마스터) — 교육용 가상 자료. 가격은 3단계 수납 실습용 근사치입니다.
(function () {
  const H = window.H;

  const CAT = {
    MED: { l: '먹는 약', short: '경구약', icon: 'pill', dept: '약제부' },
    INJ: { l: '주사', short: '주사', icon: 'drop', dept: '약제부' },
    LAB: { l: '진단검사', short: '검사', icon: 'flask', dept: '진단검사의학과' },
    RAD: { l: '영상검사', short: '영상', icon: 'image', dept: '영상의학과' },
    PATH: { l: '병리검사', short: '병리', icon: 'micro', dept: '병리과' },
    PROC: { l: '처치·시술', short: '처치', icon: 'steth', dept: '병동' },
    NUR: { l: '간호처방', short: '간호', icon: 'clip', dept: '병동' },
    DIET: { l: '식이', short: '식이', icon: 'home', dept: '영양팀' },
    BLOOD: { l: '수혈', short: '혈액', icon: 'drop', dept: '혈액은행' },
    CONSULT: { l: '협진 의뢰', short: '협진', icon: 'chat', dept: '해당 진료과' },
    OP: { l: '수술', short: '수술', icon: 'steth', dept: '수술실' },
    CV: { l: '심혈관 시술', short: '심혈관', icon: 'heart', dept: '심혈관센터' },
    EN: { l: '내시경', short: '내시경', icon: 'eye', dept: '내시경실' },
  };

  const FREQ = {
    QD: { l: '하루 1번 (QD)', n: 1, times: [9] },
    BID: { l: '하루 2번 (BID)', n: 2, times: [9, 21] },
    TID: { l: '하루 3번 (TID)', n: 3, times: [9, 13, 18] },
    QID: { l: '하루 4번 (QID)', n: 4, times: [9, 13, 18, 21] },
    Q1H: { l: '1시간마다 (Q1H)', n: 24, times: [] },
    Q2H: { l: '2시간마다 (Q2H)', n: 12, times: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
    Q4H: { l: '4시간마다 (Q4H)', n: 6, times: [2, 6, 10, 14, 18, 22] },
    Q6H: { l: '6시간마다 (Q6H)', n: 4, times: [0, 6, 12, 18] },
    Q8H: { l: '8시간마다 (Q8H)', n: 3, times: [6, 14, 22] },
    Q12H: { l: '12시간마다 (Q12H)', n: 2, times: [9, 21] },
    HS: { l: '자기 전 (HS)', n: 1, times: [21] },
    PRN: { l: '필요할 때 (PRN)', n: 0, times: [] },
    ONCE: { l: '한 번만 (ONCE)', n: 1, times: [] },
    STAT: { l: '즉시 (STAT)', n: 1, times: [] },
    CONT: { l: '지속 주입', n: 1, times: [] },
  };
  const ROUTE = { PO: '먹는 약 (PO)', IV: '정맥 (IV)', IM: '근육 (IM)', SC: '피하 (SC)', SL: '혀 밑 (SL)', INH: '흡입 (INH)', TOP: '바르는 약 (TOP)' };

  const m = (code, name, ing, cls, dose, unit, route, freq, maxDay, price, extra) => Object.assign({ code, name, ing, cls, dose, unit, route, freq, maxDay, price }, extra || {});

  const MED = [
    m('D0101', '아세트아미노펜정 500mg', '아세트아미노펜', 'analgesic', 500, 'mg', 'PO', 'PRN', 4000, 40),
    m('D0102', '이부프로펜정 400mg', '이부프로펜', 'nsaid', 400, 'mg', 'PO', 'TID', 3200, 60),
    m('D0103', '아스피린장용정 100mg', '아스피린', 'nsaid antiplatelet', 100, 'mg', 'PO', 'QD', 300, 30),
    m('D0104', '아스피린 300mg (씹어먹기)', '아스피린', 'nsaid antiplatelet', 300, 'mg', 'PO', 'STAT', 600, 50),
    m('D0105', '클로피도그렐정 75mg', '클로피도그렐', 'antiplatelet', 75, 'mg', 'PO', 'QD', 600, 520),
    m('D0106', '암로디핀정 5mg', '암로디핀', 'ccb', 5, 'mg', 'PO', 'QD', 10, 180),
    m('D0107', '로사르탄정 50mg', '로사르탄', 'arb', 50, 'mg', 'PO', 'QD', 100, 260),
    m('D0108', '메트포르민정 500mg', '메트포르민', 'antidiabetic', 500, 'mg', 'PO', 'BID', 2550, 90),
    m('D0109', '아토르바스타틴정 20mg', '아토르바스타틴', 'statin', 20, 'mg', 'PO', 'HS', 80, 350),
    m('D0110', '판토프라졸정 40mg', '판토프라졸', 'ppi', 40, 'mg', 'PO', 'QD', 80, 400),
    m('D0111', '레바미피드정 100mg', '레바미피드', 'gi', 100, 'mg', 'PO', 'TID', 300, 110),
    m('D0112', '모사프리드정 5mg', '모사프리드', 'gi', 5, 'mg', 'PO', 'TID', 15, 120),
    m('D0113', '아목시실린·클라불란산정 625mg', '아목시실린', 'penicillin antibiotic', 625, 'mg', 'PO', 'TID', 1875, 700),
    m('D0114', '세파클러캡슐 250mg', '세파클러', 'cephalosporin antibiotic', 250, 'mg', 'PO', 'TID', 1500, 300),
    m('D0115', '레보플록사신정 500mg', '레보플록사신', 'quinolone antibiotic', 500, 'mg', 'PO', 'QD', 750, 900),
    m('D0116', '푸로세미드정 40mg', '푸로세미드', 'diuretic', 40, 'mg', 'PO', 'QD', 160, 40),
    m('D0117', '스피로노락톤정 25mg', '스피로노락톤', 'diuretic ksparing', 25, 'mg', 'PO', 'QD', 100, 60),
    m('D0118', '와파린정 2mg', '와파린', 'anticoagulant', 2, 'mg', 'PO', 'QD', 10, 50),
    m('D0119', '로라제팜정 0.5mg', '로라제팜', 'benzo narcotic', 0.5, 'mg', 'PO', 'PRN', 4, 50, { narcotic: '향정' }),
    m('D0120', '졸피뎀정 5mg', '졸피뎀', 'hypnotic narcotic', 5, 'mg', 'PO', 'HS', 10, 220, { narcotic: '향정' }),
    m('D0121', '트라마돌캡슐 50mg', '트라마돌', 'opioid', 50, 'mg', 'PO', 'TID', 400, 160),
    m('D0122', '산화마그네슘정 500mg', '산화마그네슘', 'laxative', 500, 'mg', 'PO', 'TID', 2000, 30),
    m('D0123', '염화칼륨서방정 600mg', '염화칼륨', 'electrolyte potassium', 600, 'mg', 'PO', 'BID', 2400, 60),
    m('D0124', '니트로글리세린 설하정 0.6mg', '니트로글리세린', 'nitrate', 0.6, 'mg', 'SL', 'PRN', 1.8, 120),
    m('D0125', '프레드니솔론정 5mg', '프레드니솔론', 'steroid', 5, 'mg', 'PO', 'QD', 60, 40),
    m('D0126', '세티리진정 10mg', '세티리진', 'antihistamine', 10, 'mg', 'PO', 'QD', 10, 90),
    m('D0127', '살부타몰 흡입제 100mcg', '살부타몰', 'bronchodilator', 200, 'mcg', 'INH', 'PRN', 1600, 4000),
    m('D0128', '폴리스티렌설폰산칼슘 5g (칼슘 레조늄)', '폴리스티렌설폰산', 'kbinder', 5, 'g', 'PO', 'TID', 30, 900),
  ];
  const INJ = [
    m('J0201', '세프트리악손 주사 1g', '세프트리악손', 'cephalosporin antibiotic', 2, 'g', 'IV', 'QD', 4, 3800),
    m('J0202', '피페라실린·타조박탐 주사 4.5g', '피페라실린', 'penicillin antibiotic', 4.5, 'g', 'IV', 'Q8H', 18, 14500),
    m('J0203', '반코마이신 주사 1g', '반코마이신', 'glycopeptide antibiotic', 1, 'g', 'IV', 'Q12H', 4, 9800),
    m('J0204', '판토프라졸 주사 40mg', '판토프라졸', 'ppi', 40, 'mg', 'IV', 'QD', 160, 4200),
    m('J0205', '푸로세미드 주사 20mg', '푸로세미드', 'diuretic', 20, 'mg', 'IV', 'BID', 600, 300),
    m('J0206', '케토롤락 주사 30mg', '케토롤락', 'nsaid', 30, 'mg', 'IV', 'PRN', 120, 900),
    m('J0207', '모르핀 주사 2mg', '모르핀', 'opioid narcotic', 2, 'mg', 'IV', 'PRN', 40, 1200, { narcotic: '마약' }),
    m('J0208', '메토클로프라미드 주사 10mg', '메토클로프라미드', 'antiemetic', 10, 'mg', 'IV', 'PRN', 30, 250),
    m('J0209', '속효성 인슐린 (RI) 주사', '인슐린', 'insulin highalert', 4, 'unit', 'SC', 'PRN', 100, 1800, { highAlert: true }),
    m('J0210', '에녹사파린 주사 40mg', '에녹사파린', 'anticoagulant highalert', 40, 'mg', 'SC', 'QD', 200, 5200, { highAlert: true }),
    m('J0211', '덱사메타손 주사 5mg', '덱사메타손', 'steroid', 5, 'mg', 'IV', 'QD', 40, 400),
    m('J0212', '에피네프린 주사 1mg', '에피네프린', 'vasopressor highalert', 1, 'mg', 'IV', 'STAT', 30, 800, { highAlert: true }),
    m('J0213', '아트로핀 주사 0.5mg', '아트로핀', 'anticholinergic', 0.5, 'mg', 'IV', 'STAT', 3, 600),
    m('J0214', '아미오다론 주사 150mg', '아미오다론', 'antiarrhythmic highalert', 300, 'mg', 'IV', 'STAT', 2200, 3500, { highAlert: true }),
    m('J0215', '생리식염수 1L (0.9% NaCl)', '염화나트륨', 'fluid', 1000, 'mL', 'IV', 'CONT', 4000, 1500),
    m('J0216', '5% 포도당 1L (5DW)', '포도당', 'fluid', 1000, 'mL', 'IV', 'CONT', 4000, 1500),
    m('J0217', '하트만 용액 1L', '젖산링거', 'fluid', 1000, 'mL', 'IV', 'CONT', 4000, 1700),
    m('J0218', '20% 알부민 100mL', '알부민', 'albumin', 100, 'mL', 'IV', 'QD', 300, 42000),
    m('J0219', '염화칼륨 20mEq 혼합 수액', '염화칼륨', 'electrolyte potassium highalert', 20, 'mEq', 'IV', 'ONCE', 200, 2500, { highAlert: true }),
    m('J0220', '니카르디핀 주사 (지속 주입)', '니카르디핀', 'ccb', 5, 'mg/hr', 'IV', 'CONT', 360, 12000),
    m('J0221', '알테플라제 (혈전용해제) 주사', '알테플라제', 'thrombolytic highalert', 63, 'mg', 'IV', 'STAT', 90, 650000, { highAlert: true }),
    m('J0222', '헤파린 주사 5000단위', '헤파린', 'anticoagulant highalert', 5000, 'unit', 'IV', 'STAT', 40000, 1500, { highAlert: true }),
    m('J0223', '포도당칼슘 주사 (글루콘산칼슘) 10%', '글루콘산칼슘', 'electrolyte', 10, 'mL', 'IV', 'STAT', 30, 900),
    m('J0224', '50% 포도당 주사 50mL', '포도당', 'fluid', 50, 'mL', 'IV', 'STAT', 200, 800),
    m('J0225', '세파졸린 주사 1g', '세파졸린', 'cephalosporin antibiotic', 1, 'g', 'IV', 'Q8H', 6, 2100),
    m('J0226', '노르에피네프린 점적 (4mg/250mL)', '노르에피네프린', 'vasopressor highalert', 0.1, 'mcg/kg/min', 'IV', 'CONT', 99, 9800, { highAlert: true }),
    m('J0227', '미다졸람 점적 (50mg/50mL)', '미다졸람', 'benzo narcotic', 2, 'mg/hr', 'IV', 'CONT', 999, 6400, { narcotic: '향정' }),
    m('J0228', '펜타닐 점적 (500mcg/50mL)', '펜타닐', 'opioid narcotic', 50, 'mcg/hr', 'IV', 'CONT', 9999, 8800, { narcotic: '마약' }),
    m('J0229', '옥시토신 점적 (분만 유도)', '옥시토신', 'oxytocic highalert', 2, 'mU/min', 'IV', 'CONT', 999, 4500, { highAlert: true }),
    m('J0230', '비타민 K1 주사 1mg (신생아)', '피토나디온', 'vitamin', 1, 'mg', 'IM', 'ONCE', 1, 900),
    m('J0231', 'B형간염 백신 0.5mL (신생아)', 'B형간염 백신', 'vaccine', 0.5, 'mL', 'IM', 'ONCE', 0.5, 0),
    m('J0232', '에리스로마이신 안연고 (신생아)', '에리스로마이신', 'antibiotic', 1, '회', 'TOP', 'ONCE', 1, 1200),
    m('J0233', '세파졸린 주사 2g (수술 전 예방적 항생제)', '세파졸린', 'cephalosporin antibiotic', 2, 'g', 'IV', 'ONCE', 6, 4200),
    m('J0234', '독소루비신 (항암제) 60mg/m²', '독소루비신', 'chemo vesicant highalert', 60, 'mg/m²', 'IV', 'ONCE', 999, 98000, { highAlert: true, chemo: true, vesicant: true }),
    m('J0235', '사이클로포스파마이드 (항암제) 600mg/m²', '사이클로포스파마이드', 'chemo highalert', 600, 'mg/m²', 'IV', 'ONCE', 9999, 42000, { highAlert: true, chemo: true }),
    m('J0236', '옥살리플라틴 (항암제) 85mg/m²', '옥살리플라틴', 'chemo highalert', 85, 'mg/m²', 'IV', 'ONCE', 999, 156000, { highAlert: true, chemo: true }),
    m('J0237', '온단세트론 주사 8mg (항암 구토 예방)', '온단세트론', 'antiemetic', 8, 'mg', 'IV', 'ONCE', 24, 7400),
    m('J0238', '철분 주사 (카르복시말토스철) 500mg', '철분', 'iron', 500, 'mg', 'IV', 'ONCE', 1000, 128000),
    m('J0239', '비타민 B12 근육주사 1mg', '코발라민', 'vitamin', 1, 'mg', 'IM', 'ONCE', 1, 2200),
    m('J0240', '미다졸람 주사 (내시경 진정) 2mg', '미다졸람', 'benzo narcotic', 2, 'mg', 'IV', 'ONCE', 10, 1400, { narcotic: '향정' }),
    m('J0241', '플루마제닐 주사 0.5mg (진정 해독)', '플루마제닐', 'antidote', 0.2, 'mg', 'IV', 'PRN', 1, 11000),
    m('J0242', '티카그렐러 180mg (부하 용량)', '티카그렐러', 'antiplatelet', 180, 'mg', 'PO', 'STAT', 360, 4800),
    m('J0243', '아나필락시스용 에피네프린 0.3mg 근주', '에피네프린', 'vasopressor highalert', 0.3, 'mg', 'IM', 'STAT', 1, 800, { highAlert: true }),
  ];

  // 검사 항목: lo/hi 정상 범위, clo/chi 위험값(즉시 보고)
  const it = (c, n, u, lo, hi, clo, chi) => ({ c, n, u, lo, hi, clo, chi });
  const tx = (c, n, normal) => ({ c, n, text: true, normal });
  const LAB = [
    { code: 'L1001', name: '일반혈액검사 (CBC)', tube: '보라색 (EDTA)', items: [it('WBC', '백혈구', '10³/µL', 4.0, 10.0, 1.0, 30), it('Hb', '혈색소', 'g/dL', 12.0, 16.0, 7.0, 20), it('Hct', '적혈구용적', '%', 36, 48), it('PLT', '혈소판', '10³/µL', 150, 400, 50, 1000)], price: 3400 },
    { code: 'L1002', name: '전해질 (나트륨·칼륨·염소)', tube: '노란색 (SST)', items: [it('Na', '나트륨', 'mmol/L', 135, 145, 120, 160), it('K', '칼륨', 'mmol/L', 3.5, 5.1, 2.8, 6.0), it('Cl', '염소', 'mmol/L', 98, 107)], price: 4200 },
    { code: 'L1003', name: '신장기능 (BUN·크레아티닌)', tube: '노란색 (SST)', items: [it('BUN', '요소질소', 'mg/dL', 8, 23), it('Cr', '크레아티닌', 'mg/dL', 0.6, 1.2, null, 5.0)], price: 2600 },
    { code: 'L1004', name: '간기능 (AST·ALT·빌리루빈·알부민)', tube: '노란색 (SST)', items: [it('AST', 'AST', 'U/L', 0, 40), it('ALT', 'ALT', 'U/L', 0, 40), it('TBil', '총빌리루빈', 'mg/dL', 0.2, 1.2), it('Alb', '알부민', 'g/dL', 3.5, 5.2)], price: 5200 },
    { code: 'L1005', name: '혈당 (공복·수시)', tube: '회색 (NaF)', items: [it('Glu', '혈당', 'mg/dL', 70, 110, 40, 500)], price: 1300 },
    { code: 'L1006', name: '당화혈색소 (HbA1c)', tube: '보라색 (EDTA)', items: [it('A1c', '당화혈색소', '%', 4.0, 6.0)], price: 7800 },
    { code: 'L1007', name: '염증수치 (CRP)', tube: '노란색 (SST)', items: [it('CRP', 'C반응단백', 'mg/dL', 0, 0.5)], price: 3600 },
    { code: 'L1008', name: '프로칼시토닌 (PCT)', tube: '노란색 (SST)', items: [it('PCT', '프로칼시토닌', 'ng/mL', 0, 0.5)], price: 26000 },
    { code: 'L1009', name: '혈액응고 (PT/INR)', tube: '하늘색 (구연산)', items: [it('PT', '프로트롬빈시간', '초', 11, 13.5), it('INR', 'INR', '', 0.8, 1.2, null, 5.0)], price: 3200 },
    { code: 'L1010', name: '혈액응고 (aPTT)', tube: '하늘색 (구연산)', items: [it('aPTT', '활성화부분트롬보플라스틴시간', '초', 26, 36, null, 100)], price: 3200 },
    { code: 'L1011', name: '심근효소 (트로포닌 I)', tube: '초록색 (헤파린)', items: [it('TnI', '트로포닌 I', 'ng/mL', 0, 0.04, null, 0.5)], price: 18000 },
    { code: 'L1012', name: '심근효소 (CK-MB)', tube: '초록색 (헤파린)', items: [it('CKMB', 'CK-MB', 'ng/mL', 0, 5)], price: 9000 },
    { code: 'L1013', name: '심부전 지표 (BNP)', tube: '보라색 (EDTA)', items: [it('BNP', 'BNP', 'pg/mL', 0, 100)], price: 28000 },
    { code: 'L1014', name: '젖산 (Lactate)', tube: '회색 (NaF)', items: [it('Lac', '젖산', 'mmol/L', 0.5, 2.0, null, 4.0)], price: 6500 },
    { code: 'L1015', name: '동맥혈가스 (ABGA)', tube: '헤파린 주사기 (동맥)', items: [it('pH', '산도 (pH)', '', 7.35, 7.45, 7.2, 7.6), it('pCO2', '이산화탄소분압', 'mmHg', 35, 45, 20, 70), it('pO2', '산소분압', 'mmHg', 80, 100, 50, null), it('HCO3', '중탄산', 'mmol/L', 22, 26), it('SaO2', '산소포화도', '%', 95, 100)], price: 14000 },
    { code: 'L1016', name: '혈전 지표 (D-dimer)', tube: '하늘색 (구연산)', items: [it('DD', 'D-dimer', 'µg/mL', 0, 0.5)], price: 15000 },
    { code: 'L1017', name: '갑상선 (TSH)', tube: '노란색 (SST)', items: [it('TSH', '갑상선자극호르몬', 'µIU/mL', 0.4, 4.0)], price: 9000 },
    { code: 'L1018', name: '지질검사 (콜레스테롤)', tube: '노란색 (SST)', items: [it('TC', '총콜레스테롤', 'mg/dL', 0, 200), it('TG', '중성지방', 'mg/dL', 0, 150), it('HDL', 'HDL', 'mg/dL', 40, 100), it('LDL', 'LDL', 'mg/dL', 0, 130)], price: 8000 },
    { code: 'L1019', name: '소변검사 (U/A)', tube: '소변컵', items: [tx('USG', '비중', '1.015'), tx('UpH', '산도', '6.0'), tx('UPro', '단백', '음성'), tx('UWBC', '백혈구', '음성'), tx('UNit', '아질산염', '음성'), tx('URBC', '적혈구', '음성')], price: 2000 },
    { code: 'L1020', name: '혈액배양 (2세트)', tube: '배양병 (호기·혐기)', items: [tx('BCx', '배양 결과', '5일간 균 자라지 않음')], price: 24000 },
    { code: 'L1021', name: '소변배양', tube: '멸균 소변컵', items: [tx('UCx', '배양 결과', '균 자라지 않음')], price: 12000 },
    { code: 'L1022', name: '객담배양·그람염색', tube: '멸균 객담통', items: [tx('SGram', '그람염색', '특이 균 없음'), tx('SCx', '배양 결과', '정상 상재균')], price: 15000 },
    { code: 'L1023', name: '혈액형 (ABO/Rh)', tube: '보라색 (EDTA)', items: [tx('ABO', 'ABO 형', 'A'), tx('Rh', 'Rh 형', '양성(+)')], price: 2800 },
    { code: 'L1024', name: '췌장효소 (아밀라아제·리파아제)', tube: '노란색 (SST)', items: [it('Amy', '아밀라아제', 'U/L', 28, 100), it('Lip', '리파아제', 'U/L', 13, 60)], price: 6000 },
    { code: 'L1025', name: '무기질 (칼슘·인·마그네슘)', tube: '노란색 (SST)', items: [it('Ca', '칼슘', 'mg/dL', 8.6, 10.2, 6.0, 13.0), it('P', '인', 'mg/dL', 2.5, 4.5), it('Mg', '마그네슘', 'mg/dL', 1.7, 2.4)], price: 4500 },
    { code: 'L1026', name: '모세혈관 혈당 (BST, 병동 측정)', tube: '손끝 채혈', items: [it('BST', '혈당', 'mg/dL', 70, 140, 40, 500)], price: 1200, bedside: true },
    { code: 'L1027', name: '호흡기 바이러스 유전자 검사 (PCR)', tube: '비인두 면봉 (바이러스 수송 배지)', items: [tx('COV', '코로나19', '음성'), tx('FLU', '인플루엔자 A/B', '음성'), tx('RSV', 'RSV', '음성')], price: 68000 },
    { code: 'L1028', name: '결핵균 유전자 검사 (TB PCR)', tube: '멸균 객담통', items: [tx('TBPCR', '결핵균 유전자', '음성')], price: 52000 },
    { code: 'L1029', name: '비타민 D (위탁)', tube: '노란색 (SST)', items: [it('VitD', '25-수산화 비타민 D', 'ng/mL', 30, 100)], price: 21000 },
    { code: 'L1030', name: '유방암 종양표지자 CA15-3 (위탁)', tube: '노란색 (SST)', items: [it('CA153', 'CA15-3', 'U/mL', 0, 25)], price: 26000 },
    { code: 'L1031', name: '말초혈액 도말 (현미경)', tube: '보라색 (EDTA)', items: [tx('PBS', '말초혈액 도말 소견', '정상 적혈구·백혈구·혈소판 모양')], price: 6000 },
  ];
  // 진단검사의학과 파트
  const PART = { L1001: '혈액', L1009: '혈액', L1010: '혈액', L1016: '혈액', L1031: '혈액', L1002: '자동화', L1003: '자동화', L1004: '자동화', L1005: '자동화', L1006: '자동화', L1007: '자동화', L1014: '자동화', L1015: '자동화', L1018: '자동화', L1024: '자동화', L1025: '자동화',
    L1008: '면역', L1011: '면역', L1012: '면역', L1013: '면역', L1017: '면역', L1019: '요검사', L1020: '미생물', L1021: '미생물', L1022: '미생물', L1023: '혈액은행', L1027: '분자진단', L1028: '분자진단', L1029: '위탁', L1030: '위탁', L1026: '현장검사' };
  LAB.forEach((x) => { x.part = PART[x.code] || '자동화'; });

  const RAD = [
    { code: 'R3001', name: '흉부 X선 (정면 PA)', kind: 'cxr', mod: 'X선', price: 9500 },
    { code: 'R3002', name: '흉부 X선 (이동식 AP)', kind: 'cxr', mod: 'X선', price: 12000, portable: true },
    { code: 'R3003', name: '복부 X선 (누운 자세)', kind: 'axr', mod: 'X선', price: 9500 },
    { code: 'R3004', name: '발목 X선 (3방향)', kind: 'bone', mod: 'X선', price: 13000 },
    { code: 'R3005', name: '뇌 CT (조영제 없이)', kind: 'ctbrain', mod: 'CT', price: 98000 },
    { code: 'R3006', name: '흉부 CT (조영제 사용)', kind: 'ctchest', mod: 'CT', price: 142000, contrast: true },
    { code: 'R3007', name: '복부·골반 CT (조영제 사용)', kind: 'ctabd', mod: 'CT', price: 158000, contrast: true },
    { code: 'R3008', name: '뇌 MRI (확산강조영상)', kind: 'mribrain', mod: 'MRI', price: 320000 },
    { code: 'R3009', name: '복부 초음파', kind: 'usabd', mod: '초음파', price: 85000 },
    { code: 'R3010', name: '유방 촬영 (맘모그래피)', kind: 'mammo', mod: '유방촬영', price: 32000 },
    { code: 'R3011', name: '유방 초음파', kind: 'usbreast', mod: '초음파', price: 76000 },
    { code: 'R3012', name: '관상동맥 조영술 (심혈관 중재)', kind: 'cag', mod: '혈관조영', price: 680000, contrast: true },
    { code: 'R3013', name: '골밀도 검사 (BMD·이중에너지 X선)', kind: 'bmd', mod: '골밀도', price: 42000 },
    { code: 'R3014', name: '위장 조영 (바륨 투시촬영)', kind: 'fluoro', mod: '투시', price: 68000 },
    { code: 'R3015', name: '뇌혈관 조영술 (혈관조영)', kind: 'angio', mod: '혈관조영', price: 720000, contrast: true },
    { code: 'R3016', name: '뼈 스캔 (핵의학)', kind: 'bonescan', mod: '핵의학', price: 165000, nm: { drug: 'Tc-99m MDP', dose: 20, wait: 180 } },
    { code: 'R3017', name: 'PET-CT (FDG 핵의학)', kind: 'pet', mod: '핵의학', price: 980000, nm: { drug: 'F-18 FDG', dose: 10, wait: 60, fast: true } },
    { code: 'R3018', name: '갑상선 스캔 (핵의학)', kind: 'thyroid', mod: '핵의학', price: 92000, nm: { drug: 'Tc-99m 과테크네튬산', dose: 5, wait: 20 } },
    { code: 'R3019', name: '심근 관류 스캔 (SPECT 핵의학)', kind: 'spect', mod: '핵의학', price: 420000, nm: { drug: 'Tc-99m 세스타미비', dose: 25, wait: 45 } },
    { code: 'R3020', name: '무릎 MRI', kind: 'mriknee', mod: 'MRI', price: 450000 },
    { code: 'R3021', name: '복부 CT (조영제 없이)', kind: 'ctabd', mod: 'CT', price: 118000 },
  ];

  const PATH = [
    { code: 'P4001', name: '조직검사 (생검)', spec: '조직 (포르말린 고정)', price: 46000 },
    { code: 'P4002', name: '세포검사 (흡인세포)', spec: '세포 도말 슬라이드', price: 18000 },
    { code: 'P4003', name: '객담 세포검사', spec: '객담', price: 12000 },
    { code: 'P4004', name: '자궁경부 세포검사', spec: '액상 세포', price: 14000 },
    { code: 'P4005', name: '수술 절제조직 검사', spec: '수술 조직 (포르말린 고정)', price: 92000 },
    { code: 'P4006', name: '면역조직화학 염색 (추가)', spec: '파라핀 블록', price: 38000 },
    { code: 'P4007', name: '동결절편 검사 (수술 중 신속)', spec: '신선 조직 (고정하지 않음)', price: 85000, frozen: true },
  ];
  // 심혈관 시술 (심혈관센터)
  const CV = [
    { code: 'V8001', name: '관상동맥 조영술 (CAG)', dept: '순환기내과', min: 40, contrast: true, price: 680000 },
    { code: 'V8002', name: '경피적 관상동맥 중재술 (PCI·스텐트)', dept: '순환기내과', min: 90, contrast: true, price: 2850000 },
    { code: 'V8003', name: '임시 심박조율기 삽입', dept: '순환기내과', min: 40, price: 620000 },
    { code: 'V8004', name: '영구 심박조율기 삽입', dept: '순환기내과', min: 90, price: 4200000 },
    { code: 'V8005', name: '말초혈관 조영술·풍선 확장술', dept: '순환기내과', min: 60, contrast: true, price: 1500000 },
  ];
  // 내시경 (내시경실)
  const EN = [
    { code: 'E8101', name: '위내시경 (상부 위장관)', dept: '소화기내과', min: 10, prep: '전날 저녁 9시부터 금식', price: 52000 },
    { code: 'E8102', name: '대장내시경', dept: '소화기내과', min: 25, prep: '3일 저섬유 식사 + 장 정결제 2L 나눠 복용', price: 98000 },
    { code: 'E8103', name: '내시경적 역행성 담췌관 조영술 (ERCP)', dept: '소화기내과', min: 50, contrast: true, prep: '8시간 금식', price: 620000 },
    { code: 'E8104', name: '응급 내시경 지혈술', dept: '소화기내과', min: 30, prep: '금식·수액·혈액 준비', price: 340000 },
    { code: 'E8105', name: '대장 용종 절제술', dept: '소화기내과', min: 30, prep: '장 정결 + 항응고제 중단 확인', price: 210000 },
  ];
  // 수술
  const OP = [
    { code: 'O9001', name: '복강경 담낭절제술', dept: '외과', min: 90, anes: '전신마취', price: 1650000 },
    { code: 'O9002', name: '복강경 구불결장 절제술', dept: '외과', min: 240, anes: '전신마취', price: 4800000 },
    { code: 'O9003', name: '복강경 충수절제술', dept: '외과', min: 60, anes: '전신마취', price: 1250000 },
    { code: 'O9004', name: '유방 부분절제술 + 감시림프절 생검', dept: '유방외과', min: 120, anes: '전신마취', price: 2300000 },
    { code: 'O9005', name: '제왕절개술', dept: '산부인과', min: 60, anes: '척추마취', price: 1400000 },
    { code: 'O9006', name: '인공 고관절 치환술', dept: '정형외과', min: 150, anes: '척추마취', price: 3900000 },
    { code: 'O9007', name: '경피적 관상동맥 중재술 (스텐트)', dept: '순환기내과', min: 60, anes: '국소마취', price: 3200000 },
    { code: 'O9008', name: '개두술 (뇌출혈 제거)', dept: '신경외과', min: 180, anes: '전신마취', price: 5200000 },
  ];

  const NUR = [
    { code: 'N5001', name: '활력징후 4시간마다 측정', freq: 'Q4H', vs: true },
    { code: 'N5002', name: '활력징후 2시간마다 측정', freq: 'Q2H', vs: true },
    { code: 'N5003', name: '활력징후 1시간마다 측정', freq: 'Q1H', vs: true },
    { code: 'N5004', name: '섭취량·배설량 (I/O) 측정', freq: 'Q8H' },
    { code: 'N5005', name: '모세혈관 혈당 식전·자기 전 (하루 4번)', freq: 'QID' },
    { code: 'N5006', name: '2시간마다 체위 변경', freq: 'Q2H' },
    { code: 'N5007', name: '산소 코삽입관 2L/분', freq: 'CONT' },
    { code: 'N5008', name: '절대 안정 (침상 안정)', freq: 'CONT' },
    { code: 'N5009', name: '낙상 주의 (침상 난간 올리기)', freq: 'CONT' },
    { code: 'N5010', name: '유치도뇨관 유지 관리', freq: 'CONT' },
    { code: 'N5011', name: '상처 소독 (드레싱) 하루 1번', freq: 'QD' },
    { code: 'N5012', name: '접촉 격리', freq: 'CONT' },
    { code: 'N5013', name: '하루 체중 측정', freq: 'QD' },
    { code: 'N5014', name: '신경학적 사정 (GCS·동공) 1시간마다', freq: 'Q1H' },
    { code: 'N5015', name: '수분 제한 하루 1,000mL', freq: 'CONT' },
  ];
  const DIET = [
    { code: 'F6001', name: '일반식' }, { code: 'F6002', name: '죽 (연식)' }, { code: 'F6003', name: '미음 (유동식)' },
    { code: 'F6004', name: '당뇨식 1,800kcal' }, { code: 'F6005', name: '저염식 (소금 6g 이하)' }, { code: 'F6006', name: '금식 (NPO)' },
    { code: 'F6007', name: '경관 영양 (콧줄 영양)' }, { code: 'F6008', name: '저칼륨식' },
  ];
  const PROC = [
    { code: 'C7001', name: '12유도 심전도 (ECG)', price: 11000 },
    { code: 'C7002', name: '유치도뇨관 삽입', price: 9000 },
    { code: 'C7003', name: '비위관 (콧줄) 삽입', price: 8000 },
    { code: 'C7004', name: '말초정맥 주사로 확보', price: 3000 },
    { code: 'C7005', name: '상처 소독 (중)', price: 6500 },
    { code: 'C7006', name: '흉부 압박·심폐소생술', price: 120000 },
    { code: 'C7007', name: '네뷸라이저 (분무 치료)', price: 4000 },
    { code: 'C7008', name: '부목 고정 (발목)', price: 25000 },
    { code: 'C7009', name: '폐기능 검사 (PFT)', price: 32000, func: true },
    { code: 'C7010', name: '심장 초음파', price: 165000, func: true },
    { code: 'C7011', name: '24시간 홀터 심전도', price: 58000, func: true },
    { code: 'C7012', name: '뇌파 검사 (EEG)', price: 47000, func: true },
    { code: 'C7013', name: '근전도·신경전도 검사', price: 72000, func: true },
    { code: 'C7014', name: '재활 치료 (운동·작업 치료)', price: 18000 },
    { code: 'C7015', name: '운동부하 심전도 (트레드밀)', price: 64000, func: true },
    { code: 'C7016', name: '경식도 심초음파', price: 245000, func: true },
    { code: 'C7017', name: '기관지 확장제 반응 폐기능 검사', price: 41000, func: true },
    { code: 'C7018', name: '수면다원검사', price: 680000, func: true },
  ];
  const FROOM = { C7001: 'ecg', C7011: 'ecg', C7015: 'ecg', C7010: 'echo', C7016: 'echo', C7009: 'pft', C7017: 'pft', C7012: 'neuro', C7013: 'neuro', C7018: 'neuro' };
  PROC.forEach((x) => { if (FROOM[x.code]) { x.func = true; x.room = FROOM[x.code]; } });
  const BLOOD = [
    { code: 'B8001', name: '농축적혈구 (RBC) 1단위', price: 58000 },
    { code: 'B8002', name: '신선동결혈장 (FFP) 1단위', price: 41000 },
    { code: 'B8003', name: '농축혈소판 (PC) 1단위', price: 36000 },
  ];
  const DEPTS = ['내과', '순환기내과', '호흡기내과', '신장내과', '외과', '유방외과', '신경과', '신경외과', '정형외과', '응급의학과', '재활의학과', '산부인과', '소아청소년과', '영상의학과'];
  const CONSULT = DEPTS.map((d, i) => ({ code: 'K' + (9001 + i), name: `${d} 협진 의뢰`, dept: d }));

  // 응급실 묶음처방
  const SETS = [
    { id: 'chest', name: '흉통 묶음처방', desc: '급성 심근경색 의심', codes: ['C7001', 'L1011', 'L1012', 'L1001', 'L1002', 'L1003', 'L1009', 'R3002', 'D0104', 'D0124'] },
    { id: 'stroke', name: '뇌졸중 묶음처방', desc: '편마비·말 어눌함 (마지막 정상 시각 확인)', codes: ['R3005', 'L1001', 'L1005', 'L1009', 'L1010', 'L1002', 'L1003', 'C7001', 'N5014'] },
    { id: 'sepsis', name: '패혈증 묶음처방', desc: '1시간 안에 시행 (Hour-1 bundle)', codes: ['L1020', 'L1014', 'L1001', 'L1007', 'L1008', 'L1002', 'L1003', 'J0215', 'J0202'] },
    { id: 'trauma', name: '외상 기본 묶음', desc: '골절·염좌 의심', codes: ['R3004', 'C7008', 'D0101'] },
    { id: 'hyperk', name: '고칼륨혈증 응급 처치', desc: '칼륨 6.0 이상', codes: ['C7001', 'J0223', 'J0224', 'J0209', 'D0128', 'L1002'] },
  ];

  // 진단명 (한국표준질병사인분류 KCD)
  const KCD = [
    ['J18.9', '폐렴, 상세불명'], ['E11.9', '2형 당뇨병, 합병증 없음'], ['I10', '본태성(원발성) 고혈압'], ['K29.7', '상세불명의 위염'],
    ['I21.4', '급성 심내막하 심근경색증'], ['I21.9', '급성 심근경색증, 상세불명'], ['I63.9', '뇌경색증, 상세불명'], ['G45.9', '일과성 뇌허혈발작'],
    ['N10', '급성 신우신염'], ['N39.0', '요로감염, 부위 미상'], ['I50.0', '울혈성 심부전'], ['N18.3', '만성 콩팥병 3기'],
    ['K81.0', '급성 담낭염'], ['K80.2', '담낭결석 (담낭염 없음)'], ['C18.7', '구불결장의 악성 신생물'], ['C50.9', '유방의 악성 신생물'],
    ['N63', '유방의 상세불명 덩이'], ['R07.4', '흉통, 상세불명'], ['R50.9', '발열, 상세불명'], ['A41.9', '패혈증, 상세불명'],
    ['J44.1', '만성 폐쇄성 폐질환의 급성 악화'], ['K35.8', '급성 충수염'], ['S93.4', '발목의 염좌 및 긴장'], ['S82.6', '외측 복사뼈 골절'],
    ['F05.9', '섬망, 상세불명'], ['E87.6', '저칼륨혈증'], ['E87.5', '고칼륨혈증'], ['D64.9', '빈혈, 상세불명'],
    ['R10.4', '복통, 기타 및 상세불명'], ['J06.9', '급성 상기도 감염'], ['K92.2', '위장관 출혈'], ['R55', '실신 및 허탈'],
    ['E78.5', '고지혈증'], ['M17.1', '무릎 관절증'], ['R51', '두통'], ['K21.9', '위식도 역류병'],
    ['I61.9', '뇌내출혈, 상세불명'], ['O80', '단일 자연분만'], ['O82', '제왕절개에 의한 단일 분만'], ['Z38.0', '병원에서 출생한 단태아'],
    ['P07.3', '기타 미숙아 (임신 33주)'], ['S06.2', '광범위 뇌손상'], ['I20.9', '협심증, 상세불명'], ['I21.0', '급성 전벽 심근경색증'], ['K25.9', '위궤양'], ['K63.5', '대장의 용종'], ['D50.9', '철결핍 빈혈'], ['Z51.1', '항암 화학요법'], ['K74.6', '간경변증'], ['Z00.0', '일반 건강 검진'], ['L89.3', '욕창 3단계'], ['P59.9', '신생아 황달'], ['N18.5', '만성 콩팥병 5기 (투석)'], ['R65.1', '패혈성 쇼크 (기관 부전 동반)'],
  ].map(([code, name]) => ({ code, name }));

  const NANDA = [
    { code: '00132', name: '급성 통증', goal: '통증 점수 3점 이하로 줄어든다', iv: ['통증 사정 (위치·양상·강도)', '처방된 진통제 투여 후 30분 뒤 재사정', '편안한 자세 유지', '이완 요법 교육'] },
    { code: '00007', name: '고체온', goal: '체온 37.5℃ 이하로 유지된다', iv: ['4시간마다 체온 측정', '해열제 투여 및 반응 확인', '수분 섭취 권장', '미온수 마사지'] },
    { code: '00155', name: '낙상 위험성', goal: '입원 기간 동안 낙상이 없다', iv: ['침상 난간 올림', '호출벨을 손 닿는 곳에', '미끄럼 방지 신발', '보호자 낙상 예방 교육'] },
    { code: '00047', name: '피부 손상 위험성 (욕창)', goal: '피부 손상이 생기지 않는다', iv: ['2시간마다 체위 변경', '뼈 돌출 부위 피부 관찰', '압력 분산 매트리스', '피부 건조 유지'] },
    { code: '00032', name: '비효과적 호흡 양상', goal: '산소포화도 95% 이상 유지', iv: ['호흡 양상 관찰', '반좌위 유지', '처방된 산소 공급', '심호흡·기침 격려'] },
    { code: '00026', name: '체액 과다', goal: '부종 감소, 체중 증가 없음', iv: ['섭취·배설량 측정', '매일 체중 측정', '수분 제한 교육', '이뇨제 투여 후 반응 확인'] },
    { code: '00004', name: '감염 위험성', goal: '감염 증상이 나타나지 않는다', iv: ['손 위생 준수', '정맥주사 부위 관찰', '체온·백혈구 수치 확인', '무균술 준수'] },
    { code: '00179', name: '불안정한 혈당 위험성', goal: '혈당 70~180mg/dL 유지', iv: ['식전·자기 전 혈당 측정', '저혈당 증상 관찰', '인슐린 투여 시 이중 확인', '당뇨식 교육'] },
    { code: '00146', name: '불안', goal: '불안이 줄었다고 말한다', iv: ['감정 표현 격려', '치료 과정 설명', '조용한 환경 제공', '가족 면회 조정'] },
    { code: '00126', name: '지식 부족', goal: '자가 관리 방법을 말할 수 있다', iv: ['교육 요구 사정', '눈높이 교육 자료 제공', '되묻기 방식으로 이해 확인', '퇴원 교육'] },
    { code: '00085', name: '신체 기동성 장애', goal: '보조기구로 안전하게 이동한다', iv: ['관절 운동 돕기', '보행 보조', '물리치료 연계', '조기 이동 격려'] },
    { code: '00002', name: '영양 불균형: 필요량보다 적음', goal: '식사량 75% 이상 섭취', iv: ['식사량 기록', '영양 상담 의뢰', '선호 음식 확인', '체중 측정'] },
  ];

  const EDU = ['낙상 예방', '투약 방법', '퇴원 후 생활', '당뇨 자가 관리 (인슐린·혈당 측정)', '수술 전 준비', '심호흡·기침 운동', '저염식 식이', '감염 예방 (손 위생)', '통증 표현 방법', '항응고제 복용 주의'];

  const DOCTORS = [
    { id: 'dr1', name: '한지훈', dept: '내과' },
    { id: 'dr2', name: '오세린', dept: '순환기내과' },
    { id: 'dr3', name: '문태호', dept: '외과' },
    { id: 'dr4', name: '배수아', dept: '신경과' },
    { id: 'dr5', name: '장도윤', dept: '응급의학과' },
    { id: 'dr6', name: '남궁현', dept: '유방외과' },
    { id: 'dr7', name: '류민재', dept: '정형외과' },
    { id: 'dr8', name: '서윤아', dept: '산부인과' },
    { id: 'dr9', name: '임재현', dept: '신경외과' },
    { id: 'dr10', name: '강하린', dept: '소아청소년과' },
    { id: 'dr11', name: '노은재', dept: '신장내과' },
    { id: 'dr12', name: '윤태경', dept: '마취통증의학과' },
    { id: 'dr13', name: '권도윤', dept: '소화기내과' },
    { id: 'dr14', name: '송하은', dept: '혈액종양내과' },
  ];
  const WARDS = [
    { id: '7A', name: '7A 내과병동', rooms: ['701', '702', '703', '704', '705', '706'], beds: 4 },
    { id: '8B', name: '8B 외과병동', rooms: ['801', '802', '803', '804', '805', '806'], beds: 4 },
    { id: 'ER', name: '응급실', rooms: ['소생실', 'A구역', 'B구역', '관찰실'], beds: 6 },
    { id: 'ICU', name: '중환자실 (ICU)', rooms: ['내과계', '외과계'], beds: 6 },
    { id: 'LD', name: '분만실', rooms: ['진통실', '분만실', '산후회복'], beds: 3 },
    { id: 'NB', name: '신생아실·신생아중환자실', rooms: ['신생아실', 'NICU'], beds: 8 },
  ];
  EDU.push('모유 수유 방법', '신생아 돌보기 (목욕·배꼽·황달 관찰)', '산후 관리 (자궁 수축·오로)', '투석 환자 식이 (칼륨·인·수분 제한)', '동정맥루 관리', '수술 후 조기 보행·심호흡');

  const ALL = [];
  MED.forEach((x) => ALL.push(Object.assign({ cat: 'MED' }, x)));
  INJ.forEach((x) => ALL.push(Object.assign({ cat: 'INJ' }, x)));
  LAB.forEach((x) => ALL.push(Object.assign({ cat: 'LAB' }, x)));
  RAD.forEach((x) => ALL.push(Object.assign({ cat: 'RAD' }, x)));
  PATH.forEach((x) => ALL.push(Object.assign({ cat: 'PATH' }, x)));
  PROC.forEach((x) => ALL.push(Object.assign({ cat: 'PROC' }, x)));
  NUR.forEach((x) => ALL.push(Object.assign({ cat: 'NUR' }, x)));
  DIET.forEach((x) => ALL.push(Object.assign({ cat: 'DIET' }, x)));
  BLOOD.forEach((x) => ALL.push(Object.assign({ cat: 'BLOOD' }, x)));
  CONSULT.forEach((x) => ALL.push(Object.assign({ cat: 'CONSULT' }, x)));
  OP.forEach((x) => ALL.push(Object.assign({ cat: 'OP' }, x)));
  CV.forEach((x) => ALL.push(Object.assign({ cat: 'CV' }, x)));
  EN.forEach((x) => ALL.push(Object.assign({ cat: 'EN' }, x)));
  const BY = {};
  ALL.forEach((x) => { BY[x.code] = x; });

  H.M = { CAT, FREQ, ROUTE, MED, INJ, LAB, RAD, PATH, NUR, DIET, PROC, BLOOD, CONSULT, OP, CV, EN, SETS, KCD, NANDA, EDU, DOCTORS, WARDS, DEPTS, ALL, BY,
    item: (code) => BY[code],
    doctor: (id) => DOCTORS.find((d) => d.id === id) || { name: '-', dept: '-' },
    ward: (id) => WARDS.find((w) => w.id === id),
    clsHas: (item, tag) => !!(item && item.cls && item.cls.split(' ').includes(tag)),
  };
})();
