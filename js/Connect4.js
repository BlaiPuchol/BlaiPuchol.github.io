/**
 * Connect4.js
 * 
 * Juego de Conecta 4 en 3D
 * 
 * 
 * @author <bpucsal@inf.upv.es>, 2024
 * 
 */

// Modulos necesarios
import * as THREE from "../lib/three.module.js";
import {GLTFLoader} from "../lib/GLTFLoader.module.js";
import {OrbitControls} from "../lib/OrbitControls.module.js";
import {TWEEN} from "../lib/tween.module.min.js";

// Variables de consenso
let renderer, scene, camera;

// Otras globales
let cameraControls, escena, tablero, turno, columnas, container, luzAmbiente, luzPuntual1, luzPuntual2, C1, C2, COLUMNAS, FILAS, TEXT;

// Definición de constantes
C1 = 0x1A7329;
C2 = 0x731A1A;
COLUMNAS = 7;
FILAS = 6;
TEXT = 'You\'re under suspicion for a crime, but the inspector lacks proof. Beat him in "Connect Four," his favorite game, and you might walk free...';

// Definir variables para el juego
let fichasEnJuego = new Array(COLUMNAS);
for (let i = 0; i < COLUMNAS; i++) {
    fichasEnJuego[i] = new Array(FILAS);
}

let fichas = new Array(COLUMNAS);
for (let i = 0; i < COLUMNAS; i++) {
    fichas[i] = new Array(FILAS);
}

// Definir variables para la animación
let animacion = false;
let animacionTerminada = true;
let firstTime = true;
let onePlayer = false;

// Funciones del juego
function initJuego() { 
    // Inicializar el tablero
    for (let i = 0; i < COLUMNAS; i++) {
        for (let j = 0; j < FILAS; j++) {
            fichasEnJuego[i][j] = 0;
        }
    }
    // Crear las columnas
    crearColumnas();
    turno = true;
    console.log("Juego iniciado");
    console.log(fichasEnJuego);
    // Difuminar main div and info div
    let main = document.getElementById("main");
    let info = document.getElementById("info");
    let speed = 1000;
    var seconds = speed/1000;
    main.style.transition = "opacity "+seconds+"s ease";
    main.style.opacity = 0;
    info.style.transition = "opacity "+seconds+"s ease";
    info.style.opacity = 0;
    setTimeout(function() {
        main.style.display = "none";
        info.style.display = "none";
    }, speed);
    
    // Difuminar win div and gameover div
    let win = document.getElementById("win");
    let lose = document.getElementById("gameover");
    win.style.transition = "opacity 1s ease";
    win.style.opacity = 0;
    win.style.display = "none";
    lose.style.transition = "opacity 1s ease";
    lose.style.opacity = 0;
    lose.style.display = "none";
    let initialText = document.getElementById("initialText");
    initialText.style.display = "block";
    initialText.style.opacity = 1;
    initialText.innerHTML = "";
    // Escribir el texto inicial
    let i = 0;
    function typeWriter() {
        if (i < TEXT.length) {
            initialText.innerHTML += TEXT.charAt(i);
            i++;
            if (firstTime) {
                setTimeout(typeWriter, Math.floor(Math.random() * 50) + 20); // Adjust speed here
            }
            else {
                setTimeout(typeWriter, 20);
            }
        }
        else {
            setTimeout(fadeOutText, 5000); 
        }
    }
    function fadeOutText() {
        let initialText = document.getElementById("initialText");
        initialText.style.transition = "opacity 1s ease";
        initialText.style.opacity = 0;
        setTimeout(function() {
            initialText.style.display = "none";
            let turn = document.getElementById("turn");
            turn.innerHTML = "Your turn";
            turn.style.transition = "opacity 1s ease";
            turn.style.opacity = 1;
            // Acercar la cámara con animación
            new TWEEN.Tween( camera.position ).to( {x: 0, y: 120, z: -80}, 1000 ).easing( TWEEN.Easing.Quadratic.Out ).start().onComplete(function() {
                cameraControls.update();
            });
            // Subir intensidad de la luz puntual
            new TWEEN.Tween( luzPuntual1 ).to( {intensity: 0.5}, 1000 ).easing( TWEEN.Easing.Quadratic.Out ).start();
            new TWEEN.Tween( luzPuntual2 ).to( {intensity: 0.5}, 1000 ).easing( TWEEN.Easing.Quadratic.Out ).start();
        }, 1000);
    }
    typeWriter();

}

