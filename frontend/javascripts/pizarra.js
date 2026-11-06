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
   2. CONEXIÓN SOCKET.IO
================================================== */

const socket = io("http://localhost:3000");
window.socket = socket;

socket.on("connect", () => {
    console.log("Socket pizarra conectado:", socket.id);
});

const salaPizarra = sessionStorage.getItem("nombreSala") || "sala-prueba";
const usuarioPizarra = sessionStorage.getItem("nombreUsuario") || "Usuario";

console.log("Sala:", salaPizarra, "| Usuario:", usuarioPizarra);

socket.emit("unirse-sala", {
    nombreSala: salaPizarra,
    nombreUsuario: usuarioPizarra
});

socket.on("sala-unida", (datos) => console.log("Te uniste a la sala:", datos.sala));
socket.on("lista-participantes", (p) => console.log("Participantes:", p));


/* ==================================================
   3. VARIABLES DE CONFIGURACIÓN
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
let guardandoPreview = false;   // evita guardar historial en cada move de forma

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

    // NO tocar style.width/height: el CSS ya controla el tamaño visual (100%/100%)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
}

/**
 * Mide el contenedor y ajusta el canvas al tamaño real disponible.
 * Se llama al cargar y en cada resize.
 */
function ajustarCanvasAlContenedor() {
    const rect = contenedorCanvas.getBoundingClientRect();
    const nuevoAncho = Math.max(1, Math.round(rect.width));
    const nuevoAlto = Math.max(1, Math.round(rect.height));

    if (nuevoAncho === anchoLogico && nuevoAlto === altoLogico) return;

    // Guardar contenido previo
    let imagen = null;
    if (anchoLogico > 0 && altoLogico > 0) {
        try { imagen = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) { }
    }

    configurarCanvas(nuevoAncho, nuevoAlto);

    if (imagen && imagen.width && imagen.height) {
        const temp = document.createElement("canvas");
        temp.width = imagen.width;
        temp.height = imagen.height;
        temp.getContext("2d").putImageData(imagen, 0, 0);
        ctx.drawImage(temp, 0, 0, nuevoAncho, nuevoAlto);
    }

    guardarHistorial();
}


/* ==================================================
   5. POSICIÓN DEL PUNTERO
   El canvas NO se escala con transform, el zoom cambia el
   tamaño lógico, así que no hay que dividir por zoom.
================================================== */

function obtenerPosicion(evento) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evento.clientX - rect.left,
        y: evento.clientY - rect.top
    };
}


/* ==================================================
   6. COLORES Y GROSOR
================================================== */

botonesColores.forEach(boton => {
    boton.addEventListener("click", () => {
        colorActual = boton.dataset.color;
        colorLapiz.value = colorActual;
        botonesColores.forEach(el => el.classList.remove("seleccionado"));
        boton.classList.add("seleccionado");
    });
});

colorLapiz.addEventListener("input", () => {
    colorActual = colorLapiz.value;
    botonesColores.forEach(b => b.classList.remove("seleccionado"));
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
        imagen: ctx.getImageData(0, 0, canvas.width, canvas.height),
        ancho: anchoLogico,
        alto: altoLogico
    };
}

function guardarHistorial() {
    try {
        const estado = obtenerEstado();
        historial = historial.slice(0, indiceHistorial + 1);
        historial.push(estado);
        if (historial.length > MAX_HISTORIAL) historial.shift();
        indiceHistorial = historial.length - 1;
        actualizarHistorial();
    } catch (e) {
        console.warn("No se pudo guardar historial:", e);
    }
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

document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? rehacer() : deshacer();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
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

    canvas.classList.toggle("seleccion-activa", nombre === "seleccion");
    canvas.classList.toggle("texto-activo", nombre === "texto");

    switch (nombre) {
        case "borrador": canvas.style.cursor = "cell"; break;
        case "texto": canvas.style.cursor = "text"; break;
        case "relleno": canvas.style.cursor = "copy"; break;
        default: canvas.style.cursor = "crosshair";
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
    activarHerramienta(formaActual ? "forma" : "lapiz");
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
    activarHerramienta(modoTexto ? "texto" : "lapiz");
});

btnRellenar.addEventListener("click", () => {
    modoRelleno = !modoRelleno;
    modoTexto = false;
    formaActual = "";
    modoSeleccion = "";
    seleccion = null;
    herramientaForma.value = "";
    tipoSeleccion.value = "";
    activarHerramienta(modoRelleno ? "relleno" : "lapiz");
});


/* ==================================================
   9. TRAZOS Y PINCELES
================================================== */

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

