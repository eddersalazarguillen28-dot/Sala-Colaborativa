"use strict";
/* ==================================================
   1. CANVAS PRINCIPAL
================================================== */

const canvas = document.getElementById("pizarraCanvas");

if (!canvas) {
    throw new Error("No se encontró el canvas #pizarraCanvas.");
}

const ctx = canvas.getContext("2d");


/* ==================================================
   2. CONEXIÓN SOCKET.IO (sin cambios)
   Estas constantes se mantienen globales porque otros
   scripts (chat.js, videollamada.js) pueden usarlas.
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

socket.on("error-pizarra", mensaje => {
    console.error("Error de pizarra:", mensaje);
});

(function pizarraInfinita() {

/* ==================================================
   3. REFERENCIAS AL HTML
================================================== */

const g = id => {
    const nodo = document.getElementById(id);

    if (!nodo) {
        console.warn("Pizarra: falta el elemento #" + id);
    }

    // Si falta, devolvemos un nodo vacío para no romper el resto.
    return nodo || document.createElement("div");
};

const contenedorCanvas = document.querySelector(".contenedor-canvas");

const botonesColores = document.querySelectorAll(".color-opcion");

const botonesHerramienta = {
    mano: g("btnMano"),
    seleccionar: g("btnSeleccionar"),
    lapiz: g("btnLapiz"),
    borrador: g("btnBorrador"),
    borrarObjeto: g("btnBorradorObjeto"),
    texto: g("btnTexto"),
    relleno: g("btnRellenar"),
    laser: g("btnLaser")
};

const tipoPincel = g("tipoPincel");
const herramientaForma = g("herramientaForma");
const btnRellenoForma = g("btnRellenoForma");

const colorLapiz = g("colorLapiz");
const grosorLapiz = g("grosorLapiz");
const valorGrosor = g("valorGrosor");
const tamTexto = g("tamTexto");

const tipoGiro = g("tipoGiro");
const btnVoltearH = g("btnVoltearH");
const btnVoltearV = g("btnVoltearV");
const btnDuplicar = g("btnDuplicar");
const btnEliminar = g("btnEliminar");

const btnDeshacer = g("btnDeshacer");
const btnRehacer = g("btnRehacer");

const btnZoomMas = g("btnZoomMas");
const btnZoomMenos = g("btnZoomMenos");
const btnZoomReset = g("btnZoomReset");
const btnZoomAjustar = g("btnZoomAjustar");
const btnRuedaZoom = g("btnRuedaZoom");
const valorZoom = g("valorZoom");

const btnCuadricula = g("btnCuadricula");
const btnExportar = g("btnExportar");
const btnLimpiar = g("btnLimpiar");
const btnAyuda = g("btnAyuda");

const panelAyuda = g("panelAyuda");
const avisoPizarra = g("avisoPizarra");
const editorTexto = g("editorTexto");

const modalLimpiar = g("modalLimpiar");
const btnConfirmarLimpiar = g("btnConfirmarLimpiar");
const btnCancelarLimpiar = g("btnCancelarLimpiar");


/* ==================================================
   4. ESTADO
================================================== */

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 8;
const MAX_HISTORIAL = 150;
const TIEMPO_LASER = 900;          // ms que dura la estela del láser
const TAM_MAX_LOTE = 180000;       // caracteres por mensaje de socket

// Cámara: pantalla = mundo * z + (x, y)
const cam = { x: 0, y: 0, z: 1 };

let W = 1;
let H = 1;
let dpr = window.devicePixelRatio || 1;
let camaraInicializada = false;

// Capa fuera de pantalla con todos los objetos (fondo transparente).
const capa = document.createElement("canvas");
const cctx = capa.getContext("2d");

let capaSucia = true;
let pintadoPendiente = false;

// Modelo de datos
const elementos = [];
const mapa = new Map();
const cacheLim = new WeakMap();

// Trazos en curso (aún no confirmados)
const vivos = new Map();   // trazos remotos
let vivoLocal = null;      // trazo local

// Selección
const seleccion = new Set();
let portapapeles = [];
let desfasePegado = 0;

// Herramientas
let herramienta = "lapiz";
let formaActual = "";
let pincelActual = "lapiz";
let colorActual = "#000000";
let grosorActual = 4;
let tamTextoActual = 24;
let rellenoForma = false;

let verCuadricula = true;
let ruedaZoom = false;
let espacio = false;

// Interacción
let accion = null;
const punteros = new Map();
let pinch = null;
let cursorMundo = null;

// Texto
let editor = null;
let idOculto = null;

// Láser
const lasers = new Map();

// Historial local (solo deshace lo que hiciste tú)
const pilaDeshacer = [];
const pilaRehacer = [];

let contadorId = 0;
let avisoTimer = null;


/* ==================================================
   5. UTILIDADES
================================================== */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const clonar = obj => JSON.parse(JSON.stringify(obj));

function nuevoId() {
    contadorId++;

    return (
        (socket.id || "loc") + "-" +
        Date.now().toString(36) +
        contadorId.toString(36) +
        Math.random().toString(36).slice(2, 6)
    );
}

