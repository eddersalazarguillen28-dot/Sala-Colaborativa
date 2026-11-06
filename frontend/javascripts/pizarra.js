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
   2. VARIABLES
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
   3. CONFIGURACIÓN DEL CANVAS
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

// Inicializar según el tamaño disponible
const rectInicial = canvas.getBoundingClientRect();

configurarCanvas(
    Math.max(1, Math.round(rectInicial.width || 900)),
    Math.max(1, Math.round(rectInicial.height || 550))
);


/* ==================================================
   4. POSICIÓN DEL PUNTERO
================================================== */

function obtenerPosicion(evento) {

    const rect = canvas.getBoundingClientRect();

    return {
        x: (evento.clientX - rect.left) / zoomActual,
        y: (evento.clientY - rect.top) / zoomActual
    };

}


/* ==================================================
   5. COLORES
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


/* ==================================================
   6. GROSOR
================================================== */

grosorLapiz.addEventListener("input", function() {

    grosorActual = Number(grosorLapiz.value);

    valorGrosor.textContent = grosorActual + " px";

});


/* ==================================================
   7. HISTORIAL: DESHACER Y REHACER
================================================== */

function obtenerEstado() {

    return {
        imagen: ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        ),
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

    btnRehacer.disabled =
        indiceHistorial >= historial.length - 1;

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

    btnLapiz.classList.toggle(
        "activa",
        nombre === "lapiz"
    );

    btnBorrador.classList.toggle(
        "activa",
        nombre === "borrador"
    );

    btnRellenar.classList.toggle(
        "activa",
        nombre === "relleno"
    );

    btnTexto.classList.toggle(
        "activa",
        nombre === "texto"
    );

    canvas.classList.toggle(
        "seleccion-activa",
        nombre === "seleccion"
    );

    canvas.classList.toggle(
        "texto-activo",
        nombre === "texto"
    );

    canvas.style.cursor =
        nombre === "borrador" ? "cell" :
        nombre === "texto" ? "text" :
        "crosshair";

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

    formaActual = "";
    modoSeleccion = "";

    herramientaForma.value = "";
    tipoSeleccion.value = "";

    activarHerramienta("lapiz");

});

herramientaForma.addEventListener("change", function() {

    formaActual = herramientaForma.value;

    modoSeleccion = "";
    tipoSeleccion.value = "";

    activarHerramienta(
        formaActual ? "forma" : "lapiz"
    );

});

tipoSeleccion.addEventListener("change", function() {

    modoSeleccion = tipoSeleccion.value;

    formaActual = "";
    herramientaForma.value = "";

    activarHerramienta(
        modoSeleccion ? "seleccion" : "lapiz"
    );

});


/* ==================================================
   9. PINCELES
================================================== */

