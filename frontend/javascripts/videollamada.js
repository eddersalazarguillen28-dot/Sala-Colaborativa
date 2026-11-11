"use strict";

// ==========================================
// CONEXIÓN SOCKET.IO
// ==========================================

const socketVideo = window.socket;

// ==========================================
// ELEMENTOS HTML
// ==========================================

const videoLocal = document.getElementById("videoLocal");
const contenedorVideosRemotos = document.getElementById("contenedorVideosRemotos");
const btnMicrofono = document.getElementById("btnMicrofono");
const btnCamara = document.getElementById("btnCamara");
const btnEntrarLlamada = document.getElementById("btnEntrarLlamada");
const btnSalirLlamada = document.getElementById("btnSalirLlamada");
const estadoMicrofono = document.getElementById("estadoMicrofono");
const nivelAudio = document.getElementById("nivelAudio");
const selectorMicrofono = document.getElementById("selectorMicrofono");

if (!socketVideo) {
    console.error("No se encontró window.socket. Revisá el orden de carga de los scripts.");
} else {
    const salaVideo = sessionStorage.getItem("nombreSala");
    const usuarioVideo = sessionStorage.getItem("nombreUsuario");

    if (!salaVideo || !usuarioVideo) {
        console.error("No se encontraron los datos de la sala.");
    } else if (!window.RTCPeerConnection) {
        console.error("Este navegador no soporta conexiones WebRTC.");
    } else {
        // ==========================================
        // CONFIGURACIÓN WEBRTC
        // ==========================================

        const configuracionRTC = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        };

        // ==========================================
        // ESTADO DE LA VIDEOLLAMADA
        // ==========================================

        let flujoAudio = null;
        let flujoCamara = null;
        let pistaAudio = null;
        let pistaVideo = null;
        let microfonoSeleccionado = "";

        const conexionesWebRTC = new Map();
        window.conexionesWebRTC = conexionesWebRTC;
        const flujosRemotos = new Map();
        const participantesVideo = new Map();
        const candidatosPendientes = new Map();
        const participantesActivosVideo = new Set();

        socketVideo.on("lista-videollamada", (participantes) => {

            console.log("CONFIRMACIÓN DEL SERVIDOR:", participantes);

            participantesActivosVideo.clear();

            participantes.forEach((id) => {

                if (id !== socketVideo.id) {
                    participantesActivosVideo.add(id);
                }

            });

            // Mostrar el botón para salir y ocultar el de entrada.
            if (btnEntrarLlamada) btnEntrarLlamada.hidden = true;
            if (btnSalirLlamada) btnSalirLlamada.hidden = false;

            // Conectar con los participantes que ya están en la llamada.
            participantesActivosVideo.forEach((id) => {

                if (
                    participantesVideo.has(id) &&
                    socketVideo.id.localeCompare(id) < 0
                ) {
                    iniciarConexionComoEmisor(id);
                }

            });

            console.log(
                "Participantes activos en videollamada:",
                Array.from(participantesActivosVideo)
            );

        });

        socketVideo.on("sala-unida", (datos) => {

            if (datos.sala !== salaVideo) return;

            // Estado inicial mientras se confirma la entrada.
            if (btnEntrarLlamada) btnEntrarLlamada.hidden = true;
            if (btnSalirLlamada) btnSalirLlamada.hidden = false;

            socketVideo.emit("entrar-videollamada", salaVideo);

            console.log(
                "Solicitando entrada a la videollamada:",
                salaVideo
            );

        });

        socketVideo.on("participante-entro-videollamada", (datos) => {
            const idParticipante = datos.id;

            if (idParticipante === socketVideo.id) return;

            participantesActivosVideo.add(idParticipante);

            const participante = participantesVideo.get(idParticipante);

            if (participante) {
                iniciarConexionComoEmisor(idParticipante);
            }

            console.log(
                "Participante entró a la videollamada:",
                idParticipante
            );
        })

        socketVideo.on("participante-salio-videollamada", (datos) => {
            const idParticipante = datos.id;

            participantesActivosVideo.delete(idParticipante);

            eliminarParticipante(idParticipante);

            console.log(
                "Participante salió de la videollamada:",
                idParticipante
            );
        });

        const ofertasEnProceso = new Set();
        const respuestasEnProceso = new Set();

        // Estado del analizador de audio
        let contextoAudio = null;
        let analizador = null;
        let fuenteAudio = null;
        let datosAudio = null;
        let animacionAudio = null;

        function perteneceALaSala() {
            return socketVideo.connected &&
                typeof socketVideo.id === "string" &&
                Boolean(salaVideo) &&
                Boolean(usuarioVideo);
        }

        // ==========================================
        // ELEMENTOS DE VIDEO REMOTO
        // ==========================================

        function obtenerVideoRemoto(idParticipante) {
            if (!contenedorVideosRemotos) return null;

            let video = document.getElementById(`video-remoto-${idParticipante}`);
            if (video) return video;

            const tarjeta = document.createElement("div");
            tarjeta.className = "video-participante";
            tarjeta.id = `participante-video-${idParticipante}`;

            video = document.createElement("video");
            video.id = `video-remoto-${idParticipante}`;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = false;

            const nombre = document.createElement("span");
            nombre.textContent = participantesVideo.get(idParticipante) || "Participante";

            tarjeta.appendChild(video);
            tarjeta.appendChild(nombre);
            contenedorVideosRemotos.appendChild(tarjeta);
            return video;
        }

        function actualizarNombreParticipante(idParticipante) {
            const tarjeta = document.getElementById(`participante-video-${idParticipante}`);
            if (!tarjeta) return;

            const etiqueta = tarjeta.querySelector("span");
            if (etiqueta) {
                etiqueta.textContent = participantesVideo.get(idParticipante) || "Participante";
            }
        }

        // ==========================================
        // TRANSCEPTORES Y PISTAS LOCALES
        // ==========================================

        function obtenerTransceptor(conexion, tipo) {
            return conexion.getTransceivers().find(transceptor =>
                transceptor.receiver &&
                transceptor.receiver.track &&
                transceptor.receiver.track.kind === tipo
            );
        }

        async function actualizarPistaLocal(conexion, tipo, pista) {
            const transceptor = obtenerTransceptor(conexion, tipo);

            if (!transceptor) {
                throw new Error(`No se encontró el transceptor ${tipo}.`);
            }

            console.log(`Transceptor ${tipo}:`, {
                direccion: transceptor.direction,
                direccionActual: transceptor.currentDirection,
                pista: pista ? pista.kind : null
            });

            if (pista && transceptor.direction === "recvonly") {
                transceptor.direction = "sendrecv";
            }

            await transceptor.sender.replaceTrack(pista || null);
        }

        async function agregarPistasAConexion(conexion) {
            await actualizarPistaLocal(conexion, "audio", pistaAudio);
            await actualizarPistaLocal(conexion, "video", pistaVideo);
        }

        async function actualizarPistasEnTodasLasConexiones() {
            const tareas = [];
            for (const conexion of conexionesWebRTC.values()) {
                tareas.push(agregarPistasAConexion(conexion));
            }

            const resultados = await Promise.allSettled(tareas);
            resultados.forEach(resultado => {
                if (resultado.status === "rejected") {
                    console.error("Error al actualizar una pista:", resultado.reason);
                }
            });
        }

        // ==========================================
        // CREAR CONEXIÓN WEBRTC
        // ==========================================

        function crearConexionWebRTC(idParticipante, crearTransceptores = false) {
            if (conexionesWebRTC.has(idParticipante)) {
                return conexionesWebRTC.get(idParticipante);
            }

            const conexion = new RTCPeerConnection(configuracionRTC);

            // El iniciador crea los canales de audio y video.
            // El receptor los obtiene al aplicar la oferta remota.
            conexion.addTransceiver("audio", { direction: "sendrecv" });
            conexion.addTransceiver("video", { direction: "sendrecv" });

            // Recibir audio y video del participante remoto.
            conexion.ontrack = evento => {
                const video = obtenerVideoRemoto(idParticipante);
                if (!video) return;

                let flujoRemoto = flujosRemotos.get(idParticipante);

                if (!flujoRemoto) {
                    flujoRemoto = new MediaStream();
                    flujosRemotos.set(idParticipante, flujoRemoto);
                }

                const existePista = flujoRemoto.getTracks().some(
                    pista => pista.id === evento.track.id
                );

                if (!existePista) {
                    flujoRemoto.addTrack(evento.track);
                }

                video.srcObject = flujoRemoto;
                video.muted = false;

                video.play().catch(error => {
                    console.warn("No se pudo reproducir el medio remoto:", error);
                });

                actualizarNombreParticipante(idParticipante);
            };

            // Enviar candidatos ICE al otro participante.
            conexion.onicecandidate = evento => {
                if (!evento.candidate || !perteneceALaSala()) return;
                socketVideo.emit("candidato-ice", {
                    sala: salaVideo,
                    destino: idParticipante,
                    candidato: evento.candidate
                });
            };

            conexion.onconnectionstatechange = () => {
                console.log(`[WEBRTC] ${idParticipante}:`, conexion.connectionState);
                if (conexion.connectionState === "failed") {
                    console.warn("La conexión WebRTC falló con:", idParticipante);
                }
            };

            conexion.oniceconnectionstatechange = () => {
                console.log(`[ICE] ${idParticipante}:`, conexion.iceConnectionState);
            };

            conexionesWebRTC.set(idParticipante, conexion);
            console.log("Conexión WebRTC creada para:", idParticipante);
            return conexion;
        }

        // ==========================================
        // PROCESAR CANDIDATOS ICE PENDIENTES
        // ==========================================

        async function procesarCandidatosPendientes(idParticipante) {
            const conexion = conexionesWebRTC.get(idParticipante);
            if (!conexion || !conexion.remoteDescription) return;

            const candidatos = candidatosPendientes.get(idParticipante) || [];
            for (const candidato of candidatos) {
                try {
                    await conexion.addIceCandidate(new RTCIceCandidate(candidato));
                } catch (error) {
                    console.error("Error al procesar candidato ICE:", error);
                }
            }
            candidatosPendientes.delete(idParticipante);
        }

        // ==========================================
        // INICIAR CONEXIÓN COMO EMISOR
        // ==========================================

        async function iniciarConexionComoEmisor(idParticipante) {
            if (!perteneceALaSala() ||
                !participantesVideo.has(idParticipante) ||
                !participantesActivosVideo.has(idParticipante) ||
                ofertasEnProceso.has(idParticipante) ||
                conexionesWebRTC.has(idParticipante)) {
                return;
            }

            // Solo el ID menor inicia la oferta.
            if (socketVideo.id.localeCompare(idParticipante) >= 0) return;

            ofertasEnProceso.add(idParticipante);
            try {
                const conexion = crearConexionWebRTC(idParticipante, true);
                await agregarPistasAConexion(conexion);

                const oferta = await conexion.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });

                await conexion.setLocalDescription(oferta);
                if (!perteneceALaSala()) return;

                socketVideo.emit("oferta-webrtc", {
                    sala: salaVideo,
                    destino: idParticipante,
                    oferta: conexion.localDescription
                });

                console.log("Oferta WebRTC enviada a:", idParticipante);

            } catch (error) {
                console.error("Error al iniciar conexión WebRTC:", error);
                eliminarParticipante(idParticipante);

            } finally {
                ofertasEnProceso.delete(idParticipante);
            }
        }

        // ==========================================
        // RECIBIR OFERTA WEBRTC
        // ==========================================

        socketVideo.on("oferta-webrtc", async datos => {
            if (!datos || !datos.emisor || !datos.oferta || !perteneceALaSala()) return;

            const idParticipante = datos.emisor;
            if (respuestasEnProceso.has(idParticipante)) return;
            respuestasEnProceso.add(idParticipante);

            try {
                // El receptor crea la conexión sin transceptores propios.
                const conexion = crearConexionWebRTC(idParticipante, false);
                if (conexion.signalingState !== "stable") {
                    console.warn("No se puede procesar la oferta. Estado:", conexion.signalingState);
                    return;
                }

                await conexion.setRemoteDescription(new RTCSessionDescription(datos.oferta));
                await agregarPistasAConexion(conexion);
                await procesarCandidatosPendientes(idParticipante);

                const respuesta = await conexion.createAnswer();
                await conexion.setLocalDescription(respuesta);
                if (!perteneceALaSala()) return;

                socketVideo.emit("respuesta-webrtc", {
                    sala: salaVideo,
                    destino: idParticipante,
                    respuesta: conexion.localDescription
                });
                console.log("Respuesta WebRTC enviada a:", idParticipante);
            } catch (error) {
                console.error("Error al recibir oferta WebRTC:", error);
                eliminarParticipante(idParticipante);
            } finally {
                respuestasEnProceso.delete(idParticipante);
            }
        });

        // ==========================================
        // RECIBIR RESPUESTA WEBRTC
        // ==========================================

        socketVideo.on("respuesta-webrtc", async datos => {
            if (!datos || !datos.emisor || !datos.respuesta) return;

            const idParticipante = datos.emisor;
            const conexion = conexionesWebRTC.get(idParticipante);
            if (!conexion) {
                console.warn("No existe conexión con:", idParticipante);
                return;
            }
            if (conexion.signalingState !== "have-local-offer") {
                console.warn("Respuesta recibida en un estado inesperado:", conexion.signalingState);
                return;
            }
            if (respuestasEnProceso.has(idParticipante)) return;
            respuestasEnProceso.add(idParticipante);

            try {
                await conexion.setRemoteDescription(new RTCSessionDescription(datos.respuesta));
                await procesarCandidatosPendientes(idParticipante);
                console.log("Respuesta WebRTC recibida de:", idParticipante);
            } catch (error) {
                console.error("Error al recibir respuesta WebRTC:", error);
            } finally {
                respuestasEnProceso.delete(idParticipante);
            }
        });

        // ==========================================
        // RECIBIR CANDIDATOS ICE
        // ==========================================

        socketVideo.on("candidato-ice", async datos => {
            if (!datos || !datos.emisor || !datos.candidato) return;

            const idParticipante = datos.emisor;
            const conexion = conexionesWebRTC.get(idParticipante);

            // Si todavía no existe la conexión o falta la descripción remota,
            // guardar el candidato para procesarlo después.
            if (!conexion || !conexion.remoteDescription) {
                if (!candidatosPendientes.has(idParticipante)) {
                    candidatosPendientes.set(idParticipante, []);
                }
                const lista = candidatosPendientes.get(idParticipante);
                if (lista.length < 200) lista.push(datos.candidato);
                return;
            }

            try {
                await conexion.addIceCandidate(new RTCIceCandidate(datos.candidato));
            } catch (error) {
                console.error("Error al recibir candidato ICE:", error);
            }
        });

        // ==========================================
        // ACTUALIZAR LISTA DE PARTICIPANTES
        // ==========================================

        socketVideo.on("lista-participantes", participantes => {
            if (!Array.isArray(participantes)) return;

            participantesVideo.clear();
            const idsActuales = new Set();

            participantes.forEach(participante => {
                if (!participante ||
                    typeof participante.id !== "string" ||
                    participante.id === socketVideo.id) return;

                idsActuales.add(participante.id);

                participantesVideo.set(
                    participante.id,
                    participante.nombre || "Participante"
                );
            });

            // Actualizar nombres de participantes.
            participantesVideo.forEach((nombre, id) => {
                actualizarNombreParticipante(id);
            });

            // Limpiar usuarios que abandonaron la sala.
            for (const id of conexionesWebRTC.keys()) {
                if (!idsActuales.has(id)) {
                    eliminarParticipante(id);
                }
            }

            for (const id of participantesActivosVideo) {
                if (!idsActuales.has(id)) {
                    participantesActivosVideo.delete(id);
                }
            }

            // Conectar únicamente con participantes activos en la llamada.
            participantesActivosVideo.forEach(id => {
                if (participantesVideo.has(id) &&
                    socketVideo.id.localeCompare(id) < 0) {
                    iniciarConexionComoEmisor(id);
                }
            });

            console.log(
                "Participantes disponibles:",
                Array.from(participantesVideo.entries())
            );

        });

        // ==========================================
        // NUEVO PARTICIPANTE
        // ==========================================

        socketVideo.on("usuario-unido", participante => {
            if (!participante || typeof participante.id !== "string" ||
                participante.id === socketVideo.id) return;

            participantesVideo.set(participante.id, participante.nombre || "Participante");
            actualizarNombreParticipante(participante.id);
            console.log("Nuevo participante en la sala:", participante.nombre);
        });

        // ==========================================
        // ELIMINAR PARTICIPANTE
        // ==========================================

        function eliminarParticipante(idParticipante) {
            participantesActivosVideo.delete(idParticipante)
            candidatosPendientes.delete(idParticipante);
            ofertasEnProceso.delete(idParticipante);
            respuestasEnProceso.delete(idParticipante);

            const tarjetaVideo = document.getElementById(`participante-video-${idParticipante}`);
            if (tarjetaVideo) {
                const video = tarjetaVideo.querySelector("video");
                if (video) video.srcObject = null;
                tarjetaVideo.remove();
            }

            const conexion = conexionesWebRTC.get(idParticipante);
            if (conexion) {
                conexion.ontrack = null;
                conexion.onicecandidate = null;
                conexion.onconnectionstatechange = null;
                conexion.oniceconnectionstatechange = null;
                conexion.close();
                conexionesWebRTC.delete(idParticipante);
            }
            console.log("Participante eliminado:", idParticipante);
        }

        socketVideo.on("usuario-salio", participante => {

            if (!participante || !participante.id) return;

            participantesActivosVideo.delete(participante.id);

            participantesVideo.delete(participante.id);

            eliminarParticipante(participante.id);

            console.log(
                "Participante abandonó la sala:",
                participante.id
            );

        });

        socketVideo.on("usuario-desconectado", participante => {

            if (!participante || !participante.id) return;

            participantesActivosVideo.delete(participante.id);

            participantesVideo.delete(participante.id);

            eliminarParticipante(participante.id);

            console.log(
                "Participante desconectado:",
                participante.id
            );

        });

        // ==========================================
        // BUSCAR MICRÓFONOS
        // ==========================================

        async function comprobarMicrofonos() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

            try {
                const dispositivos = await navigator.mediaDevices.enumerateDevices();
                const microfonos = dispositivos.filter(dispositivo => dispositivo.kind === "audioinput");
                if (!selectorMicrofono) return;

                const seleccionAnterior = microfonoSeleccionado;
                selectorMicrofono.innerHTML = "";

                if (microfonos.length === 0) {
                    const opcion = document.createElement("option");
                    opcion.value = "";
                    opcion.textContent = "No se encontraron micrófonos";
                    selectorMicrofono.appendChild(opcion);
                    microfonoSeleccionado = "";
                    return;
                }

                microfonos.forEach((microfono, indice) => {
                    const opcion = document.createElement("option");
                    opcion.value = microfono.deviceId;
                    opcion.textContent = microfono.label || `Micrófono ${indice + 1}`;
                    selectorMicrofono.appendChild(opcion);
                });

                const existeAnterior = microfonos.some(microfono =>
                    microfono.deviceId === seleccionAnterior
                );

                if (existeAnterior) {
                    selectorMicrofono.value = seleccionAnterior;
                } else {
                    microfonoSeleccionado = microfonos[0].deviceId;
                    selectorMicrofono.value = microfonoSeleccionado;
                }
            } catch (error) {
                console.error("Error al buscar micrófonos:", error);
            }
        }

        // ==========================================
        // INDICADOR DE AUDIO
        // ==========================================

        async function iniciarIndicadorAudio() {
            try {
                if (!flujoAudio) return;
                detenerIndicadorAudio();

                const ConstructorAudioContext = window.AudioContext || window.webkitAudioContext;
                if (!ConstructorAudioContext) return;

                contextoAudio = new ConstructorAudioContext();
                if (contextoAudio.state === "suspended") await contextoAudio.resume();

                analizador = contextoAudio.createAnalyser();
                fuenteAudio = contextoAudio.createMediaStreamSource(flujoAudio);
                analizador.fftSize = 256;
                datosAudio = new Uint8Array(analizador.frequencyBinCount);
                fuenteAudio.connect(analizador);

                function actualizarNivel() {
                    if (!analizador || !datosAudio) return;
                    analizador.getByteFrequencyData(datosAudio);
                    const promedio = datosAudio.reduce((suma, valor) => suma + valor, 0) / datosAudio.length;
                    const porcentaje = Math.min(100, promedio);
                    if (nivelAudio) nivelAudio.style.width = porcentaje + "%";
                    animacionAudio = requestAnimationFrame(actualizarNivel);
                }
                actualizarNivel();
            } catch (error) {
                console.error("Error en el indicador de audio:", error);
            }
        }

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
                contextoAudio.close().catch(console.error);
                contextoAudio = null;
            }
            analizador = null;
            datosAudio = null;
            if (nivelAudio) nivelAudio.style.width = "0%";
        }

        // ==========================================
        // ACTIVAR MICRÓFONO
        // ==========================================

        async function activarMicrofono() {
            try {
                if (flujoAudio) return;
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error("El navegador no permite acceder al micrófono.");
                }

                const restricciones = microfonoSeleccionado
                    ? { audio: { deviceId: { ideal: microfonoSeleccionado } }, video: false }
                    : { audio: true, video: false };

                flujoAudio = await navigator.mediaDevices.getUserMedia(restricciones);
                pistaAudio = flujoAudio.getAudioTracks()[0];
                if (!pistaAudio) throw new Error("No se pudo obtener la pista de audio.");

                pistaAudio.enabled = true;
                await actualizarPistasEnTodasLasConexiones();

                if (btnMicrofono) btnMicrofono.textContent = "Desactivar micrófono";
                if (estadoMicrofono) {
                    estadoMicrofono.textContent = "Micrófono encendido";
                    estadoMicrofono.style.color = "#35d07f";
                }

                await comprobarMicrofonos();
                await iniciarIndicadorAudio();
                console.log("Micrófono activado.");
            } catch (error) {
                console.error("Error al activar el micrófono:", error);
                if (flujoAudio) flujoAudio.getTracks().forEach(pista => pista.stop());
                flujoAudio = null;
                pistaAudio = null;
                alert("No se pudo activar el micrófono. Revisá los permisos y el dispositivo seleccionado.");
            }
        }

        // ==========================================
        // DESACTIVAR MICRÓFONO
        // ==========================================

        async function desactivarMicrofono() {
            if (flujoAudio) flujoAudio.getTracks().forEach(pista => pista.stop());
            flujoAudio = null;
            pistaAudio = null;
            detenerIndicadorAudio();
            await actualizarPistasEnTodasLasConexiones();

            if (btnMicrofono) btnMicrofono.textContent = "Activar micrófono";
            if (estadoMicrofono) {
                estadoMicrofono.textContent = "Micrófono apagado";
                estadoMicrofono.style.color = "#f87171";
            }
            console.log("Micrófono desactivado.");
        }

        // ==========================================
        // ACTIVAR CÁMARA
        // ==========================================

        async function activarCamara() {
            try {
                if (flujoCamara) return;
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error("El navegador no permite acceder a la cámara.");
                }

                flujoCamara = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                pistaVideo = flujoCamara.getVideoTracks()[0];
                if (!pistaVideo) throw new Error("No se pudo obtener la pista de video.");

                if (videoLocal) {
                    videoLocal.srcObject = flujoCamara;
                    videoLocal.play().catch(console.warn);
                }

                await actualizarPistasEnTodasLasConexiones();
                if (btnCamara) btnCamara.textContent = "Desactivar cámara";
                console.log("Cámara activada.");
            } catch (error) {
                console.error("Error al activar la cámara:", error);
                if (flujoCamara) flujoCamara.getTracks().forEach(pista => pista.stop());
                flujoCamara = null;
                pistaVideo = null;
                alert("No se pudo activar la cámara. Revisá los permisos y el dispositivo.");
            }
        }

        // ==========================================
        // DESACTIVAR CÁMARA
        // ==========================================

        async function desactivarCamara() {
            if (flujoCamara) flujoCamara.getTracks().forEach(pista => pista.stop());
            flujoCamara = null;
            pistaVideo = null;

            if (videoLocal) videoLocal.srcObject = null;
            await actualizarPistasEnTodasLasConexiones();
            if (btnCamara) btnCamara.textContent = "Activar cámara";
            console.log("Cámara desactivada.");
        }

        // ==========================================
        // BOTONES Y DISPOSITIVOS
        // ==========================================

        if (btnMicrofono) {
            btnMicrofono.addEventListener("click", async () => {
                if (flujoAudio) await desactivarMicrofono();
                else await activarMicrofono();
            });
        }

        if (selectorMicrofono) {
            selectorMicrofono.addEventListener("change", async () => {
                microfonoSeleccionado = selectorMicrofono.value;
                if (flujoAudio) {
                    await desactivarMicrofono();
                    await activarMicrofono();
                }
            });
        }

        if (btnCamara) {
            btnCamara.addEventListener("click", async () => {
                if (flujoCamara) await desactivarCamara();
                else await activarCamara();
            });
        }

        async function salirDeLlamada() {

            // Avisar al servidor que salimos de la videollamada.
            socketVideo.emit("salir-videollamada", salaVideo);

            // Cerrar todas las conexiones WebRTC.
            for (const id of Array.from(conexionesWebRTC.keys())) {
                eliminarParticipante(id);
            }

            // Limpiar participantes activos.
            participantesActivosVideo.clear();

            // Mostrar el botón para entrar y ocultar el de salida.
            if (btnEntrarLlamada) btnEntrarLlamada.hidden = false;
            if (btnSalirLlamada) btnSalirLlamada.hidden = true;

            // Apagar micrófono y cámara.
            await desactivarMicrofono();
            await desactivarCamara();

            console.log("Saliste de la videollamada. Sigues en la sala colaborativa.");

        }

        if (btnSalirLlamada) btnSalirLlamada.addEventListener("click", salirDeLlamada);

        if (btnEntrarLlamada) {
            btnEntrarLlamada.addEventListener("click", () => {
                socketVideo.emit("entrar-videollamada", salaVideo);

                console.log("Solicitando volver a entrar a la videollamada");
            });
        }

        if (navigator.mediaDevices?.addEventListener) {
            navigator.mediaDevices.addEventListener("devicechange", comprobarMicrofonos);
        }

        // ==========================================
        // RECONEXIÓN SOCKET.IO
        // ==========================================

        socketVideo.on("disconnect", () => {
            console.warn("Socket.IO desconectado. Limpiando conexiones WebRTC.");
            for (const id of Array.from(conexionesWebRTC.keys())) eliminarParticipante(id);
            participantesVideo.clear();
            participantesActivosVideo.clear();
            candidatosPendientes.clear();
            ofertasEnProceso.clear();
            respuestasEnProceso.clear();
        });

        socketVideo.on("connect", () => {
            console.log("Socket.IO conectado. Esperando lista de participantes.");
            // sala.js / pizarra.js se encargan de volver a unirse a la sala.
        });

        socketVideo.on("connect_error", error => {
            console.error("Error de conexión Socket.IO:", error.message);
        });

        // ==========================================
        // INICIAR
        // ==========================================

        comprobarMicrofonos();
        console.log("Videollamada preparada para:", usuarioVideo, "en la sala:", salaVideo);
    }
}