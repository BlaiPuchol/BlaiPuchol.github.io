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
	// Añade el objeto grafico a la escena
    let verde = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    let rojo = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
    let azul = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 });
    let material = new THREE.MeshNormalMaterial();
    // Suelo en plano XZ
    let suelo = new THREE.Mesh(new THREE.PlaneGeometry(100,100), material);
    suelo.rotation.x = -Math.PI / 2;
    scene.add(suelo);
    // Brazo articulado en robot
    robot = new THREE.Object3D();

    // Base cilindrica
    let h = 1.5;
    let r = 5;
    base = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32), verde);
    base.position.y = h/2;
    robot.add(base);

    // Brazo articulado
    brazo = new THREE.Object3D();
    // Eje del brazo en la base
    let r_eje = 2;
    let h_eje = 1.8;
    let eje = new THREE.Mesh(new THREE.CylinderGeometry(r_eje,r_eje,h_eje,32), azul);
    // Rotate 90 grados para que el eje mire hacia Z
    eje.rotation.x = Math.PI / 2;
    eje.position.y = h - r_eje / 2;
    brazo.add(eje);
    // Esparrago del brazo
    let h_esparrago = 12;
    let w_esparrago = h_eje;
    let d_esparrago = 1.2;
    let esparrago = new THREE.Mesh(new THREE.BoxGeometry(w_esparrago, h_esparrago, d_esparrago), rojo);
    esparrago.position.y = h + h_esparrago / 2 - r_eje / 2;
    brazo.add(esparrago);
    // Añadir rotula al brazo
    let rotula = new THREE.Mesh(new THREE.SphereGeometry(r_eje,32,16), azul);
    rotula.position.y = h + h_esparrago - r_eje / 2;
    brazo.add(rotula);
    // Antebrazo
    antebrazo = new THREE.Object3D();
    // Mover el origen del antebrazo al centro de la rótula
    antebrazo.position.y = h + h_esparrago - r_eje / 2;
    // Disco de la rotula
    let r_disco = 2.2;
    let h_disco = 0.6;
    let disco = new THREE.Mesh(new THREE.CylinderGeometry(r_disco,r_disco,h_disco,32), azul);
    // Colocar el disco relativo al nuevo origen del antebrazo
    disco.position.y = h_disco / 2;
    antebrazo.add(disco);
    // Nervios del antebrazo
    let num_nervios = 4;
    let r_nervio = 0.4;
    let h_nervio = 8;
    let d_nervio = 0.4;
    // Crear y posicionar los nervios en cuadrado
    for (let i = 0; i < num_nervios; i++) {
        let nervio = new THREE.Mesh(new THREE.BoxGeometry(d_nervio, h_nervio, r_nervio), rojo);
        // Posición relativa al nuevo origen (arrancan encima del disco)
        nervio.position.y = h_disco + h_nervio / 2;
        nervio.position.x = (i % 2 === 0 ? 2 : -2) * (d_nervio / 2 + 0.1);
        nervio.position.z = (i < 2 ? 2 : -2) * (d_nervio / 2 + 0.1);
        antebrazo.add(nervio);
    }
    // Mano del robot
    mano = new THREE.Object3D();
    const manoG = new THREE.Object3D(); // contenedor de geometría de la mano
    // Disco de la mano
    let r_disco_mano = 1.5;
    let h_disco_mano = 4;
    let disco_mano = new THREE.Mesh(new THREE.CylinderGeometry(r_disco_mano, r_disco_mano, h_disco_mano, 32), azul);
    disco_mano.rotation.x = Math.PI / 2; 
    disco_mano.position.y = 0;
    manoG.add(disco_mano);
    // Pinza de la mano
    let h_pinza = 2;
    let l_pinza = 1.9; 
    let l_pinza_total = 3.8;
    let w_pinza_inicial = 0.4;
    let w_pinza_final = 0.2;
    let pinza_b = new THREE.Mesh(new THREE.BoxGeometry(w_pinza_inicial, h_pinza, l_pinza), rojo);
    pinza_b.position.y = 0;
    pinza_b.position.z = l_pinza / 2;

    // Crear geometría trapezoidal para la parte final de la pinza
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
      -w0/2, y0 - h_pinza/2, z0,   // 0: esquina inferior izquierda
       w0/2, y0 - h_pinza/2, z0,   // 1: esquina inferior derecha
      -w1/2, y0 - h_pinza/3, z1,   // 2: esquina inferior izquierda atrás
       w1/2, y0 - h_pinza/3, z1,   // 3: esquina inferior derecha atrás
      // Cara superior (y = y0 + h_pinza/2)
      -w0/2, y0 + h_pinza/2, z0,   // 4: esquina superior izquierda
       w0/2, y0 + h_pinza/2, z0,   // 5: esquina superior derecha
      -w1/2, y0 + h_pinza/3, z1,   // 6: esquina superior izquierda atrás
       w1/2, y0 + h_pinza/3, z1    // 7: esquina superior derecha atrás
    ]);
    trapezoidGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Caras (triángulos)
    const indices = [
      // Cara frontal
      0, 1, 5, 0, 5, 4,
      // Cara trasera
      2, 3, 7, 2, 7, 6,
      // Cara superior
      4, 5, 7, 4, 7, 6,
      // Cara inferior
      0, 1, 3, 0, 3, 2,
      // Cara izquierda
      0, 4, 6, 0, 6, 2,
      // Cara derecha
      1, 5, 7, 1, 7, 3
    ];
    trapezoidGeometry.setIndex(indices);
    trapezoidGeometry.computeVertexNormals();

    // Usar material con side: THREE.DoubleSide para que todas las caras sean visibles
    let rojoDoble = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    let pinza_t = new THREE.Mesh(trapezoidGeometry, rojoDoble);
    let pinza = new THREE.Object3D();
    pinza.add(pinza_b);
    pinza.add(pinza_t);
    // Añadir pinza derecha y izquierda
    pinza_derecha = pinza.clone();
    pinza_izquierda = pinza.clone();
    pinza_derecha.position.z = baseApertura;   // was: 1
    pinza_izquierda.position.z = -baseApertura; // was: -1
    // Rotar 90 grados para que las pinzas queden enfrentadas
    pinza_derecha.rotation.y = Math.PI / 2;
    pinza_izquierda.rotation.y = Math.PI / 2;
    manoG.add(pinza_derecha);
    manoG.add(pinza_izquierda);

    // Posicionar la mano en la parte superior del antebrazo sin mover su pivot (centro de la mano)
    const manoPivot = new THREE.Object3D();
    manoPivot.position.y = h_disco + h_nervio; // top del antebrazo
    mano.add(manoG);           // mano = pivot de rotación
    manoG.position.y = 0;      // geometría centrada en el pivot
    mano.position.y = 0;
    manoPivot.add(mano);
    antebrazo.add(manoPivot);
    brazo.add(antebrazo);
    robot.add(brazo);
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
  gui.add(effectController, 'animar').name('Animar');
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