function aplicarPincel(inicio, fin) {

    ctx.save();

    ctx.strokeStyle = colorActual;
    ctx.fillStyle = colorActual;

    ctx.lineWidth = grosorActual;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const dx = fin.x - inicio.x;
    const dy = fin.y - inicio.y;

    switch (pincelActual) {

        // LÁPIZ CLÁSICO
        case "lapiz":

            ctx.globalAlpha = 1;
            ctx.lineWidth = grosorActual;

            dibujarTrazo(inicio, fin);

            break;

        // PINCEL CLÁSICO
        case "pincel":

            ctx.globalAlpha = 0.9;
            ctx.lineWidth = grosorActual * 2.5;

            dibujarTrazo(inicio, fin);

            break;

        // AERÓGRAFO
        case "aerografo": {

            const distancia = Math.hypot(dx, dy);

            const cantidad = Math.max(
                10,
                Math.floor(distancia * 1.5)
            );

            for (let i = 0; i < cantidad; i++) {

                const t = Math.random();

                const x = inicio.x + dx * t;
                const y = inicio.y + dy * t;

                const angulo = Math.random() * Math.PI * 2;

                const radio = Math.random() * grosorActual * 2.5;

                ctx.globalAlpha = 0.08;

                ctx.beginPath();

                ctx.arc(
                    x + Math.cos(angulo) * radio,
                    y + Math.sin(angulo) * radio,
                    Math.max(0.5, grosorActual / 5),
                    0,
                    Math.PI * 2
                );

                ctx.fill();

            }

            break;
        }

        // ACUARELA
        case "acuarela":

            ctx.globalAlpha = 0.18;
            ctx.lineWidth = grosorActual * 4;

            dibujarTrazo(inicio, fin);

            ctx.globalAlpha = 0.12;
            ctx.lineWidth = grosorActual * 2;

            dibujarTrazo(inicio, fin);

            break;

        // ÓLEO
        case "oleo":

            ctx.globalAlpha = 1;
            ctx.lineWidth = grosorActual * 2;

            dibujarTrazo(inicio, fin);

            ctx.globalAlpha = 0.25;
            ctx.lineWidth = grosorActual / 2;

            dibujarTrazo(inicio, fin);

            break;

        // MARCADOR
        case "marcador":

            ctx.globalAlpha = 0.4;
            ctx.lineWidth = grosorActual * 3;

            dibujarTrazo(inicio, fin);

            break;

        // CRAYÓN
        case "crayon": {

            ctx.globalAlpha = 0.65;
            ctx.lineWidth = grosorActual;

            dibujarTrazo(inicio, fin);

            const distancia = Math.hypot(dx, dy);

            const cantidad = Math.max(
                3,
                Math.floor(distancia)
            );

            for (let i = 0; i < cantidad; i++) {

                const t = Math.random();

                const x = inicio.x + dx * t;
                const y = inicio.y + dy * t;

                ctx.globalAlpha = 0.25;

                ctx.fillRect(
                    x + (Math.random() - 0.5) * grosorActual * 2,
                    y + (Math.random() - 0.5) * grosorActual * 2,
                    1.5,
                    1.5
                );

            }

            break;
        }

    }

    ctx.restore();

}

function dibujarTrazo(inicio, fin) {

    ctx.beginPath();

    ctx.moveTo(inicio.x, inicio.y);

    ctx.lineTo(fin.x, fin.y);

    ctx.stroke();

}


/* ==================================================
   10. FORMAS GEOMÉTRICAS
================================================== */

function dibujarForma(inicio, fin) {

    const x = inicio.x;
    const y = inicio.y;

    const ancho = fin.x - x;
    const alto = fin.y - y;

    const centroX = x + ancho / 2;
    const centroY = y + alto / 2;

    ctx.save();

    ctx.beginPath();

    ctx.strokeStyle = colorActual;
    ctx.lineWidth = grosorActual;

    switch (formaActual) {

        // RECTÁNGULO
        case "rectangulo":

            ctx.rect(x, y, ancho, alto);

            break;

        // CÍRCULO / ELIPSE
        case "circulo":

            ctx.ellipse(
                centroX,
                centroY,
                Math.abs(ancho) / 2,
                Math.abs(alto) / 2,
                0,
                0,
                Math.PI * 2
            );

            break;

        // LÍNEA
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

            const longitud = 15 + grosorActual * 2;

            ctx.moveTo(x, y);
            ctx.lineTo(fin.x, fin.y);

            ctx.moveTo(
                fin.x - longitud * Math.cos(angulo - Math.PI / 6),
                fin.y - longitud * Math.sin(angulo - Math.PI / 6)
            );

            ctx.lineTo(fin.x, fin.y);

            ctx.lineTo(
                fin.x - longitud * Math.cos(angulo + Math.PI / 6),
                fin.y - longitud * Math.sin(angulo + Math.PI / 6)
            );

            break;
        }

    }

    ctx.stroke();

    ctx.restore();

}


/* ==================================================
   11. BORRADOR
================================================== */