function crearColumnas() {
    if (tablero === undefined) {
        return;
    }
    columnas = new Array(COLUMNAS);
    container = new THREE.Box3().setFromObject(tablero);
    let margin = (container.max.x - container.min.x) * 0.05;
    let x = container.max.x - container.min.x - margin * 2;
    let y = container.max.y - container.min.y;
    let z = container.max.z - container.min.z;
    for (let i = 0; i < COLUMNAS; i++) {
        columnas[i] = new THREE.Mesh(new THREE.BoxGeometry(x/COLUMNAS, y, z), new THREE.MeshBasicMaterial({transparent: true, opacity: 0.0, color: 0x000000, side: THREE.DoubleSide}));
        if (i === 0) {
            columnas[i].position.set(container.min.x + margin + x/COLUMNAS/2, container.min.y + y/2, container.min.z + z/2);
        } else {
            columnas[i].position.set(columnas[i-1].position.x + x/COLUMNAS, container.min.y + y/2, container.min.z + z/2);
        }
        columnas[i].name = "columna" + i;
        scene.add(columnas[i]);
    }
}


// Acciones
init();
loadScene();
render();

function init()
{
    // Motor de render
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.getElementById('container').appendChild( renderer.domElement );

    // Escena
    scene = new THREE.Scene();
    const posicionTablero = new THREE.Vector3(0, 90, 0);
    
    // Camara
    camera = new THREE.PerspectiveCamera( 50, window.innerWidth/window.innerHeight, 0.01,1000);
    camera.position.set( 0, 160, -180);
    cameraControls = new OrbitControls( camera, renderer.domElement );
    cameraControls.enablePan = false; // Disable pan
    cameraControls.target.copy(posicionTablero);
    camera.lookAt(posicionTablero);

    // Limit the camera distance from the target and min Y
    const maxDistance = 180; // Maximum distance from the target
    const minY = 85; // Minimum Y
    cameraControls.addEventListener('change', () => {
        const distance = camera.position.distanceTo(posicionTablero);
        if (distance > maxDistance) {
            const direction = new THREE.Vector3().subVectors(camera.position, posicionTablero).normalize();
            camera.position.copy(posicionTablero).addScaledVector(direction, maxDistance);
            cameraControls.update();
        }
        if (camera.position.y < minY) {
            camera.position.y = minY;
            cameraControls.update();
        }
    });

    // Luces
    luzAmbiente = new THREE.AmbientLight( 0xffffff, 0.3 );
    luzAmbiente.position.set( 0, 100, 0 );
    scene.add( luzAmbiente );
    luzPuntual1 = new THREE.PointLight( 0xffffff, 0.3 );
    luzPuntual1.position.set( 0, 271, -88);
    luzPuntual1.castShadow = true;
    scene.add( luzPuntual1 );
    luzPuntual2 = new THREE.PointLight( 0xffffff, 0.3 );
    luzPuntual2.position.set( 0, 271, 96);
    luzPuntual2.castShadow = true;
    scene.add( luzPuntual2 );
    
    // Habilitar sombras
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Eventos
    window.addEventListener('resize', updateAspectRatio );
    renderer.domElement.addEventListener('dblclick', animate );

    // Boton de inicio
    const startButton = document.getElementById('oneplayer');
    startButton.addEventListener('click', function() {
        onePlayer = true;
        initJuego();
    });
    const startButton2 = document.getElementById('twoplayers');
    startButton2.addEventListener('click', function() {
        onePlayer = false;
        initJuego();
    });
    
}

