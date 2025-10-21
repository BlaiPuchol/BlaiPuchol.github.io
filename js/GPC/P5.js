// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;
// Referencias del robot y control UI/animación
var robot, base, brazo, antebrazo, mano, pinza_derecha, pinza_izquierda;
var gui, effectController;
var animating = false;           // <- quitar uso de clock
var tweenAnim = null;            // tween principal
var moveStep = 0.5;
var baseApertura = 1;            // distancia inicial en Z desde el centro de la mano
let choreoTweens = [];           // tweens de la coreografía
let danceTween = null;           // tween de la coreografía suave
let guiAnimCtrl = null;          // referencia al botón de animación en la GUI

// Helpers para crear tweens
function refreshGUI() {
  if (!gui) return;
  if (gui.controllers && gui.controllers.length) {
    gui.controllers.forEach(c => c.updateDisplay());
  }
}
// Interpolación de keyframes con transición suave
function ease01(t){ return 0.5 - 0.5 * Math.cos(Math.PI * t); } // cos in/out
function lerp(a,b,t){ return a + (b - a) * t; }
function keyAt(keys, t){
  if (t <= keys[0][0]) return keys[0][1];
  for (let i=0; i<keys.length-1; i++){
    const [t0,v0] = keys[i], [t1,v1] = keys[i+1];
    if (t <= t1){
      const u = (t - t0) / (t1 - t0);
      return lerp(v0, v1, ease01(u));
    }
  }
  return keys[keys.length-1][1];
}
function stopChoreography() {
  if (danceTween) { danceTween.stop(); danceTween = null; }
  TWEEN.removeAll();
  choreoTweens = [];
  animating = false;
  updateAnimButtonName();
}
function startChoreography() {
  stopChoreography();
  if (!robot) return;

  // Keyframes (t normalizado 0..1)
  const kBaseY       = [[0, 0],   [0.25, 60],  [0.50, -60], [0.75, 30],  [1, 0]];
  const kBrazoZ      = [[0, 0],   [0.25, 25],  [0.50, -20], [0.75, 10],  [1, 0]];
  const kAnteY       = [[0, 0],   [0.25, 45],  [0.50, -30], [0.75, 20],  [1, 0]];
  const kAnteZ       = [[0, 0],   [0.25, 30],  [0.50, -30], [0.75, 15],  [1, 0]];
  const kPinzaRotZ   = [[0, 0],   [0.25, 90],  [0.50, 180], [0.75, 60],  [1, 0]];
  const kApertura    = [[0, baseApertura],
                        [0.25, baseApertura*1.2],
                        [0.50, baseApertura*0.4],
                        [0.75, baseApertura*1.0],
                        [1, baseApertura]];

  // Driver de tiempo
  const track = { t: 0 };
  danceTween = new TWEEN.Tween(track)
    .to({ t: 1 }, 12000) // duración total
    .easing(TWEEN.Easing.Linear.None) // linear, suavidad viene del interpolador
    .onUpdate(() => {
      const t = track.t;
      effectController.baseY       = keyAt(kBaseY, t);
      effectController.brazoZ      = keyAt(kBrazoZ, t);
      effectController.antebrazoY  = keyAt(kAnteY, t);
      effectController.antebrazoZ  = keyAt(kAnteZ, t);
      effectController.pinzaRotZ   = keyAt(kPinzaRotZ, t);
      effectController.apertura    = keyAt(kApertura, t);
      refreshGUI();
    })
    .repeat(Infinity)
    .yoyo(true) // ida y vuelta continua
    .start();

  animating = true;
  updateAnimButtonName();
}

// 1-inicializa 
init();
// 2-Crea una escena
loadScene();
// 3-renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  // Habilitar sombras suaves
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 1000 );
  camera.position.set( 1, 30, 30 );

  // vista de planta
  cameraTop = new THREE.OrthographicCamera( -50, 50, 50,-50, 1, 1000 );
  cameraTop.position.set(0,500,0);
  cameraTop.lookAt( 0, 0, 0 );
  cameraTop.up.set( 0, 0, 1 );
  // Zoom del minimapa
  cameraTop.zoom = 2.5; 
  cameraTop.updateProjectionMatrix();  

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 12, 0 );
  // Habilitar interacciones solicitadas
  cameraControls.enableZoom = true;   // rueda: zoom
  cameraControls.enablePan = true;    // botón derecho: pan
  cameraControls.enableDamping = true;
  cameraControls.mouseButtons = {     // botón izquierdo: rotar
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  // Evitar menú contextual con botón derecho sobre el canvas
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('resize', updateAspectRatio );
  // Movimiento con teclado
  window.addEventListener('keydown', onKeyDown);
  // GUI controles
  setupGUI();
}


