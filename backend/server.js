const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

// ==========================================
// IMPORTAR MÓDULOS
// ==========================================

const configurarSalas = require("./sockets/salas");
const configurarPizarra = require("./sockets/pizarra");

// ==========================================
// CREAR APLICACIÓN
// ==========================================

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json());

// ==========================================
// CREAR SERVIDOR HTTP
// ==========================================

const server = http.createServer(app);

// ==========================================
// CONFIGURAR SOCKET.IO
// ==========================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingInterval: 25000,
    pingTimeout: 60000
});

// ==========================================
// REGISTRAR MÓDULOS
// ==========================================

configurarSalas(io);
configurarPizarra(io);

const path = require("path");

// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {
    res.status(200).send(
        "Servidor de Sala Colaborativa funcionando correctamente"
    );
});

// ==========================================
// ESTADO DEL SERVIDOR
// ==========================================

app.get("/api/estado", (req, res) => {

    res.status(200).json({
        proyecto: "Sala Colaborativa",
        estado: "Activo",
        servidor: "Node.js",
        socket: "Socket.IO conectado",
        funcionalidades: [
            "Gestión de salas",
            "Participantes en tiempo real",
            "Chat en tiempo real",
            "Sincronización de pizarra",
            "Videollamada WebRTC"
        ]
    });

});

// ==========================================
// CONEXIONES Y SEÑALIZACIÓN WEBRTC
// ==========================================

io.on("connection", (socket) => {

    console.log(
        `🟢 [CONEXIÓN] Cliente conectado: ${socket.id}`
    );

    // ======================================
    // VALIDAR Y REENVIAR SEÑALES WEBRTC
    // ======================================

    function reenviarSenal(datos, tipo, propiedad) {

        if (
            !datos ||
            typeof datos !== "object" ||
            Array.isArray(datos) ||
            typeof datos.sala !== "string" ||
            typeof datos.destino !== "string" ||
            !datos.destino.trim() ||
            !datos[propiedad] ||
            typeof datos[propiedad] !== "object"
        ) {

            socket.emit(
                "error-webrtc",
                "Los datos de señalización son inválidos"
            );

            return;
        }

        const nombreSala = datos.sala.trim();
        const idDestino = datos.destino.trim();

        if (!nombreSala) {
            socket.emit("error-webrtc", "Nombre de sala inválido");
            return;
        }

        // Comprobar que el emisor pertenezca a la sala.
        if (!socket.rooms.has(nombreSala)) {

            console.log(
                `⚠️ [WEBRTC] El emisor ${socket.id} no pertenece a ${nombreSala}`
            );

            socket.emit(
                "error-webrtc",
                "No perteneces a esta sala"
            );

            return;
        }

        // Buscar al destinatario.
        const destinatario = io.sockets.sockets.get(idDestino);

        // Comprobar que el destinatario esté conectado.
        if (!destinatario) {

            console.log(
                `⚠️ [WEBRTC] Destinatario desconectado: ${idDestino}`
            );

            socket.emit(
                "error-webrtc",
                "El participante destinatario no está conectado"
            );

            return;
        }

        // Comprobar que ambos estén en la misma sala.
        if (!destinatario.rooms.has(nombreSala)) {

            console.log(
                `⚠️ [WEBRTC] Destinatario fuera de la sala: ${idDestino}`
            );

            socket.emit(
                "error-webrtc",
                "El destinatario no pertenece a esta sala"
            );

            return;
        }

        // Reenviar señal únicamente al destinatario.
        io.to(idDestino).emit(tipo, {
            [propiedad]: datos[propiedad],
            emisor: socket.id
        });

        console.log(
            `📡 [WEBRTC] ${tipo}: ${socket.id} → ${idDestino} (${nombreSala})`
        );

    }

    // ======================================
    // RECIBIR OFERTA WEBRTC
    // ======================================

    socket.on("oferta-webrtc", (datos) => {

        reenviarSenal(
            datos,
            "oferta-webrtc",
            "oferta"
        );

    });

    // ======================================
    // RECIBIR RESPUESTA WEBRTC
    // ======================================

    socket.on("respuesta-webrtc", (datos) => {

        reenviarSenal(
            datos,
            "respuesta-webrtc",
            "respuesta"
        );

    });

    // ======================================
    // RECIBIR CANDIDATOS ICE
    // ======================================

    socket.on("candidato-ice", (datos) => {

        reenviarSenal(
            datos,
            "candidato-ice",
            "candidato"
        );

    });

    // ======================================
    // DETECTAR DESCONEXIÓN
    // ======================================

    socket.on("disconnect", (reason) => {

        console.log(
            `🔴 [DESCONEXIÓN] Cliente: ${socket.id}`
        );

        console.log(
            `Motivo: ${reason}`
        );

    });

});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🚀 Servidor de Sala Colaborativa escuchando en el puerto ${PORT}`
    );

});

// ==========================================
// MANEJO DE ERRORES DEL SERVIDOR
// ==========================================

server.on("error", (error) => {

    console.error(
        "❌ Error en el servidor HTTP:",
        error
    );

});