function borrarTrazo(inicio, fin) {

    ctx.save();

    ctx.globalCompositeOperation = "destination-out";

    ctx.beginPath();

    ctx.moveTo(inicio.x, inicio.y);

    ctx.lineTo(fin.x, fin.y);

    ctx.lineWidth = grosorActual * 3;

    ctx.lineCap = "round";

    ctx.stroke();

    ctx.restore();

}


/* ==================================================
   12. TEXTO
================================================== */

btnTexto.addEventListener("click", function() {

    modoTexto = !modoTexto;

    activarHerramienta(
        modoTexto ? "texto" : "lapiz"
    );

});

function insertarTexto(x, y) {

    const texto = prompt("Escribe el texto:");

    if (!texto || !texto.trim()) return;

    const tamano = Number(
        prompt("Tamaño de letra:", "24")
    );

    if (!Number.isFinite(tamano) || tamano < 6 || tamano > 200) {

        alert("El tamaño debe estar entre 6 y 200.");

        return;

    }

    guardarHistorial();

    ctx.save();

    ctx.fillStyle = colorActual;
    ctx.font = `${tamano}px Arial`;
    ctx.textBaseline = "top";

    ctx.fillText(texto, x, y);

    ctx.restore();

    guardarHistorial();

}


/* ==================================================
   13. BOTE DE PINTURA
================================================== */

btnRellenar.addEventListener("click", function() {

    modoRelleno = !modoRelleno;

    activarHerramienta(
        modoRelleno ? "relleno" : "lapiz"
    );

});

function rellenarArea(x, y) {

    const px = Math.floor(x * dpr);
    const py = Math.floor(y * dpr);

    if (
        px < 0 || py < 0 ||
        px >= canvas.width || py >= canvas.height
    ) return;

    const imagen = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const datos = imagen.data;

    const ancho = canvas.width;
    const alto = canvas.height;

    const inicio = (py * ancho + px) * 4;

    const objetivo = [
        datos[inicio],
        datos[inicio + 1],
        datos[inicio + 2],
        datos[inicio + 3]
    ];

    const nuevo = [
        parseInt(colorActual.slice(1, 3), 16),
        parseInt(colorActual.slice(3, 5), 16),
        parseInt(colorActual.slice(5, 7), 16),
        255
    ];

    const tolerancia = 30;

    if (
        objetivo.every((valor, i) =>
            Math.abs(valor - nuevo[i]) <= tolerancia
        )
    ) return;

    const visitados = new Uint8Array(ancho * alto);

    const pila = [py * ancho + px];

    function coincide(indice) {

        return (
            Math.abs(datos[indice] - objetivo[0]) <= tolerancia &&
            Math.abs(datos[indice + 1] - objetivo[1]) <= tolerancia &&
            Math.abs(datos[indice + 2] - objetivo[2]) <= tolerancia &&
            Math.abs(datos[indice + 3] - objetivo[3]) <= tolerancia
        );

    }

    while (pila.length > 0) {

        const posicion = pila.pop();

        if (
            posicion < 0 ||
            posicion >= ancho * alto ||
            visitados[posicion]
        ) continue;

        visitados[posicion] = 1;

        const indice = posicion * 4;

        if (!coincide(indice)) continue;

        datos[indice] = nuevo[0];
        datos[indice + 1] = nuevo[1];
        datos[indice + 2] = nuevo[2];
        datos[indice + 3] = nuevo[3];

        const fila = Math.floor(posicion / ancho);
        const columna = posicion % ancho;

        if (columna > 0) pila.push(posicion - 1);
        if (columna < ancho - 1) pila.push(posicion + 1);
        if (fila > 0) pila.push(posicion - ancho);
        if (fila < alto - 1) pila.push(posicion + ancho);

    }

    ctx.putImageData(imagen, 0, 0);

}


/* ==================================================
   14. SELECCIÓN RECTANGULAR Y LIBRE
================================================== */

