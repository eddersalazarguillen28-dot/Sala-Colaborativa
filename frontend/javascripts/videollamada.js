// ==========================================
// CONEXIÓN SOCKET.IO
// ==========================================

const socketVideo = window.socket;

// ==========================================
// ELEMENTOS HTML
// ==========================================

const videoLocal = document.getElementById("videoLocal");

const btnMicrofono = document.getElementById("btnMicrofono");
const btnCamara = document.getElementById("btnCamara");
const btnSalirLlamada = document.getElementById("btnSalirLlamada");

const estadoMicrofono = document.getElementById("estadoMicrofono");
const nivelAudio = document.getElementById("nivelAudio");
const selectorMicrofono = document.getElementById("selectorMicrofono");

// ==========================================
// FLUJOS DE AUDIO Y VIDEO
// ==========================================

let flujoAudio = null;
let flujoCamara = null;

let pistaAudio = null;
let pistaVideo = null;

let microfonoSeleccionado = "";

// ==========================================
// ANALIZADOR DE AUDIO
// ==========================================

let contextoAudio = null;
let analizador = null;
let fuenteAudio = null;
let datosAudio = null;
let animacionAudio = null;

// ==========================================
// COMPROBAR COMPATIBILIDAD
// ==========================================

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

    console.error("El navegador no permite acceder a los dispositivos.");

    if (estadoMicrofono) {
        estadoMicrofono.textContent = "Dispositivos no disponibles";
    }

} else {

    // ==========================================
    // BUSCAR MICRÓFONOS DISPONIBLES
    // ==========================================

    async function comprobarMicrofonos() {

        try {

            const dispositivos = await navigator.mediaDevices.enumerateDevices();

            const microfonos = dispositivos.filter(
                dispositivo => dispositivo.kind === "audioinput"
            );

            if (!selectorMicrofono) return;

            const seleccionAnterior = selectorMicrofono.value;

            selectorMicrofono.innerHTML = "";

            if (microfonos.length === 0) {

                selectorMicrofono.innerHTML =
                    '<option value="">No se encontraron micrófonos</option>';

                console.warn("No se encontraron micrófonos.");

                return;
            }

            microfonos.forEach((microfono, indice) => {

                const opcion = document.createElement("option");

                opcion.value = microfono.deviceId;

                opcion.textContent =
                    microfono.label || `Micrófono ${indice + 1}`;

                selectorMicrofono.appendChild(opcion);

            });

            // Conservar el dispositivo seleccionado si sigue disponible
            const existeAnterior = microfonos.some(
                microfono => microfono.deviceId === seleccionAnterior
            );

            if (existeAnterior) {
                selectorMicrofono.value = seleccionAnterior;
            } else if (microfonoSeleccionado &&
                microfonos.some(m => m.deviceId === microfonoSeleccionado)) {

                selectorMicrofono.value = microfonoSeleccionado;

            }

            microfonoSeleccionado = selectorMicrofono.value;

            console.log("Micrófonos encontrados:", microfonos);

        } catch (error) {

            console.error("Error al buscar micrófonos:", error);

        }
    }

    // ==========================================
    // SOLICITAR PERMISO PARA MOSTRAR LOS MICRÓFONOS
    // ==========================================

    async function iniciarDispositivo() {

        try {

            // Solicitamos únicamente el micrófono.
            // No necesitamos cámara para detectar los dispositivos de audio.

            const permiso = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            // Liberamos el flujo temporal.
            permiso.getTracks().forEach(pista => pista.stop());

            console.log("Permiso de micrófono concedido.");

            await comprobarMicrofonos();

        } catch (error) {

            console.error("No se pudo acceder al micrófono:", error);

            if (selectorMicrofono) {

                selectorMicrofono.innerHTML =
                    '<option value="">Permiso de micrófono denegado</option>';

            }

            if (estadoMicrofono) {
                estadoMicrofono.textContent = "Permiso de micrófono requerido";
            }
        }
    }

    // ==========================================
    // ACTIVAR MICRÓFONO
    // ==========================================

    async function activarMicrofono() {

        try {

            if (flujoAudio) return;

            const restricciones = microfonoSeleccionado
                ? {
                    audio: {
                        deviceId: {
                            exact: microfonoSeleccionado
                        }
                    },
                    video: false
                }
                : {
                    audio: true,
                    video: false
                };

            flujoAudio = await navigator.mediaDevices.getUserMedia(
                restricciones
            );

            pistaAudio = flujoAudio.getAudioTracks()[0];

            pistaAudio.enabled = true;

            btnMicrofono.textContent = "Desactivar micrófono";

            estadoMicrofono.textContent = "Micrófono encendido";

            estadoMicrofono.style.color = "#35d07f";

            iniciarIndicadorAudio();

            console.log("Micrófono activado.");

        } catch (error) {

            console.error("Error al activar el micrófono:", error);

            alert(
                "No se pudo activar el micrófono. Revisá los permisos y el dispositivo seleccionado."
            );

        }
    }

    // ==========================================
    // DESACTIVAR MICRÓFONO
    // ==========================================

    function desactivarMicrofono() {

        if (flujoAudio) {

            flujoAudio.getTracks().forEach(pista => pista.stop());

            flujoAudio = null;
            pistaAudio = null;

        }

        detenerIndicadorAudio();

        btnMicrofono.textContent = "Activar micrófono";

        estadoMicrofono.textContent = "Micrófono apagado";

        estadoMicrofono.style.color = "#f87171";

        console.log("Micrófono desactivado.");
    }

    // ==========================================
    // BOTÓN DEL MICRÓFONO
    // ==========================================

    if (btnMicrofono) {

        btnMicrofono.addEventListener("click", async () => {

            if (flujoAudio) {
                desactivarMicrofono();
            } else {
                await activarMicrofono();
            }

        });

    }

    // ==========================================
    // CAMBIAR MICRÓFONO
    // ==========================================

    if (selectorMicrofono) {

        selectorMicrofono.addEventListener("change", async () => {

            microfonoSeleccionado = selectorMicrofono.value;

            console.log(
                "Micrófono seleccionado:",
                microfonoSeleccionado
            );

            // Si el micrófono ya está encendido,
            // cambiamos al nuevo dispositivo.

            if (flujoAudio) {

                desactivarMicrofono();

                await activarMicrofono();

            }

        });

    }

    // ==========================================
    // ACTIVAR CÁMARA
    // ==========================================

    async function activarCamara() {

        try {

            if (flujoCamara) return;

            flujoCamara = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            pistaVideo = flujoCamara.getVideoTracks()[0];

            if (videoLocal) {
                videoLocal.srcObject = flujoCamara;
            }

            btnCamara.textContent = "Desactivar cámara";

            console.log("Cámara activada.");

        } catch (error) {

            console.error("Error al activar la cámara:", error);

            alert(
                "No se pudo activar la cámara. Revisá los permisos y el dispositivo."
            );

        }
    }

    // ==========================================
    // DESACTIVAR CÁMARA
    // ==========================================

    function desactivarCamara() {

        if (flujoCamara) {

            flujoCamara.getTracks().forEach(pista => pista.stop());

            flujoCamara = null;
            pistaVideo = null;

        }

        if (videoLocal) {
            videoLocal.srcObject = null;
        }

        btnCamara.textContent = "Activar cámara";

        console.log("Cámara desactivada.");

    }

    // ==========================================
    // BOTÓN DE CÁMARA
    // ==========================================

    if (btnCamara) {

        btnCamara.addEventListener("click", async () => {

            if (flujoCamara) {
                desactivarCamara();
            } else {
                await activarCamara();
            }

        });

    }

    // ==========================================
    // ANALIZADOR DE AUDIO
    // ==========================================

    async function iniciarIndicadorAudio() {

        try {

            if (!flujoAudio) return;

            detenerIndicadorAudio();

            contextoAudio = new AudioContext();

            if (contextoAudio.state === "suspended") {
                await contextoAudio.resume();
            }

            analizador = contextoAudio.createAnalyser();

            fuenteAudio = contextoAudio.createMediaStreamSource(
                flujoAudio
            );

            analizador.fftSize = 256;

            datosAudio = new Uint8Array(
                analizador.frequencyBinCount
            );

            fuenteAudio.connect(analizador);

            function actualizarNivel() {

                if (!analizador || !datosAudio) return;

                analizador.getByteFrequencyData(datosAudio);

                const promedio = datosAudio.reduce(
                    (suma, valor) => suma + valor,
                    0
                ) / datosAudio.length;

                const porcentaje = Math.min(
                    100,
                    (promedio / 100) * 100
                );

                if (nivelAudio) {
                    nivelAudio.style.width = porcentaje + "%";
                }

                animacionAudio = requestAnimationFrame(
                    actualizarNivel
                );

            }

            actualizarNivel();

        } catch (error) {

            console.error("Error en el indicador de audio:", error);

        }
    }

    // ==========================================
    // DETENER ANALIZADOR DE AUDIO
    // ==========================================

    function detenerIndicadorAudio() {

        if (animacionAudio) {
            cancelAnimationFrame(animacionAudio);
            animacionAudio = null;
        }

        if (fuenteAudio) {
            fuenteAudio.disconnect();
            fuenteAudio = null;
        }

        if (contextoAudio) {

            contextoAudio.close();

            contextoAudio = null;

        }

        analizador = null;
        datosAudio = null;

        if (nivelAudio) {
            nivelAudio.style.width = "0%";
        }

    }

    // ==========================================
    // SALIR DE LA LLAMADA
    // ==========================================

    function salirDeLlamada() {

        desactivarMicrofono();

        desactivarCamara();

        console.log("Saliste de la llamada.");

    }

    if (btnSalirLlamada) {

        btnSalirLlamada.addEventListener(
            "click",
            salirDeLlamada
        );

    }

    // ==========================================
    // ACTUALIZAR DISPOSITIVOS
    // ==========================================

    navigator.mediaDevices.addEventListener(
        "devicechange",
        comprobarMicrofonos
    );

    // ==========================================
    // INICIAR
    // ==========================================

    iniciarDispositivo();

}

// ==========================================
// VERIFICAR SOCKET.IO
// ==========================================

console.log(
    socketVideo
        ? "Videollamada preparada para utilizar Socket.IO."
        : "No se encontró la conexión compartida de Socket.IO."
);