function loadScene()
{
  // Textures/loaders
  const texLoader = new THREE.TextureLoader();

  // Replace equirectangular single-texture load with a cube env made from the same image
  const wallUrl = 'env/factory_square.jpg';
  const ceilingUrl = 'env/ceiling_square.jpg';
  const cubeEnv = new THREE.CubeTextureLoader().load([
    wallUrl, 
    wallUrl, 
    ceilingUrl,
    wallUrl, 
    wallUrl, 
    wallUrl
  ],
        function (texture) {
            console.log('Cubemap cargado correctamente.');
        }, 
        undefined, 
        function (error) {
            console.error('Error al cargar el cubemap', error);
        }
  );
  cubeEnv.colorSpace = THREE.SRGBColorSpace;
  scene.background = cubeEnv;     // skybox-like background
  scene.environment = cubeEnv;    // reflections for PBR/Phong

  // Helper PBR: carga un set completo de mapas
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function loadTex(path, repeat = 1) {
    const t = texLoader.load(path);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = maxAniso;
    return t;
  }
  function loadSet(dir, repeat = 1) {
    const base = `materials/${dir}/`;
    return {
      map:              loadTex(`${base}basecolor.png`, repeat),
      normalMap:        loadTex(`${base}normal.png`, repeat),
      roughnessMap:     loadTex(`${base}roughness.png`, repeat),
      metalnessMap:     loadTex(`${base}metallic.png`, repeat),
      displacementMap:  loadTex(`${base}height.png`, repeat),
      alphaMap:         loadTex(`${base}opacity.png`, repeat),
      aoMap:            loadTex(`${base}ambientocclusion.png`, repeat)
    };
  }

  // Habitacion cúbica: paredes y techo con materiales distintos, suelo aparte
  const wallTex = texLoader.load(wallUrl);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.anisotropy = maxAniso;
  wallTex.colorSpace = THREE.SRGBColorSpace;

  const ceilingTex = texLoader.load(ceilingUrl);
  ceilingTex.wrapS = ceilingTex.wrapT = THREE.RepeatWrapping;
  ceilingTex.anisotropy = maxAniso;
  ceilingTex.colorSpace = THREE.SRGBColorSpace;


  const boxMaterials = [
    new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide }), // px
    new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide }), // nx
    new THREE.MeshLambertMaterial({ map: ceilingTex, side: THREE.BackSide }), // py (techo)
    new THREE.MeshLambertMaterial({ transparent: true, opacity: 0, side: THREE.BackSide }), // ny (suelo, invisible)
    new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide }), // pz
    new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide })  // nz
  ];

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(200, 200, 200),
    boxMaterials
  );
  room.position.y = 100;
  room.receiveShadow = true;
  scene.add(room);

  // Luces
  const ambLight = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(50, 100, 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 400;
  dirLight.shadow.camera.left = -120;
  dirLight.shadow.camera.right = 120;
  dirLight.shadow.camera.top = 120;
  dirLight.shadow.camera.bottom = -120;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  const spot = new THREE.SpotLight(0xffffff, 0.9, 300, Math.PI/6, 0.3, 1.5);
  spot.position.set(0, 120, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 5;
  spot.shadow.camera.far = 300;
  spot.shadow.bias = -0.0005;
  spot.target.position.set(0, 0, 0);
  scene.add(spot);
  scene.add(spot.target);

  // Suelo XZ con PBR (Standard): usa roughness/metalness/height/ao/normal
  const floorSet = loadSet('material-03', 6);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorSet.map,
    normalMap: floorSet.normalMap,
    roughnessMap: floorSet.roughnessMap,
    metalnessMap: floorSet.metalnessMap,
    aoMap: floorSet.aoMap,
    displacementMap: floorSet.displacementMap,
    displacementScale: 0.15,
    displacementBias: -0.02
  });
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(200,200, 256,256), floorMat);
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  // uv2 para aoMap
  suelo.geometry.setAttribute('uv2', new THREE.BufferAttribute(suelo.geometry.attributes.uv.array, 2));
  scene.add(suelo);

  // Sets de texturas por pieza
  const metal  = loadSet('material-01', 1);
  const metal2 = loadSet('material-02', 1);
  const metal4 = loadSet('material-04', 1);

  // Materiales del robot (Lambert/Standard/Phong)
  const matBase        = new THREE.MeshStandardMaterial({ map: metal2.map, normalMap: metal2.normalMap, metalnessMap: metal2.metalnessMap, aoMap: metal2.aoMap, alphaMap: metal2.alphaMap });
  const matEje         = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const matEsparrago   = new THREE.MeshStandardMaterial({ map: metal.map, normalMap: metal.normalMap, metalnessMap: metal.metalnessMap, aoMap: metal.aoMap, alphaMap: metal.alphaMap });
  const matRotula      = new THREE.MeshPhongMaterial({ color: 0xffffff, envMap: cubeEnv, reflectivity: 1.0, shininess: 120, specular: 0xffffff });
  const matDisco       = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const matNervios     = new THREE.MeshStandardMaterial({ map: metal.map, normalMap: metal.normalMap, metalnessMap: metal.metalnessMap, aoMap: metal.aoMap, alphaMap: metal.alphaMap });
  const matDiscoMano   = new THREE.MeshStandardMaterial({ map: metal4.map, normalMap: metal4.normalMap,  metalnessMap: metal4.metalnessMap, aoMap: metal4.aoMap, alphaMap: metal4.alphaMap });
  const matPinzaCuerpo = new THREE.MeshStandardMaterial({ map: metal2.map, normalMap: metal2.normalMap, metalnessMap: metal2.metalnessMap, aoMap: metal2.aoMap, alphaMap: metal2.alphaMap });
  const matPinzaTrape  = new THREE.MeshStandardMaterial({ map: metal2.map, normalMap: metal2.normalMap, metalnessMap: metal2.metalnessMap, aoMap: metal2.aoMap, alphaMap: metal2.alphaMap, side: THREE.DoubleSide });


  // Brazo articulado en robot
  robot = new THREE.Object3D();

  // Base cilindrica
  let h = 1.5;
  let r = 5;
  base = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32), matBase);
  base.position.y = h/2;
  base.castShadow = true; base.receiveShadow = true;
  robot.add(base);

  // Brazo articulado
  brazo = new THREE.Object3D();
  // Eje del brazo 
  let r_eje = 2;
  let h_eje = 1.8;
  let eje = new THREE.Mesh(new THREE.CylinderGeometry(r_eje,r_eje,h_eje,32), matEje);
  eje.rotation.x = Math.PI / 2;
  eje.position.y = h - r_eje / 2;
  eje.castShadow = true; eje.receiveShadow = true;
  brazo.add(eje);

  // Esparrago
  let h_esparrago = 12;
  let w_esparrago = h_eje;
  let d_esparrago = 1.2;
  let esparrago = new THREE.Mesh(new THREE.BoxGeometry(w_esparrago, h_esparrago, d_esparrago), matEsparrago);
  esparrago.position.y = h + h_esparrago / 2 - r_eje / 2;
  esparrago.castShadow = true; esparrago.receiveShadow = true;
  brazo.add(esparrago);

  // Rótula
  let rotula = new THREE.Mesh(new THREE.SphereGeometry(r_eje,32,16), matRotula);
  rotula.position.y = h + h_esparrago - r_eje / 2;
  rotula.castShadow = true; rotula.receiveShadow = true;
  brazo.add(rotula);

  // Antebrazo
  antebrazo = new THREE.Object3D();
  antebrazo.position.y = h + h_esparrago - r_eje / 2;

  // Disco de la rótula
  let r_disco = 2.2;
  let h_disco = 0.6;
  let disco = new THREE.Mesh(new THREE.CylinderGeometry(r_disco,r_disco,h_disco,32), matDisco);
  disco.position.y = h_disco / 2;
  disco.castShadow = true; disco.receiveShadow = true;
  antebrazo.add(disco);

  // Nervios
  let num_nervios = 4;
  let r_nervio = 0.4;
  let h_nervio = 8;
  let d_nervio = 0.4;
  for (let i = 0; i < num_nervios; i++) {
    let nervio = new THREE.Mesh(new THREE.BoxGeometry(d_nervio, h_nervio, r_nervio), matNervios);
    nervio.position.y = h_disco + h_nervio / 2;
    nervio.position.x = (i % 2 === 0 ? 2 : -2) * (d_nervio / 2 + 0.1);
    nervio.position.z = (i < 2 ? 2 : -2) * (d_nervio / 2 + 0.1);
    nervio.castShadow = true; nervio.receiveShadow = true;
    antebrazo.add(nervio);
  }

  // Mano
  mano = new THREE.Object3D();
  const manoG = new THREE.Object3D();

  // Disco de la mano 
  let r_disco_mano = 1.5;
  let h_disco_mano = 4;
  let disco_mano = new THREE.Mesh(new THREE.CylinderGeometry(r_disco_mano, r_disco_mano, h_disco_mano, 32), matDiscoMano);
  disco_mano.rotation.x = Math.PI / 2;
  disco_mano.position.y = 0;
  disco_mano.castShadow = true; disco_mano.receiveShadow = true;
  manoG.add(disco_mano);

  // Pinza de la mano
  let h_pinza = 2;
  let l_pinza = 1.9;
  let l_pinza_total = 3.8;
  let w_pinza_inicial = 0.4;
  let w_pinza_final = 0.2;
  let pinza_b = new THREE.Mesh(new THREE.BoxGeometry(w_pinza_inicial, h_pinza, l_pinza), matPinzaCuerpo);
  pinza_b.position.y = 0;
  pinza_b.position.z = l_pinza / 2;
  pinza_b.castShadow = true; pinza_b.receiveShadow = true;

  // Geometría trapezoidal de la punta
  let trapezoidGeometry = new THREE.BufferGeometry();

  // Dimensiones
  let y0 = 0; 
  let z0 = l_pinza;
  let z1 = l_pinza_total;
  let w0 = w_pinza_inicial;
  let w1 = w_pinza_final;

  // Vértices (8 puntos de la caja trapezoidal)
  const vertices = new Float32Array([
    // Cara inferior (y = y0 - h_pinza/2)
    -w0/2, y0 - h_pinza/2, z0,
     w0/2, y0 - h_pinza/2, z0,
    -w1/2, y0 - h_pinza/3, z1,
     w1/2, y0 - h_pinza/3, z1,
    // Cara superior (y = y0 + h_pinza/2)
    -w0/2, y0 + h_pinza/2, z0,
     w0/2, y0 + h_pinza/2, z0,
    -w1/2, y0 + h_pinza/3, z1,
     w1/2, y0 + h_pinza/3, z1
  ]);
  trapezoidGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  // UVs para permitir mapear texturas y AO en la pinza
  {
    const pos = trapezoidGeometry.getAttribute('position');
    let yMin=+Infinity,yMax=-Infinity,zMin=+Infinity,zMax=-Infinity;
    for (let i=0;i<pos.count;i++){
      const y = pos.getY(i), z = pos.getZ(i);
      if (y<yMin) yMin=y; if (y>yMax) yMax=y;
      if (z<zMin) zMin=z; if (z>zMax) zMax=z;
    }
    const du = Math.max(1e-6, zMax - zMin);
    const dv = Math.max(1e-6, yMax - yMin);
    const uv = new Float32Array(pos.count*2);
    for (let i=0;i<pos.count;i++){
      const y = pos.getY(i), z = pos.getZ(i);
      uv[2*i]   = (z - zMin)/du;
      uv[2*i+1] = (y - yMin)/dv;
    }
    trapezoidGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    trapezoidGeometry.setAttribute('uv2', new THREE.BufferAttribute(uv, 2));
  }

  // Caras (triángulos)
  const indices = [
    0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6,
    4, 5, 7, 4, 7, 6,
    0, 1, 3, 0, 3, 2,
    0, 4, 6, 0, 6, 2,
    1, 5, 7, 1, 7, 3
  ];
  trapezoidGeometry.setIndex(indices);
  trapezoidGeometry.computeVertexNormals();

  let pinza_t = new THREE.Mesh(trapezoidGeometry, matPinzaTrape);
  pinza_t.castShadow = true; pinza_t.receiveShadow = true;

  let pinza = new THREE.Object3D();
  pinza.add(pinza_b);
  pinza.add(pinza_t);

  pinza_derecha = pinza.clone();
  pinza_izquierda = pinza.clone();
  pinza_derecha.position.z = baseApertura;
  pinza_izquierda.position.z = -baseApertura;
  pinza_derecha.rotation.y = Math.PI / 2;
  pinza_izquierda.rotation.y = Math.PI / 2;
  manoG.add(pinza_derecha);
  manoG.add(pinza_izquierda);

  const manoPivot = new THREE.Object3D();
  manoPivot.position.y = h_disco + h_nervio;
  mano.add(manoG);
  manoG.position.y = 0;
  mano.position.y = 0;
  mano.castShadow = true; mano.receiveShadow = true;
  manoPivot.add(mano);
  antebrazo.add(manoPivot);
  brazo.add(antebrazo);
  robot.add(brazo);

  // Duplicar UV -> UV2 para aoMap en todas las piezas
  robot.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.uv && !o.geometry.attributes.uv2) {
      o.geometry.setAttribute('uv2', new THREE.BufferAttribute(o.geometry.attributes.uv.array, 2));
    }
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  scene.add(robot);
}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// Movimiento con teclado (XZ)
function onKeyDown(e) {
  if (!robot) return;
  switch (e.key) {
    case 'ArrowUp':    robot.position.z -= moveStep; break;
    case 'ArrowDown':  robot.position.z += moveStep; break;
    case 'ArrowLeft':  robot.position.x -= moveStep; break;
    case 'ArrowRight': robot.position.x += moveStep; break;
    default: break;
  }
}

