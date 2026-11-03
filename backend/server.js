
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

// Importar la configuración de salas
const configurarSalas = require("./sockets/salas");

// Crear la aplicación
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

// Configurar las salas
configurarSalas(io);

// Ruta principal
app.get("/", (req, res) => {
  res.send("Servidor de Sala Colaborativa funcionando");
});

// Ruta para comprobar el estado
app.get("/api/estado", (req, res) => {
  res.json({
    proyecto: "Sala Colaborativa",
    estado: "Activo",
    servidor: "Node.js"
  });
});

// Detectar conexiones de usuarios
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
