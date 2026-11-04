const videoLocal = document.getElementById("videoLocal");
const btnMicrofono = document.getElementById("btnMicrofono");
const btnCamara = document.getElementById("btnCamara");
const btnSalirLlamada = document.getElementById("btnSalirLlamada");

let flujoLocal = null;
let pistaAudio = null;
let pistaVideo = null;

async function iniciarDispositivo() {
    try {
        flujoLocal = await
        navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        });

        videoLocal.srcObject = flujoLocal;

        pistaAudio = flujoLocal.getAudioTracks()[0];
        pistaVideo = flujoLocal.getVideoTracks()[0];

        btnMicrofono.textContent = "Desactivar micrófono";
        btnCamara.textContent = "Desactivar cámara";

        console.log("Cámara y micrófono activados");
    } catch (error) {
        console.error("Error al acceder a los dispositivos:", error);
        alert("No se pudo acceder a la cámara o al micrófono. Revisá los permisos");
    }
}

btnMicrofono.addEventListener("click", () => {
    if (!pistaAudio) return;

    pistaAudio.enabled = !pistaAudio.enabled;

    btnMicrofono.textContent = pistaAudio.enabled
    ? "Desactivar micrófono"
    : "Activar micrófono";
});

btnSalirLlamada.addEventListener("click", () => {
    if (flujoLocal) {
        flujoLocal.getTracks().forEach(pista => pista.stop());

        flujoLocal =null
        pistaAudio =null
        pistaVideo =null

        videoLocal.srcObject = null;

        btnMicrofono.textContent = "Activar micrófono";
        btnCamara.textContent = "Activar cámara";

        console.log("Saliste de la llamada");
    }
});

iniciarDispositivo();