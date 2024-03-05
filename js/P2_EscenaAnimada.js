/**
 * EscenaAnimada.js
 * 
 * Practica AGM #2. Escena basica con interfaz y animacion
 * Se trata de añadir un interfaz de usuario que permita 
 * disparar animaciones sobre los objetos de la escena con Tween
 * 
 * @author <bpucsal@inf.upv.es>, 2024
 * 
 */

// Modulos necesarios
import * as THREE from "../lib/three.module.js";
import {GLTFLoader} from "../lib/GLTFLoader.module.js";
import {OrbitControls} from "../lib/OrbitControls.module.js";
import {TWEEN} from "../lib/tween.module.min.js";
import {GUI} from "../lib/lil-gui.module.min.js";

// Variables de consenso
let renderer, scene, camera;

// Otras globales
let cameraControls, effectController, escena, torus;

// Acciones
init();
loadScene();
loadGUI();
render();

function init()
{
    // Motor de render
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.getElementById('container').appendChild( renderer.domElement );

    // Escena
    scene = new THREE.Scene();
    
    // Camara
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1,1000);
    camera.position.set( 28, 22, 24);
    cameraControls = new OrbitControls( camera, renderer.domElement );
    cameraControls.target.set(0,1,0);
    camera.lookAt( new THREE.Vector3(0,1,0) );
}

function loadScene()
{
    // Cargar escena
    const loader = new GLTFLoader();
    loader.load( '../models/scene.gltf', function ( gltf ) {
        escena = gltf.scene;
        escena.position.set(0,0,0);
        scene.add( escena );
        // Seleccionar el objeto llamado "Torus" y guardarlo en una variable global
        torus = scene.getObjectByName('Torus');
    } );

}

function loadGUI()
{
    // Definicion de los controles
	effectController = {
        altura: 7.0,
        velocidad: 0.001,
        rango: 2.0,
	};

	// Creacion interfaz
	const gui = new GUI();

	// Construccion del menu
	const h = gui.addFolder("Control Torus");
    h.add(effectController, "altura", 0.0, 10.0, 0.1).name("Altura");
    h.add(effectController, "velocidad", 0.0, 0.01, 0.0001).name("Velocidad");
    h.add(effectController, "rango", 0.0, 10.0, 0.1).name("Rango");
}

function update()
{
    // Hacer que el torus suba y baje, como si flotase suavemente en un bucle infinito
    if (torus)
    torus.position.y = effectController.altura + Math.sin( Date.now() * effectController.velocidad ) * effectController.rango;
    TWEEN.update();
}

function render()
{
    requestAnimationFrame( render );
    update();
    renderer.render( scene, camera );
}