// Generador pseudoaleatorio con semilla: así los pinceles con
// textura (aerógrafo, crayón) se ven IGUAL para todos y al hacer zoom.
function rng(semilla) {
    let a = semilla >>> 0;

    return function () {
        a = (a + 0x6D2B79F5) | 0;

        let t = Math.imul(a ^ (a >>> 15), 1 | a);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function avisar(texto) {
    avisoPizarra.textContent = texto;
    avisoPizarra.classList.add("visible");

    clearTimeout(avisoTimer);

    avisoTimer = setTimeout(() => {
        avisoPizarra.classList.remove("visible");
    }, 2400);
}

function posPantalla(evento) {
    const r = canvas.getBoundingClientRect();

    return {
        x: evento.clientX - r.left,
        y: evento.clientY - r.top
    };
}

function aMundo(p) {
    return {
        x: (p.x - cam.x) / cam.z,
        y: (p.y - cam.y) / cam.z
    };
}

function aPantalla(x, y) {
    return {
        x: x * cam.z + cam.x,
        y: y * cam.z + cam.y
    };
}


/* ==================================================
   6. COMUNICACIÓN (SOCKET)
================================================== */

function emitirOp(datos) {
    const usuarioActual = sessionStorage.getItem("nombreUsuario")||window.nombreUsuario||"Usuario";
    socket.emit("dibujar-trazo", {
        sala: salaPizarra,
        usuario:usuarioActual,
        trazo: Object.assign({ v: 2 }, datos)
    });
}

// Envía listas grandes partidas en varios mensajes.
function emitirLotes(op, els, extra) {
    let lote = [];
    let tam = 0;

    const enviar = () => {
        if (!lote.length) return;

        emitirOp(Object.assign({ op, els: lote }, extra || {}));

        lote = [];
        tam = 0;
    };

    for (const e of els) {
        const largo = JSON.stringify(e).length;

        if (tam + largo > TAM_MAX_LOTE) enviar();

        lote.push(e);
        tam += largo;
    }

    enviar();
}


/* ==================================================
   7. GEOMETRÍA Y LÍMITES
================================================== */

function medirTexto(e) {
    cctx.save();
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.font = `${e.tam}px Arial, sans-serif`;

    const lineas = String(e.txt).split("\n");

    let ancho = 0;

    for (const l of lineas) {
        ancho = Math.max(ancho, cctx.measureText(l).width);
    }

    cctx.restore();

    return {
        w: ancho,
        h: lineas.length * e.tam * 1.25
    };
}

function padDibujo(e) {
    switch (e.t) {
        case "trazo": return e.g * 2.4 + 2;
        case "borrador": return e.g / 2 + 2;
        case "linea": return Math.max(e.g / 2, Math.max(12, e.g * 4)) + 2;
        case "texto": return 2;
        default: return (e.g || 1) / 2 + 2;
    }
}

// Devuelve {geo, sel, dib}: límites geométricos, de selección y de dibujo.
function limites(e) {
    let c = cacheLim.get(e);

    if (c) return c;

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;

    if (e.t === "elipse") {
        x0 = Math.min(e.x0, e.x1);
        x1 = Math.max(e.x0, e.x1);
        y0 = Math.min(e.y0, e.y1);
        y1 = Math.max(e.y0, e.y1);

    } else if (e.t === "texto") {
        const m = medirTexto(e);

        x0 = e.x;
        y0 = e.y;
        x1 = e.x + m.w;
        y1 = e.y + m.h;

    } else {
        const p = e.pts || [];

        for (let i = 0; i < p.length; i += 2) {
            if (p[i] < x0) x0 = p[i];
            if (p[i] > x1) x1 = p[i];
            if (p[i + 1] < y0) y0 = p[i + 1];
            if (p[i + 1] > y1) y1 = p[i + 1];
        }

        if (x0 === Infinity) {
            x0 = y0 = x1 = y1 = 0;
        }
    }

    const ps = e.t === "texto" ? 0 : (e.g || 0) / 2;
    const pd = padDibujo(e);

    c = {
        geo: [x0, y0, x1, y1],
        sel: [x0 - ps, y0 - ps, x1 + ps, y1 + ps],
        dib: [x0 - pd, y0 - pd, x1 + pd, y1 + pd]
    };

    cacheLim.set(e, c);

    return c;
}

function tocar(e) {
    cacheLim.delete(e);
}

function intersecta(a, b) {
    return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function unirLimites(lista) {
    if (!lista.length) return null;

    const r = [Infinity, Infinity, -Infinity, -Infinity];

    for (const b of lista) {
        r[0] = Math.min(r[0], b[0]);
        r[1] = Math.min(r[1], b[1]);
        r[2] = Math.max(r[2], b[2]);
        r[3] = Math.max(r[3], b[3]);
    }

    return r;
}

function distSeg(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy;

    let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;

    t = clamp(t, 0, 1);

    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function distPoli(pts, px, py, cerrado) {
    const n = pts.length / 2;

    if (n === 1) return Math.hypot(px - pts[0], py - pts[1]);

    let d = Infinity;

    for (let i = 1; i < n; i++) {
        d = Math.min(
            d,
            distSeg(px, py, pts[2 * i - 2], pts[2 * i - 1], pts[2 * i], pts[2 * i + 1])
        );
    }

    if (cerrado && n > 2) {
        d = Math.min(
            d,
            distSeg(px, py, pts[2 * n - 2], pts[2 * n - 1], pts[0], pts[1])
        );
    }

    return d;
}

function dentroPoli(pts, px, py) {
    const n = pts.length / 2;

    let dentro = false;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[2 * i], yi = pts[2 * i + 1];
        const xj = pts[2 * j], yj = pts[2 * j + 1];

        if (
            (yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
        ) {
            dentro = !dentro;
        }
    }

    return dentro;
}

function anchoTrazo(e) {
    switch (e.p) {
        case "pincel": return e.g * 1.5;
        case "acuarela": return e.g * 2.6;
        case "oleo": return e.g * 1.8;
        case "marcador": return e.g * 2.4;
        case "aerografo": return e.g * 3;
        default: return e.g;
    }
}

// ¿El punto (x, y) toca el objeto?
function golpea(e, x, y, tol) {
    const lim = limites(e).dib;

    if (
        x < lim[0] - tol || x > lim[2] + tol ||
        y < lim[1] - tol || y > lim[3] + tol
    ) return false;

    switch (e.t) {
        case "trazo":
            if (distPoli(e.pts, x, y, false) <= anchoTrazo(e) / 2 + tol) return true;
            return !!e.r && e.pts.length >= 6 && dentroPoli(e.pts, x, y);

        case "poligono":
            if (distPoli(e.pts, x, y, true) <= e.g / 2 + tol) return true;
            return !!e.r && dentroPoli(e.pts, x, y);

        case "linea":
            return distPoli(e.pts, x, y, false) <= e.g / 2 + tol;

        case "elipse": {
            const cx = (e.x0 + e.x1) / 2;
            const cy = (e.y0 + e.y1) / 2;
            const rx = Math.abs(e.x1 - e.x0) / 2;
            const ry = Math.abs(e.y1 - e.y0) / 2;

            if (rx < 1e-6 || ry < 1e-6) return false;

            const d = Math.hypot((x - cx) / rx, (y - cy) / ry);

            if (e.r && d <= 1) return true;

            return Math.abs(d - 1) * Math.min(rx, ry) <= e.g / 2 + tol;
        }

        case "texto": {
            const m = medirTexto(e);

            return (
                x >= e.x - tol && x <= e.x + m.w + tol &&
                y >= e.y - tol && y <= e.y + m.h + tol
            );
        }
    }

    return false;
}

// ¿El punto está DENTRO de una figura que se puede rellenar?
function dentroDeFigura(e, x, y) {
    switch (e.t) {
        case "trazo":
            return e.pts.length >= 6 && dentroPoli(e.pts, x, y);

        case "poligono":
            return dentroPoli(e.pts, x, y);

        case "elipse": {
            const rx = Math.abs(e.x1 - e.x0) / 2;
            const ry = Math.abs(e.y1 - e.y0) / 2;

            if (rx < 1e-6 || ry < 1e-6) return false;

            return Math.hypot(
                (x - (e.x0 + e.x1) / 2) / rx,
                (y - (e.y0 + e.y1) / 2) / ry
            ) <= 1;
        }
    }

    return false;
}

function elementoEn(x, y, tol) {
    for (let i = elementos.length - 1; i >= 0; i--) {
        const e = elementos[i];

        if (e.t === "borrador") continue;

        if (golpea(e, x, y, tol)) return e;
    }

    return null;
}

// Aplica una transformación a las coordenadas de un objeto.
// f(x, y) -> [x', y'] ; sx, sy son los factores de escala.
function mapear(e, f, sx, sy) {
    switch (e.t) {
        case "trazo":
        case "borrador":
        case "poligono":
        case "linea": {
            const p = e.pts;

            for (let i = 0; i < p.length; i += 2) {
                const r = f(p[i], p[i + 1]);

                p[i] = r[0];
                p[i + 1] = r[1];
            }

            break;
        }

        case "elipse": {
            const a = f(e.x0, e.y0);
            const b = f(e.x1, e.y1);

            e.x0 = Math.min(a[0], b[0]);
            e.x1 = Math.max(a[0], b[0]);
            e.y0 = Math.min(a[1], b[1]);
            e.y1 = Math.max(a[1], b[1]);

            break;
        }

        case "texto": {
            const m = medirTexto(e);
            const k = Math.max(0.05, (Math.abs(sx) + Math.abs(sy)) / 2);
            const c = f(e.x + m.w / 2, e.y + m.h / 2);
            const tam = Math.max(6, e.tam * k);
            const k2 = tam / e.tam;

            e.x = c[0] - (m.w * k2) / 2;
            e.y = c[1] - (m.h * k2) / 2;
            e.tam = tam;

            break;
        }
    }

    return e;
}


/* ==================================================
   8. DIBUJO DE OBJETOS
================================================== */

function rutaSuave(c, pts) {
    const n = pts.length / 2;

    c.beginPath();
    c.moveTo(pts[0], pts[1]);

    if (n === 1) {
        c.lineTo(pts[0] + 0.01, pts[1]);
        return;
    }

    if (n === 2) {
        c.lineTo(pts[2], pts[3]);
        return;
    }

    for (let i = 1; i < n - 1; i++) {
        const mx = (pts[2 * i] + pts[2 * i + 2]) / 2;
        const my = (pts[2 * i + 1] + pts[2 * i + 3]) / 2;

        c.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx, my);
    }

    c.lineTo(pts[2 * (n - 1)], pts[2 * (n - 1) + 1]);
}

function desplazar(pts, d) {
    const n = pts.length / 2;
    const salida = new Array(pts.length);

    for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(n - 1, i + 1);

        const dx = pts[2 * b] - pts[2 * a];
        const dy = pts[2 * b + 1] - pts[2 * a + 1];
        const l = Math.hypot(dx, dy) || 1;

        salida[2 * i] = pts[2 * i] - (dy / l) * d;
        salida[2 * i + 1] = pts[2 * i + 1] + (dx / l) * d;
    }

    return salida;
}

// Recorre la ruta cada "paso" unidades; cb(x, y, nx, ny)
function recorrer(pts, paso, cb) {
    const n = pts.length / 2;

    if (n === 1) {
        cb(pts[0], pts[1], 0, 1);
        return;
    }

    for (let i = 1; i < n; i++) {
        const x0 = pts[2 * i - 2];
        const y0 = pts[2 * i - 1];
        const dx = pts[2 * i] - x0;
        const dy = pts[2 * i + 1] - y0;
        const L = Math.hypot(dx, dy);
        const k = Math.max(1, Math.ceil(L / paso));
        const nx = L ? -dy / L : 0;
        const ny = L ? dx / L : 1;

        for (let j = 0; j < k; j++) {
            const t = j / k;

            cb(x0 + dx * t, y0 + dy * t, nx, ny);
        }
    }
}

function dibujarTrazo(c, e) {
    const p = e.pts;
    const gr = e.g;

    c.save();

    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = e.c;
    c.fillStyle = e.c;

    if (e.r && p.length >= 6) {
        c.fillStyle = e.r;
        rutaSuave(c, p);
        c.closePath();
        c.fill();
        c.fillStyle = e.c;
    }

    switch (e.p) {
        case "pincel":
            c.lineWidth = gr * 1.5;
            rutaSuave(c, p);
            c.stroke();
            break;

        case "acuarela":
            c.globalAlpha = 0.22;
            c.lineWidth = gr * 2.6;
            rutaSuave(c, p);
            c.stroke();

            c.globalAlpha = 0.3;
            c.lineWidth = gr * 1.4;
            rutaSuave(c, p);
            c.stroke();
            break;

        case "oleo":
            c.globalAlpha = 0.92;
            c.lineWidth = gr * 1.8;
            rutaSuave(c, p);
            c.stroke();

            c.globalAlpha = 0.25;
            c.strokeStyle = "#ffffff";
            c.lineWidth = Math.max(0.6, gr * 0.14);

            for (const d of [-0.55, -0.15, 0.3, 0.65]) {
                rutaSuave(c, desplazar(p, d * gr));
                c.stroke();
            }

            break;

        case "marcador":
            c.globalAlpha = 0.4;
            c.lineWidth = gr * 2.4;
            rutaSuave(c, p);
            c.stroke();
            break;

        case "aerografo": {
            const r = rng(e.s);
            const s = Math.max(1, gr * 0.16);
            const cuantos = Math.min(14, Math.ceil(3 + gr * 0.4));

            c.globalAlpha = 0.35;

            recorrer(p, Math.max(0.8, gr * 0.25), (x, y) => {
                for (let k = 0; k < cuantos; k++) {
                    const ang = r() * 6.2832;
                    const dist = Math.sqrt(r()) * gr * 1.6;

                    c.fillRect(
                        x + Math.cos(ang) * dist - s / 2,
                        y + Math.sin(ang) * dist - s / 2,
                        s, s
                    );
                }
            });

            break;
        }

        case "crayon": {
            const r = rng(e.s);

            c.globalAlpha = 0.55;

            recorrer(p, Math.max(0.8, gr * 0.22), (x, y, nx, ny) => {
                for (let k = 0; k < 3; k++) {
                    if (r() < 0.3) continue;

                    const o = (r() - 0.5) * gr * 1.3;
                    const s = Math.max(1, gr * (0.15 + r() * 0.3));

                    c.fillRect(x + nx * o, y + ny * o, s, s);
                }
            });

            break;
        }

        default:
            c.lineWidth = gr;
            rutaSuave(c, p);
            c.stroke();
    }

    c.restore();
}

// Dibuja el borrador desde el punto "desde" hasta el final.
function borrarTramo(c, e, desde) {
    const p = e.pts;
    const n = p.length / 2;
    const ini = Math.max(0, desde - 1);

    c.save();

    c.globalCompositeOperation = "destination-out";
    c.strokeStyle = "#000000";
    c.lineWidth = e.g;
    c.lineCap = "round";
    c.lineJoin = "round";

    c.beginPath();
    c.moveTo(p[2 * ini], p[2 * ini + 1]);

    if (n - ini === 1) {
        c.lineTo(p[2 * ini] + 0.01, p[2 * ini + 1]);
    }

    for (let i = ini + 1; i < n; i++) {
        c.lineTo(p[2 * i], p[2 * i + 1]);
    }

    c.stroke();
    c.restore();
}

function dibujarPoligono(c, e) {
    const p = e.pts;

    c.save();

    c.lineJoin = "round";
    c.lineCap = "round";

    c.beginPath();
    c.moveTo(p[0], p[1]);

    for (let i = 2; i < p.length; i += 2) {
        c.lineTo(p[i], p[i + 1]);
    }

    c.closePath();

    if (e.r) {
        c.fillStyle = e.r;
        c.fill();
    }

    c.strokeStyle = e.c;
    c.lineWidth = e.g;
    c.stroke();

    c.restore();
}

function dibujarElipse(c, e) {
    const rx = Math.abs(e.x1 - e.x0) / 2;
    const ry = Math.abs(e.y1 - e.y0) / 2;

    if (rx < 0.01 || ry < 0.01) return;

    c.save();

    c.beginPath();

    c.ellipse(
        (e.x0 + e.x1) / 2,
        (e.y0 + e.y1) / 2,
        rx, ry, 0, 0, Math.PI * 2
    );

    if (e.r) {
        c.fillStyle = e.r;
        c.fill();
    }

    c.strokeStyle = e.c;
    c.lineWidth = e.g;
    c.stroke();

    c.restore();
}

function cabezaFlecha(c, x, y, xo, yo, cab) {
    const ang = Math.atan2(y - yo, x - xo);

    c.beginPath();

    c.moveTo(
        x - cab * Math.cos(ang - Math.PI / 7),
        y - cab * Math.sin(ang - Math.PI / 7)
    );

    c.lineTo(x, y);

    c.lineTo(
        x - cab * Math.cos(ang + Math.PI / 7),
        y - cab * Math.sin(ang + Math.PI / 7)
    );

    c.stroke();
}

function dibujarLinea(c, e) {
    const p = e.pts;
    const cab = Math.max(12, e.g * 4);

    c.save();

    c.strokeStyle = e.c;
    c.lineWidth = e.g;
    c.lineCap = "round";
    c.lineJoin = "round";

    c.beginPath();
    c.moveTo(p[0], p[1]);
    c.lineTo(p[2], p[3]);
    c.stroke();

    if (e.fl >= 1) cabezaFlecha(c, p[2], p[3], p[0], p[1], cab);
    if (e.fl === 2) cabezaFlecha(c, p[0], p[1], p[2], p[3], cab);

    c.restore();
}

function dibujarTexto(c, e) {
    c.save();

    c.fillStyle = e.c;
    c.font = `${e.tam}px Arial, sans-serif`;
    c.textBaseline = "top";

    String(e.txt).split("\n").forEach((linea, i) => {
        c.fillText(linea, e.x, e.y + i * e.tam * 1.25);
    });

    c.restore();
}

function dibujarElemento(c, e) {
    switch (e.t) {
        case "trazo": dibujarTrazo(c, e); break;
        case "borrador": borrarTramo(c, e, 0); break;
        case "poligono": dibujarPoligono(c, e); break;
        case "elipse": dibujarElipse(c, e); break;
        case "linea": dibujarLinea(c, e); break;
        case "texto":
            if (e.id !== idOculto) dibujarTexto(c, e);
            break;
    }
}


/* ==================================================
   9. RENDER (capa + pantalla)
================================================== */

function ponerTransformCapa() {
    cctx.setTransform(
        dpr * cam.z, 0, 0, dpr * cam.z,
        dpr * cam.x, dpr * cam.y
    );
}

function renderCapa() {
    capaSucia = false;

    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, capa.width, capa.height);

    ponerTransformCapa();

    const vista = [
        -cam.x / cam.z,
        -cam.y / cam.z,
        (W - cam.x) / cam.z,
        (H - cam.y) / cam.z
    ];

    for (const e of elementos) {
        if (intersecta(limites(e).dib, vista)) {
            dibujarElemento(cctx, e);
        }
    }
}

function dibujarCuadricula() {
    let paso = PASO_CUADRICULA;

    while (paso * cam.z < 18) paso *= 2;
    while (paso * cam.z > 90) paso /= 2;

    const px = paso * cam.z;
    const ox = ((cam.x % px) + px) % px;
    const oy = ((cam.y % px) + px) % px;
    const s = Math.max(1, Math.round(1.6 * dpr));

    ctx.fillStyle = "#c3c9d6";

    for (let x = ox; x < W; x += px) {
        for (let y = oy; y < H; y += px) {
            ctx.fillRect(
                Math.round(x * dpr - s / 2),
                Math.round(y * dpr - s / 2),
                s, s
            );
        }
    }
}

const PASO_CUADRICULA = 40;

function manijas(b) {
    const mx = (b[0] + b[2]) / 2;
    const my = (b[1] + b[3]) / 2;

    return [
        [b[0], b[1]], [mx, b[1]], [b[2], b[1]], [b[2], my],
        [b[2], b[3]], [mx, b[3]], [b[0], b[3]], [b[0], my]
    ];
}

const HX = [-1, 0, 1, 1, 1, 0, -1, -1];
const HY = [-1, -1, -1, 0, 1, 1, 1, 0];

const CURSORES_MANIJA = [
    "nwse-resize", "ns-resize", "nesw-resize", "ew-resize",
    "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"
];

function elementosSeleccionados() {
    const lista = [];

    seleccion.forEach(id => {
        const e = mapa.get(id);

        if (e) lista.push(e);
    });

    return lista;
}

function limitesSeleccion() {
    const lista = elementosSeleccionados();

    return unirLimites(lista.map(e => limites(e).sel));
}

function dibujarSeleccion() {
    const lista = elementosSeleccionados();

    if (!lista.length) return;

    const px = 1 / cam.z;

    ctx.save();

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1 * px;

    if (lista.length > 1) {
        ctx.globalAlpha = 0.45;

        for (const e of lista) {
            const b = limites(e).sel;

            ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
        }

        ctx.globalAlpha = 1;
    }

    const b = unirLimites(lista.map(e => limites(e).sel));

    ctx.setLineDash([6 * px, 4 * px]);
    ctx.lineWidth = 1.5 * px;
    ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    ctx.setLineDash([]);

    const lado = 9 * px;

    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 1.5 * px;

    for (const [mx, my] of manijas(b)) {
        ctx.fillRect(mx - lado / 2, my - lado / 2, lado, lado);
        ctx.strokeRect(mx - lado / 2, my - lado / 2, lado, lado);
    }

    ctx.restore();
}

function dibujarLasers(ahora) {
    let activo = false;

    lasers.forEach((l, clave) => {
        l.pts = l.pts.filter(p => ahora - p.t < TIEMPO_LASER);

        if (!l.pts.length) {
            lasers.delete(clave);
            return;
        }

        activo = true;

        ctx.save();

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = l.c;

        for (let i = 1; i < l.pts.length; i++) {
            const a = 1 - (ahora - l.pts[i].t) / TIEMPO_LASER;

            ctx.globalAlpha = Math.max(0, a);
            ctx.lineWidth = (3 + 3 * a) / cam.z;

            ctx.beginPath();
            ctx.moveTo(l.pts[i - 1].x, l.pts[i - 1].y);
            ctx.lineTo(l.pts[i].x, l.pts[i].y);
            ctx.stroke();
        }

        const ult = l.pts[l.pts.length - 1];

        ctx.globalAlpha = 1;
        ctx.fillStyle = l.c;
        ctx.shadowColor = l.c;
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(ult.x, ult.y, 6 / cam.z, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });

    return activo;
}

function pintar() {
    pintadoPendiente = false;

    const ahora = performance.now();

    // Trazos remotos que nunca terminaron (se cortó la conexión)
    vivos.forEach((v, id) => {
        if (Date.now() - v.ts > 8000) {
            vivos.delete(id);
            agregarLocal(v.el, false);
        }
    });

    if (capaSucia) renderCapa();

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (verCuadricula) dibujarCuadricula();

    ctx.drawImage(capa, 0, 0);

    // Todo lo siguiente se dibuja en coordenadas del mundo
    ctx.setTransform(
        dpr * cam.z, 0, 0, dpr * cam.z,
        dpr * cam.x, dpr * cam.y
    );

    vivos.forEach(v => dibujarElemento(ctx, v.el));

    if (vivoLocal) dibujarElemento(ctx, vivoLocal);

    if (accion && accion.tipo === "forma" && accion.prev) {
        dibujarElemento(ctx, accion.prev);
    }

    dibujarSeleccion();

    if (accion && accion.tipo === "marco") {
        const r = accion;
        const x = Math.min(r.a.x, r.b.x);
        const y = Math.min(r.a.y, r.b.y);
        const w = Math.abs(r.b.x - r.a.x);
        const h = Math.abs(r.b.y - r.a.y);

        ctx.save();

        ctx.fillStyle = "rgba(37,99,235,0.08)";
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1 / cam.z;
        ctx.setLineDash([5 / cam.z, 4 / cam.z]);

        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        ctx.restore();
    }

    if (
        cursorMundo && !pinch &&
        (herramienta === "borrador" || herramienta === "borrarObjeto") &&
        !espacio
    ) {
        const radio = herramienta === "borrador"
            ? Math.max(6, grosorActual * 3) / 2
            : 8 / cam.z;

        ctx.save();

        ctx.beginPath();
        ctx.arc(cursorMundo.x, cursorMundo.y, radio, 0, Math.PI * 2);

        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();

        ctx.strokeStyle = "#6b7280";
        ctx.lineWidth = 1 / cam.z;
        ctx.stroke();

        ctx.restore();
    }

    const hayLaser = dibujarLasers(ahora);

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (hayLaser || vivos.size) pedirPintado();
}

function pedirPintado() {
    if (pintadoPendiente) return;

    pintadoPendiente = true;

    requestAnimationFrame(pintar);
}


/* ==================================================
   10. CÁMARA: MOVER Y ZOOM
================================================== */

function camaraCambio() {
    if (editor) cerrarEditor(true);

    capaSucia = true;

    valorZoom.textContent = Math.round(cam.z * 100) + "%";

    pedirPintado();
}

function zoomEn(nuevoZoom, sx, sy) {
    const z = clamp(nuevoZoom, ZOOM_MIN, ZOOM_MAX);

    const wx = (sx - cam.x) / cam.z;
    const wy = (sy - cam.y) / cam.z;

    cam.z = z;
    cam.x = sx - wx * z;
    cam.y = sy - wy * z;

    camaraCambio();
}

function ajustarVista() {
    const lista = elementos
        .filter(e => e.t !== "borrador")
        .map(e => limites(e).dib);

    const b = unirLimites(lista);

    if (!b) {
        cam.z = 1;
        cam.x = W / 2;
        cam.y = H / 2;

    } else {
        const margen = 60;
        const bw = Math.max(b[2] - b[0], 1);
        const bh = Math.max(b[3] - b[1], 1);

        const z = clamp(
            Math.min((W - margen * 2) / bw, (H - margen * 2) / bh),
            ZOOM_MIN,
            1.5
        );

        cam.z = z;
        cam.x = W / 2 - (b[0] + bw / 2) * z;
        cam.y = H / 2 - (b[1] + bh / 2) * z;
    }

    camaraCambio();
}

function redimensionar() {
    if (!contenedorCanvas) return;

    const ancho = Math.floor(contenedorCanvas.clientWidth);
    const alto = Math.floor(contenedorCanvas.clientHeight);

    if (ancho < 2 || alto < 2) return;

    W = ancho;
    H = alto;
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    capa.width = canvas.width;
    capa.height = canvas.height;

    if (!camaraInicializada) {
        camaraInicializada = true;

        // El origen del mundo queda en el centro de la pantalla.
        cam.x = W / 2;
        cam.y = H / 2;
    }

    capaSucia = true;

    pedirPintado();
}


/* ==================================================
   11. MODELO: AGREGAR / ELIMINAR / REEMPLAZAR
================================================== */

function reemplazarLocal(nuevo) {
    const viejo = mapa.get(nuevo.id);

    if (viejo) {
        elementos[elementos.indexOf(viejo)] = nuevo;
    } else {
        elementos.push(nuevo);
    }

    mapa.set(nuevo.id, nuevo);
}

// Agrega un objeto. Si "incremental" es true, lo dibuja directo
// sobre la capa (mucho más rápido que redibujar todo).
function agregarLocal(e, incremental) {
    if (mapa.has(e.id)) {
        reemplazarLocal(e);
        capaSucia = true;

    } else {
        elementos.push(e);
        mapa.set(e.id, e);

        if (incremental && !capaSucia) {
            ponerTransformCapa();
            dibujarElemento(cctx, e);

        } else {
            capaSucia = true;
        }
    }

    pedirPintado();
}

function agregarLote(els, emitir) {
    els.forEach(e => {
        if (mapa.has(e.id)) {
            reemplazarLocal(e);
        } else {
            elementos.push(e);
            mapa.set(e.id, e);
        }
    });

    capaSucia = true;

    actualizarUI();
    pedirPintado();

    if (emitir) emitirLotes("agregar", els.map(clonar));
}

function opReemplazar(els, emitir) {
    els.forEach(reemplazarLocal);

    capaSucia = true;

    actualizarUI();
    pedirPintado();

    if (emitir) emitirLotes("actualizar", els.map(clonar));
}

function opEliminar(ids, emitir) {
    ids.forEach(id => {
        const e = mapa.get(id);

        if (!e) return;

        mapa.delete(id);

        const i = elementos.indexOf(e);

        if (i >= 0) elementos.splice(i, 1);

        seleccion.delete(id);
    });

    capaSucia = true;

    actualizarUI();
    pedirPintado();

    if (emitir && ids.length) emitirOp({ op: "eliminar", ids });
}

function limpiarTodo() {
    const anteriores = elementos.slice();

    elementos.length = 0;
    mapa.clear();
    seleccion.clear();
    vivos.clear();

    vivoLocal = null;
    capaSucia = true;

    actualizarUI();
    pedirPintado();

    return anteriores;
}


/* ==================================================
   12. HISTORIAL (deshacer / rehacer)
================================================== */

function pushHist(a) {
    pilaDeshacer.push(a);

    if (pilaDeshacer.length > MAX_HISTORIAL) pilaDeshacer.shift();

    pilaRehacer.length = 0;

    actualizarUI();
}

function aplicarAccion(a, inversa) {
    switch (a.k) {
        case "add":
            if (inversa) opEliminar(a.els.map(e => e.id), true);
            else agregarLote(a.els.map(clonar), true);
            break;

        case "del":
            if (inversa) agregarLote(a.els.map(clonar), true);
            else opEliminar(a.els.map(e => e.id), true);
            break;

        case "mod":
            opReemplazar((inversa ? a.antes : a.despues).map(clonar), true);
            break;

        case "clear":
            if (inversa) {
                agregarLote(a.els.map(clonar), true);
            } else {
                limpiarTodo();
                socket.emit("limpiar-pizarra", salaPizarra);
            }
            break;
    }
}

function deshacer() {
    if (editor) cerrarEditor(true);

    const a = pilaDeshacer.pop();

    if (!a) return;

    aplicarAccion(a, true);

    pilaRehacer.push(a);

    actualizarUI();
}

function rehacer() {
    if (editor) cerrarEditor(true);

    const a = pilaRehacer.pop();

    if (!a) return;

    aplicarAccion(a, false);

    pilaDeshacer.push(a);

    actualizarUI();
}


/* ==================================================
   13. INTERFAZ (botones activos, habilitados, etc.)
================================================== */

function actualizarUI() {
    btnDeshacer.disabled = pilaDeshacer.length === 0;
    btnRehacer.disabled = pilaRehacer.length === 0;

    const hay = seleccion.size > 0;

    btnDuplicar.disabled = !hay;
    btnEliminar.disabled = !hay;
    btnVoltearH.disabled = !hay;
    btnVoltearV.disabled = !hay;
    tipoGiro.disabled = !hay;
}

function actualizarCursor() {
    canvas.dataset.herr = espacio ? "mano" : herramienta;
}

function activarHerramienta(nombre) {
    if (editor) cerrarEditor(true);

    if (accion) cancelarAccion();

    herramienta = nombre;

    Object.keys(botonesHerramienta).forEach(clave => {
        botonesHerramienta[clave].classList.toggle("activa", clave === nombre);
    });

    herramientaForma.classList.toggle("activa", nombre === "forma");
    tipoPincel.classList.toggle("activa", nombre === "lapiz");

    if (nombre !== "forma") {
        herramientaForma.value = "";
        formaActual = "";
    }

    if (nombre !== "seleccionar" && seleccion.size) {
        seleccion.clear();
        actualizarUI();
    }

    canvas.style.cursor = "";

    actualizarCursor();
    pedirPintado();
}

Object.keys(botonesHerramienta).forEach(clave => {
    botonesHerramienta[clave].addEventListener("click", () => {
        activarHerramienta(clave);
    });
});

tipoPincel.addEventListener("change", () => {
    pincelActual = tipoPincel.value;

    activarHerramienta("lapiz");
});

herramientaForma.addEventListener("change", () => {
    const valor = herramientaForma.value;

    if (!valor) {
        activarHerramienta("lapiz");
        return;
    }

    activarHerramienta("forma");

    herramientaForma.value = valor;
    formaActual = valor;

    herramientaForma.classList.add("activa");
});

btnRellenoForma.addEventListener("click", () => {
    rellenoForma = !rellenoForma;

    btnRellenoForma.classList.toggle("activa", rellenoForma);
});

botonesColores.forEach(boton => {
    boton.addEventListener("click", () => {
        colorActual = boton.dataset.color;
        colorLapiz.value = colorActual;

        botonesColores.forEach(b => b.classList.remove("seleccionado"));
        boton.classList.add("seleccionado");

        if (herramienta === "seleccionar") {
            aplicarEstiloSeleccion(e => {
                if (e.t === "borrador" || e.c === colorActual) return false;

                e.c = colorActual;
                return true;
            });
        }
    });
});

colorLapiz.addEventListener("input", () => {
    colorActual = colorLapiz.value;

    botonesColores.forEach(b => b.classList.remove("seleccionado"));
});

colorLapiz.addEventListener("change", () => {
    colorActual = colorLapiz.value;

    if (herramienta === "seleccionar") {
        aplicarEstiloSeleccion(e => {
            if (e.t === "borrador" || e.c === colorActual) return false;

            e.c = colorActual;
            return true;
        });
    }
});

grosorLapiz.addEventListener("input", () => {
    grosorActual = Number(grosorLapiz.value);
    valorGrosor.textContent = grosorActual + " px";
});

grosorLapiz.addEventListener("change", () => {
    if (herramienta !== "seleccionar") return;

    aplicarEstiloSeleccion(e => {
        if (e.t === "texto" || e.t === "borrador" || e.g === grosorActual) {
            return false;
        }

        e.g = grosorActual;
        return true;
    });
});

tamTexto.addEventListener("change", () => {
    tamTextoActual = Number(tamTexto.value) || 24;

    if (herramienta !== "seleccionar") return;

    aplicarEstiloSeleccion(e => {
        if (e.t !== "texto" || e.tam === tamTextoActual) return false;

        e.tam = tamTextoActual;
        return true;
    });
});

btnCuadricula.addEventListener("click", () => {
    verCuadricula = !verCuadricula;

    btnCuadricula.classList.toggle("activa", verCuadricula);

    pedirPintado();
});

btnRuedaZoom.addEventListener("click", () => {
    ruedaZoom = !ruedaZoom;

    btnRuedaZoom.classList.toggle("activa", ruedaZoom);

    avisar(
        ruedaZoom
            ? "La rueda del ratón ahora hace zoom"
            : "La rueda del ratón ahora mueve la pizarra"
    );
});

btnAyuda.addEventListener("click", () => {
    panelAyuda.hidden = !panelAyuda.hidden;

    btnAyuda.classList.toggle("activa", !panelAyuda.hidden);
});

btnDeshacer.addEventListener("click", deshacer);
btnRehacer.addEventListener("click", rehacer);

btnZoomMas.addEventListener("click", () => zoomEn(cam.z * 1.25, W / 2, H / 2));
btnZoomMenos.addEventListener("click", () => zoomEn(cam.z / 1.25, W / 2, H / 2));
btnZoomReset.addEventListener("click", () => zoomEn(1, W / 2, H / 2));
btnZoomAjustar.addEventListener("click", ajustarVista);


/* ==================================================
   14. EDICIÓN DE LA SELECCIÓN
================================================== */

// Cambia propiedades (color, grosor, tamaño) de lo seleccionado.
function aplicarEstiloSeleccion(fn) {
    const sel = elementosSeleccionados();

    if (!sel.length) return;

    const antes = sel.map(clonar);

    let cambio = false;

    sel.forEach(e => {
        if (fn(e)) {
            cambio = true;
            tocar(e);
        }
    });

    if (!cambio) return;

    const despues = sel.map(clonar);

    pushHist({ k: "mod", antes, despues });

    capaSucia = true;

    pedirPintado();

    emitirLotes("actualizar", despues);
}

function eliminarSeleccion() {
    const sel = elementosSeleccionados();

    if (!sel.length) return;

    pushHist({ k: "del", els: sel.map(clonar) });

    opEliminar(sel.map(e => e.id), true);
}

function copiarSeleccion() {
    const sel = elementosSeleccionados();

    if (!sel.length) return false;

    portapapeles = sel.map(clonar);
    desfasePegado = 0;

    return true;
}

function pegar() {
    if (!portapapeles.length) return;

    desfasePegado += 24;

    const nuevos = portapapeles.map(o => {
        const c = clonar(o);

        c.id = nuevoId();

        return mapear(c, (x, y) => [x + desfasePegado, y + desfasePegado], 1, 1);
    });

    agregarLote(nuevos, true);

    pushHist({ k: "add", els: nuevos.map(clonar) });

    if (herramienta !== "seleccionar") activarHerramienta("seleccionar");

    seleccion.clear();
    nuevos.forEach(e => seleccion.add(e.id));

    actualizarUI();
    pedirPintado();
}

function duplicarSeleccion() {
    if (!copiarSeleccion()) {
        avisar("Selecciona uno o más objetos primero");
        return;
    }

    pegar();
}

function transformarSeleccion(tipo) {
    const sel = elementosSeleccionados();

    if (!sel.length) {
        avisar("Selecciona uno o más objetos primero");
        return;
    }

    const b = limitesSeleccion();
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;

    const funciones = {
        "90": (x, y) => [cx - (y - cy), cy + (x - cx)],
        "180": (x, y) => [2 * cx - x, 2 * cy - y],
        "270": (x, y) => [cx + (y - cy), cy - (x - cx)],
        "h": (x, y) => [2 * cx - x, y],
        "v": (x, y) => [x, 2 * cy - y]
    };

    const f = funciones[tipo];

    if (!f) return;

    const antes = sel.map(clonar);
    const nuevos = sel.map(e => mapear(clonar(e), f, 1, 1));

    opReemplazar(nuevos, true);

    pushHist({ k: "mod", antes, despues: nuevos.map(clonar) });
}

tipoGiro.addEventListener("change", () => {
    if (tipoGiro.value) transformarSeleccion(tipoGiro.value);

    tipoGiro.value = "";
});

btnVoltearH.addEventListener("click", () => transformarSeleccion("h"));
btnVoltearV.addEventListener("click", () => transformarSeleccion("v"));
btnDuplicar.addEventListener("click", duplicarSeleccion);
btnEliminar.addEventListener("click", eliminarSeleccion);

function seleccionarTodo() {
    if (herramienta !== "seleccionar") activarHerramienta("seleccionar");

    seleccion.clear();

    elementos.forEach(e => {
        if (e.t !== "borrador") seleccion.add(e.id);
    });

    actualizarUI();
    pedirPintado();
}


/* ==================================================
   15. RELLENO (bote de pintura)
================================================== */

function aplicarRelleno(m) {
    for (let i = elementos.length - 1; i >= 0; i--) {
        const e = elementos[i];

        if (e.t === "borrador" || !dentroDeFigura(e, m.x, m.y)) continue;

        const antes = clonar(e);

        e.r = e.r === colorActual ? null : colorActual;

        tocar(e);

        const despues = clonar(e);

        pushHist({ k: "mod", antes: [antes], despues: [despues] });

        capaSucia = true;

        pedirPintado();

        emitirOp({ op: "actualizar", els: [despues] });

        return;
    }

    avisar("Haz clic dentro de una figura cerrada para rellenarla");
}


/* ==================================================
   16. TEXTO
================================================== */

function posicionarEditor() {
    if (!editor) return;

    const p = aPantalla(editor.x, editor.y);

    editorTexto.style.left = p.x + "px";
    editorTexto.style.top = p.y + "px";
    editorTexto.style.fontSize = editor.tam * cam.z + "px";
    editorTexto.style.color = editor.col;
}

function ajustarTamanoEditor() {
    editorTexto.style.width = "10px";
    editorTexto.style.height = "10px";

    editorTexto.style.width =
        Math.max(120, editorTexto.scrollWidth + 12) + "px";

    editorTexto.style.height =
        Math.max(editor ? editor.tam * cam.z * 1.25 : 20, editorTexto.scrollHeight) + "px";
}

function abrirEditor(m, existente) {
    if (editor) cerrarEditor(true);

    editor = {
        x: existente ? existente.x : m.x,
        y: existente ? existente.y : m.y,
        id: existente ? existente.id : null,
        tam: existente ? existente.tam : tamTextoActual,
        col: existente ? existente.c : colorActual
    };

    if (existente) {
        idOculto = existente.id;
        capaSucia = true;
        pedirPintado();
    }

    editorTexto.hidden = false;
    editorTexto.value = existente ? existente.txt : "";

    posicionarEditor();
    ajustarTamanoEditor();

    editorTexto.focus();
    editorTexto.select();
}

function cerrarEditor(guardar) {
    if (!editor) return;

    const ed = editor;
    const texto = editorTexto.value.replace(/\s+$/, "");

    editor = null;
    idOculto = null;

    editorTexto.hidden = true;

    if (guardar) {
        if (ed.id) {
            const e = mapa.get(ed.id);

            if (e) {
                if (!texto.trim()) {
                    pushHist({ k: "del", els: [clonar(e)] });
                    opEliminar([e.id], true);

                } else if (e.txt !== texto) {
                    const antes = clonar(e);

                    e.txt = texto;

                    tocar(e);

                    const despues = clonar(e);

                    pushHist({ k: "mod", antes: [antes], despues: [despues] });

                    emitirOp({ op: "actualizar", els: [despues] });
                }
            }

        } else if (texto.trim()) {
            const nuevo = {
                id: nuevoId(),
                t: "texto",
                x: ed.x,
                y: ed.y,
                txt: texto,
                tam: ed.tam,
                c: ed.col
            };

            agregarLocal(nuevo, true);

            pushHist({ k: "add", els: [clonar(nuevo)] });

            emitirLotes("agregar", [clonar(nuevo)]);
        }
    }

    capaSucia = true;

    pedirPintado();
}

editorTexto.addEventListener("input", ajustarTamanoEditor);

editorTexto.addEventListener("keydown", ev => {
    ev.stopPropagation();

    if (ev.key === "Escape") {
        ev.preventDefault();
        cerrarEditor(false);
    }

    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        cerrarEditor(true);
    }
});

editorTexto.addEventListener("blur", () => cerrarEditor(true));


/* ==================================================
   17. TRAZOS A MANO ALZADA Y BORRADOR
================================================== */

function iniciarTrazo(tipo, m) {
    let e;

    if (tipo === "borrador") {
        e = {
            id: nuevoId(),
            t: "borrador",
            g: Math.max(6, grosorActual * 3),
            pts: [m.x, m.y]
        };

        elementos.push(e);
        mapa.set(e.id, e);

        ponerTransformCapa();
        borrarTramo(cctx, e, 0);

    } else {
        e = {
            id: nuevoId(),
            t: "trazo",
            p: pincelActual,
            c: colorActual,
            g: grosorActual,
            s: Math.floor(Math.random() * 4294967295),
            pts: [m.x, m.y]
        };

        vivoLocal = e;
    }

    accion = {
        tipo: "dibujar",
        el: e,
        ultimo: m,
        pendientes: [],
        timer: null
    };

    emitirOp({ op: "inicio", el: clonar(e) });

    pedirPintado();
}

function vaciarPendientes() {
    if (!accion || accion.tipo !== "dibujar") return;

    accion.timer = null;

    if (accion.pendientes.length) {
        emitirOp({
            op: "pts",
            id: accion.el.id,
            pts: accion.pendientes
        });

        accion.pendientes = [];
    }
}

function moverTrazo(ev) {
    const a = accion;
    const e = a.el;

    const lista = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
    const eventos = lista.length ? lista : [ev];

    const antes = e.pts.length / 2;
    const minimo = 1.2 / cam.z;

    for (const evt of eventos) {
        const m = aMundo(posPantalla(evt));

        if (Math.hypot(m.x - a.ultimo.x, m.y - a.ultimo.y) < minimo) continue;

        e.pts.push(m.x, m.y);
        a.pendientes.push(m.x, m.y);
        a.ultimo = m;
    }

    if (e.pts.length / 2 === antes) return;

    tocar(e);

    if (e.t === "borrador") {
        ponerTransformCapa();
        borrarTramo(cctx, e, antes);
    }

    if (!a.timer) a.timer = setTimeout(vaciarPendientes, 45);

    pedirPintado();
}

function terminarTrazo() {
    const a = accion;
    const e = a.el;

    clearTimeout(a.timer);

    vaciarPendientes();

    if (e.t === "trazo") {
        vivoLocal = null;
        agregarLocal(e, true);
    }

    pushHist({ k: "add", els: [clonar(e)] });

    emitirOp({ op: "fin", id: e.id });

    tocar(e);
}


/* ==================================================
   18. FIGURAS
================================================== */

function crearForma(f, a, b, shift) {
    let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;

    if (shift) {
        if (f === "linea" || f === "flecha" || f === "flecha2") {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const L = Math.hypot(dx, dy);
            const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);

            x1 = x0 + L * Math.cos(ang);
            y1 = y0 + L * Math.sin(ang);

        } else {
            const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));

            x1 = x0 + (x1 - x0 < 0 ? -s : s);
            y1 = y0 + (y1 - y0 < 0 ? -s : s);
        }
    }

    const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    const cx = (xa + xb) / 2, cy = (ya + yb) / 2;

    const base = {
        id: nuevoId(),
        c: colorActual,
        g: grosorActual,
        r: rellenoForma ? colorActual : null
    };

    switch (f) {
        case "rectangulo":
            return Object.assign(base, {
                t: "poligono",
                pts: [xa, ya, xb, ya, xb, yb, xa, yb]
            });

        case "triangulo":
            return Object.assign(base, {
                t: "poligono",
                pts: [cx, ya, xb, yb, xa, yb]
            });

        case "rombo":
            return Object.assign(base, {
                t: "poligono",
                pts: [cx, ya, xb, cy, cx, yb, xa, cy]
            });

        case "estrella": {
            const rx = (xb - xa) / 2;
            const ry = (yb - ya) / 2;
            const pts = [];

            for (let i = 0; i < 10; i++) {
                const ang = -Math.PI / 2 + (i * Math.PI) / 5;
                const k = i % 2 ? 0.42 : 1;

                pts.push(cx + rx * k * Math.cos(ang), cy + ry * k * Math.sin(ang));
            }

            return Object.assign(base, { t: "poligono", pts });
        }

        case "circulo":
            return Object.assign(base, {
                t: "elipse",
                x0: xa, y0: ya, x1: xb, y1: yb
            });

        case "linea":
        case "flecha":
        case "flecha2":
            return {
                id: base.id,
                c: base.c,
                g: base.g,
                t: "linea",
                pts: [x0, y0, x1, y1],
                fl: f === "linea" ? 0 : f === "flecha" ? 1 : 2
            };
    }

    return null;
}

