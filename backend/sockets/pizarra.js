
function configurarPizarra(io) {

  io.on("connection", (socket) => {

    // Recibir un trazo enviado por un participante
    socket.on("dibujar-trazo", (datos = {}) => {

      const { sala, trazo } = datos;

      // Validar los datos recibidos
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

      // Comprobar que el usuario pertenezca a la sala
      if (!socket.rooms.has(nombreSala)) {
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
        !/^#[0-9a-fA-F]{6}$/.test(trazo.color) ||
        !Number.isFinite(trazo.grosor) ||
        trazo.grosor <= 0 ||
        trazo.grosor > 50
      ) {
        socket.emit("error-pizarra", "Color o grosor inválido");
        return;
      }

      // Preparar el trazo validado
      const nuevoTrazo = {
        x0: trazo.x0,
        y0: trazo.y0,
        x1: trazo.x1,
        y1: trazo.y1,
        color: trazo.color,
        grosor: trazo.grosor
      };

      // Enviar el trazo a los demás participantes
      socket.to(nombreSala).emit("nuevo-trazo", {
        trazo: nuevoTrazo
      });

      console.log(`Nuevo trazo enviado a la sala ${nombreSala}`);
    });


    // Limpiar la pizarra de todos los participantes
    socket.on("limpiar-pizarra", (sala) => {

      if (
        typeof sala !== "string" ||
        !sala.trim()
      ) {
        socket.emit("error-pizarra", "Nombre de sala inválido");
        return;
      }

      const nombreSala = sala.trim();

      // Comprobar que el usuario pertenezca a la sala
      if (!socket.rooms.has(nombreSala)) {
        socket.emit("error-pizarra", "No perteneces a esta sala");
        return;
      }

      // Notificar a todos, incluido quien solicitó limpiar
      io.to(nombreSala).emit("pizarra-limpiada");

      console.log(`Pizarra limpiada en la sala ${nombreSala}`);
    });

  });

}

module.exports = configurarPizarra;
