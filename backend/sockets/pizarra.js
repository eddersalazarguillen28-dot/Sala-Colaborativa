
"use strict";

function configurarPizarra(io) {

    // ==========================================
    // 1. VALIDACIONES GENERALES
    // ==========================================

    function esObjeto(valor) {
        return (
            valor !== null &&
            typeof valor === "object" &&
            !Array.isArray(valor)
        );
    }

    function coordenadaValida(valor) {
        return Number.isFinite(valor) &&
            Math.abs(valor) <= 1000000;
    }

    function colorValido(color) {
        return (
            typeof color === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(color)
        );
    }

    function grosorValido(grosor) {
        return (
            Number.isFinite(grosor) &&
            grosor > 0 &&
            grosor <= 200
        );
    }

    function idValido(id) {
        return (
            (typeof id === "string" && id.length > 0 && id.length <= 128) ||
            (typeof id === "number" && Number.isFinite(id))
        );
    }

    function puntosValidos(pts) {
        if (!Array.isArray(pts)) return false;
        if (pts.length > 20000) return false;
        if (pts.length % 2 !== 0) return false;

        return pts.every(coordenadaValida);
    }

    // ==========================================
    // 2. VALIDAR ELEMENTOS V2
    // ==========================================

    function elementoValido(el) {

        if (!esObjeto(el)) return false;

        if (!idValido(el.id)) return false;

        if (
            typeof el.t !== "string" ||
            el.t.length > 40
        ) {
            return false;
        }

        if (el.p !== undefined) {
            const pincelesPermitidos = [
                "lapiz",
                "pincel",
                "aerografo",
                "acuarela",
                "oleo",
                "marcador",
                "crayon",
                "borrador"
            ];

            if (
                typeof el.p !== "string" ||
                !pincelesPermitidos.includes(el.p)
            ) {
                return false;
            }
        }

        if (
            el.c !== undefined &&
            !colorValido(el.c)
        ) {
            return false;
        }

        if (
            el.g !== undefined &&
            !grosorValido(el.g)
        ) {
            return false;
        }

        if (
            el.pts !== undefined &&
            !puntosValidos(el.pts)
        ) {
            return false;
        }

        return true;
    }

    // ==========================================
    // 3. VALIDAR OPERACIONES V2
    // ==========================================

    function operacionV2Valida(trazo) {

        if (
            !esObjeto(trazo) ||
            trazo.v !== 2 ||
            typeof trazo.op !== "string"
        ) {
            return false;
        }

        switch (trazo.op) {

            // Comienza un nuevo trazo
            case "inicio":

                return elementoValido(trazo.el);

            // Agrega puntos al trazo
            case "pts":

                return (
                    idValido(trazo.id) &&
                    puntosValidos(trazo.pts)
                );

            // Finaliza un trazo
            case "fin":

                return idValido(trazo.id);

            // Agrega o actualiza elementos
            case "agregar":
            case "actualizar":

                return (
                    Array.isArray(trazo.els) &&
                    trazo.els.length <= 1000 &&
                    trazo.els.every(elementoValido)
                );

            // Elimina elementos
            case "eliminar":

                return (
                    Array.isArray(trazo.ids) &&
                    trazo.ids.length <= 1000 &&
                    trazo.ids.every(idValido)
                );

            default:
                return false;
        }
    }

    // ==========================================
    // 4. VALIDAR FORMATO ANTIGUO
    // ==========================================

    function trazoAntiguoValido(trazo) {

        if (!esObjeto(trazo)) return false;

        const tipo = trazo.tipo || "normal";

        if (tipo === "texto") {
            return (
                coordenadaValida(trazo.x0) &&
                coordenadaValida(trazo.y0) &&
                typeof trazo.texto === "string" &&
                trazo.texto.trim().length > 0 &&
                trazo.texto.length <= 500 &&
                Number.isFinite(trazo.tamano) &&
                trazo.tamano >= 8 &&
                trazo.tamano <= 200 &&
                colorValido(trazo.color)
            );
        }

        if (tipo === "relleno") {
            return (
                coordenadaValida(trazo.x0) &&
                coordenadaValida(trazo.y0) &&
                colorValido(trazo.color)
            );
        }

        if (tipo === "forma") {
            const formasPermitidas = [
                "rectangulo",
                "circulo",
                "linea",
                "triangulo",
                "flecha"
            ];

            return (
                formasPermitidas.includes(trazo.forma) &&
                coordenadaValida(trazo.x0) &&
                coordenadaValida(trazo.y0) &&
                coordenadaValida(trazo.x1) &&
                coordenadaValida(trazo.y1) &&
                colorValido(trazo.color) &&
                grosorValido(trazo.grosor)
            );
        }

        if (tipo === "borrador") {
            return (
                coordenadaValida(trazo.x0) &&
                coordenadaValida(trazo.y0) &&
                coordenadaValida(trazo.x1) &&
                coordenadaValida(trazo.y1) &&
                grosorValido(trazo.grosor)
            );
        }

        const pincelesPermitidos = [
            "lapiz",
            "pincel",
            "aerografo",
            "acuarela",
            "oleo",
            "marcador",
            "crayon"
        ];

        const pincel = trazo.pincel || "lapiz";

        return (
            coordenadaValida(trazo.x0) &&
            coordenadaValida(trazo.y0) &&
            coordenadaValida(trazo.x1) &&
            coordenadaValida(trazo.y1) &&
            colorValido(trazo.color) &&
            grosorValido(trazo.grosor) &&
            typeof pincel === "string" &&
            pincelesPermitidos.includes(pincel)
        );
    }

    // ==========================================
    // 5. CONEXIÓN SOCKET.IO
    // ==========================================

    io.on("connection", (socket) => {

        console.log(`[PIZARRA] Conectado: ${socket.id}`);

        // ======================================
        // 6. RECIBIR TRAZOS Y OPERACIONES
        // ======================================

        socket.on("dibujar-trazo", (datos = {}) => {

            try {

                if (
                    !esObjeto(datos) ||
                    typeof datos.sala !== "string" ||
                    !datos.sala.trim() ||
                    !esObjeto(datos.trazo)
                ) {
                    socket.emit(
                        "error-pizarra",
                        "Datos de dibujo inválidos"
                    );
                    return;
                }

                const sala = datos.sala.trim();
                const trazo = datos.trazo;

                // Comprobar pertenencia a la sala
                if (!socket.rooms.has(sala)) {
                    socket.emit(
                        "error-pizarra",
                        "No perteneces a esta sala"
                    );
                    return;
                }

                // Limitar tamaño del mensaje
                const contenido = JSON.stringify(trazo);

                if (
                    !contenido ||
                    Buffer.byteLength(contenido, "utf8") > 100000
                ) {
                    socket.emit(
                        "error-pizarra",
                        "El dibujo supera el tamaño permitido"
                    );
                    return;
                }

                // Detectar protocolo
                const esV2 = trazo.v === 2;

                if (esV2) {

                    if (!operacionV2Valida(trazo)) {
                        socket.emit(
                            "error-pizarra",
                            "Datos de operación V2 inválidos"
                        );
                        return;
                    }

                } else {

                    if (!trazoAntiguoValido(trazo)) {
                        socket.emit(
                            "error-pizarra",
                            "Datos de pincel inválidos"
                        );
                        return;
                    }

                }

                // Retransmitir exactamente el contenido recibido
                // sin modificar IDs, puntos ni operaciones.
                socket.to(sala).emit("nuevo-trazo", {
                    trazo
                });

            } catch (error) {

                console.error(
                    "[PIZARRA] Error procesando dibujo:",
                    error
                );

                socket.emit(
                    "error-pizarra",
                    "No se pudo procesar el dibujo"
                );
            }

        });

        // ======================================
        // 7. LIMPIAR PIZARRA
        // ======================================

        socket.on("limpiar-pizarra", (sala) => {

            if (
                typeof sala !== "string" ||
                !sala.trim()
            ) {
                socket.emit(
                    "error-pizarra",
                    "Nombre de sala inválido"
                );
                return;
            }

            const nombreSala = sala.trim();

            if (!socket.rooms.has(nombreSala)) {
                socket.emit(
                    "error-pizarra",
                    "No perteneces a esta sala"
                );
                return;
            }

            io.to(nombreSala).emit("pizarra-limpiada");

            console.log(
                `[PIZARRA] Sala "${nombreSala}" limpiada`
            );

        });

        // ======================================
        // 8. DESCONEXIÓN
        // ======================================

        socket.on("disconnect", () => {

            console.log(
                `[PIZARRA] Desconectado: ${socket.id}`
            );

        });

    });

}

module.exports = configurarPizarra;