// Configurar GUI
function setupGUI() {
  effectController = {
    baseY: 0,            // [-180..180] grados
    brazoZ: 0,           // [-45..45] grados
    antebrazoY: 0,       // [-180..180] grados
    antebrazoZ: 0,       // [-90..90] grados
    pinzaRotZ: 0,        // [-40..220] grados
    apertura: baseApertura,   // posición Z (distancia desde el centro)
    alambre: false,
    animar: function() {
      if (animating) {
        stopChoreography();
      } else {
        startChoreography();
      }
    }
  };
  gui = new lil.GUI();
  gui.add(effectController, 'baseY', -180, 180, 1).name('Base Y (°)');
  gui.add(effectController, 'brazoZ', -45, 45, 1).name('Brazo Z (°)');
  gui.add(effectController, 'antebrazoY', -180, 180, 1).name('Antebrazo Y (°)');
  gui.add(effectController, 'antebrazoZ', -90, 90, 1).name('Antebrazo Z (°)');
  gui.add(effectController, 'pinzaRotZ', -40, 220, 1).name('Pinza Z (°)');
  gui.add(effectController, 'apertura', 0.2, 1.5, 0.1).name('Apertura Z');
  gui.add(effectController, 'alambre').name('Alámbrico').onChange(setWireframe);
  // Cambiar el texto del botón según el estado de animación
  guiAnimCtrl = gui.add(effectController, 'animar');
  updateAnimButtonName();
}

