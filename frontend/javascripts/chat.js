// ==========================================
// DATOS DEL USUARIO Y SALA
// ==========================================

const usuarioChat = sessionStorage.getItem("nombreUsuario");
const salaChat = sessionStorage.getItem("nombreSala");

console.log("Usuario del chat:", usuarioChat);
console.log("Sala del chat:", salaChat);
console.log("Chat.js conectado");

// ==========================================
// ELEMENTOS HTML
// ==========================================

const formularioMensaje = document.getElementById("formularioMensaje");
const campoMensaje = document.getElementById("mensaje");
const contenedorMensajes = document.getElementById("mensajes");
const listaParticipantes = document.getElementById("listaParticipantes");

// ==========================================
// SOCKET GLOBAL
// ==========================================

const socketChat = window.socket;

if (!socketChat) {
    console.error("No se encontró la conexión global del socket.");
}

// ==========================================
// MOSTRAR PARTICIPANTES
// ==========================================

function mostrarParticipantes(participantes = []) {

    if (!listaParticipantes) return;

    listaParticipantes.innerHTML = "";

    participantes.forEach((participante) => {

        const elemento = document.createElement("div");
        elemento.classList.add("participante");

        const indicador = document.createElement("span");
        indicador.classList.add("estado-participante");

        const nombre = document.createElement("span");
        nombre.classList.add("nombre-participante");

        nombre.textContent = participante.nombre || "Usuario";

        elemento.appendChild(indicador);
        elemento.appendChild(nombre);

        listaParticipantes.appendChild(elemento);

    });

}

// ==========================================
// MOSTRAR MENSAJES
// ==========================================

function mostrarMensaje(mensaje) {

    if (!contenedorMensajes || !mensaje) return;

    const elementoMensaje = document.createElement("div");

    elementoMensaje.classList.add("mensaje");

    // Identificar mensajes propios
    if (socketChat && mensaje.id === socketChat.id) {
        elementoMensaje.classList.add("enviado");
    }

    // Nombre del usuario
    const autor = document.createElement("span");

    autor.classList.add("nombre-usuario");

    autor.textContent = mensaje.nombre || "Usuario";

    // Contenido del mensaje
    const contenido = document.createElement("p");

    contenido.textContent = mensaje.texto || "";

    // Fecha del mensaje
    const fecha = document.createElement("small");

    fecha.classList.add("fecha-mensaje");

    if (mensaje.fecha) {

        const fechaMensaje = new Date(mensaje.fecha);

        if (!isNaN(fechaMensaje.getTime())) {
            fecha.textContent = fechaMensaje.toLocaleTimeString("es-CR", {
                hour: "2-digit",
                minute: "2-digit"
            });
        }

    }

    elementoMensaje.appendChild(autor);
    elementoMensaje.appendChild(contenido);
    
    if (fecha.textContent) {
        elementoMensaje.appendChild(fecha);
    }

    contenedorMensajes.appendChild(elementoMensaje);

    // Desplazar automáticamente al último mensaje
    contenedorMensajes.scrollTop =
        contenedorMensajes.scrollHeight;

}

// ==========================================
// EVENTOS DEL SOCKET
// ==========================================

if (socketChat) {

    // Conexión establecida
    socketChat.on("connect", () => {

        console.log(
            "🟢 Conectado al servidor:",
            socketChat.id
        );

    });

    // Error al entrar a una sala
    socketChat.on("error-sala", (error) => {

        console.error("Error de sala:", error);

    });

    // Confirmación de entrada
    socketChat.on("sala-unida", (datos) => {

        console.log(
            `Te uniste correctamente a la sala: ${datos.sala}`
        );

    });

    // Actualización de participantes
    socketChat.on("lista-participantes", (participantes) => {

        mostrarParticipantes(participantes);

    });

    // Nuevo participante
    socketChat.on("usuario-unido", (usuario) => {

        console.log(
            `${usuario.nombre} ingresó a la sala`
        );

    });

    // Participante salió
    socketChat.on("usuario-salio", (usuario) => {

        console.log(
            `${usuario.nombre} salió de la sala`
        );

    });

    // Participante desconectado
    socketChat.on("usuario-desconectado", (usuario) => {

        console.log(
            `${usuario.nombre} se desconectó`
        );

    });

    // Recibir mensajes
    socketChat.on("nuevo-mensaje", (mensaje) => {

        mostrarMensaje(mensaje);

    });

    // Desconexión
    socketChat.on("disconnect", (reason) => {

        console.warn(
            "🔴 Desconectado del servidor:",
            reason
        );

    });

    // Error de conexión
    socketChat.on("connect_error", (error) => {

        console.error(
            "Error de conexión con el servidor:",
            error.message
        );

    });

}

// ==========================================
// ENVIAR MENSAJES
// ==========================================

if (formularioMensaje && campoMensaje && contenedorMensajes) {

    formularioMensaje.addEventListener("submit", (event) => {

        event.preventDefault();

        const texto = campoMensaje.value.trim();

        // Validaciones
        if (!texto) return;

        if (!socketChat) {
            console.error("No existe conexión con el servidor.");
            return;
        }

        if (!usuarioChat || !salaChat) {

            console.error(
                "No se encontró el usuario o la sala."
            );

            return;
        }

        if (!socketChat.connected) {

            console.warn(
                "El servidor todavía no está conectado."
            );

            return;
        }

        // Enviar mensaje al servidor
        socketChat.emit("enviar-mensaje", {
            nombreSala: salaChat,
            nombreUsuario: usuarioChat,
            texto: texto
        });

        // Limpiar campo
        campoMensaje.value = "";

        campoMensaje.focus();

    });

} else {

    console.error(
        "No se encontraron los elementos HTML del chat."
    );

}