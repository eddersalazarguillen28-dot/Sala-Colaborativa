
const nombresUsuarios = new Map();

function configurarSalas(io) {

  io.on("connection", (socket) => {

    // Un usuario solicita entrar a una sala
    socket.on("unirse-sala", ({ nombreSala, nombreUsuario } = {}) => {

      if (
        typeof nombreSala !== "string" ||
        typeof nombreUsuario !== "string" ||
        !nombreSala.trim() ||
        !nombreUsuario.trim()
      ) {
        socket.emit(
          "error-sala",
          "Falta el nombre de la sala o del usuario"
        );
        return;
      }

      nombreSala = nombreSala.trim();
      nombreUsuario = nombreUsuario.trim();

      socket.join(nombreSala);
      nombresUsuarios.set(socket.id, nombreUsuario);

      console.log(`${nombreUsuario} se unió a ${nombreSala}`);

      // Obtener los participantes de la sala
      const participantes = Array.from(
        io.sockets.adapter.rooms.get(nombreSala) || []
      ).map((id) => ({
        id,
        nombre: nombresUsuarios.get(id) || "Usuario"
      }));

      socket.emit("lista-participantes", participantes);

      // Avisar a los demás que llegó un usuario
      socket.to(nombreSala).emit("usuario-unido", {
        id: socket.id,
        nombre: nombreUsuario
      });

      // Confirmar que entró a la sala
      socket.emit("sala-unida", {
        sala: nombreSala,
        usuario: nombreUsuario
      });
    });


    // Un usuario sale voluntariamente
    socket.on("salir-sala", (nombreSala) => {

      if (typeof nombreSala !== "string") return;

      const nombreUsuario = nombresUsuarios.get(socket.id) || "Usuario";

      // Avisar a los demás participantes
      socket.to(nombreSala).emit("usuario-salio", {
        id: socket.id,
        nombre: nombreUsuario
      });

      // Sacar al usuario de la sala
      socket.leave(nombreSala);

      console.log(`${nombreUsuario} salió de ${nombreSala}`);

      // Obtener la lista actualizada
      const participantes = Array.from(
        io.sockets.adapter.rooms.get(nombreSala) || []
      ).map((id) => ({
        id,
        nombre: nombresUsuarios.get(id) || "Usuario"
      }));

      // Enviar la lista a quienes permanecen
      io.to(nombreSala).emit("lista-participantes", participantes);
    });


    // Cuando un usuario se desconecta
    socket.on("disconnecting", () => {

      const nombreUsuario = nombresUsuarios.get(socket.id) || "Usuario";

      // Recorrer todas las salas del usuario
      for (const nombreSala of socket.rooms) {

        // Ignorar la sala privada del socket
        if (nombreSala !== socket.id) {

          // Avisar que el usuario se desconectó
          socket.to(nombreSala).emit("usuario-desconectado", {
            id: socket.id,
            nombre: nombreUsuario
          });

          console.log(
            `${nombreUsuario} se desconectó de ${nombreSala}`
          );

          // Actualizar la lista de participantes
          const participantes = Array.from(
            io.sockets.adapter.rooms.get(nombreSala) || []
          )
            .filter((id) => id !== socket.id)
            .map((id) => ({
              id,
              nombre: nombresUsuarios.get(id) || "Usuario"
            }));

          // Enviar la lista actualizada a los demás
          socket.to(nombreSala).emit(
            "lista-participantes",
            participantes
          );
        }
      }
    });


    // Cuando termina la desconexión
    socket.on("disconnect", () => {

      nombresUsuarios.delete(socket.id);

      console.log("Usuario desconectado:", socket.id);
    });

  });

}

module.exports = configurarSalas;