function aplicarPincel(inicio, fin) {
    ctx.save();
    ctx.strokeStyle = colorActual;
    ctx.fillStyle = colorActual;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (pincelActual) {
        case "lapiz":
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual);
            break;

        case "pincel":
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual * 1.5);
            break;

        case "aerografo": {
            const pasos = 10;
            for (let i = 0; i < pasos; i++) {
                const t = Math.random();
                const px = inicio.x + (fin.x - inicio.x) * t + (Math.random() - 0.5) * grosorActual * 2;
                const py = inicio.y + (fin.y - inicio.y) * t + (Math.random() - 0.5) * grosorActual * 2;
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                ctx.arc(px, py, grosorActual * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }

        case "acuarela":
            ctx.globalAlpha = 0.25;
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual * 2.2);
            ctx.globalAlpha = 0.45;
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual * 1.4);
            break;

        case "oleo":
            ctx.globalAlpha = 0.85;
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual * 1.8);
            break;

        case "marcador":
            ctx.globalAlpha = 0.45;
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual * 2);
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
                const jitter = (Math.random() - 0.5) * grosorActual;
                const x = inicio.x + dx * t + nx * jitter;
                const y = inicio.y + dy * t + ny * jitter;
                ctx.beginPath();
                ctx.arc(x, y, grosorActual * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }

        default:
            dibujarTrazoLocal(inicio, fin, colorActual, grosorActual);
    }
    ctx.restore();
}


/* ==================================================
   10. FIGURAS
================================================== */

