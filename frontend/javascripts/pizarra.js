
/* =====================================
   ELEMENTOS HTML
===================================== */

const canvas = document.getElementById("pizarraCanvas");
const ctx = canvas.getContext("2d");

const btnLapiz = document.getElementById("btnLapiz");
const btnBorrador = document.getElementById("btnBorrador");
const btnLimpiar = document.getElementById("btnLimpiar");

const colorLapiz = document.getElementById("colorLapiz");
const grosorLapiz = document.getElementById("grosorLapiz");
const valorGrosor = document.getElementById("valorGrosor");

/* =====================================
   VARIABLES
===================================== */

let dibujando = false;

let herramientaActual = "lapiz";

let colorActual = "#000000";

let grosorActual = 4;

let ultimoPunto = null;

/* =====================================
   CONFIGURAR CANVAS
===================================== */

function configurarCanvas() {

    const rect = canvas.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

}

configurarCanvas();

/* =====================================
   OBTENER POSICIÓN DEL PUNTERO
===================================== */

function obtenerPosicion(evento) {

    const rect = canvas.getBoundingClientRect();

    return {
        x: evento.clientX - rect.left,
        y: evento.clientY - rect.top
    };

}

/* =====================================
   SELECCIONAR HERRAMIENTA
===================================== */

btnLapiz.addEventListener("click", function() {

    herramientaActual = "lapiz";

    btnLapiz.classList.add("activa");
    btnBorrador.classList.remove("activa");

    canvas.style.cursor = "crosshair";

});

btnBorrador.addEventListener("click", function() {

    herramientaActual = "borrador";

    btnBorrador.classList.add("activa");
    btnLapiz.classList.remove("activa");

    canvas.style.cursor = "cell";

});

/* =====================================
   SELECCIONAR COLORES PREDETERMINADOS
===================================== */

const botonesColores = document.querySelectorAll(".color-opcion");

botonesColores.forEach(boton => {

    boton.addEventListener("click", function() {

        // Obtener el color seleccionado
        colorActual = boton.dataset.color;

        // Actualizar el selector personalizado
        colorLapiz.value = colorActual;

        // Actualizar la selección visual
        botonesColores.forEach(elemento => {
            elemento.classList.remove("seleccionado");
        });

        boton.classList.add("seleccionado");

    });

});

/* =====================================
   SELECCIONAR COLOR PERSONALIZADO
===================================== */

colorLapiz.addEventListener("input", function() {

    colorActual = colorLapiz.value;

    // Quitar selección de colores predeterminados
    botonesColores.forEach(boton => {
        boton.classList.remove("seleccionado");
    });

});

/* =====================================
   CAMBIAR GROSOR
===================================== */

grosorLapiz.addEventListener("input", function() {

    grosorActual = Number(grosorLapiz.value);

    valorGrosor.textContent = grosorActual + " px";

});

/* =====================================
   INICIAR DIBUJO
===================================== */

canvas.addEventListener("pointerdown", function(evento) {

    dibujando = true;

    canvas.setPointerCapture(evento.pointerId);

    ultimoPunto = obtenerPosicion(evento);

    ctx.beginPath();

    ctx.moveTo(ultimoPunto.x, ultimoPunto.y);

});

/* =====================================
   DIBUJAR
===================================== */

canvas.addEventListener("pointermove", function(evento) {

    if (!dibujando) return;

    const nuevoPunto = obtenerPosicion(evento);

    ctx.beginPath();

    ctx.moveTo(ultimoPunto.x, ultimoPunto.y);

    ctx.lineTo(nuevoPunto.x, nuevoPunto.y);

    ctx.lineWidth = herramientaActual === "borrador"
        ? grosorActual * 3
        : grosorActual;

    if (herramientaActual === "lapiz") {

        ctx.globalCompositeOperation = "source-over";

        ctx.strokeStyle = colorActual;

    } else {

        ctx.globalCompositeOperation = "destination-out";

    }

    ctx.stroke();

    ultimoPunto = nuevoPunto;

});

/* =====================================
   FINALIZAR DIBUJO
===================================== */

function finalizarDibujo() {

    dibujando = false;

    ultimoPunto = null;

    ctx.globalCompositeOperation = "source-over";

}

canvas.addEventListener("pointerup", finalizarDibujo);

canvas.addEventListener("pointercancel", finalizarDibujo);

/* =====================================
   LIMPIAR PIZARRA
===================================== */

btnLimpiar.addEventListener("click", function() {

    const confirmar = confirm(
        "¿Deseas eliminar todo el contenido de la pizarra?"
    );

    if (!confirmar) return;

    const rect = canvas.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(
        0,
        0,
        rect.width,
        rect.height
    );

    ctx.globalCompositeOperation = "source-over";

});