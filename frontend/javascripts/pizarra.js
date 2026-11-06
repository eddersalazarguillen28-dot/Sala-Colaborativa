/* ==================================================
   1. ELEMENTOS HTML
================================================== */

const canvas = document.getElementById("pizarraCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const btnLapiz = document.getElementById("btnLapiz");
const btnBorrador = document.getElementById("btnBorrador");
const btnLimpiar = document.getElementById("btnLimpiar");

const colorLapiz = document.getElementById("colorLapiz");
const botonesColores = document.querySelectorAll(".color-opcion");

const grosorLapiz = document.getElementById("grosorLapiz");
const valorGrosor = document.getElementById("valorGrosor");

const herramientaForma = document.getElementById("herramientaForma");
const tipoPincel = document.getElementById("tipoPincel");
const tipoSeleccion = document.getElementById("tipoSeleccion");

const btnRecortar = document.getElementById("btnRecortar");
const btnRellenar = document.getElementById("btnRellenar");
const btnTexto = document.getElementById("btnTexto");
const btnRedimensionar = document.getElementById("btnRedimensionar");

const tipoGiro = document.getElementById("tipoGiro");

const btnDeshacer = document.getElementById("btnDeshacer");
const btnRehacer = document.getElementById("btnRehacer");

const btnZoomMas = document.getElementById("btnZoomMas");
const btnZoomMenos = document.getElementById("btnZoomMenos");
const btnZoomReset = document.getElementById("btnZoomReset");
const valorZoom = document.getElementById("valorZoom");

const contenedorCanvas = document.querySelector(".contenedor-canvas");


/* ==================================================
   2. CONEXIÓN SOCKET.IO (Backend de Christopher)
================================================== */

const socket = io("http://localhost:3000");
window.socket = socket; // <--- Esto permite que chat.js y videollamada.js compartan la misma conexión

const salaPizarra = document.getElementById("nombreSalaActual")?.textContent || "sala-prueba";
const usuarioPizarra = document.getElementById("usuarioActual")?.textContent || "Christopher";

socket.emit("unirse-sala", { 
    nombreSala: salaPizarra, 
    nombreUsuario: usuarioPizarra 
});

socket.on("sala-unida", (datos) => {
    console.log("Te uniste a la sala:", datos.sala);
});

socket.on("lista-participantes", (participantes) => {
    console.log("Participantes en la sala:", participantes);
});


/* ==================================================
   3. VARIABLES DE CONFIGURACIÓN Y CANVAS
================================================== */

let herramientaActual = "lapiz";
let formaActual = "";
let pincelActual = "lapiz";

let colorActual = "#000000";
let grosorActual = 4;

let dibujando = false;
let ultimoPunto = null;
let puntoInicial = null;

let imagenOriginal = null;

let modoSeleccion = "";
let seleccion = null;
let puntosSeleccion = [];

let modoRelleno = false;
let modoTexto = false;

let zoomActual = 1;

let historial = [];
let indiceHistorial = -1;

const MAX_HISTORIAL = 30;

let anchoLogico = 0;
let altoLogico = 0;

const dpr = window.devicePixelRatio || 1;


/* ==================================================
   4. CONFIGURACIÓN DEL CANVAS
================================================== */

function configurarCanvas(ancho, alto) {
    anchoLogico = ancho;
    altoLogico = alto;

    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);

    canvas.style.width = ancho + "px";
    canvas.style.height = alto + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
}

const rectInicial = canvas.getBoundingClientRect();
configurarCanvas(
    Math.max(1, Math.round(rectInicial.width || 900)),
    Math.max(1, Math.round(rectInicial.height || 550))
);


/* ==================================================
   5. POSICIÓN DEL PUNTERO
================================================== */

function obtenerPosicion(evento) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (evento.clientX - rect.left) / zoomActual,
        y: (evento.clientY - rect.top) / zoomActual
    };
}


/* ==================================================
   6. COLORES Y GROSOR
================================================== */

botonesColores.forEach(boton => {
    boton.addEventListener("click", function() {
        colorActual = boton.dataset.color;
        colorLapiz.value = colorActual;
        botonesColores.forEach(elemento => {
            elemento.classList.remove("seleccionado");
        });
        boton.classList.add("seleccionado");
    });
});

colorLapiz.addEventListener("input", function() {
    colorActual = colorLapiz.value;
    botonesColores.forEach(boton => {
        boton.classList.remove("seleccionado");
    });
});

grosorLapiz.addEventListener("input", function() {
    grosorActual = Number(grosorLapiz.value);
    valorGrosor.textContent = grosorActual + " px";
});


/* ==================================================
   7. HISTORIAL (DESHACER Y REHACER)
================================================== */

function obtenerEstado() {
    return {
        imagen: ctx.getImageData(0, 0, canvas.width, canvas.height),
        ancho: anchoLogico,
        alto: altoLogico
    };
}

function guardarHistorial() {
    const estado = obtenerEstado();
    historial = historial.slice(0, indiceHistorial + 1);
    historial.push(estado);
    if (historial.length > MAX_HISTORIAL) {
        historial.shift();
    }
    indiceHistorial = historial.length - 1;
    actualizarHistorial();
}

function actualizarHistorial() {
    btnDeshacer.disabled = indiceHistorial <= 0;
    btnRehacer.disabled = indiceHistorial >= historial.length - 1;
}

function restaurarEstado(estado) {
    configurarCanvas(estado.ancho, estado.alto);
    ctx.putImageData(estado.imagen, 0, 0);
}