function guardarImagenOriginal() {
    imagenOriginal = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function restaurarImagenOriginal() {
    if (imagenOriginal) ctx.putImageData(imagenOriginal, 0, 0);
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
            ctx.ellipse(x + ancho / 2, y + alto / 2, ancho / 2, alto / 2, 0, 0, Math.PI * 2);
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
            const ang = Math.atan2(fin.y - inicio.y, fin.x - inicio.x);
            const cab = Math.max(10, grosorActual * 3);
            ctx.beginPath();
            ctx.moveTo(inicio.x, inicio.y);
            ctx.lineTo(fin.x, fin.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(fin.x, fin.y);
            ctx.lineTo(fin.x - cab * Math.cos(ang - Math.PI / 7), fin.y - cab * Math.sin(ang - Math.PI / 7));
            ctx.moveTo(fin.x, fin.y);
            ctx.lineTo(fin.x - cab * Math.cos(ang + Math.PI / 7), fin.y - cab * Math.sin(ang + Math.PI / 7));
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
    const objetivo = { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
    const nuevo = hexARgb(colorHex);

    if (objetivo.r === nuevo.r && objetivo.g === nuevo.g &&
        objetivo.b === nuevo.b && objetivo.a === nuevo.a) return;

    const tol = 30;
    const coincide = (i) =>
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
    const tam = Math.max(8, Number(prompt("Tamaño de fuente (px):", String(grosorActual * 4))) || grosorActual * 4);

    ctx.save();
    ctx.fillStyle = colorActual;
    ctx.font = `${tam}px Arial, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(texto, punto.x, punto.y);
    ctx.restore();

    guardarHistorial();
    socket.emit("dibujar-trazo", {
        sala: salaPizarra,
        trazo: { tipo: "texto", x0: punto.x, y0: punto.y, texto, tamano: tam, color: colorActual }
    });
}


/* ==================================================
   13. EVENTOS DEL MOUSE
================================================== */

canvas.addEventListener("pointerdown", (evento) => {
    if (evento.pointerType === "mouse" && evento.button !== 0) return;

    const punto = obtenerPosicion(evento);
    canvas.setPointerCapture(evento.pointerId);

    puntoInicial = punto;
    ultimoPunto = punto;

    // RELLENO
    if (modoRelleno) {
        guardarHistorial();
        rellenar(punto.x, punto.y);
        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: { tipo: "relleno", x0: punto.x, y0: punto.y, color: colorActual }
        });
        return;
    }

    // TEXTO
    if (modoTexto) {
        insertarTexto(punto);
        return;
    }

    // SELECCIÓN
    if (herramientaActual === "seleccion") {
        seleccion = { inicio: punto, fin: punto };
        return;
    }

    // FORMAS
    if (herramientaActual === "forma") {
        guardarImagenOriginal();
        return;
    }

    // LÁPIZ / BORRADOR
    dibujando = true;
    if (herramientaActual === "lapiz") {
        guardarHistorial();
        aplicarPincel(punto, punto);
    } else if (herramientaActual === "borrador") {
        guardarHistorial();
        borrarTrazoLocal(punto, punto, grosorActual);
    }
});

canvas.addEventListener("pointermove", (evento) => {
    const punto = obtenerPosicion(evento);

    // SELECCIÓN
    if (herramientaActual === "seleccion" && seleccion) {
        seleccion.fin = punto;
        restaurarImagenOriginal();
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

    // FORMAS (preview)
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
                x0: ultimoPunto.x, y0: ultimoPunto.y,
                x1: punto.x, y1: punto.y,
                color: colorActual, grosor: grosorActual, pincel: pincelActual
            }
        });
    } else if (herramientaActual === "borrador") {
        borrarTrazoLocal(ultimoPunto, punto, grosorActual);
    }

    ultimoPunto = punto;
});

function finalizarDibujo(evento) {
    // SELECCIÓN: dejar el rectángulo guardado
    if (herramientaActual === "seleccion" && seleccion) {
        // Guardar la imagen base + el rect para las acciones
        return;
    }

    // FORMAS: commit
    if (herramientaActual === "forma" && puntoInicial) {
        const punto = evento ? obtenerPosicion(evento) : puntoInicial;
        dibujarFigura(puntoInicial, punto);
        guardarHistorial();
        socket.emit("dibujar-trazo", {
            sala: salaPizarra,
            trazo: {
                tipo: "forma", forma: formaActual,
                x0: puntoInicial.x, y0: puntoInicial.y,
                x1: punto.x, y1: punto.y,
                color: colorActual, grosor: grosorActual
            }
        });
        imagenOriginal = null;
        puntoInicial = null;
        return;
    }

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
   14. RECORTAR / REDIMENSIONAR / GIRAR
================================================== */

function obtenerRectSeleccion() {
    if (!seleccion) return null;
    const x = Math.min(seleccion.inicio.x, seleccion.fin.x);
    const y = Math.min(seleccion.inicio.y, seleccion.fin.y);
    const ancho = Math.abs(seleccion.fin.x - seleccion.inicio.x);
    const alto = Math.abs(seleccion.fin.y - seleccion.inicio.y);
    if (ancho < 5 || alto < 5) return null;
    return { x, y, ancho, alto };
}

btnRecortar.addEventListener("click", () => {
    const rect = obtenerRectSeleccion();
    if (!rect) { alert("Selecciona primero un área."); return; }

    guardarHistorial();

    const imagenRecorte = ctx.getImageData(
        Math.round(rect.x * dpr), Math.round(rect.y * dpr),
        Math.round(rect.ancho * dpr), Math.round(rect.alto * dpr)
    );

    configurarCanvas(Math.max(1, Math.round(rect.ancho)), Math.max(1, Math.round(rect.alto)));
    ctx.putImageData(imagenRecorte, 0, 0);

    seleccion = null;
    guardarHistorial();
});

btnRedimensionar.addEventListener("click", () => {
    const rect = obtenerRectSeleccion();
    if (!rect) { alert("Selecciona primero un área."); return; }

    const nw = Number(prompt("Nuevo ancho (px):", Math.round(rect.ancho)));
    const nh = Number(prompt("Nuevo alto (px):", Math.round(rect.alto)));
    if (!nw || !nh) return;

    guardarHistorial();

    const imagen = ctx.getImageData(
        Math.round(rect.x * dpr), Math.round(rect.y * dpr),
        Math.round(rect.ancho * dpr), Math.round(rect.alto * dpr)
    );

    const temp = document.createElement("canvas");
    temp.width = imagen.width;
    temp.height = imagen.height;
    temp.getContext("2d").putImageData(imagen, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    ctx.restore();

    ctx.drawImage(temp, rect.x, rect.y, nw, nh);

    seleccion = null;
    guardarHistorial();
});

tipoGiro.addEventListener("change", () => {
    const grados = Number(tipoGiro.value);
    if (!grados) return;
    const rect = obtenerRectSeleccion();
    if (!rect) { alert("Selecciona primero un área."); tipoGiro.value = ""; return; }

    guardarHistorial();

    const imagen = ctx.getImageData(
        Math.round(rect.x * dpr), Math.round(rect.y * dpr),
        Math.round(rect.ancho * dpr), Math.round(rect.alto * dpr)
    );

    const temp = document.createElement("canvas");
    temp.width = imagen.width;
    temp.height = imagen.height;
    temp.getContext("2d").putImageData(imagen, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillRect(rect.x, rect.y, rect.ancho, rect.alto);
    ctx.restore();

    ctx.save();
    ctx.translate(rect.x + rect.ancho / 2, rect.y + rect.alto / 2);
    ctx.rotate((grados * Math.PI) / 180);
    ctx.drawImage(temp, -rect.ancho / 2, -rect.alto / 2, rect.ancho, rect.alto);
    ctx.restore();

    tipoGiro.value = "";
    seleccion = null;
    guardarHistorial();
});


/* ==================================================
   15. ZOOM (ajusta el tamaño lógico del canvas)
================================================== */

function aplicarZoom(nuevoZoom) {
    const anterior = zoomActual;
    zoomActual = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevoZoom));
    if (anterior === zoomActual) return;

    // Guardar contenido actual
    const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Escalar tamaño lógico
    const rect = contenedorCanvas.getBoundingClientRect();
    const baseAncho = Math.max(1, Math.round(rect.width));
    const baseAlto = Math.max(1, Math.round(rect.height));

    const nuevoAncho = Math.max(1, Math.round(baseAncho * zoomActual));
    const nuevoAlto = Math.max(1, Math.round(baseAlto * zoomActual));

    configurarCanvas(nuevoAncho, nuevoAlto);

    if (imagen && imagen.width && imagen.height) {
        const temp = document.createElement("canvas");
        temp.width = imagen.width;
        temp.height = imagen.height;
        temp.getContext("2d").putImageData(imagen, 0, 0);
        ctx.drawImage(temp, 0, 0, nuevoAncho, nuevoAlto);
    }

    valorZoom.textContent = Math.round(zoomActual * 100) + "%";
}

btnZoomMas.addEventListener("click", () => aplicarZoom(zoomActual + ZOOM_PASO));
btnZoomMenos.addEventListener("click", () => aplicarZoom(zoomActual - ZOOM_PASO));
btnZoomReset.addEventListener("click", () => aplicarZoom(1));


/* ==================================================
   16. LIMPIAR
================================================== */

function limpiarCanvasLocal() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    guardarHistorial();
}

btnLimpiar.addEventListener("click", () => {
    const confirmar = confirm("¿Deseas eliminar todo el contenido de la pizarra?");
    if (!confirmar) return;

    // 1) Limpiar YA en esta pantalla
    limpiarCanvasLocal();

    // 2) Avisar a los demás
    socket.emit("limpiar-pizarra", salaPizarra);
});

socket.on("pizarra-limpiada", () => {
    limpiarCanvasLocal();
});


/* ==================================================
   17. SOCKET: TRAZOS REMOTOS
================================================== */

socket.on("nuevo-trazo", (datos) => {
    const t = datos.trazo;
    if (!t) return;

    if (t.tipo === "texto") {
        ctx.save();
        ctx.fillStyle = t.color;
        ctx.font = `${t.tamano}px Arial, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(t.texto, t.x0, t.y0);
        ctx.restore();
        return;
    }

    if (t.tipo === "relleno") {
        rellenar(t.x0, t.y0, t.color);
        return;
    }

    if (t.tipo === "forma") {
        const fA = formaActual, cA = colorActual, gA = grosorActual;
        formaActual = t.forma; colorActual = t.color; grosorActual = t.grosor;
        guardarImagenOriginal();
        dibujarFigura({ x: t.x0, y: t.y0 }, { x: t.x1, y: t.y1 });
        formaActual = fA; colorActual = cA; grosorActual = gA;
        return;
    }

    const pA = pincelActual, cA = colorActual, gA = grosorActual;
    if (t.pincel) pincelActual = t.pincel;
    colorActual = t.color; grosorActual = t.grosor;
    aplicarPincel({ x: t.x0, y: t.y0 }, { x: t.x1, y: t.y1 });
    pincelActual = pA; colorActual = cA; grosorActual = gA;
});


/* ==================================================
   18. RESPONSIVE
================================================== */

let timerResize = null;
window.addEventListener("resize", () => {
    clearTimeout(timerResize);
    timerResize = setTimeout(() => {
        if (zoomActual === 1) ajustarCanvasAlContenedor();
    }, 200);
});


/* ==================================================
   19. EXPORTAR PNG
================================================== */

const btnExportar = document.createElement("button");
btnExportar.id = "btnExportar";
btnExportar.className = "icono-herramienta";
btnExportar.type = "button";
btnExportar.title = "Descargar pizarra";
btnExportar.setAttribute("aria-label", "Descargar pizarra");
btnExportar.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>`;

const grupoHistorial = btnDeshacer.parentElement.parentElement;
const grupoExportar = document.createElement("div");
grupoExportar.className = "grupo-herramientas";
grupoExportar.appendChild(btnExportar);
grupoHistorial.parentNode.insertBefore(grupoExportar, grupoHistorial.nextSibling);

btnExportar.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = `pizarra-${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
});


/* ==================================================
   20. INICIALIZACIÓN
================================================== */

// Esperar a que el layout esté listo para medir bien
window.addEventListener("load", () => {
    ajustarCanvasAlContenedor();
    aplicarZoom(1);
    valorZoom.textContent = "100%";
    guardarHistorial();
    console.log("Pizarra lista.");
});