
function configurarPizarra(io) {

  io.on("connection", (socket) => {

    // Recibir un trazo enviado por un participante
    socket.on("dibujar-trazo", (datos = {}) => {

      const { sala, trazo } = datos;

      // Comprobar que los datos sean válidos
      if (
        typeof sala !== "string" ||
        !sala.trim() ||
        !trazo ||
        typeof trazo !== "object"
      ) {
        socket.emit("error-pizarra", "Datos de dibujo inválidos");
        return;
      }

      // Comprobar que el usuario pertenezca a esa sala
      if (!socket.rooms.has(sala)) {
        socket.emit("error-pizarra", "No perteneces a esta sala");
        return;
      }

      // Validar las coordenadas
      const coordenadas = [
        trazo.x0,
        trazo.y0,
        trazo.x1,
        trazo.y1
      ];

      if (!coordenadas.every(Number.isFinite)) {
        socket.emit("error-pizarra", "Coordenadas inválidas");
        return;
      }

      // Validar color y grosor
      if (
        typeof trazo.color !== "string" ||
        trazo.color.length > 30 ||
        !Number.isFinite(trazo.grosor) ||
        trazo.grosor <= 0 ||
        trazo.grosor > 50
      ) {
        socket.emit("error-pizarra", "Color o grosor inválido");
        return;
      }

      // Enviar el trazo a los demás usuarios de la misma sala
      socket.to(sala).emit("nuevo-trazo", {
        trazo: {
          x0: trazo.x0,
          y0: trazo.y0,
          x1: trazo.x1,
          y1: trazo.y1,
          color: trazo.color,
          grosor: trazo.grosor
        }
      });

      console.log(`Nuevo trazo enviado a la sala ${sala}`);
    });

    // Limpiar la pizarra de todos los participantes de una sala
    socket.on("limpiar-pizarra", (sala) => {

      if (
        typeof sala !== "string" ||
        !socket.rooms.has(sala)
      ) {
        socket.emit("error-pizarra", "No perteneces a esta sala");
        return;
      }

      socket.to(sala).emit("pizarra-limpiada");

      console.log(`Pizarra limpiada en la sala ${sala}`);
    });

  });

}

module.exports = configurarPizarra;
