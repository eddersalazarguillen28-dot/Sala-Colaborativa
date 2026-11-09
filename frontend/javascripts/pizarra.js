
"use strict";

/* ==================================================
   1. ELEMENTOS HTML
================================================== */

const canvas = document.getElementById("pizarraCanvas");

if (!canvas) {
    throw new Error("No se encontró el canvas #pizarraCanvas.");
}

const ctx = canvas.getContext("2d", {
    willReadFrequently: true
});

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

const controles = [
    btnLapiz, btnBorrador, btnLimpiar,
    colorLapiz, grosorLapiz, valorGrosor,
    herramientaForma, tipoPincel, tipoSeleccion,
    btnRecortar, btnRellenar, btnTexto,
    btnRedimensionar, tipoGiro,
    btnDeshacer, btnRehacer,
    btnZoomMas, btnZoomMenos, btnZoomReset,
    valorZoom, contenedorCanvas
];

if (controles.some(elemento => !elemento)) {
    console.error(
        "Faltan elementos HTML necesarios para algunas herramientas de la pizarra."
    );
}


/* ==================================================
   2. CONEXIÓN SOCKET.IO
================================================== */

const URL_SERVIDOR =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://sala-colaborativa.onrender.com";

const salaPizarra = sessionStorage.getItem("nombreSala");
const usuarioPizarra = sessionStorage.getItem("nombreUsuario");

if (!salaPizarra || !usuarioPizarra) {
    console.error("No se encontró el usuario o la sala.");
}