function loadScene()
{
    // Cargar escena
    const loader = new GLTFLoader();
    //Cargar habitación
    loader.load( './models/interrogation_room.gltf', function ( gltf ) {
        escena = gltf.scene;
        escena.position.set(0,0,0);
        escena.receiveShadow = true;
        scene.add( escena );
        loader.load( './models/tablero.gltf', function ( gltf ) {
            escena = gltf.scene;
            escena.position.set(0,81.183,0);
            escena.scale.set(4,4,4);
            scene.add( escena );
            // Seleccionar el objeto llamado "Board" y guardarlo en una variable global
            tablero = scene.getObjectByName('Board');
            tablero.castShadow = true;
            // Añadir botin de inicio
            const startButton = document.getElementById('oneplayer');
            startButton.style.display = "initial";
            const startButton2 = document.getElementById('twoplayers');
            startButton2.style.display = "initial";
        });
    });

}

function updateAspectRatio()
{
    const ar = window.innerWidth/window.innerHeight;
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect = ar;
    camera.updateProjectionMatrix();
}

function animate(event)
{
    // Capturar y normalizar
    let x= event.clientX;
    let y = event.clientY;
    x = ( x / window.innerWidth ) * 2 - 1;
    y = -( y / window.innerHeight ) * 2 + 1;

    // Construir el rayo y detectar la interseccion
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(new THREE.Vector2(x,y), camera);
    let intersecciones = rayo.intersectObjects(columnas);
    if( intersecciones.length > 0 ){
        let columna = parseInt(intersecciones[0].object.name.substring(7));
        console.log("Columna: " + columna);
        if (animacionTerminada) {
            animacionTerminada = false;
            animarFicha(columna);
        }
    }
}

function animarFicha(columna) {
    // Animacion que crea una ficha con física y la hace caer en la columna seleccionada y elija el color según el turno
    // Fichas en la columna
    let i = 0;
    while (i < FILAS && fichasEnJuego[columna][i] !== 0) {
        i++;
    }
    if (i === FILAS) {
        animacionTerminada = true;
        return;
    }
    let j = columna;
    let color = turno ? C1 : C2;
    let radio = columnas[0].geometry.parameters.width/2 * 0.8;
    let grosor = (container.max.z - container.min.z) * 0.3;
    let ficha = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, grosor, 32), new THREE.MeshBasicMaterial({color: color}));
    ficha.position.set(columnas[j].position.x, 130, columnas[j].position.z);
    ficha.rotateX(Math.PI/2);
    ficha.castShadow = true;
    ficha.receiveShadow = true;
    scene.add(ficha);
    console.log("Ficha: " + i + ", " + j);
    let altura = (container.max.y - container.min.y);
    let destino = container.min.y + i * altura/FILAS * 0.975 + radio * 1.5;
    let duracion = 1000;
    new TWEEN.Tween( ficha.position ).
    to( {y: destino}, duracion ).
    easing( TWEEN.Easing.Quadratic.Out ).
    start().
    onComplete(function() {
        // Marcar la ficha en el tablero
        fichasEnJuego[j][i] = turno ? 1 : 2;
        console.log(fichasEnJuego);
        fichas[j][i] = ficha;
        let jugador = true;
        // Comprobar si hay 4 en raya
        if (comprobar4enRaya(j, i)) {
            console.log("4 en raya");
            gameOver();
        } else {
        // Cambiar el turno
            turno = !turno;
            let turn = document.getElementById("turn");
            turn.innerHTML = turno ? "Your turn" : "Inspector's turn";
            // Tiro aleatorio del inspector
            if (!turno && onePlayer) {
                let found = false;
                while (!found) {
                    let columna = Math.floor(Math.random() * COLUMNAS);
                    let z = 0;
                    while (z < FILAS && fichasEnJuego[columna][z] !== 0) {
                        z++;
                    }
                    if (z < FILAS) {
                        found = true;
                        jugador = false;
                        setTimeout(function() {
                            animarFicha(columna);
                        }, 1000);
                    }
                }
            }
        }
        if (jugador) {
            animacionTerminada = true;
        }
    });
}

