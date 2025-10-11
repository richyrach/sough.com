(function () {
  const mixerEl = document.getElementById("mixer");
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const saveBtn = document.getElementById("save");
  const shuffleBtn = document.getElementById("random");
  const defaultBtn = document.getElementById("default");
  const btnBrown = document.getElementById("brown");
  const btnPink = document.getElementById("pink");
  const btnWhite = document.getElementById("white");
  const btnMute = document.getElementById("mute");

  let ctx, master, analyser, started = false;
  let tracks = {}, lastSnapshot = {};

  function createCtx() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser);
    if (window.__attachAnalyser) window.__attachAnalyser(analyser);
  }
  const makeGain = () => { const g = ctx.createGain(); g.connect(master); return g; };
  const makeFilter = (type, freq, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const connectChain = (nodes) => { for(let i=0;i<nodes.length-1;i++) nodes[i].connect(nodes[i+1]); return nodes[nodes.length-1]; };

  function bufferNoise(type = "white", seconds = 2) {
    const buf = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0=0,b1=0,b2=0,last=0;
      for (let i=0;i<data.length;i++) {
        let w=Math.random()*2-1;
        if (type==="pink") { b0=0.99765*b0+w*0.0990460; b1=0.96300*b1+w*0.2965164; b2=0.57000*b2+w*1.0526913; w=b0+b1+b2+w*0.1848; }
        else if (type==="brown") { last=(last+0.02*w)/1.02; w=last*3.5; }
        data[i]=w*0.5;
      }
    }
    return buf;
  }
  const makeLoop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; };
  const genWhite = () => makeLoop(bufferNoise("white"));
  const genPink = () => makeLoop(bufferNoise("pink"));
  const genBrown = () => makeLoop(bufferNoise("brown"));

  function genRain() {
    const n = makeLoop(bufferNoise("white"));
    const bp = makeFilter("bandpass", 1200, 0.6);
    const lfo = ctx.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.12;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 300; lfo.connect(lfoGain); lfoGain.connect(bp.frequency); lfo.start();
    const g = makeGain(); g.gain.value=0;
    connectChain([n,bp,g]);
    const dropGain = ctx.createGain(); dropGain.gain.value=0;
    const dropNoise = makeLoop(bufferNoise("white")); const hp = makeFilter("highpass", 5000, .7);
    dropNoise.connect(hp).connect(dropGain).connect(g);
    function triggerDrop(){ const now=ctx.currentTime; dropGain.gain.cancelScheduledValues(now); dropGain.gain.setValueAtTime(0,now); dropGain.gain.linearRampToValueAtTime(0.6, now+.01); dropGain.gain.exponentialRampToValueAtTime(.0001, now+.12); }
    setInterval(()=>{ if(started && tracks.rain && tracks.rain.gain>0.01 && Math.random()<0.25) triggerDrop(); },800);
    return { out:g, srcs:[n,dropNoise,lfo] };
  }

  function genWind() {
    const n = makeLoop(bufferNoise("white"));
    const bp = makeFilter("bandpass", 400, 0.8);
    const lfo = ctx.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 120; lfo.connect(lfoGain); lfoGain.connect(bp.frequency); lfo.start();
    const g = makeGain(); g.gain.value=0; connectChain([n,bp,g]);
    return { out:g, srcs:[n,lfo] };
  }

  function genOcean() {
    const n = makeLoop(bufferNoise("pink"));
    const lp = makeFilter("lowpass", 500);
    const g = makeGain(); g.gain.value=0; connectChain([n,lp,g]);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03;
    const amp = ctx.createGain(); amp.gain.value = 0.3; lfo.connect(amp.gain); amp.connect(g.gain); lfo.start();
    return { out:g, srcs:[n,lfo] };
  }

  function genCafe() {
    const g = makeGain(); g.gain.value=0; const voices=[];
    for(let i=0;i<4;i++){ const n=makeLoop(bufferNoise("white")); const bp=makeFilter("bandpass", 300+Math.random()*1400, .9); const vg=ctx.createGain(); vg.gain.value=0; n.connect(bp).connect(vg).connect(g); voices.push(vg); }
    setInterval(()=>{
      if(!started || !(tracks.cafe && tracks.cafe.gain>0.02)) return;
      const v=voices[Math.floor(Math.random()*voices.length)]; const now=ctx.currentTime;
      v.gain.cancelScheduledValues(now); v.gain.setValueAtTime(0,now); v.gain.linearRampToValueAtTime(0.2+Math.random()*0.15, now+.05); v.gain.exponentialRampToValueAtTime(.0001, now+.4+Math.random()*0.8);
    },180);
    return { out:g, srcs:[] };
  }

  function genTrain() {
    const g = makeGain(); g.gain.value=0; const eventGain=ctx.createGain(); eventGain.gain.value=0;
    const n=makeLoop(bufferNoise("white")); const hp=makeFilter("highpass",2000,.7); n.connect(hp).connect(eventGain).connect(g);
    setInterval(()=>{
      if(!started || !(tracks.train && tracks.train.gain>0.02)) return;
      const now=ctx.currentTime; eventGain.gain.setValueAtTime(0,now); eventGain.gain.linearRampToValueAtTime(0.6, now+.01); eventGain.gain.exponentialRampToValueAtTime(.0001, now+.08);
    },420);
    return { out:g, srcs:[n] };
  }

  function makeTrack(id, label, generator){ return { id,label,generator,node:null,srcs:[],gain:0 }; }
  function buildTracks(){
    tracks = {
      rain: makeTrack("rain","Rain",genRain),
      wind: makeTrack("wind","Wind",genWind),
      ocean: makeTrack("ocean","Ocean",genOcean),
      cafe: makeTrack("cafe","Café",genCafe),
      train: makeTrack("train","Tram",genTrain),
      pink: makeTrack("pink","Pink Noise",genPink),
      brown: makeTrack("brown","Brown Noise",genBrown),
      white: makeTrack("white","White Noise",genWhite),
    };
  }

  function ensureStarted(){
    if(!ctx) createCtx();
    if(!started){
      Object.values(tracks).forEach(t=>{ const g=t.generator(); t.node=g.out||ctx.createGain(); (g.srcs||[]).forEach(s=>{ try{s.start(0);}catch(e){} }); t.node.connect(master); });
      started=true;
      defaultPreset();
      Object.values(tracks).forEach(t=> setVolume(t.id, t.gain));
    }
    if(ctx.state==="suspended") ctx.resume();
  }

  function setVolume(id, val){
    const t=tracks[id]; if(!t||!ctx) return;
    if(t.node&&t.node.gain) t.node.gain.setTargetAtTime(val, ctx.currentTime, 0.02);
    t.gain=val; const label=document.getElementById("v-"+id); if(label) label.textContent=((val*100)|0)+"%";
  }

  function stopAll(){ if(!ctx) return; lastSnapshot={}; Object.values(tracks).forEach(t=> lastSnapshot[t.id]=t.gain);
    const now=ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.exponentialRampToValueAtTime(.0001, now+.2); }

  function resumeAll(){ const now=ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(.0001, now); master.gain.exponentialRampToValueAtTime(.9, now+.15);
    Object.keys(lastSnapshot).forEach(k=> setVolume(k,lastSnapshot[k])); }

  function defaultPreset(){
    tracks.rain.gain=.55; tracks.wind.gain=.18; tracks.ocean.gain=0.0;
    tracks.cafe.gain=.06; tracks.train.gain=0.0;
    tracks.brown.gain=.28; tracks.pink.gain=0.0; tracks.white.gain=0.0;
  }

  function buildUI(){
    mixerEl.innerHTML=""; const layout=document.createElement("div");
    layout.style.display="grid"; layout.style.gridTemplateColumns="repeat(auto-fill, minmax(230px,1fr))";
    layout.style.gap="12px"; mixerEl.appendChild(layout);
    Object.values(tracks).forEach(t=>{
      const card=document.createElement("div"); card.className="panel";
      card.innerHTML=`
        <div class="row"><strong>${t.label}</strong><span class="small" id="v-${t.id}">${(t.gain*100)|0}%</span></div>
        <input type="range" min="0" max="1" step="0.01" value="${t.gain}" data-id="${t.id}" />
      `;
      layout.appendChild(card);
    });
    layout.querySelectorAll("input[type=range]").forEach(sl=>{
      sl.addEventListener("input",(e)=>{ const id=e.target.dataset.id; ensureStarted(); setVolume(id,+e.target.value); });
    });
  }

  function randomize(){ Object.values(tracks).forEach(t=>{ t.gain = Math.random()<0.2?0:+(Math.random()*0.7).toFixed(2); if(["train","cafe"].includes(t.id) && t.gain>0.35) t.gain=0.35; });
    buildUI(); ensureStarted(); Object.values(tracks).forEach(t=> setVolume(t.id, t.gain)); }

  function copyLink(){ navigator.clipboard.writeText(location.href).then(()=>{ saveBtn.textContent="Link copied!"; setTimeout(()=> saveBtn.textContent="Copy Link", 1200); }); }

  function init(){
    buildTracks(); buildUI();
    playBtn&&playBtn.addEventListener("click", ()=>{ ensureStarted(); resumeAll(); });
    stopBtn&&stopBtn.addEventListener("click", stopAll);
    saveBtn&&saveBtn.addEventListener("click", copyLink);
    shuffleBtn&&shuffleBtn.addEventListener("click", randomize);
    defaultBtn&&defaultBtn.addEventListener("click", ()=>{ defaultPreset(); buildUI(); ensureStarted(); Object.values(tracks).forEach(t=> setVolume(t.id, t.gain)); });
    btnBrown&&btnBrown.addEventListener("click", ()=>{ ensureStarted(); setVolume("brown", .4); setVolume("pink",0); setVolume("white",0); });
    btnPink&&btnPink.addEventListener("click", ()=>{ ensureStarted(); setVolume("pink", .4); setVolume("brown",0); setVolume("white",0); });
    btnWhite&&btnWhite.addEventListener("click", ()=>{ ensureStarted(); setVolume("white", .4); setVolume("brown",0); setVolume("pink",0); });
    btnMute&&btnMute.addEventListener("click", ()=>{ ensureStarted(); Object.values(tracks).forEach(t=> setVolume(t.id, 0)); });
    document.addEventListener("keydown",(e)=>{
      if(e.code==="Space"){ e.preventDefault(); ensureStarted(); if(master.gain.value>0.05) stopAll(); else resumeAll(); }
      if(e.key==="m"||e.key==="M"){ ensureStarted(); Object.values(tracks).forEach(t=> setVolume(t.id, 0)); }
    });
  }
  init();
})();
