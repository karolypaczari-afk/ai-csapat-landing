/* ============================================================
   HERO 3D — Three.js parancsnoki nyitókép.
   • Visszafogott, halk csillagpor (nem „pixel-katyvasz").
   • A 28 ágens NÉV + SZEREP feliratos kártyaként lebeg egy
     enyhén jobbra tolt konstellációban; mélység-halványítás
     a zsúfoltság ellen, így a bal oldali szöveg olvasható marad.
   • Egér-parallax, görgetésre összetartás.
   ESM modul; csak desktop/WebGL-en indul.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";
var TAU = Math.PI * 2;

export function initHero(opts) {
  var canvas = opts.canvas, agents = opts.agents || [], avBase = opts.avBase || "/assets/img/avatars/", EN = !!opts.en;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  var root = new THREE.Group();
  root.position.x = 2.4;            // jobbra told, hogy a bal oldali copy tiszta legyen
  scene.add(root);

  /* ---------- halk csillagpor (apró, fakó) ---------- */
  function stars(count, spread, size, color, alpha) {
    var g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (var i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * spread;
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size: size, color: new THREE.Color(color), transparent: true, opacity: alpha, depthWrite: false, sizeAttenuation: true }));
  }
  var dust = stars(1300, 55, 0.05, 0xbfe6ff, 0.55); scene.add(dust);
  var dust2 = stars(500, 36, 0.07, 0x8ab4ff, 0.35); scene.add(dust2);

  /* ---------- feliratos ágens-kártya textúra ---------- */
  function roundRect(x, rx, ry, w, h, r) { x.beginPath(); x.moveTo(rx + r, ry); x.arcTo(rx + w, ry, rx + w, ry + h, r); x.arcTo(rx + w, ry + h, rx, ry + h, r); x.arcTo(rx, ry + h, rx, ry, r); x.arcTo(rx, ry, rx + w, ry, r); x.closePath(); }
  function cardTexture(img, name, role, ring) {
    var W = 300, H = 364, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var x = cv.getContext("2d");
    roundRect(x, 5, 5, W - 10, H - 10, 26); x.fillStyle = "rgba(20,20,38,0.92)"; x.fill();
    x.save(); x.shadowColor = ring; x.shadowBlur = 18; x.lineWidth = 4.5; x.strokeStyle = ring; x.stroke(); x.restore();
    // portré-kör
    var cR = 76, ccx = W / 2, ccy = 102;
    x.save(); x.beginPath(); x.arc(ccx, ccy, cR, 0, TAU); x.clip();
    var s = Math.max((cR * 2) / img.width, (cR * 2) / img.height), dw = img.width * s, dh = img.height * s;
    x.drawImage(img, ccx - dw / 2, ccy - dh / 2, dw, dh); x.restore();
    x.lineWidth = 5; x.strokeStyle = ring; x.beginPath(); x.arc(ccx, ccy, cR, 0, TAU); x.stroke();
    // név
    x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "700 34px 'JetBrains Mono', monospace";
    x.fillText(name, W / 2, 226);
    // szerep (max 2 sor)
    x.fillStyle = "#C7C5DE"; x.font = "21px Inter, system-ui, sans-serif";
    var words = role.split(" "), line = "", lines = [];
    for (var i = 0; i < words.length; i++) { var test = line ? line + " " + words[i] : words[i]; if (x.measureText(test).width > W - 44 && line) { lines.push(line); line = words[i]; } else line = test; }
    lines.push(line); lines = lines.slice(0, 2);
    for (var k = 0; k < lines.length; k++) x.fillText(lines[k], W / 2, 262 + k * 26);
    var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; return tex;
  }

  /* ---------- konstelláció (feliratos kártyák) ---------- */
  var sprites = [], N = agents.length, R = 8.6;
  agents.forEach(function (a, i) {
    var y = 1 - (i / Math.max(N - 1, 1)) * 2, rad = Math.sqrt(1 - y * y), theta = i * 2.39996323;
    var base = new THREE.Vector3(Math.cos(theta) * rad * R * 1.15, y * R * 0.92, Math.sin(theta) * rad * R);
    var mat = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
    var sp = new THREE.Sprite(mat);
    sp.position.copy(base); sp.scale.set(0.02, 0.024, 1);
    sp.renderOrder = 2; sp.userData = { base: base.clone(), phase: i * 0.5 };
    root.add(sp); sprites.push(sp);
    var im = new Image();
    im.onload = function () { mat.map = cardTexture(im, a.code, EN ? (a.roleEn || a.role) : a.role, a.color || "#00D4FF"); mat.needsUpdate = true; };
    im.src = avBase + a.code + ".webp";
  });

  /* ---------- interakció ---------- */
  var mx = 0, my = 0, tmx = 0, tmy = 0, scrollP = 0;
  function onPointer(e) { var t = e.touches ? e.touches[0] : e; tmx = (t.clientX / window.innerWidth - 0.5); tmy = (t.clientY / window.innerHeight - 0.5); }
  window.addEventListener("pointermove", onPointer, { passive: true });
  function resize() { var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize); resize();

  /* ---------- render-hurok ---------- */
  var raf = 0, intro = 0, last = 0, alive = true, tmp = new THREE.Vector3();
  function tick(now) {
    if (!alive) return; raf = requestAnimationFrame(tick); if (document.hidden) return;
    var dt = Math.min((now - last) / 1000 || 0, 0.05); last = now; var t = now / 1000;
    intro = Math.min(intro + dt * 0.6, 1); var ease = 1 - Math.pow(1 - intro, 3);
    mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;

    root.rotation.y += dt * 0.05; root.rotation.x = my * 0.18;
    dust.rotation.y += dt * 0.004; dust2.rotation.y -= dt * 0.006;
    camera.position.x += ((mx * 2) - camera.position.x) * 0.04;
    camera.position.y += ((-my * 1.4) - camera.position.y) * 0.04;
    camera.position.z = 14 - ease * 1.2 - scrollP * 4.5; camera.lookAt(root.position.x * 0.45, 0, 0);

    for (var i = 0; i < sprites.length; i++) {
      var sp = sprites[i], u = sp.userData, conv = scrollP;
      var bob = Math.sin(t * 0.7 + u.phase) * 0.14;
      sp.position.set(u.base.x * (1 - conv * 0.55), u.base.y * (1 - conv * 0.55) + bob, u.base.z * (1 - conv * 0.55));
      // mélység-halványítás: a hátul lévő kártyák fakóbbak (kevésbé zsúfolt)
      sp.getWorldPosition(tmp); var depth = (tmp.z - camera.position.z);
      var dn = Math.max(0, Math.min(1, (depth + 24) / 24));      // ~0 hátul, ~1 elöl
      var op = ease * (0.45 + dn * 0.55) * (1 - conv * 0.85);
      sp.material.opacity = op;
      var sc = (2.0 * ease) * (0.78 + dn * 0.42) * (1 - conv * 0.3);
      sp.scale.set(sc * 0.83, sc, 1);
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(tick);

  return {
    setScroll: function (p) { scrollP = Math.max(0, Math.min(1, p)); },
    destroy: function () {
      alive = false; cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer); window.removeEventListener("resize", resize);
      sprites.forEach(function (s) { if (s.material.map) s.material.map.dispose(); s.material.dispose(); });
      [dust, dust2].forEach(function (p) { p.geometry.dispose(); p.material.dispose(); });
      renderer.dispose();
    }
  };
}