function dibujarSeleccion() {

    if (!seleccion) return;

    ctx.save();

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    if (modoSeleccion === "rectangular") {

        ctx.strokeRect(
            seleccion.x,
            seleccion.y,
            seleccion.ancho,
            seleccion.alto
        );

    } else if (modoSeleccion === "libre" && puntosSeleccion.length > 1) {

        ctx.beginPath();

        ctx.moveTo(
            puntosSeleccion[0].x,
            puntosSeleccion[0].y
        );

        for (let i = 1; i < puntosSeleccion.length; i++) {

            ctx.lineTo(
                puntosSeleccion[i].x,
                puntosSeleccion[i].y
            );

        }

        ctx.stroke();

    }

    ctx.restore();

}

function obtenerLimitesSeleccion() {

    if (!seleccion) return null;

    if (modoSeleccion === "rectangular") {

        const x = Math.min(
            seleccion.x,
            seleccion.x + seleccion.ancho
        );

        const y = Math.min(
            seleccion.y,
            seleccion.y + seleccion.alto
        );

        return {
            x,
            y,
            ancho: Math.abs(seleccion.ancho),
            alto: Math.abs(seleccion.alto)
        };

    }

    if (
        modoSeleccion === "libre" &&
        puntosSeleccion.length >= 3
    ) {

        const xs = puntosSeleccion.map(p => p.x);
        const ys = puntosSeleccion.map(p => p.y);

        const x = Math.min(...xs);
        const y = Math.min(...ys);

        return {
            x,
            y,
            ancho: Math.max(...xs) - x,
            alto: Math.max(...ys) - y
        };

    }

    return null;

}


/* ==================================================
   15. RECORTAR
================================================== */

btnRecortar.addEventListener("click", function() {

    const limites = obtenerLimitesSeleccion();

    if (
        !limites ||
        limites.ancho < 1 ||
        limites.alto < 1
    ) {

        alert("Primero debes realizar una selección.");

        return;

    }

    const x = Math.max(0, Math.floor(limites.x * dpr));
    const y = Math.max(0, Math.floor(limites.y * dpr));

    const ancho = Math.min(
        canvas.width - x,
        Math.ceil(limites.ancho * dpr)
    );

    const alto = Math.min(
        canvas.height - y,
        Math.ceil(limites.alto * dpr)
    );

    if (ancho <= 0 || alto <= 0) return;

    const temporal = document.createElement("canvas");

    temporal.width = ancho;
    temporal.height = alto;

    const tctx = temporal.getContext("2d");

    if (modoSeleccion === "libre") {

        tctx.save();

        tctx.beginPath();

        puntosSeleccion.forEach((punto, i) => {

            const px = punto.x * dpr - x;
            const py = punto.y * dpr - y;

            if (i === 0) {
                tctx.moveTo(px, py);
            } else {
                tctx.lineTo(px, py);
            }

        });

        tctx.closePath();
        tctx.clip();

        tctx.drawImage(canvas, -x, -y);

        tctx.restore();

    } else {

        tctx.drawImage(
            canvas,
            x,
            y,
            ancho,
            alto,
            0,
            0,
            ancho,
            alto
        );

    }

    const imagen = tctx.getImageData(
        0,
        0,
        ancho,
        alto
    );

    guardarHistorial();

    configurarCanvas(
        ancho / dpr,
        alto / dpr
    );

    ctx.putImageData(imagen, 0, 0);

    seleccion = null;
    puntosSeleccion = [];
    modoSeleccion = "";

    tipoSeleccion.value = "";

    activarHerramienta("lapiz");

    guardarHistorial();

});


/* ==================================================
   16. CAMBIAR TAMAÑO
================================================== */

