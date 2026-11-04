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

const botonesColores = document.querySelectorAll(".color-opcion");
const herramientaForma = document.getElementById("herramientaForma");

/* =====================================
   VARIABLES
===================================== */

let dibujando = false;

let herramientaActual = "lapiz";
let formaActual = "";

let colorActual = "#000000";
let grosorActual = 4;

let ultimoPunto = null;
let puntoInicial = null;
let imagenOriginal = null;

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
   SELECCIONAR LÁPIZ
===================================== */

btnLapiz.addEventListener("click", function() {

    herramientaActual = "lapiz";
    formaActual = "";

    herramientaForma.value = "";

    btnLapiz.classList.add("activa");
    btnBorrador.classList.remove("activa");

    canvas.style.cursor = "crosshair";

});

/* =====================================
   SELECCIONAR BORRADOR
===================================== */

btnBorrador.addEventListener("click", function() {

    herramientaActual = "borrador";
    formaActual = "";

    herramientaForma.value = "";

    btnBorrador.classList.add("activa");
    btnLapiz.classList.remove("activa");

    canvas.style.cursor = "cell";

});

/* =====================================
   SELECCIONAR FORMAS
===================================== */

herramientaForma.addEventListener("change", function() {

    formaActual = herramientaForma.value;

    if (formaActual === "") {
        herramientaActual = "lapiz";

        btnLapiz.classList.add("activa");
        btnBorrador.classList.remove("activa");

        canvas.style.cursor = "crosshair";
        return;
    }

    herramientaActual = "forma";

    btnLapiz.classList.remove("activa");
    btnBorrador.classList.remove("activa");

    canvas.style.cursor = "crosshair";

});

/* =====================================
   SELECCIONAR COLOR
===================================== */

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

/* =====================================
   COLOR PERSONALIZADO
===================================== */

colorLapiz.addEventListener("input", function() {

    colorActual = colorLapiz.value;

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
   DIBUJAR FORMAS GEOMÉTRICAS
===================================== */

function dibujarForma(inicio, fin) {

    const x = inicio.x;
    const y = inicio.y;

    const ancho = fin.x - x;
    const alto = fin.y - y;

    const centroX = x + ancho / 2;
    const centroY = y + alto / 2;

    ctx.beginPath();

    ctx.strokeStyle = colorActual;
    ctx.lineWidth = grosorActual;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (formaActual) {

        // RECTÁNGULO
        case "rectangulo":

            ctx.rect(x, y, ancho, alto);
            break;

        // CÍRCULO
        case "circulo": {

            const radio = Math.max(
                Math.abs(ancho),
                Math.abs(alto)
            ) / 2;

            ctx.arc(
                centroX,
                centroY,
                radio,
                0,
                Math.PI * 2
            );

            break;
        }

        // LÍNEA RECTA
        case "linea":

            ctx.moveTo(x, y);
            ctx.lineTo(fin.x, fin.y);
            break;

        // TRIÁNGULO
        case "triangulo":

            ctx.moveTo(centroX, y);
            ctx.lineTo(x, fin.y);
            ctx.lineTo(fin.x, fin.y);
            ctx.closePath();

            break;

        // FLECHA
        case "flecha": {

            const angulo = Math.atan2(alto, ancho);
            const longitudPunta = 15 + grosorActual;

            ctx.moveTo(x, y);
            ctx.lineTo(fin.x, fin.y);

            ctx.moveTo(
                fin.x - longitudPunta * Math.cos(angulo - Math.PI / 6),
                fin.y - longitudPunta * Math.sin(angulo - Math.PI / 6)
            );

            ctx.lineTo(fin.x, fin.y);

            ctx.lineTo(
                fin.x - longitudPunta * Math.cos(angulo + Math.PI / 6),
                fin.y - longitudPunta * Math.sin(angulo + Math.PI / 6)
            );

            break;
        }

    }

    ctx.stroke();

}

/* =====================================
   INICIAR DIBUJO
===================================== */

canvas.addEventListener("pointerdown", function(evento) {

    dibujando = true;

    canvas.setPointerCapture(evento.pointerId);

    ultimoPunto = obtenerPosicion(evento);
    puntoInicial = obtenerPosicion(evento);

    // Guardar el estado anterior para previsualizar formas
    if (herramientaActual === "forma") {

        imagenOriginal = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

        return;
    }

    // Dibujar un punto si solamente se hace clic
    if (herramientaActual === "lapiz") {

        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = colorActual;

        ctx.beginPath();

        ctx.arc(
            ultimoPunto.x,
            ultimoPunto.y,
            grosorActual / 2,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }

});

/* =====================================
   MOVIMIENTO DEL PUNTERO
===================================== */

canvas.addEventListener("pointermove", function(evento) {

    if (!dibujando) return;

    const nuevoPunto = obtenerPosicion(evento);

    // DIBUJAR FIGURAS
    if (herramientaActual === "forma") {

        if (!imagenOriginal) return;

        ctx.putImageData(imagenOriginal, 0, 0);

        dibujarForma(puntoInicial, nuevoPunto);

        return;
    }

    // LÁPIZ Y BORRADOR
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

function finalizarDibujo(evento) {

    if (!dibujando) return;

    if (herramientaActual === "forma" && imagenOriginal) {

        const posicionFinal = obtenerPosicion(evento);

        ctx.putImageData(imagenOriginal, 0, 0);

        dibujarForma(puntoInicial, posicionFinal);

    }

    dibujando = false;

    ultimoPunto = null;
    puntoInicial = null;
    imagenOriginal = null;

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

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

});