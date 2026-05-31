// ==========================================================================
//  body3d.js  —  stylized, rotatable 3D figure for the Musculoskeletal view.
//  Three.js is loaded lazily from a CDN. Clicking a body part jumps to that
//  muscle region's table. Drag to rotate (custom, no extra dependency).
// ==========================================================================

const Body3D = (() => {
  let loaded = null;

  function loadThree() {
    if (loaded) return loaded;
    loaded = new Promise((resolve, reject) => {
      if (window.THREE) return resolve(window.THREE);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/three@0.152.0/build/three.min.js";
      s.onload = () => resolve(window.THREE);
      s.onerror = () => reject(new Error("Three.js failed to load (offline?)."));
      document.head.appendChild(s);
    });
    return loaded;
  }

  // region index -> label (matches data.js musculoskeletal regions order)
  const REGION = (i, sys) => sys.regions[i];

  async function mount(host, sys, onJump) {
    let THREE;
    try { THREE = await loadThree(); }
    catch (e) {
      host.innerHTML = `<div class="hint" style="position:static;margin:40px auto;max-width:80%">
        3D view needs an internet connection the first time. The muscle tables below work offline.</div>`;
      return;
    }

    host.innerHTML = "";
    const W = host.clientWidth, H = host.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0.2, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff4e0, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(4, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xf4a300, 0.5); rim.position.set(-6, 2, -4); scene.add(rim);

    const figure = new THREE.Group();
    scene.add(figure);

    const baseColor = 0xe7c9a0, jointColor = 0xcf9b66;
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05 });

    const parts = [];
    function part(geo, color, x, y, z, region, label) {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(x, y, z);
      m.userData = { region, label, base: new THREE.Color(color) };
      figure.add(m); parts.push(m);
      return m;
    }
    const cap = (r, h) => new THREE.CapsuleGeometry(r, h, 6, 12);
    const sph = r => new THREE.SphereGeometry(r, 20, 16);

    // head / neck / spine
    part(sph(0.85), baseColor, 0, 4.0, 0, 0, REGION(0, sys));               // Head
    part(cap(0.35, 0.5), jointColor, 0, 3.2, 0, 1, REGION(1, sys));         // Anterior Neck/Throat
    part(cap(0.3, 0.4), 0xc99, 0, 2.95, -0.25, 2, REGION(2, sys));          // Neck & Vertebral Column
    // thorax / abdomen / pelvis
    part(new THREE.BoxGeometry(2.0, 1.6, 1.0), baseColor, 0, 2.0, 0, 3, REGION(3, sys));  // Thorax
    part(new THREE.BoxGeometry(1.9, 1.0, 0.95), 0xe0bf95, 0, 0.95, 0, 6, REGION(6, sys)); // Ant/Post Thorax
    part(new THREE.BoxGeometry(1.7, 1.1, 0.9), baseColor, 0, 0.1, 0, 4, REGION(4, sys));  // Abdominal Wall
    part(new THREE.BoxGeometry(1.8, 0.9, 0.95), jointColor, 0, -0.85, 0, 5, REGION(5, sys)); // Pelvic Floor
    // arms (mirror)
    [-1, 1].forEach(side => {
      part(sph(0.45), jointColor, side * 1.25, 2.5, 0, 7, REGION(7, sys));            // Shoulder
      part(cap(0.3, 1.0), baseColor, side * 1.55, 1.6, 0, 7, REGION(7, sys));         // upper arm
      part(sph(0.32), jointColor, side * 1.7, 0.85, 0, 8, REGION(8, sys));            // Elbow
      part(cap(0.26, 1.0), baseColor, side * 1.85, 0.0, 0, 9, REGION(9, sys));        // Forearm
      part(sph(0.3), baseColor, side * 2.0, -0.8, 0, 10, REGION(10, sys));            // Hand
    });
    // legs (mirror)
    [-1, 1].forEach(side => {
      part(sph(0.42), jointColor, side * 0.55, -1.4, 0, 11, REGION(11, sys));         // Hip/Knee
      part(cap(0.36, 1.2), baseColor, side * 0.6, -2.4, 0, 12, REGION(12, sys));      // Thigh/Legs
      part(sph(0.34), jointColor, side * 0.62, -3.3, 0, 11, REGION(11, sys));         // Knee
      part(cap(0.3, 1.2), baseColor, side * 0.63, -4.2, 0, 12, REGION(12, sys));      // Lower leg
      part(new THREE.BoxGeometry(0.5, 0.3, 0.9), baseColor, side * 0.63, -5.1, 0.25, 13, REGION(13, sys)); // Foot
    });

    figure.scale.setScalar(0.95);

    // label readout
    const readout = el("div", { class: "hint" }, "Drag to rotate · click a region to open its muscle table");
    host.appendChild(readout);

    // --- interaction: drag rotate + raycast click ---
    let dragging = false, lx = 0, ly = 0, ry = 0.2, rx = 0;
    const dom = renderer.domElement;
    dom.style.cursor = "grab";
    dom.addEventListener("pointerdown", e => { dragging = true; lx = e.clientX; ly = e.clientY; dom.style.cursor = "grabbing"; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener("pointerup", e => { dragging = false; dom.style.cursor = "grab"; });
    dom.addEventListener("pointermove", e => {
      if (dragging) {
        ry += (e.clientX - lx) * 0.01; rx += (e.clientY - ly) * 0.01;
        rx = Math.max(-0.8, Math.min(0.8, rx));
        lx = e.clientX; ly = e.clientY;
      }
      // hover highlight
      hover(e);
    });

    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    let hovered = null;
    function pick(e) {
      const r = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      return ray.intersectObjects(parts)[0];
    }
    function hover(e) {
      const hit = pick(e);
      if (hovered && (!hit || hit.object !== hovered)) { hovered.material.emissive.setHex(0x000000); hovered = null; readout.textContent = "Drag to rotate · click a region to open its muscle table"; }
      if (hit && hit.object !== hovered) {
        hovered = hit.object;
        hovered.material.emissive = new THREE.Color(0xf4a300);
        hovered.material.emissiveIntensity = 0.5;
        readout.textContent = hovered.userData.label + "  →  click to open";
        dom.style.cursor = "pointer";
      } else if (!hit && !dragging) { dom.style.cursor = "grab"; }
    }
    let downXY = null;
    dom.addEventListener("pointerdown", e => { downXY = [e.clientX, e.clientY]; });
    dom.addEventListener("click", e => {
      if (downXY && Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 5) return; // was a drag
      const hit = pick(e);
      if (hit) onJump(hit.object.userData.region);
    });

    let alive = true;
    (function loop() {
      if (!alive) return;
      figure.rotation.y = ry; figure.rotation.x = rx;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })();

    const onResize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // cleanup hook for the router
    host._cleanup = () => { alive = false; window.removeEventListener("resize", onResize); renderer.dispose(); };
  }

  return { mount };
})();

window.Body3D = Body3D;
