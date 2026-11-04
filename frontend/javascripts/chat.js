const socket = io("http://localhost:3000");

const usuarioChat = sessionStorage.getItem("nombreUsuario");
const salaChat = sessionStorage.getItem("nombreSala");

const formularioMensaje = document.getElementById("formularioMensaje");
const campoMensaje = document.getElementById("mensaje");
const contenedorMensajes = document.getElementById("mensajes");

console.log("Chat.js conectado");

socket.on("connect", () => {
    console.log("Conectado al servidor:", socket.id);

    socket.emit("unirse-sala", {
        nombreSala,
        nombreUsuario
    });
});

socket.on("sala-unida", (datos) => {
    console.log("Entraste a la sala:", datos.sala);
});

socket.on("error-sala", (error) => {
    console.error(error);
});

socket.on("nuevo-mensaje", (mensaje) => {
    const elementoMensaje = document.createElement("div");
    elementoMensaje.classList.add("mensaje");

    if (mensaje.id === socket.id) {
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

if (formularioMensaje && campoMensaje && contenedorMensajes) {
    formularioMensaje.addEventListener("submit", (event) => {
        event.preventDefault();

        const texto = campoMensaje.value.trim();

        if (texto === "") return;

        socket.emit("enviar-mensaje", {
            nombreSala,
            texto
        });
        campoMensaje.value = "";
    });
} else {
    console.error("No se encontraron los elementos del chat");
}