function formaValida(e) {
    const b = limites(e).geo;

    if (e.t === "linea") {
        return Math.hypot(b[2] - b[0], b[3] - b[1]) > 3 / cam.z;
    }

    return (b[2] - b[0]) > 2 / cam.z || (b[3] - b[1]) > 2 / cam.z;
}


/* ==================================================
   19. BORRAR OBJETOS COMPLETOS
================================================== */

function borrarEn(m) {
    const tol = 6 / cam.z;
    const ids = [];

    for (let i = elementos.length - 1; i >= 0; i--) {
        const e = elementos[i];

        if (e.t === "borrador" || !golpea(e, m.x, m.y, tol)) continue;

        accion.borrados.push(clonar(e));
        ids.push(e.id);
    }

    if (ids.length) opEliminar(ids, true);
}


/* ==================================================
   20. LÁSER
================================================== */

function miLaser() {
    let l = lasers.get("yo");

    if (!l) {
        l = { c: colorActual, pts: [] };
        lasers.set("yo", l);
    }

    l.c = colorActual;

    return l;
}


/* ==================================================
   21. PUNTEROS (mouse, lápiz táctil y dedos)
================================================== */

function manijaEn(p) {
    const b = limitesSeleccion();

    if (!b) return -1;

    const hs = manijas(b);

    for (let i = 0; i < hs.length; i++) {
        const s = aPantalla(hs[i][0], hs[i][1]);

        if (Math.hypot(s.x - p.x, s.y - p.y) <= 10) return i;
    }

    return -1;
}

