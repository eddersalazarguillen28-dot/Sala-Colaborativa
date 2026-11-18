
let nombreUsuario;
let nombreSala;

//Seleccion de elementos del DOM
const historialContainer = document.getElementById('historialActividades');
const userListContainer = document.getElementById('user-list');
const userCountBadge = document.getElementById('user-count');

const MAX_EVENTOS = 500;

document.addEventListener("DOMContentLoaded",()=>{
    nombreUsuario = sessionStorage.getItem("nombreUsuario")||"Usuario";
    nombreSala = sessionStorage.getItem("nombreSala")||"Principal";

    const spanUsuario = document.getElementById("usuarioActual");
    if(spanUsuario) spanUsuario.textContent = nombreUsuario;

    const spanSala = document.getElementById("nombreSalaActual");
    if (spanSala) spanSala.textContent = `Sala: ${nombreSala}`;

    //ABRIR Y CERRAR MODAL
    const btnAbrir = document.getElementById("btnAbrirHistorial");
    const btnCerrar = document.getElementById("CerrarHistorial");
    const modal = document.getElementById("modalHistorial");

    if (btnAbrir && modal){
        btnAbrir.addEventListener("click", () => {
            modal.style.display = "flex";
        });
    }

    if(btnCerrar && modal){
        btnCerrar.addEventListener("click", () =>{
            modal.style.display = "none";
        });

    }
    //Cerrar si se hace clic fuera del modal
    if(modal){
        modal.addEventListener("click",(e) => {
            if(e.target === modal){
                modal.style.display = "none";
            }
        });
    }

    //registrarActividad('Sistema',`Te uniste a "${nombreSala}" como ${nombreUsuario}`);
    configurarExportaciones();
    configurarEventosSocketHistorial();


});




//const canvas = document.getElementById('pizarraCanvas');

//FUNCT que registra un nuevo evento en el historial
function registrarActividad(usuario,accion,fecha){
    if(!historialContainer)return;

    const momento = fecha ? new Date(fecha) : new Date();
    const hora = momento.toLocaleTimeString([],{
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
    });

    //Estructura tarjeta historial
    const item = document.createElement("div");
    item.className = "historial-item";
    item.style.cssText = "margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:4px;";

    const spanHora = document.createElement("span");
    spanHora.style.cssText = "color:#64748b;font-size:0.75rem;";
    spanHora.textContent = `[${hora}]`;

    const p = document.createElement("p");
    p.style.cssText = "margin:2px 0 0 0;color:#cbd5e1;";

    const autor=document.createElement("strong");
    autor.textContent=`${usuario}:`;

    p.append(autor,` ${accion}`);
    item.append(spanHora,p);

    //Insertar al inicio(mas reciente arriba
    historialContainer.prepend(item);

    while(historialContainer.children.length > MAX_EVENTOS){
        historialContainer.lastElementChild.remove();
    }

}

function avisarExportacion(formato){
    const s = window.socket;

    if (s && s.connected){
        s.emit("registrar-exportacion", { sala: nombreSala,formato});
    }else{
        registrarActividad(nombreUsuario || "Usuario",`Exportó la pizarra como ${formato}`);
    }
}

function configurarExportaciones(){
    const btnExportPng = document.getElementById('btnExportarPng');
    const btnExportPdf = document.getElementById('btnExportarPdf');

    //PNG
    if(btnExportPng){
        btnExportPng.addEventListener('click',(e) => {
            e.stopPropagation();

            const canvasLocal = document.getElementById('pizarraCanvas');
            if(!canvasLocal) return;

            const link = document.createElement('a');
            link.download = `pizarra-colaborativa-${Date.now()}.png`;
            link.href = canvasLocal.toDataURL("image/png");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            avisarExportacion("PNG");
        });
    }

    if (btnExportPdf){

        btnExportPdf.addEventListener('click',(e) => {
            e.stopPropagation();
            //Validar librería cargada
            if(!window.jspdf){
                alert('Falta cargar la librería jsPDF en el HTML');
                return;
            }

            const canvasLocal = document.getElementById('pizarraCanvas');
            if(!canvasLocal) return;

            const { jsPDF } = window.jspdf;
            const imageURI = canvasLocal.toDataURL('image/png');

            //PDF con dimensiones proporcionales del canvas

            const pdf = new jsPDF({
                orientation:canvasLocal.width > canvasLocal.height ? 'landscape' : 'portrait',
                unit:'px',
                format: [canvasLocal.width , canvasLocal.height]
            });

            pdf.addImage(imageURI,'PNG', 0 , 0 , canvasLocal.width , canvasLocal.height);
            pdf.save(`pizarra-colaborativa-${Date.now()}.pdf`);

            avisarExportacion("PDF");


        });
    
    }

    
}


