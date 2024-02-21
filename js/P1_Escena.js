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
let arboles, montañas, lago;

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
    // Arboles
    const arbol = new THREE.Mesh( new THREE.CylinderGeometry(0.1,0.1,1,6), new THREE.MeshBasicMaterial({color:'green'}) );
    arbol.position.set(0,0.5,0);
    arboles = new THREE.Object3D();
    arboles.add(arbol);
    arboles.position.set(-2,0,0);
    scene.add(arboles);

    // Montañas
    const montaña = new THREE.Mesh( new THREE.ConeGeometry(0.5,1,4), new THREE.MeshBasicMaterial({color:'grey'}) );
    montaña.position.set(0,0.5,0);
    montañas = new THREE.Object3D();
    montañas.add(montaña);
    montañas.position.set(2,0,0);
    scene.add(montañas);

    // Lago
    const lago = new THREE.Mesh( new THREE.CylinderGeometry(1,1,0.1,20), new THREE.MeshBasicMaterial({color:'blue'}) );
    lago.position.set(0,0,0);
    scene.add(lago);
}

function update()
{
    angulo += 0.01;
    esferaCubo.rotation.y = angulo;
}

function render()
{
    requestAnimationFrame( render );
    update();
    renderer.render( scene, camera );
}