function iniciarMover(m) {
    accion = {
        tipo: "mover",
        inicio: m,
        originales: elementosSeleccionados().map(clonar),
        timer: null,
        movido: false
    };
}

function seleccionarDown(ev, p, m) {
    const h = manijaEn(p);

    if (h >= 0) {
        accion = {
            tipo: "escalar",
            h,
            B: limitesSeleccion(),
            originales: elementosSeleccionados().map(clonar),
            timer: null,
            movido: false
        };

        return;
    }

    const tol = 6 / cam.z;
    const e = elementoEn(m.x, m.y, tol);

    if (e) {
        if (ev.shiftKey) {
            if (seleccion.has(e.id)) {
                seleccion.delete(e.id);
                actualizarUI();
                pedirPintado();
                return;
            }

            seleccion.add(e.id);

        } else if (!seleccion.has(e.id)) {
            seleccion.clear();
            seleccion.add(e.id);
        }

        actualizarUI();
        iniciarMover(m);
        pedirPintado();

        return;
    }

    const base = ev.shiftKey ? new Set(seleccion) : new Set();

    if (!ev.shiftKey) seleccion.clear();

    accion = { tipo: "marco", a: m, b: m, base };

    actualizarUI();
    pedirPintado();
}

function aplicarMovimiento(f, sx, sy) {
    const a = accion;

    a.movido = true;

    const nuevos = a.originales.map(o => mapear(clonar(o), f, sx, sy));

    nuevos.forEach(reemplazarLocal);

    capaSucia = true;

    if (!a.timer) {
        a.timer = setTimeout(() => {
            a.timer = null;

            emitirLotes(
                "actualizar",
                elementosSeleccionados().map(clonar)
            );
        }, 70);
    }

    pedirPintado();
}

