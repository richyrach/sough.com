(function () {
  let ctx, src, master, analyser;
  let lp, hp, delay, delayGain, convolver, reverbGain;
  let fileBuf = null, loopStart = 0, loopEnd = 1, rate = 1;
  let pendingPlay = false;

  const fileInput = document.getElementById("file");
  const btnPlay = document.getElementById("r-play");
  const btnStop = document.getElementById("r-stop");
  const btnRec = document.getElementById("r-rec");
  const aDl = document.getElementById("r-dl");

  const rRate = document.getElementById("r-rate"); const rRateVal = document.getElementById("r-rate-val");
  const rLP = document.getElementById("r-lp"); const rLPVal = document.getElementById("r-lp-val");
  const rHP = document.getElementById("r-hp"); const rHPVal = document.getElementById("r-hp-val");
  const rDelay = document.getElementById("r-delay"); const rDelayVal = document.getElementById("r-delay-val");
  const rRev = document.getElementById("r-rev"); const rRevVal = document.getElementById("r-rev-val");
  const rLStart = document.getElementById("r-lstart"); const rLStartVal = document.getElementById("r-lstart-val");
  const rLEnd = document.getElementById("r-lend"); const rLEndVal = document.getElementById("r-lend-val");

  const wave = document.getElementById("wave");
  const wctx = wave ? wave.getContext("2d") : null;

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.95; master.connect(ctx.destination);
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser);
    if (window.__attachAnalyser) window.__attachAnalyser(analyser);

    lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=20000;
    hp = ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=20;
    delay = ctx.createDelay(1.0); delay.delayTime.value=0.0;
    delayGain = ctx.createGain(); delayGain.gain.value=0.0; delay.connect(delayGain).connect(master);
    convolver = ctx.createConvolver(); convolver.buffer = makeImpulse(2.2, 0.6);
    reverbGain = ctx.createGain(); reverbGain.gain.value=0.2; convolver.connect(reverbGain).connect(master);
  }

  function makeImpulse(seconds, decay) {
    const rate = 44100, len = rate*seconds;
    const impulse = ctx.createBuffer(2, len, rate);
    for(let ch=0; ch<2; ch++){ const data=impulse.getChannelData(ch); for(let i=0;i<len;i++){ data[i]=(Math.random()*2-1)*Math.pow(1-i/len, decay*2); } }
    return impulse;
  }

  function connectSource(startNow=false) {
    if (!fileBuf) return;
    if (src) { try{src.stop();}catch(e){} try{src.disconnect();}catch(e){} }
    src = ctx.createBufferSource();
    src.buffer = fileBuf; src.loop = true;
    src.loopStart = loopStart * fileBuf.duration; src.loopEnd = loopEnd * fileBuf.duration;
    src.playbackRate.value = rate;
    src.connect(hp); hp.connect(lp).connect(master);
    src.connect(delay); src.connect(convolver);
    if (startNow) { try{ src.start(0);}catch(e){} }
  }

  function drawWaveform() {
    if (!wave || !wctx || !fileBuf) return;
    const dpr = window.devicePixelRatio || 1;
    wave.width = Math.max(1, Math.floor(wave.clientWidth * dpr));
    wave.height = Math.max(1, Math.floor(wave.clientHeight * dpr));
    const c = wctx; c.clearRect(0,0,wave.width,wave.height);
    const ch = fileBuf.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / wave.width));
    const amp = wave.height/2;
    c.strokeStyle="#7DBA92"; c.lineWidth=1; c.beginPath();
    for (let i=0;i<wave.width;i++){
      const start=i*step; let mn=1, mx=-1;
      for (let j=0;j<step;j++){ const idx=start+j; if (idx < ch.length){ const v=ch[idx]; if (v<mn) mn=v; if (v>mx) mx=v; } }
      c.moveTo(i, (1+mn)*amp); c.lineTo(i, (1+mx)*amp);
    }
    c.stroke();
    c.fillStyle = "rgba(200,122,59,.25)";
    c.fillRect(0, 0, wave.width * loopStart, wave.height);
    c.fillRect(wave.width * loopEnd, 0, wave.width * (1 - loopEnd), wave.height);
  }

  function decodeFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          ensureCtx();
          if (ctx.state === "suspended") await ctx.resume();
          ctx.decodeAudioData(e.target.result).then((buf) => { fileBuf = buf; drawWaveform(); resolve(buf); }).catch(reject);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { await decodeFile(f); connectSource(false); if (pendingPlay) { pendingPlay=false; connectSource(true); } }
    catch (err) { alert("Could not decode this audio file."); }
  });

  btnPlay.addEventListener("click", async () => {
    ensureCtx(); if (ctx.state === "suspended") await ctx.resume();
    if (fileBuf) { connectSource(true); return; }
    const f = fileInput.files && fileInput.files[0];
    if (!f) { pendingPlay = true; fileInput.click(); return; }
    try { await decodeFile(f); connectSource(true); }
    catch (err) { pendingPlay = false; alert("Could not decode this audio file."); }
  });

  btnStop.addEventListener("click", () => {
    if (src) { try{ src.stop(); }catch(e){} try{ src.disconnect(); }catch(e){} src = null; }
  });

  rRate.addEventListener("input", (e) => { rate = +e.target.value; rRateVal.textContent = rate.toFixed(2) + "×"; if (src) src.playbackRate.value = rate; });
  const fmtHz = (v) => (v >= 1000 ? (v/1000).toFixed(1) + "kHz" : (v|0) + "Hz");
  rLP.addEventListener("input", (e) => { const v = +e.target.value; rLPVal.textContent = fmtHz(v); if (lp) lp.frequency.value = v; });
  rHP.addEventListener("input", (e) => { const v = +e.target.value; rHPVal.textContent = fmtHz(v); if (hp) hp.frequency.value = v; });
  rDelay.addEventListener("input", (e) => { const v = +e.target.value; rDelayVal.textContent = v.toFixed(2) + "s"; if (delay) delay.delayTime.value = v; delayGain.gain.value = v > 0 ? 0.25 : 0; });
  rRev.addEventListener("input", (e) => { const v = +e.target.value; rRevVal.textContent = Math.round(v * 100) + "%"; if (reverbGain) reverbGain.gain.value = v; });
  rLStart.addEventListener("input", (e) => { loopStart = +e.target.value; if (src && fileBuf) src.loopStart = loopStart * fileBuf.duration; rLStartVal.textContent = Math.round(loopStart * 100) + "%"; drawWaveform(); });
  rLEnd.addEventListener("input", (e) => { loopEnd = +e.target.value; if (src && fileBuf) src.loopEnd = loopEnd * fileBuf.duration; rLEndVal.textContent = Math.round(loopEnd * 100) + "%"; drawWaveform(); });

  btnRec.addEventListener("click", () => {
    ensureCtx();
    if (typeof MediaRecorder === "undefined") { alert("Recording not supported in this browser."); return; }
    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);
    const recorder = new MediaRecorder(dest.stream);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      aDl.href = url; aDl.style.display = "inline-block";
    };
    recorder.start();
    btnRec.textContent = "Recording… click again to stop";
    const stopRec = () => { recorder.stop(); btnRec.textContent = "Record"; btnRec.removeEventListener("click", stopRec); };
    btnRec.addEventListener("click", stopRec);
  });

  addEventListener("resize", drawWaveform);
})();
