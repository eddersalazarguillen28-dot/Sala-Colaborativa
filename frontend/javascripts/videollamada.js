const videoLocal = document.getElementById("videoLocal");
const btnMicrofono = document.getElementById("btnMicrofono");
const btnCamara = document.getElementById("btnCamara");
const btnSalirLlamada = document.getElementById("btnSalirLlamada");

let flujoLocal = null;
let pistaAudio = null;
let pistaVideo = null;

async function iniciarDispositivo() {
    try {
        // Solicitamos audio y video (cámbialo a video: false si estrictamente solo quieres audio)
        flujoLocal = await navigator.mediaDevices.getUserMedia({
            video: true, 
            audio: true
        });

        if (videoLocal) {
            videoLocal.srcObject = flujoLocal;
        }

        pistaAudio = flujoLocal.getAudioTracks()[0];
        pistaVideo = flujoLocal.getVideoTracks()[0];

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

iniciarDispositivo();