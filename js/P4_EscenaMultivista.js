/**
 * EscenaMultivista.js
 * 
 * Practica AGM #4. Escena basica multivista y picking
 * Se trata de añadir dos vistas a la escena y un sistema de picking
 * 
 * @author 
 * 
 */

// Modulos necesarios
/*******************
 * TO DO: Cargar los modulos necesarios
 *******************/

// Variables de consenso
let renderer, scene, camera;

// Otras globales
/*******************
 * TO DO: Variables globales de la aplicacion
 *******************/

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
    renderer.autoClear = false;
    /*******************
    * TO DO: Completar el motor de render, el canvas y habilitar
    * el buffer de sombras.
    *******************/

    // Escena
    scene = new THREE.Scene();
    
    // Camara
    /*******************
     * TO DO: Crear dos camaras una ortografica y otra perspectiva
     * a elegir. La camara perspectiva debe manejarse con OrbitControls
     * mientras que la ortografica debe ser fija
     *******************/

    // Luces
    /*******************
     * TO DO: Añadir luces y habilitar sombras
     * - Una ambiental
     * - Una direccional
     * - Una focal
     *******************/

    // Eventos
    /*******************
     * TO DO: Añadir manejadores de eventos
     * - Cambio de tamaño de la ventana
     * - Doble click sobre un objeto (animate)
     *******************/
}

function loadScene()
{
    // Texturas
    /*******************
     * TO DO: Cargar texturas
     * - De superposición
     * - De entorno
     *******************/

    // Materiales
    /*******************
     * TO DO: Crear materiales y aplicar texturas
     * - Uno basado en Lambert
     * - Uno basado en Phong
     * - Uno basado en Basic
     *******************/

    /*******************
    * TO DO: Misma escena que en la practica anterior
    * cambiando los materiales y activando las sombras
    *******************/

    /******************
     * TO DO: Crear una habitacion de entorno
     ******************/

    /******************
     * TO DO: Asociar una textura de vídeo al suelo
     ******************/

}

function loadGUI()
{
    // Interfaz de usuario
    /*******************
    * TO DO: Crear la interfaz de usuario con la libreria lil-gui.js
    * - Funcion de disparo de animaciones. Las animaciones deben ir
    *   encadenadas
    * - Slider de control de radio del pentagono
    * - Checkbox para alambrico/solido
    * - Checkbox de sombras
    * - Selector de color para cambio de algun material
    * - Boton de play/pause y checkbox de mute
    *******************/
}

function updateAspectRatio()
{
    // Renueva la relación de aspecto de la camara
    /*******************
    * TO DO: Actualizar relacion de aspecto de ambas camaras
    *******************/
}

function animate()
{
    /*******************
    * TO DO: Animar el objeto seleccionado con dobleclick
    * en cualquier vista
    *******************/
}

function update(delta)
{
    /*******************
    * TO DO: Actualizar tween
    *******************/
}

function render(delta)
{
    requestAnimationFrame( render );
    update(delta);
    /*******************
     * TO DO: Renderizar ambas vistas
     * - La perspectiva debe ocupar toda la ventana
     * - La ortografica debe ser cuadrada y ocupar un octavo de la ventana
     *   en la parte superior izquierda
     *******************/
}