// Ghid animat: pornirea sistemului LG 3CD Changer si conectarea laptopului la PORTABLE
(function () {
  const STEP_MS = 7000;
  let uid = 0;

  const steps = (side) => [
    {
      title: 'Pornește sistemul',
      short: 'Apasă ⏻/I — primul buton din stânga.',
      text: 'Apasă butonul <b>⏻/I</b> — primul din coloana stângă, lângă afișaj. Afișajul albastru se aprinde.',
      tip: 'Dacă nu se aprinde nimic, verifică dacă LG-ul e în priză.',
      lcd: [['', 0], ['HELLO', 1500], ['TUNER', 3400]],
    },
    {
      title: 'Conectează cablul audio',
      short: `Jack 3.5 mm: laptop 🎧 (${side === 'left' ? 'stânga' : 'dreapta'}) → LG PORT. IN.`,
      text: `Folosește cablul <b>jack 3.5 mm</b>. Un capăt intră în mufa de căști <b>🎧</b> din <b>partea ${side === 'left' ? 'stângă' : 'dreaptă'}</b> a laptopului, celălalt în mufa rotundă <b>PORT. IN</b> din stânga-jos a sistemului LG — cea de sus, deasupra portului USB.`,
      tip: 'Împinge mufa până la capăt, până simți un mic „clic”.',
      lcd: [['TUNER', 0]],
    },
    {
      title: 'Apasă PORTABLE',
      short: 'Ultimul buton din coloana stângă → apare PORTABLE.',
      text: 'Apasă butonul <b>PORTABLE</b> — ultimul din coloana stângă. Pe afișaj trebuie să apară <b>PORTABLE</b>.',
      tip: 'Dacă apare altceva (TUNER, CD, USB), mai apasă o dată PORTABLE.',
      lcd: [['TUNER', 0], ['PORTABLE', 1700]],
    },
    {
      title: 'Reglează volumul',
      short: 'Rotește VOLUME spre dreapta, încet.',
      text: 'Rotește butonul mare <b>VOLUME</b> spre dreapta, încet. Pe laptop ține volumul la <b>80–100%</b>, iar nivelul din sală îl reglezi de pe LG.',
      tip: 'Pentru fundal în restaurant e suficient VOL 12–20.',
      lcd: [['PORTABLE', 0], ['VOL 10', 1000], ['VOL 14', 1900], ['VOL 18', 2800], ['PORTABLE', 4800]],
    },
    {
      title: 'Pornește muzica',
      short: 'Spotify, YouTube sau telefonul prin Bluetooth.',
      text: 'Pornește muzica din aplicație: <b>Spotify</b>, <b>YouTube</b> sau de pe <b>telefon prin Bluetooth</b>. Sunetul iese acum din boxele LG.',
      tip: 'Nu se aude? Verifică în Setări că ieșirea audio este „Speakers / Difuzoare”.',
      lcd: [['PORTABLE', 0]],
    },
  ];

  function leftButtons() {
    const labels = ['⏻/I', 'SET', 'EQ', 'XDSS', 'PORTABLE'];
    return labels.map((l, i) => {
      const y = 176 + i * 40;
      const cls = i === 0 ? 'btn btn-power' : i === 4 ? 'btn btn-portable' : 'btn';
      return `<g class="${cls}"><rect x="492" y="${y}" width="40" height="36" rx="6"/><text x="512" y="${y + 21.5}" text-anchor="middle" class="t-btn${l.length > 5 ? ' t-btn-s' : ''}">${l}</text></g>`;
    }).join('');
  }
  function rightButtons() {
    const labels = ['⏏ O/C', 'DISC 1', 'DISC 2', 'DISC 3', 'SKIP'];
    return labels.map((l, i) => {
      const y = 176 + i * 40;
      return `<g class="btn"><rect x="748" y="${y}" width="40" height="36" rx="6"/><text x="768" y="${y + 21.5}" text-anchor="middle" class="t-btn t-btn-s">${l}</text></g>`;
    }).join('');
  }

  function headphoneGlyph(x, y, s = 1) {
    return `<g class="hp" transform="translate(${x} ${y}) scale(${s})"><path d="M-7 3v-3a7 7 0 0 1 14 0v3"/><rect x="-8.5" y="1.5" width="4" height="6" rx="1.3"/><rect x="4.5" y="1.5" width="4" height="6" rx="1.3"/></g>`;
  }

  function scene(side, id) {
    const jx = side === 'left' ? 27 : 373;
    const jy = 360;
    const cable = side === 'left'
      ? `M${jx} ${jy} C5 368 2 392 10 410 C24 446 60 532 150 532 L420 532 C470 532 476 500 482 470 C488 436 496 414 512 410`
      : `M${jx} ${jy} C400 360 420 352 440 360 C470 372 482 404 512 410`;
    const lb = { x: 200, y: 440 }; // bula laptop
    const gb = { x: 400, y: 440 }; // bula LG
    const lbEdge = side === 'left' ? { x: lb.x - 48, y: lb.y - 26 } : { x: lb.x + 48, y: lb.y - 26 };

    return `
<svg class="g-scene" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg" data-step="1">
  <defs>
    <clipPath id="${id}-lb"><circle cx="${lb.x}" cy="${lb.y}" r="54"/></clipPath>
    <clipPath id="${id}-gb"><circle cx="${gb.x}" cy="${gb.y}" r="54"/></clipPath>
  </defs>

  <!-- telefon (pasul 5) -->
  <g class="phone-fig">
    <rect x="392" y="52" width="40" height="74" rx="8"/>
    <path d="M406 60h12"/>
    <path class="bt" d="M406 82l12 12-6 6V76l6 6-12 12"/>
    <path class="bt-wave" d="M380 112 Q330 150 300 152" stroke-dasharray="3 6"/>
  </g>

  <!-- LAPTOP -->
  <g class="laptop">
    <rect class="lt-lid" x="62" y="150" width="276" height="180" rx="10"/>
    <rect class="lt-screen" x="74" y="162" width="252" height="156" rx="4"/>
    <g class="lt-ui">
      <rect x="80" y="168" width="20" height="144" rx="3"/>
      <rect x="108" y="168" width="212" height="12" rx="3"/>
      <rect x="108" y="188" width="66" height="52" rx="4"/><rect x="181" y="188" width="66" height="52" rx="4"/><rect x="254" y="188" width="66" height="52" rx="4"/>
      <rect x="108" y="248" width="66" height="58" rx="4"/><rect x="181" y="248" width="66" height="58" rx="4"/><rect x="254" y="248" width="66" height="58" rx="4"/>
    </g>
    <g class="lt-eq">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${143 + i * 14}" y="214" width="7" height="60" rx="3" style="animation-delay:${(i * 0.13).toFixed(2)}s"/>`).join('')}
    </g>
    <g class="lt-vol">
      <rect x="130" y="226" width="140" height="34" rx="17"/>
      <path d="M146 238h5l6-5v18l-6-5h-5Z"/>
      <rect class="vol-track" x="168" y="241" width="88" height="4" rx="2"/>
      <rect class="vol-fill" x="168" y="241" width="88" height="4" rx="2"/>
    </g>
    <path class="lt-base" d="M42 338H358L382 372H18Z"/>
    <path class="lt-edge" d="M18 372H382V377Q382 382 377 382H23Q18 382 18 377Z"/>
    <path class="lt-keys" d="M70 346H330M62 354H338M54 362H346"/>
    <path class="lt-pad" d="M176 364h48"/>
    <circle class="lt-jack" cx="${jx}" cy="${jy}" r="3.5"/>
  </g>

  <!-- CABLU -->
  <path class="cable" d="${cable}" pathLength="1"/>
  <circle class="plug-end plug-lt" cx="${jx}" cy="${jy}" r="7"/>
  <circle class="plug-end plug-lg" cx="512" cy="410" r="10"/>

  <!-- SISTEM LG -->
  <g class="lg">
    <path class="body" d="M470 72Q470 46 496 46H784Q810 46 810 72V506Q810 520 796 520H484Q470 520 470 506Z"/>
    <path class="wing" d="M484 66V500M796 66V500"/>
    <rect class="panel" x="514" y="56" width="252" height="66" rx="8"/>
    <circle cx="616" cy="80" r="9.5"/>
    <path d="M613 74.5v11h6.5"/><circle class="dot" cx="619.5" cy="76" r="1"/>
    <text x="631" y="86" class="t-logo">LG</text>
    <text x="640" y="111" text-anchor="middle" class="t-small">3CD CHANGER SYSTEM</text>

    <rect class="lcd-win" x="540" y="132" width="196" height="64" rx="6"/>
    <text class="lcd" x="638" y="172" text-anchor="middle"></text>
    <g class="lcd-deco">
      <rect x="552" y="140" width="5" height="48" rx="1.5"/>
      <path d="M592 186h18M618 186h8M666 186h18M692 186h8"/>
    </g>
    <circle class="sensor" cx="768" cy="152" r="9"/><text x="768" y="155.5" text-anchor="middle" class="t-btn t-btn-s">R</text>

    ${leftButtons()}
    ${rightButtons()}

    <rect class="band" x="548" y="270" width="184" height="56" rx="28"/>
    <path class="ico-s" d="M566 292v12l-8-6Z M574 292v12l-8-6Z"/>
    <path class="ico-s" d="M706 292v12l8-6Z M714 292v12l8-6Z"/>
    <g class="pill"><rect x="562" y="206" width="44" height="16" rx="8"/><text x="584" y="217.5" text-anchor="middle" class="t-btn t-btn-s">TUNER</text></g>
    <g class="pill"><rect x="674" y="206" width="44" height="16" rx="8"/><text x="696" y="217.5" text-anchor="middle" class="t-btn t-btn-s">CD</text></g>
    <g class="pill"><rect x="562" y="376" width="44" height="16" rx="8"/><text x="584" y="387.5" text-anchor="middle" class="t-btn t-btn-s">TAPE</text></g>
    <g class="pill"><rect x="674" y="376" width="44" height="16" rx="8"/><text x="696" y="387.5" text-anchor="middle" class="t-btn t-btn-s">USB</text></g>
    <circle class="ring" cx="640" cy="298" r="74"/>
    <circle class="vol-arc" cx="640" cy="298" r="84" pathLength="100" transform="rotate(130 640 298)"/>
    <text x="640" y="240" text-anchor="middle" class="t-btn t-btn-s t-vol">VOLUME</text>
    <g class="knob">
      <circle cx="640" cy="298" r="46"/>
      <circle class="knob-in" cx="640" cy="298" r="33"/>
      <path class="knob-mark" d="M640 270v12"/>
    </g>

    <rect class="jack-panel" x="492" y="396" width="40" height="104" rx="6"/>
    <circle class="lg-jack" cx="512" cy="410" r="7"/><circle cx="512" cy="410" r="3"/>
    <rect x="506" y="428" width="12" height="22" rx="2"/>
    <circle cx="512" cy="474" r="3"/>

    <rect class="door" x="546" y="400" width="194" height="92" rx="8"/>
    <rect x="582" y="414" width="122" height="28" rx="14"/>
    <text x="643" y="432" text-anchor="middle" class="t-btn t-btn-s">USB DIRECT RECORDING</text>
    <text x="643" y="462" text-anchor="middle" class="t-small">PLAY BACK / RECORD</text>
    <text x="728" y="484" text-anchor="end" class="t-small">MCD</text>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${562 + i * 27}" y="498" width="24" height="13" rx="3"/>`).join('')}
  </g>

  <!-- unde de sunet (pasul 5) -->
  <g class="waves">
    <path d="M826 250a52 52 0 0 1 0 96"/><path d="M846 228a80 80 0 0 1 0 140"/><path d="M866 206a108 108 0 0 1 0 184"/>
  </g>
  <g class="notes">
    <path d="M884 140v-26l14-4v24"/><circle cx="880" cy="140" r="4.5"/><circle cx="894" cy="134" r="4.5"/>
  </g>

  <!-- atingeri -->
  <circle class="tap tap-power" cx="512" cy="194" r="22"/>
  <circle class="tap tap-power t2" cx="512" cy="194" r="22"/>
  <circle class="tap tap-portable" cx="512" cy="354" r="22"/>
  <circle class="tap tap-portable t2" cx="512" cy="354" r="22"/>

  <!-- etichete -->
  <g class="co co-power"><path d="M462 194h28"/><rect x="368" y="180" width="94" height="28" rx="14"/><text x="415" y="198" text-anchor="middle" class="t-co">APASĂ ⏻/I</text></g>
  <g class="co co-portable"><path d="M440 316 490 350"/><rect x="352" y="288" width="122" height="28" rx="14"/><text x="413" y="306" text-anchor="middle" class="t-co">APASĂ PORTABLE</text></g>
  <g class="co co-volume"><path d="M822 432 724 346"/><rect x="822" y="418" width="118" height="28" rx="14"/><text x="881" y="436" text-anchor="middle" class="t-co">ROTEȘTE ↻</text></g>

  <!-- bule de detaliu (pasul 2) -->
  <g class="bubble b-laptop">
    <path class="lead" d="M${lbEdge.x} ${lbEdge.y} L${jx} ${jy + 4}"/>
    <circle class="b-ring" cx="${lb.x}" cy="${lb.y}" r="54"/>
    <g clip-path="url(#${id}-lb)">
      <rect x="${lb.x - 80}" y="${lb.y - 12}" width="160" height="26" rx="6"/>
      <rect x="${lb.x - 46}" y="${lb.y - 3}" width="18" height="8" rx="1.5"/>
      <path d="M${lb.x - 18} ${lb.y - 3}h16l-2 8h-12Z"/>
      <circle class="hl" cx="${lb.x + 22}" cy="${lb.y + 1}" r="6"/>
      ${headphoneGlyph(lb.x + 22, lb.y - 30, 1)}
      <circle class="plug-in" cx="${lb.x + 22}" cy="${lb.y + 1}" r="6"/>
    </g>
    <text x="${lb.x}" y="${lb.y + 74}" text-anchor="middle" class="t-label">LAPTOP · 🎧 ${side === 'left' ? 'STÂNGA' : 'DREAPTA'}</text>
  </g>
  <g class="bubble b-lg">
    <path class="lead" d="M${gb.x + 50} ${gb.y - 22} L505 410"/>
    <circle class="b-ring" cx="${gb.x}" cy="${gb.y}" r="54"/>
    <g clip-path="url(#${id}-gb)">
      <rect x="${gb.x - 15}" y="${gb.y - 46}" width="30" height="96" rx="5"/>
      <circle class="hl" cx="${gb.x}" cy="${gb.y - 20}" r="8"/><circle cx="${gb.x}" cy="${gb.y - 20}" r="3.5"/>
      <rect x="${gb.x - 6}" y="${gb.y + 2}" width="12" height="22" rx="2"/>
      <text x="${gb.x + 21}" y="${gb.y - 16}" class="t-btn t-hl">AUX</text>
      <text x="${gb.x + 21}" y="${gb.y + 17}" class="t-btn t-dim">USB</text>
      <circle class="plug-in" cx="${gb.x}" cy="${gb.y - 20}" r="8"/>
    </g>
    <text x="${gb.x}" y="${gb.y + 74}" text-anchor="middle" class="t-label">LG · PORT. IN (SUS)</text>
  </g>
</svg>`;
  }

  function mount(host, opts = {}) {
    const id = `g${++uid}`;
    let side = opts.side || 'left';
    let current = 0;
    let timers = [];
    let advanceTimer = null;
    let playing = true;
    const compact = !!opts.compact;

    host.classList.add('guide');
    if (compact) host.classList.add('guide-compact');

    function render() {
      const list = steps(side);
      host.innerHTML = `
        <div class="g-stage">${scene(side, id)}</div>
        <div class="g-caption">
          <div class="g-num"><span class="g-n">01</span><span class="g-of">/ 0${list.length}</span></div>
          <div class="g-body">
            <h3 class="g-title"></h3>
            <p class="g-text"></p>
            ${compact ? '' : '<p class="g-tip"></p>'}
          </div>
          <div class="g-ctrl">
            <button class="g-btn g-prev" title="Pasul anterior">${icon('back')}</button>
            <button class="g-btn g-play" title="Pauză / redare">${icon('pause')}</button>
            <button class="g-btn g-next" title="Pasul următor">${icon('forward')}</button>
          </div>
        </div>
        <div class="g-progress">${list.map((s, i) => `<button class="g-seg" data-i="${i}" title="${s.title}"><i></i><span>${s.title}</span></button>`).join('')}</div>`;
      host.querySelector('.g-prev').onclick = () => go(current - 1);
      host.querySelector('.g-next').onclick = () => go(current + 1);
      host.querySelector('.g-play').onclick = () => setPlaying(!playing);
      host.querySelectorAll('.g-seg').forEach((b) => (b.onclick = () => go(+b.dataset.i)));
      go(current);
    }

    function setLcd(text) {
      const svg = host.querySelector('svg');
      const lcd = host.querySelector('.lcd');
      if (!svg || !lcd) return;
      lcd.textContent = text;
      svg.classList.toggle('lcd-on', text !== '');
    }

    function go(i) {
      const list = steps(side);
      current = (i + list.length) % list.length;
      timers.forEach(clearTimeout);
      timers = [];
      clearTimeout(advanceTimer);
      const s = list[current];
      const svg = host.querySelector('svg');
      svg.setAttribute('data-step', '');
      void svg.getBoundingClientRect();
      svg.setAttribute('data-step', String(current + 1));
      s.lcd.forEach(([text, at]) => timers.push(setTimeout(() => setLcd(text), at)));

      host.querySelector('.g-n').textContent = String(current + 1).padStart(2, '0');
      host.querySelector('.g-title').textContent = s.title;
      host.querySelector('.g-text').innerHTML = compact ? s.short : s.text;
      const tip = host.querySelector('.g-tip');
      if (tip) tip.textContent = s.tip;

      host.querySelectorAll('.g-seg').forEach((seg, k) => {
        const bar = seg.querySelector('i');
        seg.classList.toggle('on', k === current);
        seg.classList.toggle('done', k < current);
        bar.style.transition = 'none';
        bar.style.width = k < current ? '100%' : '0%';
        if (k === current && playing) {
          void bar.offsetWidth;
          bar.style.transition = `width ${STEP_MS}ms linear`;
          bar.style.width = '100%';
        }
      });
      if (playing && visible) advanceTimer = setTimeout(() => go(current + 1), STEP_MS);
    }

    function setPlaying(v) {
      playing = v;
      host.querySelector('.g-play').innerHTML = icon(playing ? 'pause' : 'play');
      host.classList.toggle('paused', !playing);
      go(current);
    }

    // ruleaza doar cand ghidul se vede pe ecran (economie de procesor)
    let visible = true;
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === visible) return;
      visible = entry.isIntersecting;
      host.classList.toggle('offscreen', !visible);
      if (visible) go(current);
      else { timers.forEach(clearTimeout); clearTimeout(advanceTimer); }
    }).observe(host);

    render();
    return {
      setSide(s) { if (s !== side) { side = s; render(); } },
      go,
      restart() { go(0); },
    };
  }

  window.AGGuide = { mount, steps };
})();
