
"use strict";

function configurarPizarra(io) {

    // ==========================================
    // VALIDACIONES
    // ==========================================

    const esObjeto = v =>
        v !== null &&
        typeof v === "object" &&
        !Array.isArray(v);

    const numeroValido = v =>
        Number.isFinite(v) && Math.abs(v) <= 1000000;

    const idValido = v =>
        typeof v === "string" &&
        v.length > 0 &&
        v.length <= 128;

    const colorValido = v =>
        typeof v === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(v);

    const grosorValido = v =>
        Number.isFinite(v) && v > 0 && v <= 200;

    function puntosValidos(pts, permitirVacio = false) {
        return (
            Array.isArray(pts) &&
            pts.length <= 20000 &&
            (permitirVacio || pts.length >= 2) &&
            pts.length % 2 === 0 &&
            pts.every(numeroValido)
        );
    }

    /////////////////////////////////////////////////
    function registrar(sala,usuario,accion){
        io.to(sala).emit("registro-actividad",{
            usuario,
            accion,
            fecha:new Date().toISOString()
        });
            
        
    }

    function nombreElemento(tipo){
        if(tipo === "poligono" || tipo === "elipse" || tipo === "linea"){
            return "una figura geométrica";
        }
        if(tipo === "texto") return "un texto";
        return "un trazo";
    }

    function accionDeOperacion(socket,t){
        if(!socket.data.trazosEnCurso)socket.data.trazosEnCurso = new Map();
        const enCurso = socket.data.trazosEnCurso;

        switch(t.op){

            case "inicio":
                if(enCurso.size > 50) enCurso.clear();
                enCurso.set(t.el.id, t.el.t);
                return null;
        
            case "cancelar":
                enCurso.delete(t.id);
                return null;

            case "fin":{
                const tipo = enCurso.get(t.id);
                enCurso.delete(t.id);
                if(!tipo)return null;
                return tipo === "borrador"
                    ? "Usó el borrador"
                    : `Dibujó ${nombreElemento(tipo)}`;
            }
            case "agregar":
                if(!t.els.length)return null;
                return t.els.length === 1
                    ? `Agregó ${nombreElemento(t.els[0].t)}`
                    : `Agregó ${t.els.length} elementos`;
        
            case "actualizar":
                if(!t.els.length)return null;
                return t.els.length === 1
                    ? "Modificó un elemento"
                    : `Modificó ${t.els.length} elementos`;
        
            case "eliminar":
                if(!t.ids.length) return null;
                return t.ids.length === 1
                    ? "Eliminó un elemento"
                    : `Eliminó ${t.ids.length} elementos`;
            default:
                return null;
        }
        

    }

    


    // ==========================================
    // VALIDAR OBJETOS DE LA PIZARRA
    // ==========================================

    function elementoValido(e) {

        if (!esObjeto(e) || !idValido(e.id)) return false;

        const tipos = [
            "trazo",
            "borrador",
            "poligono",
            "elipse",
            "linea",
            "texto"
        ];

        if (!tipos.includes(e.t)) return false;

        if (e.t === "texto") {
            return (
                numeroValido(e.x) &&
                numeroValido(e.y) &&
                typeof e.txt === "string" &&
                e.txt.length <= 10000 &&
                Number.isFinite(e.tam) &&
                e.tam >= 6 &&
                e.tam <= 200 &&
                colorValido(e.c)
            );
        }

        if (!grosorValido(e.g)) return false;

        if (e.t === "borrador") {
            return puntosValidos(e.pts);
        }

        if (e.t === "elipse") {
            return (
                numeroValido(e.x0) &&
                numeroValido(e.y0) &&
                numeroValido(e.x1) &&
                numeroValido(e.y1) &&
                colorValido(e.c) &&
                (e.r === null || e.r === undefined || colorValido(e.r))
            );
        }

        if (!puntosValidos(e.pts)) return false;

        if (!colorValido(e.c)) return false;

        if (
            e.r !== null &&
            e.r !== undefined &&
            !colorValido(e.r)
        ) return false;

        if (e.t === "trazo") {

            const pinceles = [
                "lapiz",
                "pincel",
                "aerografo",
                "acuarela",
                "oleo",
                "marcador",
                "crayon"
            ];

            return (
                pinceles.includes(e.p) &&
                Number.isFinite(e.s)
            );
        }

        if (e.t === "linea") {
            return (
                Number.isInteger(e.fl) &&
                e.fl >= 0 &&
                e.fl <= 2
            );
        }

        return true;
    }

    // ==========================================
    // VALIDAR OPERACIONES V2
    // ==========================================

    function operacionValida(t) {

        if (!esObjeto(t) || t.v !== 2) return false;

        switch (t.op) {

            case "inicio":
                return elementoValido(t.el);

            case "pts":
                return (
                    idValido(t.id) &&
                    puntosValidos(t.pts)
                );

            case "fin":
            case "cancelar":
                return idValido(t.id);

            case "agregar":
            case "actualizar":
            case "estado":
                return (
                    Array.isArray(t.els) &&
                    t.els.length <= 1000 &&
                    (
                        t.op !== "estado" ||
                        idValido(t.rid)
                    ) &&
                    t.els.every(elementoValido)
                );

            case "eliminar":
                return (
                    Array.isArray(t.ids) &&
                    t.ids.length <= 1000 &&
                    t.ids.every(idValido)
                );

            case "pedir-estado":
                return idValido(t.rid);

            case "laser":
                if (
                    typeof t.u !== "string" ||
                    !t.u.trim() ||
                    t.u.length > 100
                ) return false;

                if (t.fin === true) return true;

                return (
                    numeroValido(t.x) &&
                    numeroValido(t.y) &&
                    colorValido(t.c)
                );

            default:
                return false;
        }
    }

    // ==========================================
    // CONEXIÓN
    // ==========================================

    io.on("connection", socket => {

        console.log("[PIZARRA] Conectado:", socket.id);

        // ======================================
        // RECIBIR OPERACIONES
        // ======================================

        socket.on("dibujar-trazo", datos => {

            console.log("EL SERVIDOR RECIBIÓ DIBUJAR-TRAZO");

            console.log("[Servidor] Datos recibidos en dibujar-trazo:",datos);

            try {

                if (
                    !esObjeto(datos) ||
                    typeof datos.sala !== "string" ||
                    !datos.sala.trim() ||
                    !esObjeto(datos.trazo)
                ) {
                    socket.emit(
                        "error-pizarra",
                        "Datos de dibujo inválidos"
                    );
                    return;
                }

                const sala = datos.sala.trim();
                const trazo = datos.trazo;

                if (!socket.rooms.has(sala)){
                    socket.emit("error-pizarra", "No perteneces a esta sala");
                    return;
                }

                const usuarioRemitente = socket.data.nombreUsuario;

                if(
                    typeof usuarioRemitente !== "string" || !usuarioRemitente.trim()
                ){
                    socket.emit("error-pizarra","No se pudo identificar al colaborador");
                    return;
                }

                console.log("[Servidor] Nombre recibido:",{
                    usuarioFinal:usuarioRemitente
                });


                const contenido = JSON.stringify(trazo);

                if (
                    Buffer.byteLength(contenido, "utf8") > 250000
                ) {
                    socket.emit(
                        "error-pizarra",
                        "Mensaje de pizarra demasiado grande"
                    );
                    return;
                }

                if (!operacionValida(trazo)) {

                    socket.emit(
                        "error-pizarra",
                        "Datos de operación V2 inválidos: " + (trazo.op || "desconocida")
                    );

                    return;
                }

                //PRUEBA
                console.log("[Servidor] Antes de enviar:",{
                    sala:sala,
                    usuario:usuarioRemitente,
                    nombreUsuario:usuarioRemitente,
                    trazo:trazo
                });
                //////

                // Retransmitir al resto de participantes.
                socket.to(sala).emit("nuevo-trazo", {
                    usuario:usuarioRemitente,
                    nombreUsuario:usuarioRemitente,
                    trazo: trazo
                });

                //////////////////////////////////////////////////
                const accion = accionDeOperacion(socket,trazo);
                if(accion)registrar(sala,usuarioRemitente,accion);
                //////////////////////////////////////////////////

            } catch (error) {

                console.error("[PIZARRA] Error:", error);

                socket.emit(
                    "error-pizarra",
                    "Error procesando la operación de pizarra"
                );
            }

        });

        // ======================================
        // LIMPIAR PIZARRA
        // ======================================

        socket.on("limpiar-pizarra", sala => {

            if (
                typeof sala !== "string" ||
                !sala.trim()
            ) {
                socket.emit(
                    "error-pizarra",
                    "Nombre de sala inválido"
                );
                return;
            }

            const nombreSala = sala.trim();

            if (!socket.rooms.has(nombreSala)) {
                socket.emit(
                    "error-pizarra",
                    "No perteneces a esta sala"
                );
                return;
            }

            io.to(nombreSala).emit("pizarra-limpiada");

            ///////////////////////////////////////////////
            registrar(
                nombreSala,
                socket.data.nombreUsuario || "Usuario",
                "Limpió toda la pizarra"
            );
            ////////////////////////////////////////////////

            console.log(
                `[PIZARRA] Sala "${nombreSala}" limpiada`
            );
        });

        /////////////////////////////////////////////////////////////////////////////
        socket.on("registrar-exportacion",datos => {

            if (!esObjeto(datos)) return;

            const sala = typeof datos.sala === "string" ? datos.sala.trim() : "";
            const formato = datos.formato;

            if(!sala || !socket.rooms.has(sala)) return;
            if(formato !== "PNG" && formato !== "PDF") return;

            const usuario = socket.data.nombreUsuario;
            if (typeof usuario !== "string" || !usuario.trim()) return;

            registrar(sala,usuario,`Exportó la pizarra como ${formato}`);
        });

        /////////////////////////////////////////////////////////////////////////////////

        socket.on("disconnect", () => {
            console.log("[PIZARRA] Desconectado:", socket.id);
        });

    });
}

module.exports = configurarPizarra;
