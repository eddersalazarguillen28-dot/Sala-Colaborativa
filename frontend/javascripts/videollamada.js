
const socketVideo = window.socketSala;

// Elementos HTML
const videoLocal = document.getElementById("videoLocal");
const btnMicrofono = document.getElementById("btnMicrofono");
const btnCamara = document.getElementById("btnCamara");
const btnSalirLlamada = document.getElementById("btnSalirLlamada");

const estadoMicrofono = document.getElementById("estadoMicrofono");
const nivelAudio = document.getElementById("nivelAudio");
const selectorMicrofono = document.getElementById("selectorMicrofono");

// Flujos independientes
let flujoAudio = null;
let flujoCamara = null;

let pistaAudio = null;
let pistaVideo = null;

// Analizador de sonido
let contextoAudio = null;
let analizador = null;
let fuenteAudio = null;
let datosAudio = null;
let animacionAudio = null;

// Buscar micrófonos disponibles
async function comprobarMicrofonos() {
    try {
        // Solicitamos audio y video (cámbialo a video: false si estrictamente solo quieres audio)
        flujoLocal = await navigator.mediaDevices.getUserMedia({
            video: true, 
            audio: true
        });

        if (videoLocal) {
            videoLocal.srcObject = flujoLocal;
        }

        console.log("Micrófonos encontrados:", microfonos);

        if (btnMicrofono) btnMicrofono.textContent = "Desactivar micrófono";
        if (btnCamara) btnCamara.textContent = "Desactivar cámara";

        console.log("Dispositivos de audio y video activados correctamente");
    } catch (error) {
        console.error("Error al acceder a los dispositivos:", error);
        alert("No se pudo acceder a la cámara o al micrófono. Revisá los permisos en tu navegador.");
    }
}

// Control del Micrófono
if (btnMicrofono) {
    btnMicrofono.addEventListener("click", () => {
        if (!pistaAudio) return;

        pistaAudio.enabled = !pistaAudio.enabled;
        btnMicrofono.textContent = pistaAudio.enabled
            ? "Desactivar micrófono"
            : "Activar micrófono";
    });
}

// Control de la Cámara (Faltaba este evento)
if (btnCamara) {
    btnCamara.addEventListener("click", () => {
        if (!pistaVideo) return;

        pistaVideo.enabled = !pistaVideo.enabled;
        btnCamara.textContent = pistaVideo.enabled
            ? "Desactivar cámara"
            : "Activar cámara";
    });
}

// Salir de la llamada y liberar recursos
if (btnSalirLlamada) {
    btnSalirLlamada.addEventListener("click", () => {
        if (flujoLocal) {
            flujoLocal.getTracks().forEach(pista => pista.stop());

            flujoLocal = null;
            pistaAudio = null;
            pistaVideo = null;

            if (videoLocal) videoLocal.srcObject = null;

            if (btnMicrofono) btnMicrofono.textContent = "Activar micrófono";
            if (btnCamara) btnCamara.textContent = "Activar cámara";

            console.log("Saliste de la llamada");
        }
    });
}

// Botón de cámara
btnCamara.addEventListener("click", async () => {

    if (flujoCamara) {
        flujoCamara.getTracks().forEach(pista => pista.stop());

        flujoCamara = null;
        pistaVideo = null;

        videoLocal.srcObject = null;

        btnCamara.textContent = "Activar cámara";

        console.log("Cámara desactivada");
        return;
    }

    try {
        flujoCamara = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        pistaVideo = flujoCamara.getVideoTracks()[0];

        videoLocal.srcObject = flujoCamara;

        btnCamara.textContent = "Desactivar cámara";

        console.log("Cámara activada");

    } catch (error) {
        console.error("Error al activar la cámara:", error);
        alert("No se pudo acceder a la cámara. Revisá los permisos y el dispositivo.");
    }
});

// Botón salir de la llamada
btnSalirLlamada.addEventListener("click", () => {

    // Detener micrófono
    if (flujoAudio) {
        flujoAudio.getTracks().forEach(pista => pista.stop());
        flujoAudio = null;
        pistaAudio = null;
    }

    // Detener cámara
    if (flujoCamara) {
        flujoCamara.getTracks().forEach(pista => pista.stop());
        flujoCamara = null;
        pistaVideo = null;
    }

    // Limpiar video
    videoLocal.srcObject = null;

    // Detener analizador
    detenerIndicadorAudio();

    // Restablecer botones y estado
    btnMicrofono.textContent = "Activar micrófono";
    btnCamara.textContent = "Activar cámara";

    estadoMicrofono.textContent = "Micrófono apagado";
    estadoMicrofono.style.color = "#f87171";

    console.log("Saliste de la llamada");
});

// Actualizar dispositivos al conectar o desconectar uno
comprobarMicrofonos();

navigator.mediaDevices.addEventListener(
    "devicechange",
    comprobarMicrofonos
);

console.log(
    socketVideo
        ? "Videollamada preparada para utilizar Socket.IO"
        : "No se encontró la conexión compartida de Socket.IO"
);