canvas.addEventListener("pointerdown", ev => {
    if (editor) {
        cerrarEditor(true);
        return;
    }

    const p = posPantalla(ev);

    punteros.set(ev.pointerId, { x: p.x, y: p.y });

    canvas.setPointerCapture(ev.pointerId);

    // Dos dedos: mover y hacer zoom
    if (ev.pointerType === "touch" && punteros.size === 2) {
        iniciarPinch();
        return;
    }

    if (punteros.size > 1 || accion) return;

    const m = aMundo(p);

    const mover =
        ev.button === 1 ||
        ev.button === 2 ||
        espacio ||
        herramienta === "mano";

    if (mover) {
        ev.preventDefault();

        accion = { tipo: "pan", sx: p.x, sy: p.y, cx: cam.x, cy: cam.y };

        canvas.classList.add("agarrando");

        return;
    }

    if (ev.pointerType === "mouse" && ev.button !== 0) return;

    switch (herramienta) {
        case "lapiz":
            iniciarTrazo("trazo", m);
            break;

        case "borrador":
            iniciarTrazo("borrador", m);
            break;

        case "forma":
            if (formaActual) {
                accion = { tipo: "forma", a: m, b: m, prev: null };
            }
            break;

        case "relleno":
            aplicarRelleno(m);
            break;

        case "texto":
            ev.preventDefault();
            abrirEditor(m, null);
            break;

        case "laser": {
            accion = { tipo: "laser", ult: 0 };

            miLaser().pts.push({ x: m.x, y: m.y, t: performance.now() });

            pedirPintado();
            break;
        }

        case "borrarObjeto":
            accion = { tipo: "borrarObj", borrados: [] };
            borrarEn(m);
            break;

        case "seleccionar":
            seleccionarDown(ev, p, m);
            break;
    }
});

