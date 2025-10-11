(function () {
  let ctx, master, analyser;
  let bpm = 90, swing = 0.12, step = 0, timer = null;
  const steps = 16;
  const patt = { kick: Array(steps).fill(0), snare: Array(steps).fill(0), hat: Array(steps).fill(0) };

  const elKick = document.getElementById("kick");
  const elSnare = document.getElementById("snare");
  const elHat = document.getElementById("hat");
  const elBpm = document.getElementById("bpm");
  const elBpmv = document.getElementById("bpmv");
  const elSwing = document.getElementById("swing");
  const elSwingv = document.getElementById("swingv");

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser);
    if (window.__attachAnalyser) window.__attachAnalyser(analyser);
  }

  function cell(track, i) {
    const d = document.createElement("div");
    d.className = "step"; d.dataset.track = track; d.dataset.i = i;
    d.onclick = () => { patt[track][i] = patt[track][i] ? 0 : 1; d.classList.toggle("on"); updateQuery(); };
    return d;
  }

  function buildGrid() {
    elKick.innerHTML = ""; elSnare.innerHTML = ""; elHat.innerHTML = "";
    for (let i = 0; i < steps; i++) elKick.appendChild(cell("kick", i));
    for (let i = 0; i < steps; i++) elSnare.appendChild(cell("snare", i));
    for (let i = 0; i < steps; i++) elHat.appendChild(cell("hat", i));
  }

  const sixteenth = () => (60 / bpm) / 4;

  function schedule() {
    ensureCtx();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const t = ctx.currentTime;
      const dur = sixteenth();
      const swingOffset = (step % 2 === 1) ? swing * dur : 0;
      playStep(step, t + swingOffset);
      step = (step + 1) % steps;
    }, sixteenth() * 1000);
  }

  function osc(freq, t, dur, type = "sine") {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }

  function noiseBurst(t, dur, hpFreq) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hpFreq;
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
  }

  function playStep(i, t) {
    if (patt.kick[i]) osc(70, t, 0.12, "sine");
    if (patt.snare[i]) noiseBurst(t, 0.12, 800);
    if (patt.hat[i]) noiseBurst(t, 0.05, 4000);
  }

  document.getElementById("start").onclick = () => { ensureCtx(); schedule(); };
  document.getElementById("stop").onclick = () => { if (timer) clearInterval(timer); };
  document.getElementById("clear").onclick = () => {
    ["kick", "snare", "hat"].forEach(k => patt[k] = Array(steps).fill(0));
    buildGrid(); updateFromPattern(); updateQuery();
  };
  document.getElementById("rand").onclick = () => {
    ["kick", "snare", "hat"].forEach(k => patt[k] = patt[k].map(() => Math.random() < 0.25 ? 1 : 0));
    buildGrid(); updateFromPattern(); updateQuery();
  };
  document.getElementById("share").onclick = () => {
    const s = ["kick", "snare", "hat"].map(k => patt[k].join("")).join("-");
    const u = new URL(location.href); u.searchParams.set("p", s); u.searchParams.set("bpm", bpm); u.searchParams.set("sw", swing.toFixed(2));
    navigator.clipboard.writeText(u.toString());
  };

  elBpm.oninput = (e) => { bpm = +e.target.value; elBpmv.textContent = bpm + " BPM"; if (timer) schedule(); updateQuery(); };
  elSwing.oninput = (e) => { swing = +e.target.value; elSwingv.textContent = Math.round(swing * 100) + "%"; updateQuery(); };

  function updateFromPattern() {
    document.querySelectorAll(".step").forEach(d => {
      const tr = d.dataset.track; const i = +d.dataset.i;
      d.classList.toggle("on", !!patt[tr][i]);
    });
  }

  function updateQuery() {
    const s = ["kick", "snare", "hat"].map(k => patt[k].join("")).join("-");
    const u = new URL(location.href);
    u.searchParams.set("p", s);
    u.searchParams.set("bpm", bpm);
    u.searchParams.set("sw", swing.toFixed(2));
    history.replaceState({}, "", u.toString());
  }

  function loadFromQuery() {
    const u = new URL(location.href);
    const s = u.searchParams.get("p");
    bpm = +(u.searchParams.get("bpm") || bpm);
    swing = +(u.searchParams.get("sw") || swing);
    elBpm.value = bpm; elBpmv.textContent = bpm + " BPM";
    elSwing.value = swing; elSwingv.textContent = Math.round(swing * 100) + "%";
    if (s) {
      const parts = s.split("-"); const keys = ["kick", "snare", "hat"];
      parts.forEach((str, idx) => {
        if (str && str.length === steps) patt[keys[idx]] = str.split("").map(x => x === "1" ? 1 : 0);
      });
    } else {
      patt.kick = [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0];
      patt.snare= [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
      patt.hat  = [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1];
    }
  }

  function init() { buildGrid(); loadFromQuery(); updateFromPattern(); }
  init();
})();