const socket = io(URL_SERVIDOR, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

window.socket = socket;

socket.on("connect", () => {
    console.log("Socket conectado:", socket.id);

    if (salaPizarra && usuarioPizarra) {
        socket.emit("unirse-sala", {
            nombreSala: salaPizarra,
            nombreUsuario: usuarioPizarra
        });
    }
});

socket.on("connect_error", error => {
    console.error("Error de conexión:", error.message);
});

socket.on("disconnect", motivo => {
    console.warn("Socket desconectado:", motivo);
});

socket.on("sala-unida", datos => {
    console.log("Te uniste a la sala:", datos.sala);
});

socket.on("error-sala", mensaje => {
    console.error("Error de sala:", mensaje);
});

socket.on("lista-participantes", participantes => {
    console.log("Participantes:", participantes);
});


/* ==================================================
   3. VARIABLES DE CONFIGURACIÓN
================================================== */

// Todas las personas comparten las mismas dimensiones lógicas.
const ANCHO_LOGICO = 1200;
const ALTO_LOGICO = 800;

let escalaBase = 1;

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

let modoRelleno = false;
let modoTexto = false;

let zoomActual = 1;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_PASO = 0.1;

let historial = [];
let indiceHistorial = -1;

const MAX_HISTORIAL = 30;

const dpr = window.devicePixelRatio || 1;


/* ==================================================
   4. CONFIGURACIÓN DEL CANVAS
================================================== */

function configurarCanvas() {
    canvas.width = Math.round(ANCHO_LOGICO * dpr);
    canvas.height = Math.round(ALTO_LOGICO * dpr);

    canvas.style.width =
        `${ANCHO_LOGICO * escalaBase * zoomActual}px`;

    canvas.style.height =
        `${ALTO_LOGICO * escalaBase * zoomActual}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
}

function ajustarCanvasAlContenedor() {
    if (!contenedorCanvas) return;

    const anchoDisponible = contenedorCanvas.clientWidth;
    const altoDisponible = contenedorCanvas.clientHeight;

    if (anchoDisponible <= 0 || altoDisponible <= 0) return;

    // Mantiene la proporción 3:2 sin deformar los dibujos.
    escalaBase = Math.min(
        anchoDisponible / ANCHO_LOGICO,
        altoDisponible / ALTO_LOGICO
    );

    // Evita que la pizarra se vuelva excesivamente pequeña.
    escalaBase = Math.max(0.1, escalaBase);

    canvas.style.width =
        `${ANCHO_LOGICO * escalaBase * zoomActual}px`;

    canvas.style.height =
        `${ALTO_LOGICO * escalaBase * zoomActual}px`;
}


/* ==================================================
   5. POSICIÓN DEL PUNTERO
================================================== */

function obtenerPosicion(evento) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (evento.clientX - rect.left) *
            (ANCHO_LOGICO / rect.width),

        y: (evento.clientY - rect.top) *
            (ALTO_LOGICO / rect.height)
    };
}


/* ==================================================
   6. COLORES Y GROSOR
================================================== */

botonesColores.forEach(boton => {
    boton.addEventListener("click", () => {
        colorActual = boton.dataset.color;
        colorLapiz.value = colorActual;

        botonesColores.forEach(el => {
            el.classList.remove("seleccionado");
        });

        boton.classList.add("seleccionado");
    });
});

colorLapiz.addEventListener("input", () => {
    colorActual = colorLapiz.value;

    botonesColores.forEach(boton => {
        boton.classList.remove("seleccionado");
    });
});

grosorLapiz.addEventListener("input", () => {
    grosorActual = Number(grosorLapiz.value);
    valorGrosor.textContent = grosorActual + " px";
});


/* ==================================================
   7. HISTORIAL
================================================== */

function obtenerEstado() {
    return {
        imagen: ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        ),
        ancho: ANCHO_LOGICO,
        alto: ALTO_LOGICO
    };
}

function guardarHistorial() {
    try {
        const estado = obtenerEstado();

        historial = historial.slice(0, indiceHistorial + 1);

        historial.push(estado);

        if (historial.length > MAX_HISTORIAL) {
            historial.shift();
        }

        indiceHistorial = historial.length - 1;

        actualizarHistorial();

    } catch (error) {
        console.warn("No se pudo guardar historial:", error);
    }
}

function actualizarHistorial() {
    btnDeshacer.disabled = indiceHistorial <= 0;

    btnRehacer.disabled =
        indiceHistorial >= historial.length - 1;
}

function restaurarEstado(estado) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.putImageData(estado.imagen, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

document.addEventListener("keydown", evento => {
    if (
        (evento.ctrlKey || evento.metaKey) &&
        evento.key.toLowerCase() === "z"
    ) {
        evento.preventDefault();

        evento.shiftKey ? rehacer() : deshacer();
    }

    if (
        (evento.ctrlKey || evento.metaKey) &&
        evento.key.toLowerCase() === "y"
    ) {
        evento.preventDefault();
        rehacer();
    }
});


/* ==================================================
   8. SELECCIÓN DE HERRAMIENTAS
================================================== */

function activarHerramienta(nombre) {
    herramientaActual = nombre;

    btnLapiz.classList.toggle("activa", nombre === "lapiz");
    btnBorrador.classList.toggle("activa", nombre === "borrador");
    btnRellenar.classList.toggle("activa", nombre === "relleno");
    btnTexto.classList.toggle("activa", nombre === "texto");

    canvas.classList.toggle(
        "seleccion-activa",
        nombre === "seleccion"
    );

    canvas.classList.toggle(
        "texto-activo",
        nombre === "texto"
    );

    switch (nombre) {
        case "borrador":
            canvas.style.cursor = "cell";
            break;

        case "texto":
            canvas.style.cursor = "text";
            break;

        case "relleno":
            canvas.style.cursor = "copy";
            break;

        default:
            canvas.style.cursor = "crosshair";
    }
}

btnLapiz.addEventListener("click", () => {
    formaActual = "";
    modoSeleccion = "";
    seleccion = null;
    modoRelleno = false;
    modoTexto = false;

    herramientaForma.value = "";
    tipoSeleccion.value = "";

    activarHerramienta("lapiz");
});

btnBorrador.addEventListener("click", () => {
    formaActual = "";
    modoSeleccion = "";
    seleccion = null;
    modoRelleno = false;
    modoTexto = false;

    herramientaForma.value = "";
    tipoSeleccion.value = "";

    activarHerramienta("borrador");
});

tipoPincel.addEventListener("change", () => {
    pincelActual = tipoPincel.value;
    activarHerramienta("lapiz");
});

herramientaForma.addEventListener("change", () => {
    formaActual = herramientaForma.value;

    modoSeleccion = "";
    seleccion = null;
    modoRelleno = false;
    modoTexto = false;

    tipoSeleccion.value = "";

    activarHerramienta(
        formaActual ? "forma" : "lapiz"
    );
});

tipoSeleccion.addEventListener("change", () => {
    modoSeleccion = tipoSeleccion.value;

    if (modoSeleccion) {
        formaActual = "";
        herramientaForma.value = "";

        modoRelleno = false;
        modoTexto = false;

        activarHerramienta("seleccion");

    } else {
        seleccion = null;
        activarHerramienta("lapiz");
    }
});

btnTexto.addEventListener("click", () => {
    modoTexto = !modoTexto;

    modoRelleno = false;
    formaActual = "";
    modoSeleccion = "";
    seleccion = null;

    herramientaForma.value = "";
    tipoSeleccion.value = "";

    activarHerramienta(
        modoTexto ? "texto" : "lapiz"
    );
});

btnRellenar.addEventListener("click", () => {
    modoRelleno = !modoRelleno;

    modoTexto = false;
    formaActual = "";
    modoSeleccion = "";
    seleccion = null;

    herramientaForma.value = "";
    tipoSeleccion.value = "";

    activarHerramienta(
        modoRelleno ? "relleno" : "lapiz"
    );
});


/* ==================================================
   9. TRAZOS Y PINCELES
================================================== */

function dibujarTrazoLocal(inicio, fin, color, grosor) {
    ctx.save();

    ctx.strokeStyle = color || "#000000";
    ctx.lineWidth = Number(grosor) || 1;
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

    ctx.lineWidth = (Number(grosor) || 1) * 3;
    ctx.lineCap = "round";

    ctx.stroke();

    ctx.restore();
}

function aplicarPincel(inicio, fin) {
    ctx.save();

    ctx.strokeStyle = colorActual;
    ctx.fillStyle = colorActual;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (pincelActual) {
        case "lapiz":
            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual
            );
            break;

        case "pincel":
            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual * 1.5
            );
            break;

        case "aerografo": {
            const pasos = 10;

            for (let i = 0; i < pasos; i++) {
                const t = Math.random();

                const px =
                    inicio.x +
                    (fin.x - inicio.x) * t +
                    (Math.random() - 0.5) * grosorActual * 2;

                const py =
                    inicio.y +
                    (fin.y - inicio.y) * t +
                    (Math.random() - 0.5) * grosorActual * 2;

                ctx.globalAlpha = 0.15;

                ctx.beginPath();
                ctx.arc(
                    px, py, grosorActual * 0.7,
                    0, Math.PI * 2
                );

                ctx.fill();
            }

            break;
        }

        case "acuarela":
            ctx.globalAlpha = 0.25;

            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual * 2.2
            );

            ctx.globalAlpha = 0.45;

            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual * 1.4
            );
            break;

        case "oleo":
            ctx.globalAlpha = 0.85;

            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual * 1.8
            );
            break;

        case "marcador":
            ctx.globalAlpha = 0.45;

            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual * 2
            );
            break;

        case "crayon": {
            const paso = Math.max(1, grosorActual * 0.4);

            const dx = fin.x - inicio.x;
            const dy = fin.y - inicio.y;

            const dist = Math.hypot(dx, dy) || 1;

            const nx = -dy / dist;
            const ny = dx / dist;

            ctx.globalAlpha = 0.35;

            for (let d = 0; d <= dist; d += paso) {
                const t = d / dist;

                const jitter =
                    (Math.random() - 0.5) * grosorActual;

                const x =
                    inicio.x + dx * t + nx * jitter;

                const y =
                    inicio.y + dy * t + ny * jitter;

                ctx.beginPath();

                ctx.arc(
                    x, y, grosorActual * 0.5,
                    0, Math.PI * 2
                );

                ctx.fill();
            }

            break;
        }

        default:
            dibujarTrazoLocal(
                inicio, fin, colorActual, grosorActual
            );
    }

    ctx.restore();
}


/* ==================================================
   10. FIGURAS
================================================== */

function guardarImagenOriginal() {
    imagenOriginal = ctx.getImageData(
        0, 0, canvas.width, canvas.height
    );
}

function restaurarImagenOriginal() {
    if (imagenOriginal) {
        ctx.putImageData(imagenOriginal, 0, 0);
    }
}

function dibujarFigura(inicio, fin) {
    if (!inicio || !fin) return;

    restaurarImagenOriginal();

    ctx.save();

    ctx.strokeStyle = colorActual;
    ctx.fillStyle = colorActual;

    ctx.lineWidth = grosorActual;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const x = Math.min(inicio.x, fin.x);
    const y = Math.min(inicio.y, fin.y);

    const ancho = Math.abs(fin.x - inicio.x);
    const alto = Math.abs(fin.y - inicio.y);

    switch (formaActual) {
        case "rectangulo":
            ctx.strokeRect(x, y, ancho, alto);
            break;

        case "circulo":
            ctx.beginPath();

            ctx.ellipse(
                x + ancho / 2,
                y + alto / 2,
                ancho / 2,
                alto / 2,
                0, 0, Math.PI * 2
            );

            ctx.stroke();
            break;

        case "linea":
            ctx.beginPath();
            ctx.moveTo(inicio.x, inicio.y);
            ctx.lineTo(fin.x, fin.y);
            ctx.stroke();
            break;

        case "triangulo":
            ctx.beginPath();

            ctx.moveTo(x + ancho / 2, y);
            ctx.lineTo(x + ancho, y + alto);
            ctx.lineTo(x, y + alto);

            ctx.closePath();
            ctx.stroke();
            break;

        case "flecha": {
            const ang = Math.atan2(
                fin.y - inicio.y,
                fin.x - inicio.x
            );

            const cab = Math.max(10, grosorActual * 3);

            ctx.beginPath();
            ctx.moveTo(inicio.x, inicio.y);
            ctx.lineTo(fin.x, fin.y);
            ctx.stroke();

            ctx.beginPath();

            ctx.moveTo(fin.x, fin.y);

            ctx.lineTo(
                fin.x - cab * Math.cos(ang - Math.PI / 7),
                fin.y - cab * Math.sin(ang - Math.PI / 7)
            );

            ctx.moveTo(fin.x, fin.y);

            ctx.lineTo(
                fin.x - cab * Math.cos(ang + Math.PI / 7),
                fin.y - cab * Math.sin(ang + Math.PI / 7)
            );

            ctx.stroke();

            break;
        }
    }

    ctx.restore();
}


/* ==================================================
   11. RELLENO (FLOOD FILL)
================================================== */

function hexARgb(hex) {
    const h = hex.replace("#", "");

    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
        a: 255
    };
}

function rellenar(x, y, colorHex = colorActual) {
    const W = canvas.width;
    const H = canvas.height;

    const px = Math.round(x * dpr);
    const py = Math.round(y * dpr);

    if (px < 0 || py < 0 || px >= W || py >= H) return;

    const imagen = ctx.getImageData(0, 0, W, H);
    const data = imagen.data;

    const idx = (py * W + px) * 4;

    const objetivo = {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
    };

    const nuevo = hexARgb(colorHex);

    if (
        objetivo.r === nuevo.r &&
        objetivo.g === nuevo.g &&
        objetivo.b === nuevo.b &&
        objetivo.a === nuevo.a
    ) return;

    const tol = 30;

    const coincide = i =>
        Math.abs(data[i] - objetivo.r) <= tol &&
        Math.abs(data[i + 1] - objetivo.g) <= tol &&
        Math.abs(data[i + 2] - objetivo.b) <= tol &&
        Math.abs(data[i + 3] - objetivo.a) <= tol;

    const pila = [[px, py]];
    const visitado = new Uint8Array(W * H);

    while (pila.length) {
        const [cx, cy] = pila.pop();

        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;

        const p = cy * W + cx;

        if (visitado[p]) continue;

        const i = p * 4;

        if (!coincide(i)) continue;

        visitado[p] = 1;

        data[i] = nuevo.r;
        data[i + 1] = nuevo.g;
        data[i + 2] = nuevo.b;
        data[i + 3] = nuevo.a;

        pila.push([cx + 1, cy]);
        pila.push([cx - 1, cy]);
        pila.push([cx, cy + 1]);
        pila.push([cx, cy - 1]);
    }

    ctx.putImageData(imagen, 0, 0);
}


/* ==================================================
   12. TEXTO
================================================== */

function insertarTexto(punto) {
    const texto = prompt("Escribe el texto:");

    if (!texto) return;

    const tam = Math.max(
        8,
        Number(
            prompt(
                "Tamaño de fuente (px):",
                String(grosorActual * 4)
            )
        ) || grosorActual * 4
    );

    ctx.save();

    ctx.fillStyle = colorActual;
    ctx.font = `${tam}px Arial, sans-serif`;
    ctx.textBaseline = "top";

    ctx.fillText(texto, punto.x, punto.y);

    ctx.restore();

    guardarHistorial();

    socket.emit("dibujar-trazo", {
        sala: salaPizarra,
        trazo: {
            tipo: "texto",
            x0: punto.x,
            y0: punto.y,
            texto,
            tamano: tam,
            color: colorActual
        }
    });
}


/* ==================================================
   13. EVENTOS DEL PUNTERO
================================================== */

canvas.addEventListener("pointerdown", evento => {
    if (evento.pointerType === "mouse" && evento.button !== 0) {
        return;
    }

    const punto = obtenerPosicion(evento);

    canvas.setPointerCapture(evento.pointerId);

    puntoInicial = punto;
    ultimoPunto = punto;

    if (modoRelleno) {
        guardarHistorial();

        rellenar(punto.x, punto.y);

        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: {
                tipo: "relleno",
                x0: punto.x,
                y0: punto.y,
                color: colorActual
            }
        });

        return;
    }

    if (modoTexto) {
        insertarTexto(punto);
        return;
    }

    if (herramientaActual === "seleccion") {
        seleccion = {
            inicio: punto,
            fin: punto
        };

        return;
    }

    if (herramientaActual === "forma") {
        guardarImagenOriginal();
        return;
    }

    dibujando = true;

    if (herramientaActual === "lapiz") {
        guardarHistorial();
        aplicarPincel(punto, punto);

    } else if (herramientaActual === "borrador") {
        guardarHistorial();
        borrarTrazoLocal(punto, punto, grosorActual);
    }
});


canvas.addEventListener("pointermove", evento => {
    const punto = obtenerPosicion(evento);

    if (herramientaActual === "seleccion" && seleccion) {
        seleccion.fin = punto;

        ctx.save();

        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;

        ctx.strokeRect(
            Math.min(seleccion.inicio.x, seleccion.fin.x),
            Math.min(seleccion.inicio.y, seleccion.fin.y),
            Math.abs(seleccion.fin.x - seleccion.inicio.x),
            Math.abs(seleccion.fin.y - seleccion.inicio.y)
        );

        ctx.restore();

        return;
    }

    if (herramientaActual === "forma" && puntoInicial) {
        dibujarFigura(puntoInicial, punto);
        return;
    }

    if (!dibujando || !ultimoPunto) return;

    if (herramientaActual === "lapiz") {
        aplicarPincel(ultimoPunto, punto);

        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: {
                x0: ultimoPunto.x,
                y0: ultimoPunto.y,
                x1: punto.x,
                y1: punto.y,
                color: colorActual,
                grosor: grosorActual,
                pincel: pincelActual
            }
        });
    }

    else if (herramientaActual === "borrador") {
        borrarTrazoLocal(ultimoPunto, punto, grosorActual);

        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: {
                tipo: "borrador",
                x0: ultimoPunto.x,
                y0: ultimoPunto.y,
                x1: punto.x,
                y1: punto.y,
                grosor: grosorActual
            }
        });
    }

    ultimoPunto = punto;
});


function finalizarDibujo(evento) {
    if (herramientaActual === "seleccion" && seleccion) {
        return;
    }

    if (herramientaActual === "forma" && puntoInicial) {
        const punto = evento
            ? obtenerPosicion(evento)
            : puntoInicial;

        dibujarFigura(puntoInicial, punto);

        guardarHistorial();

        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: {
                tipo: "forma",
                forma: formaActual,
                x0: puntoInicial.x,
                y0: puntoInicial.y,
                x1: punto.x,
                y1: punto.y,
                color: colorActual,
                grosor: grosorActual
            }
        });

        imagenOriginal = null;
        puntoInicial = null;

        return;
    }

    if (!dibujando) return;

    if (
        herramientaActual === "lapiz" ||
        herramientaActual === "borrador"
    ) {
        guardarHistorial();
    }

    dibujando = false;
    ultimoPunto = null;
    puntoInicial = null;
}

canvas.addEventListener("pointerup", finalizarDibujo);
canvas.addEventListener("pointercancel", finalizarDibujo);


/* ==================================================
   14. RECORTAR / REDIMENSIONAR / GIRAR
================================================== */

function obtenerRectSeleccion() {
    if (!seleccion) return null;

    const x = Math.min(
        seleccion.inicio.x,
        seleccion.fin.x
    );

    const y = Math.min(
        seleccion.inicio.y,
        seleccion.fin.y
    );

    const ancho = Math.abs(
        seleccion.fin.x - seleccion.inicio.x
    );

    const alto = Math.abs(
        seleccion.fin.y - seleccion.inicio.y
    );

    if (ancho < 5 || alto < 5) return null;

    return { x, y, ancho, alto };
}

function obtenerImagenSeleccion(rect) {
    return ctx.getImageData(
        Math.round(rect.x * dpr),
        Math.round(rect.y * dpr),
        Math.max(1, Math.round(rect.ancho * dpr)),
        Math.max(1, Math.round(rect.alto * dpr))
    );
}

function crearCanvasTemporal(imagen) {
    const temp = document.createElement("canvas");

    temp.width = imagen.width;
    temp.height = imagen.height;

    temp.getContext("2d").putImageData(imagen, 0, 0);

    return temp;
}

btnRecortar.addEventListener("click", () => {
    const rect = obtenerRectSeleccion();

    if (!rect) {
        alert("Selecciona primero un área.");
        return;
    }

    guardarHistorial();

    const imagen = obtenerImagenSeleccion(rect);

    const temp = crearCanvasTemporal(imagen);

    ctx.clearRect(
        0, 0, ANCHO_LOGICO, ALTO_LOGICO
    );

    // El recorte se coloca en la esquina superior izquierda.
    ctx.drawImage(
        temp,
        0, 0,
        imagen.width, imagen.height,
        0, 0,
        rect.ancho, rect.alto
    );

    seleccion = null;

    guardarHistorial();
});


btnRedimensionar.addEventListener("click", () => {
    const rect = obtenerRectSeleccion();

    if (!rect) {
        alert("Selecciona primero un área.");
        return;
    }

    const nw = Number(
        prompt("Nuevo ancho (px):", Math.round(rect.ancho))
    );

    const nh = Number(
        prompt("Nuevo alto (px):", Math.round(rect.alto))
    );

    if (
        !Number.isFinite(nw) ||
        !Number.isFinite(nh) ||
        nw < 1 ||
        nh < 1 ||
        nw > ANCHO_LOGICO ||
        nh > ALTO_LOGICO
    ) return;

    guardarHistorial();

    const imagen = obtenerImagenSeleccion(rect);
    const temp = crearCanvasTemporal(imagen);

    ctx.clearRect(
        rect.x, rect.y, rect.ancho, rect.alto
    );

    ctx.drawImage(
        temp,
        0, 0,
        imagen.width, imagen.height,
        rect.x, rect.y,
        nw, nh
    );

    seleccion = null;

    guardarHistorial();
});


tipoGiro.addEventListener("change", () => {
    const grados = Number(tipoGiro.value);

    if (!grados) return;

    const rect = obtenerRectSeleccion();

    if (!rect) {
        alert("Selecciona primero un área.");
        tipoGiro.value = "";
        return;
    }

    guardarHistorial();

    const imagen = obtenerImagenSeleccion(rect);
    const temp = crearCanvasTemporal(imagen);

    ctx.clearRect(
        rect.x, rect.y, rect.ancho, rect.alto
    );

    ctx.save();

    ctx.translate(
        rect.x + rect.ancho / 2,
        rect.y + rect.alto / 2
    );

    ctx.rotate((grados * Math.PI) / 180);

    ctx.drawImage(
        temp,
        -rect.ancho / 2,
        -rect.alto / 2,
        rect.ancho,
        rect.alto
    );

    ctx.restore();

    tipoGiro.value = "";
    seleccion = null;

    guardarHistorial();
});


/* ==================================================
   15. ZOOM
================================================== */

function aplicarZoom(nuevoZoom) {
    zoomActual = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, nuevoZoom)
    );

    ajustarCanvasAlContenedor();

    valorZoom.textContent =
        Math.round(zoomActual * 100) + "%";
}

btnZoomMas.addEventListener("click", () => {
    aplicarZoom(zoomActual + ZOOM_PASO);
});

btnZoomMenos.addEventListener("click", () => {
    aplicarZoom(zoomActual - ZOOM_PASO);
});

btnZoomReset.addEventListener("click", () => {
    aplicarZoom(1);
});


/* ==================================================
   16. LIMPIAR
================================================== */

function limpiarCanvasLocal() {
    ctx.save();

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.clearRect(
        0, 0, canvas.width, canvas.height
    );

    ctx.restore();

    guardarHistorial();
}

btnLimpiar.addEventListener("click", () => {
    const confirmar = confirm(
        "¿Deseas eliminar todo el contenido de la pizarra?"
    );

    if (!confirmar) return;

    limpiarCanvasLocal();

    socket.emit("limpiar-pizarra", salaPizarra);
});

socket.on("pizarra-limpiada", () => {
    limpiarCanvasLocal();
});


/* ==================================================
   17. SOCKET: TRAZOS REMOTOS
================================================== */

socket.on("nuevo-trazo", datos => {
    const t = datos?.trazo;

    if (!t) return;

    // TEXTO REMOTO
    if (t.tipo === "texto") {
        ctx.save();

        ctx.fillStyle = t.color;
        ctx.font = `${t.tamano}px Arial, sans-serif`;
        ctx.textBaseline = "top";

        ctx.fillText(t.texto, t.x0, t.y0);

        ctx.restore();

        guardarHistorial();

        return;
    }

    // RELLENO REMOTO
    if (t.tipo === "relleno") {
        guardarHistorial();

        rellenar(t.x0, t.y0, t.color);

        guardarHistorial();

        return;
    }

    // BORRADOR REMOTO
    if (t.tipo === "borrador") {
        borrarTrazoLocal(
            { x: t.x0, y: t.y0 },
            { x: t.x1, y: t.y1 },
            t.grosor
        );

        guardarHistorial();

        return;
    }

    // FIGURA REMOTA
    if (t.tipo === "forma") {
        const formaTemp = formaActual;
        const colorTemp = colorActual;
        const grosorTemp = grosorActual;

        formaActual = t.forma;
        colorActual = t.color;
        grosorActual = t.grosor;

        imagenOriginal = null;

        dibujarFigura(
            { x: t.x0, y: t.y0 },
            { x: t.x1, y: t.y1 }
        );

        imagenOriginal = null;

        formaActual = formaTemp;
        colorActual = colorTemp;
        grosorActual = grosorTemp;

        guardarHistorial();

        return;
    }

    // LÁPIZ Y PINCELES REMOTOS
    if (
        t.x0 !== undefined &&
        t.y0 !== undefined &&
        t.x1 !== undefined &&
        t.y1 !== undefined
    ) {
        const colorAnterior = colorActual;
        const grosorAnterior = grosorActual;
        const pincelAnterior = pincelActual;

        colorActual = t.color || "#000000";
        grosorActual = Number(t.grosor) || 1;
        pincelActual = t.pincel || "lapiz";

        aplicarPincel(
            { x: t.x0, y: t.y0 },
            { x: t.x1, y: t.y1 }
        );

        colorActual = colorAnterior;
        grosorActual = grosorAnterior;
        pincelActual = pincelAnterior;

        guardarHistorial();
    }
});


socket.on("error-pizarra", mensaje => {
    console.error("Error de pizarra:", mensaje);
});


/* ==================================================
   18. INICIALIZACIÓN Y REDIMENSIONAMIENTO
================================================== */

function iniciarPizarra() {
    escalaBase = 1;

    configurarCanvas();

    ajustarCanvasAlContenedor();

    if (indiceHistorial === -1) {
        guardarHistorial();
    }

    aplicarZoom(1);

    console.log(
        "Pizarra iniciada:",
        ANCHO_LOGICO,
        "x",
        ALTO_LOGICO
    );
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciarPizarra,
        { once: true }
    );
} else {
    requestAnimationFrame(iniciarPizarra);
}

if (window.ResizeObserver) {
    const observadorCanvas = new ResizeObserver(() => {
        ajustarCanvasAlContenedor();
    });

    observadorCanvas.observe(contenedorCanvas);
} else {
    window.addEventListener("resize", ajustarCanvasAlContenedor);
}