function comprobar4enRaya(j, i) {
    let jugador = turno ? 1 : 2;
    let contador = 1;
    // Comprobar horizontal
    for (let k = j - 1; k >= 0 && fichasEnJuego[k][i] === jugador; k--) {
        contador++;
    }
    for (let k = j + 1; k < COLUMNAS && fichasEnJuego[k][i] === jugador; k++) {
        contador++;
    }
    if (contador >= 4) {
        return true;
    }
    // Comprobar vertical
    contador = 1;
    for (let k = i - 1; k >= 0 && fichasEnJuego[j][k] === jugador; k--) {
        contador++;
    }
    for (let k = i + 1; k < FILAS && fichasEnJuego[j][k] === jugador; k++) {
        contador++;
    }
    if (contador >= 4) {
        return true;
    }
    // Comprobar diagonal
    contador = 1;
    for (let k = 1; j - k >= 0 && i - k >= 0 && fichasEnJuego[j - k][i - k] === jugador; k++) {
        contador++;
    }
    for (let k = 1; j + k < COLUMNAS && i + k < FILAS && fichasEnJuego[j + k][i + k] === jugador; k++) {
        contador++;
    }
    if (contador >= 4) {
        return true;
    }
    // Comprobar diagonal
    contador = 1;
    for (let k = 1; j - k >= 0 && i + k < FILAS && fichasEnJuego[j - k][i + k] === jugador; k++) {
        contador++;
    }
    for (let k = 1; j + k < COLUMNAS && i - k >= 0 && fichasEnJuego[j + k][i - k] === jugador; k++) {
        contador++;
    }
    if (contador >= 4) {
        return true;
    }
    // Comprobar empate
    contador = 0;
    for (let k = 0; k < COLUMNAS; k++) {
        if (fichasEnJuego[k][FILAS - 1] !== 0) {
            contador++;
        }
    }
    if (contador === COLUMNAS) {
        gameOver(true);

    }
    return false;
}

function gameOver(empate = false) {
    let turn = document.getElementById("turn");
    turn.style.opacity = 0;
    if (empate) {
        console.log("Empate");
        let lose = document.getElementById("gameover");
        lose.style.transition = "opacity 1s ease";
        lose.style.opacity = 1;
        lose.style.display = "block";
        // Boton de reinicio
        const restartButton = document.getElementById('retry');
        restartButton.addEventListener('click', initJuego);
        firstTime = false;
    } else {
        if (turno) {
            console.log("Has ganado");
            let win = document.getElementById("win");
            win.style.transition = "opacity 1s ease";
            win.style.opacity = 1;
            win.style.display = "block";
            // Boton de reinicio
            const restartButton = document.getElementById('playagain');
            restartButton.addEventListener('click', initJuego);
            firstTime = false;
        } else {
            console.log("Has perdido");
            let lose = document.getElementById("gameover");
            lose.style.transition = "opacity 1s ease";
            lose.style.opacity = 1;
            lose.style.display = "block";
            // Boton de reinicio
            const restartButton = document.getElementById('retry');
            restartButton.addEventListener('click', initJuego);
            firstTime = false;
        }
    }
    // Borrar las fichas
    for (let i = 0; i < COLUMNAS; i++) {
        for (let j = 0; j < FILAS; j++) {
            if (fichas[i][j] !== undefined) {
                scene.remove(fichas[i][j]);
            }
        }
    }
    // Borrar las columnas
    for (let i = 0; i < COLUMNAS; i++) {
        scene.remove(columnas[i]);
    }
}


function update()
{
    TWEEN.update();
}

function render()
{
    requestAnimationFrame( render );
    update();
    renderer.render( scene, camera );
}