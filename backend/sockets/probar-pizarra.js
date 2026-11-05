
const { io } = require("socket.io-client");

// Obtener el nombre desde la terminal
const nombreUsuario = process.argv[2] || "Christopher";

const sala = "sala-prueba";

// Conectarse al servidor
const usuario = io("http://localhost:3000");

usuario.on("connect", () => {
  console.log("Conectado:", nombreUsuario, usuario.id);

  usuario.emit("unirse-sala", {
    nombreSala: sala,
    nombreUsuario
  });
});

// Confirmación de entrada
usuario.on("sala-unida", (datos) => {
  console.log("Entraste a la sala:", datos);

  // Christopher enviará un trazo de prueba
  if (nombreUsuario === "Christopher") {
    setTimeout(() => {

      const trazo = {
        x0: 50,
        y0: 60,
        x1: 150,
        y1: 120,
        color: "#ff0000",
        grosor: 4
      };

      console.log("Enviando trazo de prueba...");

      usuario.emit("dibujar-trazo", {
        sala,
        trazo
      });

    }, 3000);
  }
});

// Recibir dibujos de otros participantes
usuario.on("nuevo-trazo", (datos) => {
  console.log("¡Nuevo trazo recibido!", datos.trazo);
});

// Recibir aviso de limpieza
usuario.on("pizarra-limpiada", () => {
  console.log("La pizarra fue limpiada");
});

// Mostrar errores
usuario.on("error-pizarra", (mensaje) => {
  console.log("Error de pizarra:", mensaje);
});

usuario.on("error-sala", (mensaje) => {
  console.log("Error de sala:", mensaje);
});

usuario.on("connect_error", (error) => {
  console.log("Error de conexión:", error.message);
});