btnRedimensionar.addEventListener("click", function() {

    const porcentaje = Number(
        prompt("Introduce el porcentaje de tamaño (10 a 300):", "100")
    );

    if (
        !Number.isFinite(porcentaje) ||
        porcentaje < 10 ||
        porcentaje > 300
    ) {

        alert("Introduce un porcentaje válido entre 10 y 300.");

        return;

    }

    if (porcentaje === 100) return;

    const factor = porcentaje / 100;

    guardarHistorial();

    const temporal = document.createElement("canvas");

    temporal.width = canvas.width;
    temporal.height = canvas.height;

    temporal.getContext("2d").drawImage(canvas, 0, 0);

    const nuevoAncho = Math.max(1, Math.round(anchoLogico * factor));
    const nuevoAlto = Math.max(1, Math.round(altoLogico * factor));

    configurarCanvas(nuevoAncho, nuevoAlto);

    ctx.drawImage(
        temporal,
        0,
        0,
        temporal.width,
        temporal.height,
        0,
        0,
        nuevoAncho,
        nuevoAlto
    );

    guardarHistorial();

});


/* ==================================================
   17. GIRAR CONTENIDO
================================================== */

tipoGiro.addEventListener("change", function() {

    const grados = Number(tipoGiro.value);

    if (![90, 180, 270].includes(grados)) return;

    const temporal = document.createElement("canvas");

    temporal.width = canvas.width;
    temporal.height = canvas.height;

    temporal.getContext("2d").drawImage(canvas, 0, 0);

    const anchoAnterior = anchoLogico;
    const altoAnterior = altoLogico;

    guardarHistorial();

    const nuevoAncho =
        grados === 180 ? anchoAnterior : altoAnterior;

    const nuevoAlto =
        grados === 180 ? altoAnterior : anchoAnterior;

    configurarCanvas(nuevoAncho, nuevoAlto);

    ctx.save();

    if (grados === 90) {

        ctx.translate(nuevoAncho, 0);
        ctx.rotate(Math.PI / 2);

    } else if (grados === 180) {

        ctx.translate(nuevoAncho, nuevoAlto);
        ctx.rotate(Math.PI);

    } else {

        ctx.translate(0, nuevoAlto);
        ctx.rotate(-Math.PI / 2);

    }

    ctx.drawImage(
        temporal,
        0,
        0,
        temporal.width / dpr,
        temporal.height / dpr
    );

    ctx.restore();

    tipoGiro.value = "";

    guardarHistorial();

});


/* ==================================================
   18. ZOOM
================================================== */

function actualizarZoom() {

    canvas.style.transform = `scale(${zoomActual})`;

    valorZoom.textContent =
        Math.round(zoomActual * 100) + "%";

}

btnZoomMas.addEventListener("click", function() {

    zoomActual = Math.min(zoomActual + 0.1, 3);

    actualizarZoom();

});

btnZoomMenos.addEventListener("click", function() {

    zoomActual = Math.max(zoomActual - 0.1, 0.5);

    actualizarZoom();

});

btnZoomReset.addEventListener("click", function() {

    zoomActual = 1;

    actualizarZoom();

});


/* ==================================================
   19. LIMPIAR TODA LA PIZARRA
================================================== */

btnLimpiar.addEventListener("click", function() {

    const confirmar = confirm(
        "¿Deseas eliminar todo el contenido de la pizarra?"
    );

    if (!confirmar) return;

    guardarHistorial();

    // Restablecer transformación para limpiar
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Limpiar todos los píxeles internos
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Restaurar escala de resolución
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Restablecer estados
    dibujando = false;

    ultimoPunto = null;
    puntoInicial = null;
    imagenOriginal = null;

    seleccion = null;
    puntosSeleccion = [];

    modoSeleccion = "";
    modoRelleno = false;
    modoTexto = false;

    formaActual = "";

    herramientaForma.value = "";
    tipoSeleccion.value = "";

    tipoPincel.value = "lapiz";
    pincelActual = "lapiz";

    activarHerramienta("lapiz");

    guardarHistorial();

});


/* ==================================================
   20. CONTROL PRINCIPAL DEL MOUSE Y TÁCTIL
================================================== */