//Funcion actualizar la lista de usuarios
function actualizarListaUsuarios(usuarios){
    if(!userListContainer || !userCountBadge)return;

    userListContainer.innerHTML="";
    userCountBadge.textContent = usuarios.length;

    const miId=window.socket ? window.socket.id : null;


    usuarios.forEach((usuario,indice) => {
        const esObjeto = typeof usuario === "object" && usuario !== null;
        const nombrePart = esObjeto
            ? (usuario.nombre || usuario.usuario || "Usuario")
            : String(usuario);
        
        const esTu = esObjeto && usuario.id
            ? usuario.id === miId
            : nombrePart === nombreUsuario;

        
        const esAnfitrion = indice === 0;
        
        const li = document.createElement("li");
        li.className = "user-item";

        const izquierda = document.createElement("span");
        const punto = document.createElement("span");
        punto.className = "user-indicator";
        izquierda.append(punto,nombrePart + (esTu ? "(Tú)" : ""));
        
        const badge = document.createElement("span");
        badge.className ="role-badge";
        badge.style.cssText = esAnfitrion
            ? "background:rgba(16,185,129,0.2);color:#34d399;padding:2px 6px;border-radius:4px;font-size:0.75rem;"
            : "background:rgba(59,130,246,0.1);color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:0.75rem;"
        badge.textContent = esAnfitrion ? "Anfitrión" : "Activo";

        li.append(izquierda,badge);
        userListContainer.appendChild(li);
    });
}

function configurarEventosSocketHistorial(){

    const activeSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);
    if (!activeSocket){
        console.warn("[Historial] No hay socket disponible; el historial no recibirá eventos");
        return;
    }

    //Lista de participantes que emite pizarra.js
    activeSocket.on('lista-participantes', (participantes) => {
        if(Array.isArray(participantes))actualizarListaUsuarios(participantes);
    });

    activeSocket.on("registro-actividad",(datos)=> {
        if(
            !datos ||
            typeof datos.usuario !== "string" ||
            typeof datos.accion !== "string"
        ) return;

        registrarActividad(datos.usuario, datos.accion, datos.fecha);
    });

    activeSocket.on("sala-unida", (datos) => {
        if(datos && typeof datos.usuario === "string") nombreUsuario = datos.usuario;
        registrarActividad("Sistema", `Te uniste a "${nombreSala}" como ${nombreUsuario}`);
    });

    activeSocket.on("usuario-unido", (datos)=>{
        if(datos && datos.nombre){
            registrarActividad(datos.nombre, "se unió a la sala");
            mostrarNotificacion(`${datos.nombre} se unió a la sala`, "unirse");

        }
    });

    activeSocket.on("usuario-salio",(datos) => {
        if (datos && datos.nombre){
            registrarActividad(datos.nombre, "salió de la sala");
             mostrarNotificacion(`${datos.nombre} salió de la sala`, "salir");

        }
    });

    activeSocket.on("usuario-desconectado", (datos) => {
        if(datos && datos.nombre){
             registrarActividad(datos.nombre, "se desconectó");
              mostrarNotificacion(`${datos.nombre} se desconectó`, "salir");
            }
    });
}

    


//FUNCT mostrar notificaciones toast

function obtenerContenedorToast(){
    let contenedor = document.getElementById("toastContainer");
    if(!contenedor){
        contenedor = document.createElement("div");
        contenedor.id = "toastContainer";
        contenedor.style.cssText = "position:fixed;top:16px;right:16px;z-index:9999;display:flex;"+"flex-direction:column;gap:8px;pointer-events:none;";
        document.body.appendChild(contenedor);
    }
    return contenedor;
}


function mostrarNotificacion(mensaje, tipo = 'info'){
    const colores={unirse:"#10b981", salir:"#ef4444",info:"#3b82f6"};

    const toast = document.createElement('div');

    toast.style.cssText = `
    background: ${colores[tipo] || colores.info};
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    display:flex;
    align-items:center;
    justify-content:space-between;
    min-width:220px;
    pointer-events:auto;
    `;
    const texto = document.createElement("span");
    texto.textContent = mensaje;
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.textContent="x";
    cerrar.style.cssText = "background:transparent; border:none; color:white; font-size:1rem; cursor:pointer; margin-left:10px; "
    cerrar.addEventListener("click",() => toast.remove());
    toast.append(texto,cerrar);
    obtenerContenedorToast().appendChild(toast);


    setTimeout(() => {toast.style.opacity = '1';}, 10);

    //Quitar después de 4 segundos
    setTimeout(()=>{
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(),300);
    },4000);

}
