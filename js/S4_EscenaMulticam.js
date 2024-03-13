/**
 * EscenaMulticam.js
 * 
 * Seminario AGM. Construir una escena básica animada, con gui, iluminacion,
 * texturas, video como textura en 4 viewports
 * 
 * @author R.Vivo' <rvivo@upv.es>
 * @date   Feb,2023
 * 
 */

// Modulos necesarios
import * as THREE from "../lib/three.module.js";
import {GLTFLoader} from "../lib/GLTFLoader.module.js";
import {OrbitControls} from "../lib/OrbitControls.module.js";
import {TWEEN} from "../lib/tween.module.min.js";
import {GUI} from "../lib/lil-gui.module.min.js";

// Variables estandar
let renderer, scene, camera;

// Otras globales
let cameraControls, effectController;
let esferaCubo,cubo,esfera,suelo;
let video;
let alzado, planta, perfil;
const L = 5;

// Acciones
init();
loadScene();
setupGUI();
render();

function setCameras(ar)
{
    let camaraOrto;

    // Construir las camaras ortograficas.
    // ar: relacion de aspecto. 2L: lado ventana de la vista
    if(ar>1)
     camaraOrto = new THREE.OrthographicCamera(-L*ar,L*ar,L,-L,-10,100);
    else
     camaraOrto = new THREE.OrthographicCamera(-L,L,L/ar,-L/ar,-10,100);

    alzado = camaraOrto.clone();
    alzado.position.set(0,0,10);
    alzado.lookAt(0,0,0);

    perfil = camaraOrto.clone();
    perfil.position.set(10,0,0);
    perfil.lookAt(0,0,0);

    planta = camaraOrto.clone();
    planta.position.set(0,10,0);
    planta.lookAt(0,0,0);
    planta.up = new THREE.Vector3(0,0,-1); 
}

function init()
{
    // Instanciar el motor de render
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth,window.innerHeight);
    document.getElementById('container').appendChild( renderer.domElement );
    renderer.antialias = true;
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0xAAAAAA);
    renderer.autoClear = false;

    // Instanciar el nodo raiz de la escena
    scene = new THREE.Scene();
    ///scene.background = new THREE.Color(0.5,0.5,0.5);

    // Instanciar la camara perspectiva y su control
    const ar = window.innerWidth/window.innerHeight;
    camera= new THREE.PerspectiveCamera(75,ar,1,100);
    camera.position.set(0.5,2,7);
    cameraControls = new OrbitControls( camera, renderer.domElement );
    cameraControls.target.set(0,1,0);
    camera.lookAt(0,1,0);

    // Instanciar camaras ortograficas
    setCameras(ar);

    // Luces
    const ambiental = new THREE.AmbientLight(0x222222);
    scene.add(ambiental);
    const direccional = new THREE.DirectionalLight(0xFFFFFF,0.3);
    direccional.position.set(-1,1,-1);
    direccional.castShadow = true;
    scene.add(direccional);
    const puntual = new THREE.PointLight(0xFFFFFF,0.5);
    puntual.position.set(2,7,-4);
    scene.add(puntual);
    const focal = new THREE.SpotLight(0xFFFFFF,0.3);
    focal.position.set(-2,7,4);
    focal.target.position.set(0,0,0);
    focal.angle= Math.PI/7;
    focal.penumbra = 0.3;
    focal.castShadow= true;
    focal.shadow.camera.far = 20;
    focal.shadow.camera.fov = 80;
    scene.add(focal);
    scene.add(new THREE.CameraHelper(focal.shadow.camera));

    // Eventos
    window.addEventListener('resize', updateAspectRatio );
    renderer.domElement.addEventListener('dblclick', animate );
}