canvas.addEventListener("pointerdown", function(evento) {

    if (evento.pointerType === "mouse" && evento.button !== 0) {
        return;
    }

    const punto = obtenerPosicion(evento);

    // TEXTO
    if (herramientaActual === "texto") {

        insertarTexto(punto.x, punto.y);

        return;

    }

    // RELLENO
    if (herramientaActual === "relleno") {

        guardarHistorial();

        rellenarArea(punto.x, punto.y);

        guardarHistorial();

        return;

    }

    dibujando = true;

    canvas.setPointerCapture(evento.pointerId);

    puntoInicial = punto;
    ultimoPunto = punto;

    // SELECCIÓN
    if (herramientaActual === "seleccion") {

        imagenOriginal = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

        seleccion = {
            x: punto.x,
            y: punto.y,
            ancho: 0,
            alto: 0
        };

        puntosSeleccion = [punto];

        return;

    }

    // FORMAS
    if (herramientaActual === "forma") {

        imagenOriginal = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

        return;

    }

    // LÁPIZ
    if (herramientaActual === "lapiz") {

        guardarHistorial();

        aplicarPincel(punto, punto);

    }

    // BORRADOR
    if (herramientaActual === "borrador") {

        guardarHistorial();

        borrarTrazo(punto, punto);

    }

});


canvas.addEventListener("pointermove", function(evento) {

    if (!dibujando) return;

    const punto = obtenerPosicion(evento);

    // FORMAS
    if (herramientaActual === "forma") {

        ctx.putImageData(imagenOriginal, 0, 0);

        dibujarForma(puntoInicial, punto);

        return;

    }

    // SELECCIÓN RECTANGULAR
    if (
        herramientaActual === "seleccion" &&
        modoSeleccion === "rectangular"
    ) {

        ctx.putImageData(imagenOriginal, 0, 0);

        seleccion.ancho = punto.x - puntoInicial.x;
        seleccion.alto = punto.y - puntoInicial.y;

        dibujarSeleccion();

        return;

    }

    // SELECCIÓN LIBRE
    if (
        herramientaActual === "seleccion" &&
        modoSeleccion === "libre"
    ) {

        puntosSeleccion.push(punto);

        ctx.putImageData(imagenOriginal, 0, 0);

        dibujarSeleccion();

        return;

    }

    // LÁPIZ
    if (herramientaActual === "lapiz") {

        aplicarPincel(ultimoPunto, punto);

    }

    // BORRADOR
    if (herramientaActual === "borrador") {

        borrarTrazo(ultimoPunto, punto);

    }

    ultimoPunto = punto;

});


function finalizarDibujo(evento) {

    if (!dibujando) return;

    const punto = obtenerPosicion(evento);

    if (herramientaActual === "forma") {

        ctx.putImageData(imagenOriginal, 0, 0);

        dibujarForma(puntoInicial, punto);

        imagenOriginal = null;

        guardarHistorial();

    }

    if (herramientaActual === "seleccion") {

        ctx.putImageData(imagenOriginal, 0, 0);

        if (modoSeleccion === "rectangular") {

            seleccion.ancho = punto.x - puntoInicial.x;
            seleccion.alto = punto.y - puntoInicial.y;

        }

        if (modoSeleccion === "libre") {

            puntosSeleccion.push(punto);

        }

        imagenOriginal = null;

        dibujarSeleccion();

    }

    if (
        herramientaActual === "lapiz" ||
        herramientaActual === "borrador"
    ) {

        guardarHistorial();

    }

    dibujando = false;

    ultimoPunto = null;
    puntoInicial = null;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

}

canvas.addEventListener("pointerup", finalizarDibujo);

canvas.addEventListener("pointercancel", finalizarDibujo);


/* ==================================================
   21. INICIALIZACIÓN
================================================== */

// Estado inicial para poder utilizar deshacer
guardarHistorial();

actualizarZoom();

console.log("Pizarra interactiva inicializada correctamente.");