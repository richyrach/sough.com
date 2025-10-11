(function () {
  const canvas = document.getElementById("viz");
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const c = canvas.getContext("2d");
  function resize(){ canvas.width=Math.max(1,Math.floor(canvas.clientWidth*dpr)); canvas.height=Math.max(1,Math.floor(canvas.clientHeight*dpr)); }
  resize(); addEventListener("resize", resize);
  let analyser=null, dataArray=null;
  function drawIdle(){
    c.clearRect(0,0,canvas.width,canvas.height);
    const bars=64,bw=canvas.width/bars;
    for(let i=0;i<bars;i++){ const h=Math.sin((Date.now()/800+i*0.4))*0.3+0.7;
      const barH=h*canvas.height*0.35; const x=i*bw+bw*0.25; const y=canvas.height-barH-6;
      c.fillStyle = i%3===0?"#7DBA92":i%3===1?"#C87A3B":"#7aa0ff"; c.fillRect(x,y,bw*0.5,barH); }
  }
  function drawLive(){
    c.clearRect(0,0,canvas.width,canvas.height);
    analyser.getByteFrequencyData(dataArray);
    const bars=96,bw=canvas.width/bars;
    for(let i=0;i<bars;i++){ const v=dataArray[i], barH=(v/255)*canvas.height*0.65; const x=i*bw+bw*0.2; const y=canvas.height-barH-6;
      c.fillStyle = i%3===0?"#7DBA92":i%3===1?"#C87A3B":"#7aa0ff"; c.fillRect(x,y,bw*0.6,barH); }
  }
  (function loop(){ if(!analyser) drawIdle(); else drawLive(); requestAnimationFrame(loop); })();
  window.__attachAnalyser = (an) => { analyser=an; dataArray=new Uint8Array(analyser.frequencyBinCount); };
})();
