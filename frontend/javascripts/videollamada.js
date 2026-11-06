
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
        const dispositivos =
            await navigator.mediaDevices.enumerateDevices();

        const microfonos = dispositivos.filter(
            dispositivo => dispositivo.kind === "audioinput"
        );

        const seleccionadoAnterior = selectorMicrofono.value;

        selectorMicrofono.innerHTML = "";

        microfonos.forEach((microfono, indice) => {
            const opcion = document.createElement("option");

            opcion.value = microfono.deviceId;
            opcion.textContent =
                microfono.label || `Micrófono ${indice + 1}`;

            selectorMicrofono.appendChild(opcion);
        });

        if (microfonos.length === 0) {
            selectorMicrofono.innerHTML =
                '<option value="">No se encontraron micrófonos</option>';
        } else if (
            microfonos.some(m => m.deviceId === seleccionadoAnterior)
        ) {
            selectorMicrofono.value = seleccionadoAnterior;
        }

        console.log("Micrófonos encontrados:", microfonos);

    } catch (error) {
        console.error("Error buscando micrófonos:", error);
    }
}

// Activar micrófono
async function iniciarMicrofono() {
    try {
        const dispositivo = selectorMicrofono.value;

        flujoAudio = await navigator.mediaDevices.getUserMedia({
            audio: dispositivo
                ? { deviceId: { exact: dispositivo } }
                : true,
            video: false
        });

        pistaAudio = flujoAudio.getAudioTracks()[0];

        console.log("Micrófono utilizado:", pistaAudio.label);

        await comprobarMicrofonos();

        btnMicrofono.textContent = "Desactivar micrófono";
        estadoMicrofono.textContent = "Micrófono activado";
        estadoMicrofono.style.color = "#35d07f";

        iniciarIndicadorAudio();

    } catch (error) {
        console.error("Error al activar el micrófono:", error);
        estadoMicrofono.textContent = "Error al activar el micrófono";
        estadoMicrofono.style.color = "#f87171";
    }
}

// CAMBIAR AUTOMÁTICAMENTE EL MICRÓFONO SELECCIONADO
selectorMicrofono.addEventListener("change", async () => {

    if (!pistaAudio) {
        console.log(
            "Micrófono seleccionado:",
            selectorMicrofono.selectedOptions[0]?.textContent
        );
        return;
    }

    const microfonoEstabaActivo = pistaAudio.enabled;

    // Detener el micrófono anterior
    if (flujoAudio) {
        flujoAudio.getAudioTracks().forEach(pista => pista.stop());
    }

    detenerIndicadorAudio();

    flujoAudio = null;
    pistaAudio = null;

    // Activar el nuevo dispositivo
    await iniciarMicrofono();

    // Conservar el estado de silencio anterior
    if (!microfonoEstabaActivo && pistaAudio) {
        pistaAudio.enabled = false;

        btnMicrofono.textContent = "Activar micrófono";
        estadoMicrofono.textContent = "Micrófono silenciado";
        estadoMicrofono.style.color = "#f87171";

        nivelAudio.style.width = "0%";
    }

    console.log("Cambio de micrófono completado");
});

// Medir el sonido del micrófono
async function iniciarIndicadorAudio() {
    detenerIndicadorAudio();

    contextoAudio = new AudioContext();

    await contextoAudio.resume();

    fuenteAudio = contextoAudio.createMediaStreamSource(flujoAudio);

    analizador = contextoAudio.createAnalyser();
    analizador.fftSize = 2048;

    fuenteAudio.connect(analizador);

    datosAudio = new Float32Array(analizador.fftSize);

    function actualizarNivel() {
        if (!pistaAudio || !pistaAudio.enabled) {
            nivelAudio.style.width = "0%";
            animacionAudio = requestAnimationFrame(actualizarNivel);
            return;
        }

        analizador.getFloatTimeDomainData(datosAudio);

        let suma = 0;

        for (let i = 0; i < datosAudio.length; i++) {
            suma += datosAudio[i] * datosAudio[i];
        }

        const rms = Math.sqrt(suma / datosAudio.length);

        const porcentaje = Math.min(rms * 100000, 100);

        console.log("Nivel de audio:", rms, "Porcentaje:", porcentaje);

        nivelAudio.style.width = porcentaje + "%";

        animacionAudio = requestAnimationFrame(actualizarNivel);
    }

    actualizarNivel();
}

// Detener el indicador de sonido
function detenerIndicadorAudio() {
    if (animacionAudio) {
        cancelAnimationFrame(animacionAudio);
        animacionAudio = null;
    }

    if (contextoAudio) {
        contextoAudio.close();
        contextoAudio = null;
    }

    analizador = null;
    fuenteAudio = null;

    nivelAudio.style.width = "0%";
}

// Botón de micrófono
btnMicrofono.addEventListener("click", async () => {

    if (!pistaAudio) {
        await iniciarMicrofono();
        return;
    }

    pistaAudio.enabled = !pistaAudio.enabled;

    if (pistaAudio.enabled) {
        btnMicrofono.textContent = "Desactivar micrófono";
        estadoMicrofono.textContent = "Micrófono activado";
        estadoMicrofono.style.color = "#35d07f";
    } else {
        btnMicrofono.textContent = "Activar micrófono";
        estadoMicrofono.textContent = "Micrófono silenciado";
        estadoMicrofono.style.color = "#f87171";
        nivelAudio.style.width = "0%";
    }
});

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