function loadScene()
{
    // Materiales 
    const path ="./images/";
    const texcubo = new THREE.TextureLoader().load(path+"wood512.jpg");
    const texsuelo = new THREE.TextureLoader().load(path+"r_256.jpg");
    texsuelo.repeat.set(4,3);
    texsuelo.wrapS= texsuelo.wrapT = THREE.RepeatWrapping;
    const entorno = [ path+"posx.jpg", path+"negx.jpg",
                      path+"posy.jpg", path+"negy.jpg",
                      path+"posz.jpg", path+"negz.jpg"];
    const texesfera = new THREE.CubeTextureLoader().load(entorno);

    const matcubo = new THREE.MeshLambertMaterial({color:'yellow',map:texcubo});
    const matesfera = new THREE.MeshPhongMaterial({color:'white',
                                                   specular:'gray',
                                                   shininess: 30,
                                                   envMap: texesfera });
    const matsuelo = new THREE.MeshStandardMaterial({color:"rgb(150,150,150)",map:texsuelo});

    // Suelo
    suelo = new THREE.Mesh( new THREE.PlaneGeometry(10,10, 100,100), matsuelo );
    suelo.rotation.x = -Math.PI/2;
    suelo.position.y = -0.2;
    suelo.receiveShadow = true;
    scene.add(suelo);

    // Esfera y cubo
    esfera = new THREE.Mesh( new THREE.SphereGeometry(1,20,20), matesfera );
    cubo = new THREE.Mesh( new THREE.BoxGeometry(2,2,2), matcubo );
    esfera.position.x = 1;
    cubo.position.x = -1;
    esfera.castShadow = true;
    esfera.receiveShadow = true;
    cubo.castShadow = cubo.receiveShadow = true;

    esferaCubo = new THREE.Object3D();
    esferaCubo.add(esfera);
    esferaCubo.add(cubo);
    esferaCubo.position.y = 1.5;

    scene.add(esferaCubo);

    scene.add( new THREE.AxesHelper(3) );
    cubo.add( new THREE.AxesHelper(1) );

    // Modelos importados
    const loader = new THREE.ObjectLoader();
    loader.load('models/soldado/soldado.json', 
    function (objeto)
    {
        const soldado = new THREE.Object3D();
        soldado.add(objeto);
        cubo.add(soldado);
        soldado.position.y = 1;
        soldado.name = 'soldado';
        soldado.traverse(ob=>{
            if(ob.isObject3D) ob.castShadow = true;
        });
        objeto.material.setValues( {map:
         new THREE.TextureLoader().load("models/soldado/soldado.png")} );
    });

    // Importar un modelo en gltf
   const glloader = new GLTFLoader();

   glloader.load( 'models/robota/scene.gltf', function ( gltf ) {
       gltf.scene.position.y = 1;
       gltf.scene.rotation.y = -Math.PI/2;
       gltf.scene.name = 'robota';
       esfera.add( gltf.scene );
       gltf.scene.traverse(ob=>{
        if(ob.isObject3D) ob.castShadow = true;
    })
   
   }, undefined, function ( error ) {
   
       console.error( error );
   
   } );

    // Habitacion
    const paredes = [];
    paredes.push( new THREE.MeshBasicMaterial({side:THREE.BackSide,
                  map: new THREE.TextureLoader().load(path+"posx.jpg")}) );
    paredes.push( new THREE.MeshBasicMaterial({side:THREE.BackSide,
                  map: new THREE.TextureLoader().load(path+"negx.jpg")}) );
    paredes.push( new THREE.MeshBasicMaterial({side:THREE.BackSide,
                  map: new THREE.TextureLoader().load(path+"posy.jpg")}) );
    paredes.push( new THREE.MeshBasicMaterial({side:THREE.BackSide,
                  map: new THREE.TextureLoader().load(path+"negy.jpg")}) );
    paredes.push( new THREE.MeshBasicMaterial({side:THREE.BackSide,
                  map: new THREE.TextureLoader().load(path+"posz.jpg")}) );
    paredes.push( new THREE.MeshBasicMaterial({side:THREE.BackSide,
                  map: new THREE.TextureLoader().load(path+"negz.jpg")}) );
    const habitacion = new THREE.Mesh( new THREE.BoxGeometry(40,40,40),paredes);
    scene.add(habitacion);

    // Cine
    video = document.createElement('video');
    video.src = "./videos/Pixar.mp4";
    video.load();
    video.muted = true;
    video.play();
    const texvideo = new THREE.VideoTexture(video);
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(20,6, 4,4), 
                                    new THREE.MeshBasicMaterial({map:texvideo}));
    pantalla.position.set(0,4.5,-5);
    scene.add(pantalla);
}

