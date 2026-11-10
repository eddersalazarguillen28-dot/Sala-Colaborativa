function configurarPizarra(io) {

    // Validar colores hexadecimales
    function colorValido(color) {
        return (
            typeof color === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(color)
        );
    }

    // Validar coordenadas
    function coordenadaValida(valor) {
        return Number.isFinite(valor) && Math.abs(valor) <= 1000000;
    }

    // Validar grosor de pinceles y figuras
    function grosorValido(grosor) {
        return (
            Number.isFinite(grosor) &&
            grosor > 0 &&
            grosor <= 50
        );
    }

    io.on("connection", (socket) => {

        console.log(`Pizarra conectada: ${socket.id}`);

        // ==========================================
        // 1. RECIBIR Y VALIDAR TRAZOS
        // ==========================================

        socket.on("dibujar-trazo", (datos = {}) => {

            if (
                !datos ||
                typeof datos !== "object" ||
                Array.isArray(datos)
            ) {
                socket.emit("error-pizarra", "Datos de dibujo inválidos");
                return;
            }

            const { sala, trazo } = datos;

            if (
                typeof sala !== "string" ||
                !sala.trim() ||
                !trazo ||
                typeof trazo !== "object" ||
                Array.isArray(trazo)
            ) {
                socket.emit("error-pizarra", "Datos de dibujo inválidos");
                return;
            }

            const nombreSala = sala.trim();

            // Comprobar que pertenece a la sala
            if (!socket.rooms.has(nombreSala)) {
                socket.emit("error-pizarra", "No perteneces a esta sala");
                return;
            }

            // ======================================
            // 2. VALIDAR TIPO DE TRAZO
            // ======================================

            const tipo = trazo.tipo || "normal";

            const tiposPermitidos = [
                "normal",
                "texto",
                "relleno",
                "forma",
                "borrador"
            ];

            if (
                typeof tipo !== "string" ||
                !tiposPermitidos.includes(tipo)
            ) {
                socket.emit("error-pizarra", "Tipo de dibujo no permitido");
                return;
            }

            let nuevoTrazo = {};

            // ======================================
            // 3. VALIDAR TEXTO
            // ======================================

            if (tipo === "texto") {

                if (
                    !coordenadaValida(trazo.x0) ||
                    !coordenadaValida(trazo.y0) ||
                    typeof trazo.texto !== "string" ||
                    !trazo.texto.trim() ||
                    trazo.texto.length > 500 ||
                    !Number.isFinite(trazo.tamano) ||
                    trazo.tamano < 8 ||
                    trazo.tamano > 200 ||
                    !colorValido(trazo.color)
                ) {
                    socket.emit("error-pizarra", "Datos de texto inválidos");
                    return;
                }

                nuevoTrazo = {
                    tipo: "texto",
                    x0: trazo.x0,
                    y0: trazo.y0,
                    texto: trazo.texto,
                    tamano: trazo.tamano,
                    color: trazo.color
                };
            }

            // ======================================
            // 4. VALIDAR RELLENO
            // ======================================

            else if (tipo === "relleno") {

                if (
                    !coordenadaValida(trazo.x0) ||
                    !coordenadaValida(trazo.y0) ||
                    !colorValido(trazo.color)
                ) {
                    socket.emit("error-pizarra", "Datos de relleno inválidos");
                    return;
                }

                nuevoTrazo = {
                    tipo: "relleno",
                    x0: trazo.x0,
                    y0: trazo.y0,
                    color: trazo.color
                };
            }

            // ======================================
            // 5. VALIDAR FIGURAS
            // ======================================

            else if (tipo === "forma") {

                const formasPermitidas = [
                    "rectangulo",
                    "circulo",
                    "linea",
                    "triangulo",
                    "flecha"
                ];

                if (
                    !formasPermitidas.includes(trazo.forma) ||
                    !coordenadaValida(trazo.x0) ||
                    !coordenadaValida(trazo.y0) ||
                    !coordenadaValida(trazo.x1) ||
                    !coordenadaValida(trazo.y1) ||
                    !colorValido(trazo.color) ||
                    !grosorValido(trazo.grosor)
                ) {
                    socket.emit("error-pizarra", "Datos de figura inválidos");
                    return;
                }

                nuevoTrazo = {
                    tipo: "forma",
                    forma: trazo.forma,
                    x0: trazo.x0,
                    y0: trazo.y0,
                    x1: trazo.x1,
                    y1: trazo.y1,
                    color: trazo.color,
                    grosor: trazo.grosor
                };
            }

            // ======================================
            // 6. VALIDAR BORRADOR
            // ======================================

            else if (tipo === "borrador") {

                if (
                    !coordenadaValida(trazo.x0) ||
                    !coordenadaValida(trazo.y0) ||
                    !coordenadaValida(trazo.x1) ||
                    !coordenadaValida(trazo.y1) ||
                    !grosorValido(trazo.grosor)
                ) {
                    socket.emit("error-pizarra", "Datos de borrador inválidos");
                    return;
                }

                nuevoTrazo = {
                    tipo: "borrador",
                    x0: trazo.x0,
                    y0: trazo.y0,
                    x1: trazo.x1,
                    y1: trazo.y1,
                    grosor: trazo.grosor
                };
            }

            // ======================================
            // 7. VALIDAR LÁPIZ Y PINCELES
            // ======================================

            else {

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

                if (
                    !coordenadaValida(trazo.x0) ||
                    !coordenadaValida(trazo.y0) ||
                    !coordenadaValida(trazo.x1) ||
                    !coordenadaValida(trazo.y1) ||
                    !colorValido(trazo.color) ||
                    !grosorValido(trazo.grosor) ||
                    typeof pincel !== "string" ||
                    !pincelesPermitidos.includes(pincel)
                ) {
                    socket.emit("error-pizarra", "Datos de pincel inválidos");
                    return;
                }

                nuevoTrazo = {
                    x0: trazo.x0,
                    y0: trazo.y0,
                    x1: trazo.x1,
                    y1: trazo.y1,
                    color: trazo.color,
                    grosor: trazo.grosor,
                    pincel
                };
            }

            // ======================================
            // 8. ENVIAR TRAZO A LOS PARTICIPANTES
            // ======================================

            socket.to(nombreSala).emit("nuevo-trazo", {
                trazo: nuevoTrazo
            });

            console.log(
                `[PIZARRA] Trazo "${tipo}" enviado a sala "${nombreSala}"`
            );

        });

        // ==========================================
        // 9. LIMPIAR LA PIZARRA
        // ==========================================

        socket.on("limpiar-pizarra", (sala) => {

            if (
                typeof sala !== "string" ||
                !sala.trim()
            ) {
                socket.emit("error-pizarra", "Nombre de sala inválido");
                return;
            }

            const nombreSala = sala.trim();

            if (!socket.rooms.has(nombreSala)) {
                socket.emit("error-pizarra", "No perteneces a esta sala");
                return;
            }

            // Notificar a todos los participantes
            io.to(nombreSala).emit("pizarra-limpiada");

            console.log(
                `[PIZARRA] Sala "${nombreSala}" limpiada por ${socket.id}`
            );

        });

    });

}

module.exports = configurarPizarra;