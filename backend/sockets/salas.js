
const nombresUsuarios = new Map();

function configurarSalas(io) {

    io.on("connection", (socket) => {

        let salaActual = null;
        let operacionSala = Promise.resolve();

        // ==========================================
        // OBTENER PARTICIPANTES
        // ==========================================

        function obtenerParticipantes(nombreSala) {

            return Array.from(
                io.sockets.adapter.rooms.get(nombreSala) || []
            ).map((id) => ({
                id,
                nombre: nombresUsuarios.get(id) || "Usuario"
            }));

        }

        // ==========================================
        // ACTUALIZAR PARTICIPANTES
        // ==========================================

        function actualizarParticipantes(nombreSala) {

            if (!nombreSala) return;

            io.to(nombreSala).emit(
                "lista-participantes",
                obtenerParticipantes(nombreSala)
            );

        }

        // ==========================================
        // SALIR DE UNA SALA
        // ==========================================

        async function abandonarSala(nombreSala, voluntario = true) {

            if (!nombreSala || salaActual !== nombreSala) {
                return;
            }

            const nombreUsuario =
                nombresUsuarios.get(socket.id) || "Usuario";

            if (voluntario) {

                socket.to(nombreSala).emit("usuario-salio", {
                    id: socket.id,
                    nombre: nombreUsuario
                });

            }

            await socket.leave(nombreSala);

            salaActual = null;

            actualizarParticipantes(nombreSala);

            console.log(
                `👋 ${nombreUsuario} salió de ${nombreSala}`
            );

        }

        // ==========================================
        // UNIRSE A UNA SALA
        // ==========================================

        socket.on("unirse-sala", (datos = {}) => {

            operacionSala = operacionSala.then(async () => {

                try {

                    if (
                        !datos ||
                        typeof datos !== "object" ||
                        Array.isArray(datos)
                    ) {
                        socket.emit(
                            "error-sala",
                            "Datos de sala inválidos"
                        );
                        return;
                    }

                    let { nombreSala, nombreUsuario } = datos;

                    if (
                        typeof nombreSala !== "string" ||
                        typeof nombreUsuario !== "string"
                    ) {
                        socket.emit(
                            "error-sala",
                            "Falta el nombre de la sala o del usuario"
                        );
                        return;
                    }

                    nombreSala = nombreSala.trim();
                    nombreUsuario = nombreUsuario.trim();

                    if (!nombreSala || !nombreUsuario) {
                        socket.emit(
                            "error-sala",
                            "Falta el nombre de la sala o del usuario"
                        );
                        return;
                    }

                    if (
                        nombreSala.length > 100 ||
                        nombreUsuario.length > 60
                    ) {
                        socket.emit(
                            "error-sala",
                            "Los datos superan el tamaño permitido"
                        );
                        return;
                    }

                    if (!socket.connected) return;

                    // Si ya pertenece a esta sala, actualizar nombre.

                    if (salaActual === nombreSala) {

                        nombresUsuarios.set(
                            socket.id,
                            nombreUsuario
                        );

                        actualizarParticipantes(nombreSala);

                        socket.emit("sala-unida", {
                            sala: nombreSala,
                            usuario: nombreUsuario
                        });

                        return;
                    }

                    // Abandonar la sala anterior.

                    if (salaActual) {
                        await abandonarSala(salaActual);
                    }

                    if (!socket.connected) return;

                    // Ingresar a la nueva sala.

                    await socket.join(nombreSala);

                    salaActual = nombreSala;

                    nombresUsuarios.set(
                        socket.id,
                        nombreUsuario
                    );

                    console.log(
                        `🟢 ${nombreUsuario} se unió a ${nombreSala}`
                    );

                    actualizarParticipantes(nombreSala);

                    socket.to(nombreSala).emit("usuario-unido", {
                        id: socket.id,
                        nombre: nombreUsuario
                    });

                    socket.emit("sala-unida", {
                        sala: nombreSala,
                        usuario: nombreUsuario
                    });

                } catch (error) {

                    console.error(
                        "Error al ingresar a la sala:",
                        error
                    );

                    socket.emit(
                        "error-sala",
                        "No se pudo ingresar a la sala"
                    );

                }

            }).catch((error) => {

                console.error(
                    "Error en la operación de sala:",
                    error
                );

            });

        });

        // ==========================================
        // ENVIAR MENSAJES
        // ==========================================

        socket.on("enviar-mensaje", (datos = {}) => {

            if (
                !datos ||
                typeof datos !== "object" ||
                Array.isArray(datos)
            ) {
                socket.emit("error-chat", "Mensaje inválido");
                return;
            }

            const { nombreSala, texto } = datos;

            if (
                typeof nombreSala !== "string" ||
                typeof texto !== "string"
            ) {
                socket.emit(
                    "error-chat",
                    "Los datos del mensaje son inválidos"
                );
                return;
            }

            const sala = nombreSala.trim();
            const contenido = texto.trim();

            if (!contenido || contenido.length > 5000) {
                socket.emit(
                    "error-chat",
                    "El mensaje está vacío o supera los 5000 caracteres"
                );
                return;
            }

            if (
                !sala ||
                salaActual !== sala ||
                !socket.rooms.has(sala)
            ) {
                socket.emit(
                    "error-chat",
                    "No perteneces a esta sala"
                );
                return;
            }

            const mensaje = {
                id: socket.id,
                nombre: nombresUsuarios.get(socket.id) || "Usuario",
                texto: contenido,
                fecha: new Date().toISOString()
            };

            io.to(sala).emit("nuevo-mensaje", mensaje);

            console.log(
                `💬 [CHAT] ${mensaje.nombre} en ${sala}: ${contenido}`
            );

        });

        // ==========================================
        // SALIR VOLUNTARIAMENTE DE UNA SALA
        // ==========================================

        socket.on("salir-sala", (nombreSala) => {

            operacionSala = operacionSala.then(async () => {

                try {

                    if (
                        typeof nombreSala !== "string" ||
                        nombreSala !== salaActual
                    ) {
                        return;
                    }

                    await abandonarSala(nombreSala);

                } catch (error) {

                    console.error(
                        "Error al salir de la sala:",
                        error
                    );

                }

            });

        });

        // ==========================================
        // DETECTAR DESCONEXIÓN
        // ==========================================

        socket.on("disconnecting", () => {

            const nombreUsuario =
                nombresUsuarios.get(socket.id) || "Usuario";

            for (const nombreSala of socket.rooms) {

                // Ignorar la sala privada del socket.

                if (nombreSala === socket.id) continue;

                socket.to(nombreSala).emit(
                    "usuario-desconectado",
                    {
                        id: socket.id,
                        nombre: nombreUsuario
                    }
                );

                const participantes = obtenerParticipantes(nombreSala)
                    .filter((usuario) => usuario.id !== socket.id);

                socket.to(nombreSala).emit(
                    "lista-participantes",
                    participantes
                );

                console.log(
                    `🔴 ${nombreUsuario} se desconectó de ${nombreSala}`
                );

            }

            salaActual = null;

        });

        // ==========================================
        // LIMPIAR INFORMACIÓN DEL USUARIO
        // ==========================================

        socket.on("disconnect", () => {

            nombresUsuarios.delete(socket.id);

            console.log(
                `Usuario desconectado definitivamente: ${socket.id}`
            );

        });

    });

}

module.exports = configurarSalas;