function hover(p, m) {
    if (herramienta === "seleccionar" && !espacio) {
        const h = manijaEn(p);

        if (h >= 0) {
            canvas.style.cursor = CURSORES_MANIJA[h];

        } else if (elementoEn(m.x, m.y, 6 / cam.z)) {
            canvas.style.cursor = "move";

        } else {
            canvas.style.cursor = "";
        }
    }

    if (herramienta === "borrador" || herramienta === "borrarObjeto") {
        pedirPintado();
    }
}

canvas.addEventListener("pointermove", ev => {
    const p = posPantalla(ev);

    if (punteros.has(ev.pointerId)) {
        punteros.set(ev.pointerId, { x: p.x, y: p.y });
    }

    if (pinch && punteros.size >= 2) {
        moverPinch();
        return;
    }

    const m = aMundo(p);

    cursorMundo = m;

    if (!accion) {
        hover(p, m);
        return;
    }

    const a = accion;

    switch (a.tipo) {
        case "pan":
            cam.x = a.cx + (p.x - a.sx);
            cam.y = a.cy + (p.y - a.sy);

            camaraCambio();
            break;

        case "dibujar":
            moverTrazo(ev);
            break;

        case "forma":
            a.b = m;
            a.prev = crearForma(formaActual, a.a, m, ev.shiftKey);

            pedirPintado();
            break;

        case "mover":
            aplicarMovimiento(
                (x, y) => [x + (m.x - a.inicio.x), y + (m.y - a.inicio.y)],
                1, 1
            );
            break;

        case "escalar": {
            const [x0, y0, x1, y1] = a.B;
            const ow = Math.max(x1 - x0, 1);
            const oh = Math.max(y1 - y0, 1);
            const hx = HX[a.h];
            const hy = HY[a.h];

            const ax = hx > 0 ? x0 : x1;
            const ay = hy > 0 ? y0 : y1;

            let sx = 1;
            let sy = 1;

            if (hx !== 0) sx = (hx > 0 ? m.x - x0 : x1 - m.x) / ow;
            if (hy !== 0) sy = (hy > 0 ? m.y - y0 : y1 - m.y) / oh;

            if (ev.shiftKey && hx !== 0 && hy !== 0) {
                const k = Math.max(Math.abs(sx), Math.abs(sy));

                sx = (sx < 0 ? -1 : 1) * k;
                sy = (sy < 0 ? -1 : 1) * k;
            }

            if (Math.abs(sx) < 0.02) sx = sx < 0 ? -0.02 : 0.02;
            if (Math.abs(sy) < 0.02) sy = sy < 0 ? -0.02 : 0.02;

            aplicarMovimiento(
                (x, y) => [ax + (x - ax) * sx, ay + (y - ay) * sy],
                sx, sy
            );

            break;
        }

        case "marco":
            a.b = m;
            pedirPintado();
            break;

        case "borrarObj":
            borrarEn(m);
            break;

        case "laser": {
            miLaser().pts.push({ x: m.x, y: m.y, t: performance.now() });

            const t = performance.now();

            if (t - a.ult > 30) {
                a.ult = t;

                emitirOp({
                    op: "laser",
                    x: m.x,
                    y: m.y,
                    c: colorActual,
                    u: usuarioPizarra || "anon"
                });
            }

            pedirPintado();
            break;
        }
    }
});