function setupGUI()
{
	// Definicion de los controles
	effectController = {
		mensaje: 'My cinema',
		giroY: 0.0,
		separacion: 0,
		sombras: true,
		play: function(){video.play();},
		pause: function(){video.pause();},
        mute: true,
		colorsuelo: "rgb(150,150,150)"
	};

	// Creacion interfaz
	const gui = new GUI();

	// Construccion del menu
	const h = gui.addFolder("Control esferaCubo");
	h.add(effectController, "mensaje").name("Aplicacion");
	h.add(effectController, "giroY", -180.0, 180.0, 0.025).name("Giro en Y");
	h.add(effectController, "separacion", { 'Ninguna': 0, 'Media': 2, 'Total': 5 })
     .name("Separacion")
     .onChange(s=>{
        cubo.position.set( -1-s/2, 0, 0 );
        esfera.position.set( 1+s/2, 0, 0 );
     });
	h.add(effectController, "sombras")
      .onChange(v=>{
        cubo.castShadow = v;
        esfera.castShadow = v;
      });
    h.addColor(effectController, "colorsuelo")
     .name("Color moqueta")
     .onChange(c=>{suelo.material.setValues({color:c})});
    const videofolder = gui.addFolder("Control video");
    videofolder.add(effectController,"mute").onChange(v=>{video.muted = v});
	videofolder.add(effectController,"play");
	videofolder.add(effectController,"pause");

}

function updateAspectRatio()
{
    const ar = window.innerWidth/window.innerHeight;

    // Dimensiones del canvas
    renderer.setSize(window.innerWidth,window.innerHeight);

    // Reajuste de la relacion de aspecto de las camaras

    camera.aspect = ar;
    camera.updateProjectionMatrix();

    if(ar>1){
        alzado.left = planta.left = perfil.left = -L*ar;
        alzado.right = planta.right =perfil.right = L*ar;
    }
    else{
        alzado.top = planta.top= perfil.top=  L/ar;
        alzado.bottom = planta.bottom = perfil.bottom = -L/ar;       
    }
    alzado.updateProjectionMatrix();
    perfil.updateProjectionMatrix();
    planta.updateProjectionMatrix();   
}

function animate(event)
{
    // 1. Capturar la posicion de doble click (S.R. top-left con Y down)
    let x = event.clientX;
    let y = event.clientY;

    // 2. Detectar la zona de click
    let derecha = false, abajo = false;
    let cam = null;

    if( x > window.innerWidth/2 ){
        derecha = true;
        x -= window.innerWidth/2;
    }
    if( y > window.innerHeight/2 ){
        abajo = true;
        y -= window.innerHeight/2;
    }

    // x e y ya estan en el primer cuadrante
    // cam es la camara que recibe el evento
    if(derecha)
        if(abajo) cam = camera;
        else cam = perfil;
    else
        if(abajo) cam = planta;
        else cam = alzado;    

    // 3. Normalizar las coordenadas de click al cuadrado de 2x2
    x = ( x * 4/window.innerWidth ) - 1;
    y = -( y * 4/window.innerHeight ) + 1; //--> Ejercicio !!    

    // 4. Construir el rayo, detectar la interseccion y actuar
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(new THREE.Vector2(x,y), cam);

    const soldado = scene.getObjectByName('soldado');
    const robot = scene.getObjectByName('robota');
    let intersecciones = rayo.intersectObjects(soldado.children,true);

    if( intersecciones.length > 0 ){
        new TWEEN.Tween( soldado.position ).
        to( {x:[0,0],y:[3,1],z:[0,0]}, 2000 ).
        interpolation( TWEEN.Interpolation.Bezier ).
        easing( TWEEN.Easing.Bounce.Out ).
        start();
    }

    intersecciones = rayo.intersectObjects(robot.children,true);

    if( intersecciones.length > 0 ){
        new TWEEN.Tween( robot.rotation ).
        to( {x:[0,0],y:[Math.PI,-Math.PI/2],z:[0,0]}, 5000 ).
        interpolation( TWEEN.Interpolation.Linear ).
        easing( TWEEN.Easing.Exponential.InOut ).
        start();
    }
}

function update()
{
	// Lectura de controles en GUI (mejor hacerlo como callback)
	esferaCubo.rotation.y = effectController.giroY * Math.PI/180;

    TWEEN.update();
}

function render()
{
    requestAnimationFrame(render);
    update();

    // Limpieza del canvas una vez por frame
    renderer.clear();

    // El S.R. del viewport es left-bottom con X right y Y up
    renderer.setViewport(0,window.innerHeight/2, window.innerWidth/2,window.innerHeight/2);
    renderer.render(scene,alzado);

    renderer.setViewport(0,0, window.innerWidth/2,window.innerHeight/2);
    renderer.render(scene,planta);

    renderer.setViewport(window.innerWidth/2,window.innerHeight/2, window.innerWidth/2,window.innerHeight/2);
    renderer.render(scene,perfil);

    renderer.setViewport(window.innerWidth/2,0,window.innerWidth/2,window.innerHeight/2);
    renderer.render(scene,camera);
}