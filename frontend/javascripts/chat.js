const usuarioChat = sessionStorage.getItem("nombreUsuario");
const salaChat = sessionStorage.getItem("nombreSala");

console.log("Usuario del chat:", usuarioChat);
console.log("Sala del chat:", salaChat);

const formularioMensaje = document.getElementById("formularioMensaje");
const campoMensaje = document.getElementById("mensaje");
const contenedorMensajes = document.getElementById("mensajes");
const listaParticipantes = document.getElementById("listaParticipantes");

console.log("Chat.js conectado");

function mostrarParticipantes(participantes) {
    if (!listaParticipantes) return;

    listaParticipantes.innerHTML = "";

    participantes.forEach((participante) => {
        const elemento = document.createElement("div");
        elemento.classList.add("participante");

        const indicador = document.createElement("span");
        indicador.classList.add("estado-participante");

        const nombre = document.createElement("span");
        nombre.classList.add("nombre-participante");
        nombre.textContent = participante.nombre;

        elemento.appendChild(indicador);
        elemento.appendChild(nombre);

        listaParticipantes.appendChild(elemento);
    })
}

// Verificamos que el socket global exista antes de usarlo
const socketChat = window.socket;

if (socketChat) {
    socketChat.on("error-sala", (error) => {
        console.error(error);
    });

    socketChat.on("lista-participantes", (participantes) => {
        mostrarParticipantes(participantes);
    });

    socketChat.on("usuario-unido", (usuario) => {
        console.log(usuario.nombre + "ingresó a la sala");
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