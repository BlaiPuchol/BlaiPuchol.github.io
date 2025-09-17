// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;

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

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 12, 0 );

  window.addEventListener('resize', updateAspectRatio );
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
    let robot = new THREE.Object3D();

    // Base cilindrica
    let h = 1.5;
    let r = 5;
    let base = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32), verde);
    base.position.y = h/2;
    robot.add(base);

    // Brazo articulado
    let brazo = new THREE.Object3D();
    // Eje del brazo en la base
    let r_eje = 2;
    let h_eje = 1.8;
    let eje = new THREE.Mesh(new THREE.CylinderGeometry(r_eje,r_eje,h_eje,32), azul);
    // Rotate 90 grados para que el eje mire hacia Z
    eje.rotation.z = Math.PI / 2;
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
    let antebrazo = new THREE.Object3D();
    // Disco de la rotula
    let r_disco = 2.2;
    let h_disco = 0.6;
    let disco = new THREE.Mesh(new THREE.CylinderGeometry(r_disco,r_disco,h_disco,32), azul);
    disco.position.y = h + h_esparrago + h_disco / 2 - r_eje / 2;
    antebrazo.add(disco);
    // Nervios del antebrazo
    let num_nervios = 4;
    let r_nervio = 0.4;
    let h_nervio = 8;
    let d_nervio = 0.4;
    // Crear y posicionar los nervios en cuadrado
    for (let i = 0; i < num_nervios; i++) {
        let nervio = new THREE.Mesh(new THREE.BoxGeometry(d_nervio, h_nervio, r_nervio), rojo);
        nervio.position.y = h + h_esparrago + h_disco + h_nervio / 2 - r_eje / 2;
        nervio.position.x = (i % 2 === 0 ? 2 : -2) * (d_nervio / 2 + 0.1);
        nervio.position.z = (i < 2 ? 2 : -2) * (d_nervio / 2 + 0.1);
        antebrazo.add(nervio);
    }
    // Mano del robot
    let mano = new THREE.Object3D();
    // Disco de la mano
    let r_disco_mano = 1.5;
    let h_disco_mano = 4;
    let disco_mano = new THREE.Mesh(new THREE.CylinderGeometry(r_disco_mano, r_disco_mano, h_disco_mano, 32), azul);
    disco_mano.rotation.z = Math.PI / 2;
    disco_mano.position.y = h_nervio;
    mano.add(disco_mano);
    // Pinza de la mano
    let h_pinza = 2;
    let l_pinza = 1.9; 
    let l_pinza_total = 3.8;
    let w_pinza_inicial = 0.4;
    let w_pinza_final = 0.2;
    let pinza_b = new THREE.Mesh(new THREE.BoxGeometry(w_pinza_inicial, h_pinza, l_pinza), rojo);
    pinza_b.position.y = h_nervio;
    pinza_b.position.z = l_pinza / 2;

    // Crear geometría trapezoidal para la parte final de la pinza
    let trapezoidGeometry = new THREE.BufferGeometry();

    // Dimensiones
    let y0 = h_nervio;
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
    let pinza_derecha = pinza.clone();
    let pinza_izquierda = pinza.clone();
    pinza_derecha.position.x = 1;
    pinza_izquierda.position.x = -1;
    mano.add(pinza_derecha);
    mano.add(pinza_izquierda);
    mano.position.y = h + h_esparrago + h_disco - r_eje / 2;
    antebrazo.add(mano);
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

function update()
{
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();
}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}