function deshacer() {
    if (indiceHistorial <= 0) return;
    indiceHistorial--;
    restaurarEstado(historial[indiceHistorial]);
    actualizarHistorial();
}

function rehacer() {
    if (indiceHistorial >= historial.length - 1) return;
    indiceHistorial++;
    restaurarEstado(historial[indiceHistorial]);
    actualizarHistorial();
}

btnDeshacer.addEventListener("click", deshacer);
btnRehacer.addEventListener("click", rehacer);


/* ==================================================
   8. SELECCIÓN DE HERRAMIENTAS
================================================== */

function activarHerramienta(nombre) {
    herramientaActual = nombre;
    btnLapiz.classList.toggle("activa", nombre === "lapiz");
    btnBorrador.classList.toggle("activa", nombre === "borrador");
    btnRellenar.classList.toggle("activa", nombre === "relleno");
    btnTexto.classList.toggle("activa", nombre === "texto");
    canvas.style.cursor = nombre === "borrador" ? "cell" : nombre === "texto" ? "text" : "crosshair";
}

btnLapiz.addEventListener("click", function() {
    formaActual = "";
    modoSeleccion = "";
    modoRelleno = false;
    modoTexto = false;
    herramientaForma.value = "";
    tipoSeleccion.value = "";
    activarHerramienta("lapiz");
});

btnBorrador.addEventListener("click", function() {
    formaActual = "";
    modoSeleccion = "";
    herramientaForma.value = "";
    tipoSeleccion.value = "";
    activarHerramienta("borrador");
});

tipoPincel.addEventListener("change", function() {
    pincelActual = tipoPincel.value;
    activarHerramienta("lapiz");
});

herramientaForma.addEventListener("change", function() {
    formaActual = herramientaForma.value;
    activarHerramienta(formaActual ? "forma" : "lapiz");
});


/* ==================================================
   9. PINCELES Y TRAZOS (INTEGRACIÓN SOCKET.IO)
================================================== */

function aplicarPincel(inicio, fin) {
    ctx.save();
    ctx.strokeStyle = colorActual;
    ctx.fillStyle = colorActual;
    ctx.lineWidth = grosorActual;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (pincelActual) {
        case "lapiz":
        case "pincel":
        case "acuarela":
        case "oleo":
        case "marcador":
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual);
            break;
    }
    ctx.restore();
}

function dibujarTrazoLocal(inicio, fin, color, grosor) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(inicio.x, inicio.y);
    ctx.lineTo(fin.x, fin.y);
    ctx.stroke();
    ctx.restore();
}

function borrarTrazoLocal(inicio, fin, grosor) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(inicio.x, inicio.y);
    ctx.lineTo(fin.x, fin.y);
    ctx.lineWidth = grosor * 3;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
}


/* ==================================================
   10. CONTROL DEL MOUSE Y ENVÍO DE DATOS AL SERVIDOR
================================================== */

canvas.addEventListener("pointerdown", function(evento) {
    if (evento.pointerType === "mouse" && evento.button !== 0) return;

    const punto = obtenerPosicion(evento);
    if (!punto) return;

    dibujando = true;
    canvas.setPointerCapture(evento.pointerId);

    puntoInicial = punto;
    ultimoPunto = punto;

    if (herramientaActual === "lapiz") {
        guardarHistorial();
        aplicarPincel(punto, punto);
    } else if (herramientaActual === "borrador") {
        guardarHistorial();
        borrarTrazoLocal(punto, punto, grosorActual);
    }
});

canvas.addEventListener("pointermove", function(evento) {
    if (!dibujando || !ultimoPunto) return;
    
    const punto = obtenerPosicion(evento);
    if (!punto) return;

    if (herramientaActual === "lapiz") {
        aplicarPincel(ultimoPunto, punto);

        // Emitir el trazo al servidor por WebSockets
        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: {
                x0: ultimoPunto.x,
                y0: ultimoPunto.y,
                x1: punto.x,
                y1: punto.y,
                color: colorActual,
                grosor: grosorActual
            }
        });
    }

    if (herramientaActual === "borrador") {
        borrarTrazoLocal(ultimoPunto, punto, grosorActual);
    }

    ultimoPunto = punto;
});

function finalizarDibujo(evento) {
    if (!dibujando) return;
    if (herramientaActual === "lapiz" || herramientaActual === "borrador") {
        guardarHistorial();
    }
    dibujando = false;
    ultimoPunto = null;
    puntoInicial = null;
}

canvas.addEventListener("pointerup", finalizarDibujo);
canvas.addEventListener("pointercancel", finalizarDibujo);


/* ==================================================
   11. ESCUCHAR EVENTOS DEL SERVIDOR (TIEMPO REAL)
================================================== */

// Recibir trazos de otros compañeros en la sala
socket.on("nuevo-trazo", (datos) => {
    const { x0, y0, x1, y1, color, grosor } = datos.trazo;
    dibujarTrazoLocal({ x: x0, y: y0 }, { x: x1, y: y1 }, color, grosor);
});

// Sincronizar el botón de limpiar pizarra
btnLimpiar.addEventListener("click", function() {
    const confirmar = confirm("¿Deseas eliminar todo el contenido de la pizarra?");
    if (!confirmar) return;

    // Avisar al servidor que limpie la sala
    socket.emit("limpiar-pizarra", salaPizarra);
});

// Recibir aviso de limpieza de la sala
socket.on("pizarra-limpiada", () => {
    guardarHistorial();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    guardarHistorial();
});


/* ==================================================
   12. INICIALIZACIÓN
================================================== */

guardarHistorial();
console.log("Pizarra interactiva sincronizada con Socket.io correctamente.");