// Actualiza el nombre del botón de animación en la GUI
function updateAnimButtonName() {
  if (guiAnimCtrl) {
    guiAnimCtrl.name(animating ? 'Stop' : 'Animar');
  }
}

// Aplicar valores de la GUI al rig
function applyControlsToRig() {
  if (robot) robot.rotation.y = deg2rad(effectController.baseY);
  if (brazo) brazo.rotation.z = deg2rad(effectController.brazoZ);
  if (antebrazo) {
    antebrazo.rotation.y = deg2rad(effectController.antebrazoY);
    antebrazo.rotation.z = deg2rad(effectController.antebrazoZ);
  }
  if (mano) mano.rotation.z = deg2rad(effectController.pinzaRotZ);
  if (pinza_derecha && pinza_izquierda) {
    const z = effectController.apertura; // posición directa
    pinza_derecha.position.z = z;        // was: rotation.z
    pinza_izquierda.position.z = -z;     // was: rotation.z
  }
}

function setWireframe(v) {
  scene.traverse(o => {
    if (o.isMesh) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.wireframe = v);
      else if (o.material) o.material.wireframe = v;
    }
  });
}

function deg2rad(d) { return d * Math.PI / 180; }

function update()
{
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();

  // Actualizar tweens
  TWEEN.update();

  applyControlsToRig();
}

function render()
{
	requestAnimationFrame( render );
	update();// vista 3d perspectiva
  renderer.autoClear = false;
  renderer.setViewport(0,0,window.innerWidth,window.innerHeight);
  renderer.setClearColor( new THREE.Color(0xa2a2f2) );
  renderer.clear();
  renderer.render( scene, camera );

  // vista de arriba (miniatura en la esquina superior izquierda)
  const ds = Math.min(window.innerHeight, window.innerWidth) / 4;
  const x = 0;
  const y = window.innerHeight - ds;
  renderer.setViewport(x, y, ds, ds);
  renderer.setScissor(x, y, ds, ds);
  renderer.setScissorTest(true);
  renderer.setClearColor( new THREE.Color(0xaffff) );
  renderer.clear();
  renderer.setScissorTest(false);
  renderer.render(scene, cameraTop);
}