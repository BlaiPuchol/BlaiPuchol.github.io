/**
 * Escena.js
 * 
 * Practica AGM #1. Escena basica en three.js
 * Seis objetos organizados en un grafo de escena con
 * transformaciones, animacion basica y modelos importados
 * 
 * @author <bpucsal@inf.upv.es>, 2024
 * 
 */

// Modulos necesarios
import * as THREE from "../lib/three.module.js";
import {GLTFLoader} from "../lib/GLTFLoader.module.js";

// Variables de consenso
let renderer, scene, camera;

// Otras globales
let escena;

// Acciones
init();
loadScene();
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
    camera.position.set( 0.5, 2, 7 );
    camera.lookAt( new THREE.Vector3(0,1,0) );
}

// Escena en la que se represente un paisaje de bosque con elementos como arboles, montañas y un lago
function loadScene()
{
    // Cargar escena
    const loader = new GLTFLoader();
    loader.load( '../models/escena.gltf', function ( gltf ) {
        escena = gltf.scene;
        escena.position.set(0,0,0);
        scene.add( escena );
    } );
}

function update()
{
    
}

function render()
{
    requestAnimationFrame( render );
    update();
    renderer.render( scene, camera );
}