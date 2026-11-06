// No declaramos 'socket' de nuevo; usamos directamente la conexión global compartida por la pizarra
const usuarioChat = sessionStorage.getItem("nombreUsuario") || "Christopher";
const salaChat = sessionStorage.getItem("nombreSala") || "sala-prueba";

const formularioMensaje = document.getElementById("formularioMensaje");
const campoMensaje = document.getElementById("mensaje");
const contenedorMensajes = document.getElementById("mensajes");

console.log("Chat.js conectado");

// Verificamos que el socket global exista antes de usarlo
const socketChat = window.socket;

if (socketChat) {
    socketChat.emit("unirse-sala", {
        nombreSala: salaChat,
        nombreUsuario: usuarioChat
    });

    socketChat.on("sala-unida", (datos) => {
        console.log("Entraste a la sala:", datos.sala);
    });

    socketChat.on("error-sala", (error) => {
        console.error(error);
    });

    socketChat.on("nuevo-mensaje", (mensaje) => {
        const elementoMensaje = document.createElement("div");
        elementoMensaje.classList.add("mensaje");

        if (mensaje.id === socketChat.id) {
            elementoMensaje.classList.add("enviado");
        }

        const autor = document.createElement("span");
        autor.classList.add("nombre-usuario");
        autor.textContent = mensaje.nombre;

        const contenido = document.createElement("p");
        contenido.textContent = mensaje.texto;

        elementoMensaje.appendChild(autor);
        elementoMensaje.appendChild(contenido);

        contenedorMensajes.appendChild(elementoMensaje);

        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    });
} else {
    console.error("No se encontró la conexión global del socket.");
}

if (formularioMensaje && campoMensaje && contenedorMensajes) {
    formularioMensaje.addEventListener("submit", (event) => {
        event.preventDefault();

        const texto = campoMensaje.value.trim();

        if (texto === "" || !socketChat) return;

        socketChat.emit("enviar-mensaje", {
            nombreSala: salaChat,
            texto
        });
        campoMensaje.value = "";
    });
} else {
    console.error("No se encontraron los elementos del chat");
}