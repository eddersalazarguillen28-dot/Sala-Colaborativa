
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
      "Sincronización de pizarra"
    ]
  });
});

// Detectar conexiones y desconexiones
io.on("connection", (socket) => {

  console.log("Usuario conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });

});

// Iniciar el servidor
const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
