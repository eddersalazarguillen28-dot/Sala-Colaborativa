const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

// Importar los módulos de Socket.io
const configurarSalas = require("./sockets/salas");
const configurarPizarra = require("./sockets/pizarra");

// Crear la aplicación Express
const app = express();

app.use(cors());
app.use(express.json());

// Crear el servidor HTTP
const server = http.createServer(app);

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

//SALA USUARIOS///////
const salasUsuarios = {};
////////////////////////////////

// Configurar la gestión de salas
configurarSalas(io);

// Configurar la sincronización de la pizarra
configurarPizarra(io);

// Ruta principal
app.get("/", (req, res) => {
  res.send("Servidor de Sala Colaborativa funcionando");
});

// Ruta para comprobar el estado del servidor
app.get("/api/estado", (req, res) => {
  res.json({
    proyecto: "Sala Colaborativa",
    estado: "Activo",
    servidor: "Node.js",
    funcionalidades: [
      "Gestión de salas",
      "Participantes en tiempo real",
      "Sincronización de pizarra",
      "Chat en tiempo real",
      "Videollamada WebRTC"
    ]
  });
});

// Monitoreo avanzado de conexiones, salas y eventos en tiempo real (Etapa 4)
io.on("connection", (socket) => {
  console.log(`🟢 [CONEXIÓN] Nuevo cliente conectado ID: ${socket.id}`);

  let usuarioActual = "Christopher / Invitado";
  let salaActual = null;

  // Registrar cuando se unan a una sala (con filtro de duplicados y unión real)
  socket.on("unirse-sala", (datos) => {
    if (datos) {
      const nuevaSala = datos.nombreSala || datos.sala;
      const nuevoUsuario = datos.nombreUsuario || usuarioActual;

      // Si el cliente ya está registrado en esta sala con este nombre, evitamos duplicar
      if (salaActual === nuevaSala && usuarioActual === nuevoUsuario) {
        return;
      }

      salaActual = nuevaSala;
      usuarioActual = nuevoUsuario;

      ///////SALA USUARIO//////////////////
      socket.join(salaActual);

      if (!salasUsuarios[salaActual]) {
        salasUsuarios[salaActual] = [];
      } 

      if (!salasUsuarios[salaActual].includes(usuarioActual)) {
        salasUsuarios[salaActual].push(usuarioActual);
      }

      io.to(salaActual).emit("user-joined",{
        nombre:usuarioActual,
        usuarios:salasUsuarios[salaActual]
      });

      console.log(`[SALA] Usuario "${usuarioActual}" (${socket.id}) se unió a: "${salaActual}"`);
      /////////////////////////////////////////////////////////////////////////////////////////////////////////
    }
  });

  // Registrar mensajes del chat si fluyen por aquí
  socket.on("enviar-mensaje", (datos) => {
    const { nombreSala, texto } = datos || {};
    console.log(`💬 [CHAT] [Sala: ${nombreSala || salaActual}] ${usuarioActual}: "${texto}"`);
  });

  // Registrar limpieza de pizarra
  socket.on("limpiar-pizarra", (sala) => {
    console.log(`🧹 [PIZARRA] La sala "${sala || salaActual}" fue limpiada por ${usuarioActual}`);
  });

  // --- SEÑALIZACIÓN WEBRTC PARA VIDEOLLAMADA ---

  socket.on("oferta-webrtc", (datos) => {
    if (
      !datos ||
      !datos.sala ||
      !datos.destino ||
      !datos.oferta ||
      !socket.rooms.has(datos.sala)
    ) return;

    const destinatario = io.sockets.sockets.get(datos.destino);

    if (!destinatario || !destinatario.rooms.has(datos.sala)) return;

    io.to(datos.destino).emit("oferta-webrtc", {
      oferta: datos.oferta,
      emisor: socket.id
    });
  });

  socket.on("respuesta-webrtc", (datos) => {
    if (
      !datos ||
      !datos.sala ||
      !datos.destino ||
      !datos.respuesta ||
      !socket.rooms.has(datos.sala)
    ) return;

    const destinatario = io.sockets.sockets.get(datos.destino);

    if (!destinatario || !destinatario.rooms.has(datos.sala)) return;

    io.to(datos.destino).emit("respuesta-webrtc", {
      respuesta: datos.respuesta,
      emisor: socket.id
    });
  });

  socket.on("candidato-ice", (datos) => {
    if (
      !datos ||
      !datos.sala ||
      !datos.destino ||
      !datos.candidato ||
      !socket.rooms.has(datos.sala)
    ) return;

    const destinatario = io.sockets.sockets.get(datos.destino);

    if (!destinatario || !destinatario.rooms.has(datos.sala)) return;

    io.to(datos.destino).emit("candidato-ice", {
      candidato: datos.candidato,
      emisor: socket.id
    });
  });

  // Monitorear el proceso previo a la desconexión
  socket.on("disconnecting", () => {
    const salas = Array.from(socket.rooms);
    console.log(`⚠️ [AVISO] El cliente ${socket.id} (${usuarioActual}) va a salir de las salas:`, salas);
  });

  // Detectar desconexión definitiva
  socket.on("disconnect", (reason) => {
    if(salaActual && salasUsuarios[salaActual]){
      salasUsuarios[salaActual] = salasUsuarios[salaActual].filter(u => u !== usuarioActual);
      io.to(salaActual).emit("user-left",{
        nombre:usuarioActual,
        usuarios:salasUsuarios[salaActual]
      });
    }
    console.log(`🔴 [DESCONEXIÓN] Cliente desconectado ID: ${socket.id} (${usuarioActual}). Razón: ${reason}`);
  });
});

// Iniciar el servidor (Dinámico para Render o local en puerto 3000)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});