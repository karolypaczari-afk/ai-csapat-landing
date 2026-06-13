/* ============================================================
   Ágens adat-vizualizációk (canvas) — SZEREP-SPECIFIKUS.
   Minden szakember a saját munkáját idéző animációt kap
   (piackutató → cél-szkennelés, e-mail → boríték-szekvencia,
   helyi SEO → térkép-pin sonar, vágó → vágó-idővonal, stb.).
   Egyetlen közös rAF-hurok hajtja az aktív canvasokat;
   offscreen / rejtett fül / reduced-motion → áll.
   ============================================================ */
(function () {
  "use strict";

  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = [], running = false;
  var GRID = "rgba(124,58,237,0.22)", MUT = "rgba(124,58,237,0.5)", DIM = "rgba(166,163,194,0.5)";
  var TAU = Math.PI * 2;

  function fit(it) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = it.canvas.getBoundingClientRect(); if (!r.width) return;
    it.w = r.width; it.h = r.height;
    it.canvas.width = Math.round(r.width * dpr); it.canvas.height = Math.round(r.height * dpr);
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function A(c, a) { c.globalAlpha = a; }
  // determinisztikus pszeudo-random a seedből
  function rnd(s) { var x = Math.sin(s * 999.13) * 43758.5; return x - Math.floor(x); }

  /* ============ SZEREP-SPECIFIKUS RAJZOLÓK (c,t,col,w,h,s) ============ */

  // SHERLOCK — piackutató: célközönség-dotok, kereszttel pásztázva, talált = világít
  function scan(c,t,col,w,h,s){ var cx=w/2,cy=h/2;
    for(var i=0;i<10;i++){var px=8+rnd(s+i)* (w-16),py=8+rnd(s+i+9)*(h-16);var sx=cx+Math.cos(t*1.1)*(w*0.32),sy=cy+Math.sin(t*1.5)*(h*0.3);var d=Math.hypot(px-sx,py-sy);var lit=d<22;A(c,lit?1:0.3);c.fillStyle=lit?col:DIM;c.beginPath();c.arc(px,py,lit?3:1.6,0,TAU);c.fill();}
    A(c,1);var sx=cx+Math.cos(t*1.1)*(w*0.32),sy=cy+Math.sin(t*1.5)*(h*0.3);c.strokeStyle=col;c.lineWidth=1.5;c.beginPath();c.arc(sx,sy,12,0,TAU);c.stroke();c.beginPath();c.moveTo(sx-16,sy);c.lineTo(sx+16,sy);c.moveTo(sx,sy-16);c.lineTo(sx,sy+16);c.stroke();c.lineWidth=1; }

  // TYRION — versenytárs: TE vs ŐK oszlopok, egymással versengve
  function versus(c,t,col,w,h,s){ var n=4,gw=w/(n*2+1);
    for(var i=0;i<n;i++){var you=(Math.sin(t*1.6+i)+1)/2*0.5+0.45,them=(Math.sin(t*1.4+i+2)+1)/2*0.5+0.3;
      c.fillStyle=col;A(c,0.9);c.fillRect((i*2+1)*gw*0.9+4,h-h*you,gw*0.7,h*you);
      c.fillStyle=MUT;A(c,0.8);c.fillRect((i*2+2)*gw*0.9+4,h-h*them,gw*0.7,h*them);}A(c,1);
    c.fillStyle="#fff";c.font="8px monospace";c.fillText("TE",4,10); }

  // JOHN — stratégia: döntési fa, egy ágon végigfutó impulzus
  function tree(c,t,col,w,h,s){ var root={x:10,y:h/2};var lv=[[0.45,0.25],[0.45,0.5],[0.45,0.75],[0.8,0.2],[0.8,0.5],[0.8,0.8]];
    var nodes=lv.map(function(p){return {x:p[0]*w,y:p[1]*h};});
    c.strokeStyle=GRID;[[0],[1],[2]].forEach(function(){});
    var edges=[[root,nodes[0]],[root,nodes[1]],[root,nodes[2]],[nodes[1],nodes[3]],[nodes[1],nodes[4]],[nodes[1],nodes[5]]];
    edges.forEach(function(e){c.beginPath();c.moveTo(e[0].x,e[0].y);c.lineTo(e[1].x,e[1].y);c.stroke();});
    var path=[root,nodes[1],nodes[4]];var seg=(t*0.6)%(path.length-1);var i=Math.floor(seg),f=seg-i;var a=path[i],b=path[i+1];
    c.fillStyle=col;c.beginPath();c.arc(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,3,0,TAU);c.fill();
    nodes.concat([root]).forEach(function(nn,k){var p=(Math.sin(t*2+k)+1)/2;c.fillStyle=k===6?"#fff":col;A(c,0.5+p*0.5);c.beginPath();c.arc(nn.x,nn.y,2.4,0,TAU);c.fill();});A(c,1); }

  // GANDALF — előfizetés: visszatérő bevétel-hurok, növekvő ív + körbefutó blip
  function loop(c,t,col,w,h,s){ var cx=w/2,cy=h/2,R=Math.min(w,h)/2-8;
    c.strokeStyle=GRID;c.lineWidth=6;c.beginPath();c.arc(cx,cy,R,0,TAU);c.stroke();
    var v=0.5+0.45*Math.sin(t*0.5);c.strokeStyle=col;c.beginPath();c.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+TAU*v);c.stroke();
    var a=t*1.2;c.fillStyle="#fff";c.beginPath();c.arc(cx+Math.cos(a)*R,cy+Math.sin(a)*R,3,0,TAU);c.fill();
    c.lineWidth=1;c.fillStyle=col;c.font="10px monospace";c.textAlign="center";A(c,0.8+0.2*Math.sin(t*3));c.fillText("↻",cx,cy+4);A(c,1);c.textAlign="start"; }

  // CLARK — landoló szakértő: oldal-szekciók rajzolódnak sorban
  function wireframe(c,t,col,w,h,s){ c.strokeStyle=GRID;rr(c,6,4,w-12,h-8,4);c.stroke();
    c.fillStyle=MUT;[8,8].forEach(function(){});c.beginPath();c.arc(12,11,1.5,0,TAU);c.arc(18,11,1.5,0,TAU);c.fill();
    var rows=[[0.22,0.34,col],[0.42,0.16,MUT],[0.62,0.16,MUT],[0.82,0.12,col]];var cyc=(t*0.5)%(rows.length+1);
    rows.forEach(function(r,i){if(cyc>i){A(c,i===0||i===3?0.9:0.5);c.fillStyle=r[2];c.fillRect(12,h*r[0],(w-24)*(i===0?1:0.7),h*r[1]);}});A(c,1); }

  // MAXIMUS — landoló építő: blokkok épülnek alulról fölfelé
  function build(c,t,col,w,h,s){ var n=4,bh=(h-10)/n,cyc=(t*0.7)%(n+1.5);
    for(var i=0;i<n;i++){var idx=n-1-i;if(cyc>i){var p=Math.min(1,cyc-i);A(c,0.4+0.5*p);c.fillStyle=i%2?col:MUT;var bw=(w-12)*p;c.fillRect(6,6+idx*bh,bw,bh-4);}}A(c,1); }

  // DUMBLEDORE — hirdetéstervező: figyelem-tölcsér szűkül
  function funnel(c,t,col,w,h,s){ var n=4,gap=5,bh=(h-gap*(n-1))/n;
    for(var i=0;i<n;i++){var base=1-i*0.2,p=(Math.sin(t*1.4+i*0.5)+1)/2,bw=w*base*(0.6+p*0.4);c.fillStyle=col;A(c,0.4+0.5*(1-i/n));c.fillRect((w-bw)/2,i*(bh+gap),bw,bh);}A(c,1);
    var fy=((t*40)%h);c.fillStyle="#fff";A(c,0.6);c.fillRect(w/2-1,fy,2,4);A(c,1); }

  // JORDAN — szövegíró: hirdetésszöveg gépelődik, kurzorral
  function typead(c,t,col,w,h,s){ var lines=[[0.9,col],[0.7,DIM],[0.55,DIM]];var lh=h/(lines.length+0.5);
    lines.forEach(function(l,i){var prog=Math.max(0,Math.min(1,(t*0.5-i*0.4)%2.2));var y=lh*(i+0.5);A(c,i===0?1:0.6);c.fillStyle=l[1];var fw=(w-12)*l[0]*prog;c.fillRect(6,y,fw,i===0?6:4);if(prog<1){c.fillStyle=col;c.fillRect(6+fw+1,y-1,2,i===0?8:6);}});A(c,1); }

  // PAM — kreatív designer: szín-swatchök + kivágó keret
  function swatch(c,t,col,w,h,s){ var sw=["#7C3AED","#06B6D4","#00D4FF","#FFC400","#9B6DFF"];var n=sw.length,bw=(w-12)/n;
    for(var i=0;i<n;i++){var lit=(Math.floor(t*1.5)%n)===i;A(c,lit?1:0.5);c.fillStyle=sw[i];rr(c,6+i*bw,h*0.55,bw-4,h*0.3,3);c.fill();}A(c,1);
    var fx=6+((Math.sin(t)*0.5+0.5)*(w-40));c.strokeStyle="#fff";c.lineWidth=1.5;rr(c,fx,8,30,h*0.34,3);c.stroke();c.lineWidth=1; }

  // LUCIUS — Google Ads: költségkeret-óra (gauge)
  function gauge(c,t,col,w,h,s){ var cx=w/2,cy=h*0.74,R=Math.min(w/2,h)-8;c.lineWidth=7;c.lineCap="round";
    c.strokeStyle=GRID;c.beginPath();c.arc(cx,cy,R,Math.PI,0);c.stroke();
    var v=0.5+0.42*Math.sin(t*0.8);c.strokeStyle=col;c.beginPath();c.arc(cx,cy,R,Math.PI,Math.PI+Math.PI*v);c.stroke();
    var na=Math.PI+Math.PI*v;c.strokeStyle="#fff";c.lineWidth=2;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(na)*(R-4),cy+Math.sin(na)*(R-4));c.stroke();
    c.fillStyle=col;c.beginPath();c.arc(cx,cy,3,0,TAU);c.fill();c.lineWidth=1;c.lineCap="butt"; }

  // NEO — Facebook Ads: célzó-reticle ráközelít a közönség-dotokra
  function reticle(c,t,col,w,h,s){ var cx=w/2,cy=h/2;var conv=(Math.sin(t*0.9)*0.5+0.5);
    for(var i=0;i<9;i++){var ang=i/9*TAU,rr0=Math.min(w,h)*0.42*(1-conv*0.6);var px=cx+Math.cos(ang+t*0.3)*rr0,py=cy+Math.sin(ang+t*0.3)*rr0*0.8;A(c,0.5);c.fillStyle=col;c.beginPath();c.arc(px,py,2,0,TAU);c.fill();}A(c,1);
    var R=8+(1-conv)*Math.min(w,h)*0.3;c.strokeStyle="#fff";c.lineWidth=1.5;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(q){var x=cx+q[0]*R,y=cy+q[1]*R;c.beginPath();c.moveTo(x,y- q[1]*7);c.lineTo(x,y);c.lineTo(x-q[0]*7,y);c.stroke();});
    c.strokeStyle=col;c.beginPath();c.arc(cx,cy,3,0,TAU);c.stroke();c.lineWidth=1; }

  // FORREST — e-mail: boríték-szekvencia folyik lefelé, küldés-pulzus
  function mailseq(c,t,col,w,h,s){ c.strokeStyle=GRID;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();
    for(var i=0;i<4;i++){var y=((t*28+i*h/4)%(h+20))-10;var ew=22,eh=15,x=w/2-ew/2;A(c,0.85);c.fillStyle=i%2?col:MUT;rr(c,x,y,ew,eh,2);c.fill();c.strokeStyle="rgba(11,11,22,0.8)";c.beginPath();c.moveTo(x,y);c.lineTo(x+ew/2,y+eh*0.55);c.lineTo(x+ew,y);c.stroke();}A(c,1);
    var p=(Math.sin(t*3)+1)/2;c.fillStyle=col;A(c,p);c.beginPath();c.arc(w/2,h-6,3+p*2,0,TAU);c.fill();A(c,1); }

  // MORPHEUS — Figma tervező: artboardok rendeződnek
  function artboards(c,t,col,w,h,s){ var bo=[[0.05,0.1,0.4,0.5],[0.5,0.08,0.42,0.34],[0.52,0.5,0.4,0.4],[0.08,0.65,0.38,0.28]];
    bo.forEach(function(b,i){var app=Math.max(0,Math.min(1,(t*0.6-i*0.35)%2.4));A(c,0.3+app*0.6);c.strokeStyle=col;c.lineWidth=1.5;rr(c,b[0]*w,b[1]*h,b[2]*w*app,b[3]*h*app,3);c.stroke();c.fillStyle=col;A(c,0.08*app);c.fill();});A(c,1);c.lineWidth=1; }

  // DOROTHY — Figma→kód: kódsorok jelennek meg, zárójelekkel
  function code(c,t,col,w,h,s){ var lines=[[0,0.5],[1,0.7],[2,0.85],[1,0.6],[0,0.4]];var lh=h/lines.length;
    lines.forEach(function(l,i){var prog=Math.max(0,Math.min(1,(t*0.7-i*0.25)%2.6));var x=6+l[0]*10;A(c,i%2?0.55:0.85);c.fillStyle=i%2?DIM:col;c.fillRect(x,i*lh+lh*0.3,(w-x-6)*l[1]*prog,3);});A(c,1);
    c.fillStyle=col;c.font="10px monospace";A(c,0.6);c.fillText("{",w-12,lh*0.9);c.fillText("}",w-12,h-4);A(c,1); }

  // MIYAGI — Figma QA: ellenőrző-lista pipálódik, pásztázó vonallal
  function inspect(c,t,col,w,h,s){ var n=4,lh=h/n;var scan=((t*0.6)%1)*h;
    for(var i=0;i<n;i++){var y=lh*(i+0.5);var done=scan> y;c.strokeStyle=done?col:DIM;c.lineWidth=1.5;
      if(done){c.beginPath();c.moveTo(8,y);c.lineTo(11,y+3);c.lineTo(16,y-3);c.stroke();}else{c.beginPath();c.arc(11,y,3,0,TAU);c.stroke();}
      c.fillStyle=done?col:DIM;A(c,done?0.8:0.4);c.fillRect(22,y-2,(w-30)*(0.5+rnd(s+i)*0.4),3);A(c,1);}
    c.strokeStyle="#fff";A(c,0.4);c.beginPath();c.moveTo(0,scan);c.lineTo(w,scan);c.stroke();A(c,1);c.lineWidth=1; }

  // Q — adatgyűjtő: lefelé áramló adat egy töltődő tárolóba
  function ingest(c,t,col,w,h,s){ for(var i=0;i<12;i++){var x=6+rnd(s+i)*(w-12);var y=((t*60*(0.5+rnd(s+i+3))+i*20)%(h*0.7));A(c,0.7);c.fillStyle=col;c.fillRect(x,y,2,5);}A(c,1);
    var fill=(Math.sin(t*0.7)*0.5+0.5)*0.6+0.2;c.strokeStyle=GRID;rr(c,6,h*0.72,w-12,h*0.24,3);c.stroke();c.fillStyle=col;A(c,0.6);rr(c,8,h*0.72+(h*0.24)*(1-fill),w-16,(h*0.24)*fill-2,2);c.fill();A(c,1); }

  // TRUMAN — UGC: filmszalag gördül
  function filmstrip(c,t,col,w,h,s){ var fw=24,gap=6,tot=fw+gap,off=(t*30)%tot;c.strokeStyle=GRID;
    for(var x=-off;x<w;x+=tot){c.fillStyle="rgba(0,212,255,0.08)";c.fillRect(x,h*0.22,fw,h*0.56);c.strokeRect(x,h*0.22,fw,h*0.56);c.fillStyle=MUT;c.fillRect(x+3,h*0.08,fw-6,3);c.fillRect(x+3,h*0.89,fw-6,3);}
    c.fillStyle=col;A(c,0.7);c.fillRect((t*44)%w,0,2,h);A(c,1); }

  // TED — script-író: forgatókönyv-sorok gépelődnek, jelenet-markerrel
  function script(c,t,col,w,h,s){ var n=3,lh=h/n;
    for(var i=0;i<n;i++){var y=lh*(i+0.4);var prog=Math.max(0,Math.min(1,(t*0.5-i*0.5)%2.4));c.fillStyle=col;A(c,0.7);c.fillRect(6,y,12,3);A(c,i?0.5:0.85);c.fillStyle=i?DIM:col;c.fillRect(22,y,(w-30)*(0.6+rnd(s+i)*0.35)*prog,3);if(prog<1){c.fillStyle=col;c.fillRect(22+(w-30)*(0.6+rnd(s+i)*0.35)*prog+1,y-1,2,5);}}A(c,1); }

  // SARAH — renderelő: progress-bar + tile-ok komponálódnak
  function render(c,t,col,w,h,s){ var cols=6,rows=3,p=(t*0.4)%1.3;var tw=(w-12)/cols,th=(h*0.6-8)/rows;
    for(var r=0;r<rows;r++)for(var k=0;k<cols;k++){var idx=r*cols+k,total=cols*rows;var on=p*total>idx;A(c,on?0.8:0.15);c.fillStyle=col;c.fillRect(6+k*tw,6+r*th,tw-2,th-2);}A(c,1);
    c.strokeStyle=GRID;rr(c,6,h*0.78,w-12,h*0.16,3);c.stroke();c.fillStyle=col;A(c,0.85);rr(c,8,h*0.78+2,(w-16)*Math.min(1,p/1.3),h*0.16-4,2);c.fill();A(c,1); }

  // EDWARD — vágó: vágó-idővonal klipekkel + lejátszófej
  function timeline(c,t,col,w,h,s){ var tracks=2,th=(h-8)/tracks;
    for(var tr=0;tr<tracks;tr++){var y=4+tr*th;var x=4;while(x<w-4){var cw=14+rnd(s+tr+x)*30;if(x+cw>w-4)cw=w-4-x;A(c,0.6);c.fillStyle=tr?MUT:col;rr(c,x,y+2,cw-3,th-6,2);c.fill();x+=cw;}}A(c,1);
    var px=(t*55)%w;c.strokeStyle="#fff";c.lineWidth=1.5;c.beginPath();c.moveTo(px,0);c.lineTo(px,h);c.stroke();c.fillStyle="#fff";c.beginPath();c.moveTo(px-3,0);c.lineTo(px+3,0);c.lineTo(px,5);c.fill();c.lineWidth=1; }

  // COLUMBO — SEO audit: státusz-pontos lista, pásztázó kiemelés
  function audit(c,t,col,w,h,s){ var n=4,lh=h/n;var cols=["#2BE38B",col,"#FFC400","#2BE38B"];var hl=Math.floor((t*0.8)%n);
    for(var i=0;i<n;i++){var y=lh*(i+0.5);if(i===hl){A(c,0.12);c.fillStyle=col;c.fillRect(2,y-lh*0.45,w-4,lh*0.9);}A(c,1);c.fillStyle=cols[i];c.beginPath();c.arc(10,y,3,0,TAU);c.fill();A(c,0.6);c.fillStyle=DIM;c.fillRect(18,y-1.5,(w-26)*(0.5+rnd(s+i)*0.4),3);A(c,1);} }

  // INDIANA — kulcsszó: lebegő kulcsszó-pillék + nagyító
  function keywords(c,t,col,w,h,s){ var tags=[[0.2,0.3,28],[0.6,0.25,20],[0.4,0.6,34],[0.78,0.62,18],[0.15,0.75,22]];
    tags.forEach(function(tg,i){var x=tg[0]*w,y=tg[1]*h+Math.sin(t*1.2+i)*3;A(c,0.7);c.strokeStyle=col;c.fillStyle="rgba(124,58,237,0.12)";rr(c,x,y,tg[2],9,4);c.fill();c.stroke();});A(c,1);
    var mx=w/2+Math.cos(t*0.8)*w*0.25,my=h/2+Math.sin(t)*h*0.2;c.strokeStyle="#fff";c.lineWidth=1.5;c.beginPath();c.arc(mx,my,7,0,TAU);c.moveTo(mx+5,my+5);c.lineTo(mx+10,my+10);c.stroke();c.lineWidth=1; }

  // MONICA — tartalom-opt: pontszám-ív emelkedik + szöveg-sávok
  function score(c,t,col,w,h,s){ var cx=w*0.28,cy=h/2,R=Math.min(w*0.22,h/2)-4;c.lineWidth=6;
    c.strokeStyle=GRID;c.beginPath();c.arc(cx,cy,R,0,TAU);c.stroke();var v=0.6+0.35*Math.sin(t*0.6);c.strokeStyle=col;c.beginPath();c.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+TAU*v);c.stroke();c.lineWidth=1;
    c.fillStyle="#fff";c.font="11px monospace";c.textAlign="center";c.fillText(Math.round(v*100),cx,cy+4);c.textAlign="start";
    for(var i=0;i<4;i++){var y=8+i*(h-12)/4;var p=(Math.sin(t*1.2+i)+1)/2;A(c,0.5);c.fillStyle=col;c.fillRect(w*0.5,y,(w*0.45)*(0.4+p*0.6),4);}A(c,1); }

  // DOKI — technikai SEO: 3 mini CWV-mérő töltődik a jó tartományba
  function diagnostics(c,t,col,w,h,s){ var labels=3,bh=(h-8)/labels;
    for(var i=0;i<labels;i++){var y=4+i*bh+bh/2;c.strokeStyle=GRID;rr(c,30,y-3,w-38,6,3);c.stroke();var v=0.55+0.4*Math.sin(t*0.9+i*1.3);c.fillStyle=v>0.6?"#2BE38B":col;A(c,0.85);rr(c,31,y-2,(w-40)*v,4,2);c.fill();A(c,1);c.fillStyle=DIM;c.font="7px monospace";c.fillText(["LCP","CLS","INP"][i],4,y+2.5);} }

  // KATNISS — helyi SEO: térkép-rács + lokáció-pin sonarral
  function mappin(c,t,col,w,h,s){ c.strokeStyle=GRID;for(var gx=0;gx<w;gx+=16)for(var gy=0;gy<h;gy+=16){}
    c.strokeStyle=GRID;for(var x=8;x<w;x+=16){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(var y=8;y<h;y+=16){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    var cx=w/2,cy=h/2;for(var k=0;k<3;k++){var p=((t*0.5+k/3)%1);A(c,(1-p)*0.7);c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.arc(cx,cy,p*Math.min(w,h)*0.4,0,TAU);c.stroke();}A(c,1);c.lineWidth=1;
    c.fillStyle=col;c.beginPath();c.arc(cx,cy-4,5,Math.PI,0);c.lineTo(cx,cy+6);c.closePath();c.fill();c.fillStyle="#0B0B16";c.beginPath();c.arc(cx,cy-4,2,0,TAU);c.fill(); }

  var DRAW = {
    scan:scan, versus:versus, tree:tree, loop:loop, wireframe:wireframe, build:build, funnel:funnel,
    typead:typead, swatch:swatch, gauge:gauge, reticle:reticle, mailseq:mailseq, artboards:artboards,
    code:code, inspect:inspect, ingest:ingest, filmstrip:filmstrip, script:script, render:render,
    timeline:timeline, audit:audit, keywords:keywords, score:score, diagnostics:diagnostics, mappin:mappin
  };

  function paint(it,t){ var c=it.ctx;c.save();c.clearRect(0,0,it.w,it.h);c.globalAlpha=1;(DRAW[it.type]||scan)(c,t*(it.speed||1),it.color||"#00D4FF",it.w,it.h,it.seed);c.restore(); }
  function frame(now){ var t=now/1000,any=false;for(var i=0;i<items.length;i++){var it=items[i];if(!it.visible||!it.w)continue;any=true;paint(it,t);}if(any&&!document.hidden&&!REDUCE)requestAnimationFrame(frame);else running=false; }
  function kick(){ if(!running&&!REDUCE){running=true;requestAnimationFrame(frame);} }
  function drawStatic(it){ if(!it.w)fit(it);if(it.w)paint(it,it.seed+5); }

  var io=("IntersectionObserver" in window)?new IntersectionObserver(function(es){es.forEach(function(e){var it=e.target.__viz;if(!it)return;it.visible=e.isIntersecting;if(it.visible){if(!it.w)fit(it);REDUCE?drawStatic(it):kick();}});},{threshold:0.12}):null;
  window.addEventListener("resize",function(){items.forEach(function(it){if(it.visible){fit(it);if(REDUCE)drawStatic(it);}});},{passive:true});
  document.addEventListener("visibilitychange",function(){if(!document.hidden)kick();});

  window.GM_Dashboards={
    mount:function(canvas,type,color,seed,speed){
      var it={canvas:canvas,ctx:canvas.getContext("2d"),type:type,color:color,seed:(seed||0)+1.3,speed:speed||1,visible:false,w:0,h:0};
      canvas.__viz=it;items.push(it);
      if(io)io.observe(canvas);else{it.visible=true;fit(it);REDUCE?drawStatic(it):kick();}
      return it;
    }
  };
})();