// Termina la acción actual guardándola en el historial.
function finalizarAccion() {
    const a = accion;

    if (!a) return;

    accion = null;

    canvas.classList.remove("agarrando");

    switch (a.tipo) {
        case "dibujar":
            accion = a;
            terminarTrazo();
            accion = null;
            break;

        case "forma": {
            if (!a.prev || !formaValida(a.prev)) break;

            const e = a.prev;

            agregarLocal(e, true);

            pushHist({ k: "add", els: [clonar(e)] });

            emitirLotes("agregar", [clonar(e)]);

            break;
        }

        case "mover":
        case "escalar": {
            clearTimeout(a.timer);

            if (!a.movido) break;

            const despues = elementosSeleccionados().map(clonar);

            pushHist({ k: "mod", antes: a.originales, despues });

            emitirLotes("actualizar", despues);

            break;
        }

        case "marco": {
            const rect = [
                Math.min(a.a.x, a.b.x), Math.min(a.a.y, a.b.y),
                Math.max(a.a.x, a.b.x), Math.max(a.a.y, a.b.y)
            ];

            if (rect[2] - rect[0] > 3 / cam.z || rect[3] - rect[1] > 3 / cam.z) {
                a.base.forEach(id => seleccion.add(id));

                elementos.forEach(e => {
                    if (e.t !== "borrador" && intersecta(limites(e).sel, rect)) {
                        seleccion.add(e.id);
                    }
                });
            }

            actualizarUI();

            break;
        }

        case "borrarObj":
            if (a.borrados.length) {
                pushHist({ k: "del", els: a.borrados });
            }
            break;

        case "laser":
            emitirOp({ op: "laser", fin: true, u: usuarioPizarra || "anon" });
            break;
    }

    pedirPintado();
}

// Cancela la acción actual sin guardar nada.
function cancelarAccion() {
    const a = accion;

    if (!a) return;

    if (a.tipo === "dibujar") {
        if (a.el.t === "borrador") {
            finalizarAccion();
            return;
        }

        clearTimeout(a.timer);

        vivoLocal = null;

        emitirOp({ op: "cancelar", id: a.el.id });

    } else if (a.tipo === "mover" || a.tipo === "escalar") {
        clearTimeout(a.timer);

        a.originales.forEach(o => reemplazarLocal(clonar(o)));

        emitirLotes("actualizar", a.originales.map(clonar));

        capaSucia = true;

    } else if (a.tipo === "borrarObj") {
        finalizarAccion();
        return;
    }

    accion = null;

    canvas.classList.remove("agarrando");

    pedirPintado();
}

function soltar(ev) {
    punteros.delete(ev.pointerId);

    if (pinch) {
        if (punteros.size < 2) {
            pinch = null;
            accion = null;
        }

        return;
    }

    finalizarAccion();
}

canvas.addEventListener("pointerup", soltar);
canvas.addEventListener("pointercancel", soltar);

canvas.addEventListener("pointerleave", () => {
    if (!accion) {
        cursorMundo = null;
        pedirPintado();
    }
});

canvas.addEventListener("contextmenu", ev => ev.preventDefault());

// Doble clic: editar un texto, o crear uno nuevo con la herramienta Seleccionar.
canvas.addEventListener("dblclick", ev => {
    const m = aMundo(posPantalla(ev));
    const e = elementoEn(m.x, m.y, 6 / cam.z);

    if (e && e.t === "texto") {
        abrirEditor(m, e);

    } else if (!e && herramienta === "seleccionar") {
        abrirEditor(m, null);
    }
});


/* ---------- Gestos con dos dedos ---------- */

function iniciarPinch() {
    cancelarAccion();

    const [a, b] = Array.from(punteros.values());

    pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        z: cam.z,
        camx: cam.x,
        camy: cam.y
    };

    accion = { tipo: "pinch" };
}

function moverPinch() {
    const [a, b] = Array.from(punteros.values());

    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;

    const z = clamp(pinch.z * (d / pinch.d), ZOOM_MIN, ZOOM_MAX);

    const wx = (pinch.cx - pinch.camx) / pinch.z;
    const wy = (pinch.cy - pinch.camy) / pinch.z;

    cam.z = z;
    cam.x = cx - wx * z;
    cam.y = cy - wy * z;

    camaraCambio();
}


/* ---------- Rueda del ratón / trackpad ---------- */

canvas.addEventListener("wheel", ev => {
    ev.preventDefault();

    const p = posPantalla(ev);

    let dx = ev.deltaX;
    let dy = ev.deltaY;

    if (ev.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
    }

    if (ev.ctrlKey || ev.metaKey || ruedaZoom) {
        const factor = Math.abs(dy) >= 40
            ? (dy < 0 ? 1.12 : 1 / 1.12)
            : Math.exp(-dy * 0.01);

        zoomEn(cam.z * factor, p.x, p.y);

        return;
    }

    if (ev.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
    }

    cam.x -= dx;
    cam.y -= dy;

    camaraCambio();

}, { passive: false });


/* ==================================================
   22. LIMPIAR PIZARRA (con confirmación propia)
================================================== */

btnLimpiar.addEventListener("click", () => {
    if (!elementos.length) {
        avisar("La pizarra ya está vacía");
        return;
    }

    modalLimpiar.hidden = false;

    btnCancelarLimpiar.focus();
});

btnCancelarLimpiar.addEventListener("click", () => {
    modalLimpiar.hidden = true;
});

btnConfirmarLimpiar.addEventListener("click", () => {
    modalLimpiar.hidden = true;

    if (editor) cerrarEditor(false);

    const anteriores = limpiarTodo();

    if (anteriores.length) {
        pushHist({ k: "clear", els: anteriores.map(clonar) });
    }

    socket.emit("limpiar-pizarra", salaPizarra);

    avisar("Pizarra limpiada · puedes deshacer con Ctrl+Z");
});

modalLimpiar.addEventListener("click", ev => {
    if (ev.target === modalLimpiar) modalLimpiar.hidden = true;
});


/* ==================================================
   23. EXPORTAR A PNG
================================================== */

