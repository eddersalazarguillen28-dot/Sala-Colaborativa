
const { io } = require("socket.io-client");

// Conectarse al servidor
const usuario = io("http://localhost:3000");

// Cuando se conecta al servidor
usuario.on("connect", () => {
  console.log("Conectado al servidor:", usuario.id);

  // Solicitar entrar a la sala
  usuario.emit("unirse-sala", {
    nombreSala: "sala-prueba",
    nombreUsuario: "Edder"
  });
});

// Cuando el servidor confirma que entramos a la sala
usuario.on("sala-unida", (datos) => {
  console.log("Entraste a la sala:", datos);
});

// Recibir la lista de participantes
usuario.on("lista-participantes", (participantes) => {
  console.log("Lista de participantes:", participantes);
});

// Avisar cuando entra otro usuario
usuario.on("usuario-unido", (datos) => {
  console.log("Nuevo participante:", datos.nombre);
});

// Avisar cuando otro usuario sale voluntariamente
usuario.on("usuario-salio", (datos) => {
  console.log("Participante salió:", datos.nombre);
});

// Avisar cuando otro usuario se desconecta inesperadamente
usuario.on("usuario-desconectado", (datos) => {
  console.log("Participante desconectado:", datos.nombre);
});

// Mostrar errores
usuario.on("error-sala", (mensaje) => {
  console.log("Error:", mensaje);
});

// Mostrar errores de conexión
usuario.on("connect_error", (error) => {
  console.log("Error de conexión:", error.message);
});