function exportarPNG() {
    const visibles = elementos.filter(e => e.t !== "borrador");

    if (!visibles.length) {
        avisar("No hay nada que exportar");
        return;
    }

    const b = unirLimites(visibles.map(e => limites(e).dib));
    const margen = 40;

    const x0 = b[0] - margen;
    const y0 = b[1] - margen;
    const w = b[2] - b[0] + margen * 2;
    const h = b[3] - b[1] + margen * 2;

    let escala = Math.min(2, 4096 / Math.max(w, h));

    escala = Math.min(escala, Math.sqrt(16000000 / (w * h)));

    const ancho = Math.max(1, Math.ceil(w * escala));
    const alto = Math.max(1, Math.ceil(h * escala));

    const capaTemp = document.createElement("canvas");
    const final = document.createElement("canvas");

    capaTemp.width = final.width = ancho;
    capaTemp.height = final.height = alto;

    const c1 = capaTemp.getContext("2d");
    const c2 = final.getContext("2d");

    c1.setTransform(escala, 0, 0, escala, -x0 * escala, -y0 * escala);

    elementos.forEach(e => dibujarElemento(c1, e));

    c2.fillStyle = "#ffffff";
    c2.fillRect(0, 0, ancho, alto);
    c2.drawImage(capaTemp, 0, 0);

    final.toBlob(blob => {
        if (!blob) {
            avisar("No se pudo crear la imagen");
            return;
        }

        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");

        enlace.href = url;
        enlace.download = `pizarra-${salaPizarra || "sala"}.png`;

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => URL.revokeObjectURL(url), 2000);

    }, "image/png");
}

btnExportar.addEventListener("click", exportarPNG);


/* ==================================================
   24. TECLADO
================================================== */

document.addEventListener("keydown", ev => {
    const t = ev.target;

    const tipoInput = t && t.tagName === "INPUT" ? t.type : "";

    const campoTexto =
        t && (
            t.tagName === "TEXTAREA" ||
            t.isContentEditable ||
            (t.tagName === "INPUT" &&
                !["range", "color", "checkbox", "button", "radio"].includes(tipoInput))
        );

    if (campoTexto) return;

    const campoControl =
        t && (t.tagName === "SELECT" || tipoInput === "range");

    const mod = ev.ctrlKey || ev.metaKey;

    if (campoControl && !mod && ev.key !== "Escape") return;

    const tecla = ev.key.toLowerCase();

    if (ev.key === " ") {
        if (!espacio) {
            espacio = true;
            actualizarCursor();
        }

        ev.preventDefault();
        return;
    }

    if (mod) {
        switch (tecla) {
            case "z":
                ev.preventDefault();
                ev.shiftKey ? rehacer() : deshacer();
                return;

            case "y":
                ev.preventDefault();
                rehacer();
                return;

            case "a":
                ev.preventDefault();
                seleccionarTodo();
                return;

            case "c":
                if (copiarSeleccion()) ev.preventDefault();
                return;

            case "x":
                if (copiarSeleccion()) {
                    ev.preventDefault();
                    eliminarSeleccion();
                }
                return;

            case "v":
                if (portapapeles.length) {
                    ev.preventDefault();
                    pegar();
                }
                return;

            case "d":
                ev.preventDefault();
                duplicarSeleccion();
                return;
        }

        return;
    }

    switch (ev.key) {
        case "Delete":
        case "Backspace":
            if (seleccion.size) {
                ev.preventDefault();
                eliminarSeleccion();
            }
            return;

        case "Escape":
            if (!modalLimpiar.hidden) {
                modalLimpiar.hidden = true;

            } else if (accion) {
                cancelarAccion();

            } else if (seleccion.size) {
                seleccion.clear();
                actualizarUI();
                pedirPintado();

            } else if (herramienta === "forma") {
                activarHerramienta("lapiz");
            }
            return;

        case "+":
        case "=":
            zoomEn(cam.z * 1.25, W / 2, H / 2);
            return;

        case "-":
        case "_":
            zoomEn(cam.z / 1.25, W / 2, H / 2);
            return;

        case "0":
            zoomEn(1, W / 2, H / 2);
            return;

        case "1":
            ajustarVista();
            return;

        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
            ev.preventDefault();

            const paso = ev.shiftKey ? 5 : 1;

            const dx = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
            const dy = ev.key === "ArrowUp" ? -1 : ev.key === "ArrowDown" ? 1 : 0;

            if (seleccion.size) {
                const sel = elementosSeleccionados();
                const antes = sel.map(clonar);
                const mx = dx * paso * 4;
                const my = dy * paso * 4;

                const nuevos = sel.map(e =>
                    mapear(clonar(e), (x, y) => [x + mx, y + my], 1, 1)
                );

                opReemplazar(nuevos, true);

                pushHist({ k: "mod", antes, despues: nuevos.map(clonar) });

            } else {
                cam.x -= dx * 60 * paso;
                cam.y -= dy * 60 * paso;

                camaraCambio();
            }

            return;
        }
    }

    const atajos = {
        v: "seleccionar",
        h: "mano",
        p: "lapiz",
        e: "borrador",
        d: "borrarObjeto",
        t: "texto",
        b: "relleno",
        l: "laser"
    };

    if (atajos[tecla]) activarHerramienta(atajos[tecla]);
});

document.addEventListener("keyup", ev => {
    if (ev.key === " ") {
        espacio = false;
        actualizarCursor();
    }
});

window.addEventListener("blur", () => {
    espacio = false;
    actualizarCursor();
});


/* ==================================================
   25. SINCRONIZACIÓN: RECIBIR DE OTROS USUARIOS
================================================== */

let miPeticion = null;

const peticionesAtendidas = new Set();
const respuestasPendientes = new Map();

function pedirEstado() {
    miPeticion = nuevoId();

    emitirOp({ op: "pedir-estado", rid: miPeticion });
}

function programarRespuesta(rid) {
    if (!elementos.length || peticionesAtendidas.has(rid)) return;

    // Espera un tiempo aleatorio: solo contesta quien llegue primero.
    const tm = setTimeout(() => {
        respuestasPendientes.delete(rid);

        if (peticionesAtendidas.has(rid)) return;

        peticionesAtendidas.add(rid);

        enviarEstado(rid);

    }, 150 + Math.random() * 850);

    respuestasPendientes.set(rid, tm);
}

function enviarEstado(rid) {
    const todos = elementos.map(clonar);

    const lotes = [];

    let lote = [];
    let tam = 0;

    for (const e of todos) {
        const largo = JSON.stringify(e).length;

        if (tam + largo > TAM_MAX_LOTE && lote.length) {
            lotes.push(lote);
            lote = [];
            tam = 0;
        }

        lote.push(e);
        tam += largo;
    }

    if (lote.length) lotes.push(lote);

    lotes.forEach((l, i) => {
        setTimeout(() => {
            emitirOp({ op: "estado", rid, els: l });
        }, i * 30);
    });
}

function recibir(t) {
    switch (t.op) {

        case "inicio": {
            const e = t.el;

            if (!e || !e.id) return;

            if (e.t === "borrador") {
                if (mapa.has(e.id)) return;

                elementos.push(e);
                mapa.set(e.id, e);

                ponerTransformCapa();
                borrarTramo(cctx, e, 0);

            } else {
                vivos.set(e.id, { el: e, ts: Date.now() });
            }

            pedirPintado();
            break;
        }

        case "pts": {
            const v = vivos.get(t.id);

            if (v) {
                v.el.pts.push(...t.pts);
                v.ts = Date.now();
                tocar(v.el);

            } else {
                const e = mapa.get(t.id);

                if (e && e.t === "borrador") {
                    const antes = e.pts.length / 2;

                    e.pts.push(...t.pts);
                    tocar(e);

                    ponerTransformCapa();
                    borrarTramo(cctx, e, antes);
                }
            }

            pedirPintado();
            break;
        }

        case "fin": {
            const v = vivos.get(t.id);

            if (v) {
                vivos.delete(t.id);
                tocar(v.el);
                agregarLocal(v.el, true);
            }

            break;
        }

        case "cancelar":
            vivos.delete(t.id);
            pedirPintado();
            break;

        case "agregar":
            agregarLote(t.els || [], false);
            break;

        case "actualizar":
            opReemplazar(t.els || [], false);
            break;

        case "eliminar":
            opEliminar(t.ids || [], false);
            break;

        case "laser": {
            const clave = t.u || "anon";

            if (t.fin) return;

            let l = lasers.get(clave);

            if (!l) {
                l = { c: t.c || "#ef4444", pts: [] };
                lasers.set(clave, l);
            }

            l.c = t.c || l.c;
            l.pts.push({ x: t.x, y: t.y, t: performance.now() });

            pedirPintado();
            break;
        }

        case "pedir-estado":
            if (t.rid && t.rid !== miPeticion) programarRespuesta(t.rid);
            break;

        case "estado": {
            if (!t.rid) return;

            peticionesAtendidas.add(t.rid);

            clearTimeout(respuestasPendientes.get(t.rid));

            (t.els || []).forEach(e => {
                if (!mapa.has(e.id)) {
                    elementos.push(e);
                    mapa.set(e.id, e);
                }
            });

            capaSucia = true;

            pedirPintado();
            break;
        }
    }
}

socket.on("nuevo-trazo", datos => {
    const t = datos && datos.trazo;

    if (!t || t.v !== 2) return;

    recibir(t);
});

socket.on("pizarra-limpiada", () => {
    if (editor) cerrarEditor(false);

    limpiarTodo();
});

// Al entrar (o reconectar) a la sala, pide lo que ya está dibujado.
socket.on("sala-unida", () => {
    setTimeout(pedirEstado, 500);
});


/* ==================================================
   26. INICIO
================================================== */

function iniciarPizarra() {
    redimensionar();

    activarHerramienta("lapiz");

    btnCuadricula.classList.toggle("activa", verCuadricula);

    valorZoom.textContent = "100%";

    actualizarUI();
    pedirPintado();
}

if (window.ResizeObserver && contenedorCanvas) {
    new ResizeObserver(redimensionar).observe(contenedorCanvas);
}

window.addEventListener("resize", redimensionar);

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarPizarra, { once: true });
} else {
    iniciarPizarra();
}

})();