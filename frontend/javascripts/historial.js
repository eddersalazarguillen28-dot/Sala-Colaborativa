
let nombreUsuario;
let nombreSala;

document.addEventListener("DOMContentLoaded",()=>{
    nombreUsuario = sessionStorage.getItem("nombreUsuario")||"Usuario";
    nombreSala = sessionStorage.getItem("nombreSala")||"Principal";

    const spanUsuario = document.getElementById("usuarioActual");
    if(spanUsuario) spanUsuario.textContent = nombreUsuario;

    const spanSala = document.getElementById("nombreSalaActual");
    if (spanSala) spanSala.textContent = `Sala: ${nombreSala}`;

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

    registrarActividad('Sistema',`Te uniste a "${nombreSala}" como ${nombreUsuario}`);

    configurarEventosSocketHistorial();


});


//Seleccion de elementos del DOM
const historialContainer = document.getElementById('historialActividades');
const userListContainer = document.getElementById('user-list');
const userCountBadge = document.getElementById('user-count');

//const canvas = document.getElementById('pizarraCanvas');

//FUNCT que registra un nuevo evento en el historial
function registrarActividad(usuario,accion){
    if(!historialContainer)return;

    const ahora = new Date();
    const horaFormateada = ahora.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

    //Estructura tarjeta historial
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.style.cssText = "margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:4px;";
    item.innerHTML = `
        <span style = "color:#64748b;font-size:0.75rem;">[${horaFormateada}]</span>
        <p style = "margin:2px 0 0 0;color:#cbd5e1;"><strong>${usuario}:</strong> ${accion}</p>
    `;
    //Insertar al inicio(mas reciente arriba
    historialContainer.prepend(item);

}

//Exportación a PNG y PDF 
document.addEventListener("DOMContentLoaded",() => {
    const btnExportPng = document.getElementById('btnExportarPng');
    const btnExportPdf = document.getElementById('btnExportarPdf');

    //PNG


    if(btnExportPng){
        btnExportPng.addEventListener('click',(e) => {
            e.stopPropagation();
            const canvasLocal = document.getElementById('pizarraCanvas');
            if(!canvasLocal) return;
            const imageURI = canvasLocal.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `pizarra-colaborativa-${Date.now()}.png`;
            link.href = imageURI;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            registrarActividad(nombreUsuario || "Usuario",'Exportó la pizarra como imagen PNG');
        });

    }

    //Documento PDF

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

            registrarActividad(nombreUsuario || "Usuario",'Exportó la pizarra como documento PDF');


        });
    
    }

});

//Funcion actualizar la lista de usuarios
function actualizarListaUsuarios(usuarios){
    if(!userListContainer || !userCountBadge)return;

    userListContainer.innerHTML='';
    userCountBadge.textContent = usuarios.length;

    usuarios.forEach(usuario=>{
        const nombrePart = typeof usuario === 'object' ? (usuario.nombre || usuario.usuario || "Usuario") : usuario;

        const li = document.createElement('li');
        li.className = 'user-item';

        //Validar si el usuario en la lista eres tu
        const esTu = nombrePart === nombreUsuario ? '(Tú)' : '';
        const esAnfitrionHTML = nombrePart === nombreUsuario
        ? '<span class="role-badge" style="background:rgba(16,185,129,0.2); color:#34d399;padding:2px 6px; border-radius:4px;font-size:0.75rem;">Anfitrión</span>' 
        : '<span class="role-badge" style="background:rgba(59,130,246,0.1); color:#93c5fd; padding:2px 6px; border-radius:4px; font-size:0.75rem;">Activos</span>';


        li.innerHTML = `
            <span><span class="user-indicator"></span>${nombrePart}${esTu}</span>
            ${esAnfitrionHTML}
        
        `;
        userListContainer.appendChild(li);
    });
}

function configurarEventosSocketHistorial(){

    const activeSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);
    if (!activeSocket) return;

    //Lista de participantes que emite pizarra.js
    activeSocket.on('lista-participantes', (participantes) => {
        if(Array.isArray(participantes)){
            actualizarListaUsuarios(participantes);
        }
    });

    activeSocket.on('nuevo-trazo',(datos) => {
        console.log("[Cliente historial]Datos recibidos del servidor:",datos);

        const t = datos && datos.trazo;

        if(!t) return;

        const autorTrazo = [
        datos.nombreUsuario,
        datos.usuario,
        datos.trazo?.nombreUsuario,
        datos.trazo?.usuario
        ].find(nombre => typeof nombre === "string" && nombre.trim() !== "")
        || "Usuario desconocido";

        procesarOperacionHistorial(
            datos.trazo,
            autorTrazo.trim()
        );
    });

    activeSocket.on('pizarra-limpiada',() =>{
        registrarActividad('Sistema','Se limpió toda la pizarra');
    });

    //Cuando el ususario entra a la sala
    activeSocket.on("usuario-unido", (datos) => {
        if(datos && datos.nombre){
            registrarActividad(datos.nombre,"se unió a la sala");
        }
    });

    //Cuando un usuario sale de la sala 
    activeSocket.on('usuario-salido',(datos) => {
        if(datos && datos.nombre){
            registrarActividad(datos.nombre,"salió de la sala");
        }
    });

    activeSocket.on("usuario-desconectado",(datos)=>{
        if(datos && datos.nombre){
            registrarActividad(datos.nombre,"se desconectó");
        }
    });

}

function procesarOperacionHistorial(t,actor){
    if (t.op === 'agregar' || t.op === 'estado'){
        registrarActividad(actor , 'Agregó un elemento a la pizarra');
    }else if (t.op === 'actualizar'){
        registrarActividad(actor, 'Modificó un elemento de la pizarra');
    }else if(t.op === 'eliminar'){
        registrarActividad(actor,'Eliminó un elemento de la pizarra');
    }else if(t.op === 'inicio' && t.el){
        const tipoObjeto = t.el.t === 'borrador' ? 'borrador' : (t.el.t === 'poligono' || t.el.t === 'elipse' || t.el.t === 'linea' ? 'figura geométrica' : 'trazo');
        registrarActividad(actor, `Comenzó a dibujar un ${tipoObjeto}`);
    }

}


//FUNCT mostrar notificaciones toast
/*
function mostrarNotificacion(mensaje, tipo = 'info'){
    if (!toastContaineer) return;

    const toast = document.createElement('div');

    //Colores dinámicos segun el tipo de evento
    const bgColor = tipo === 'join' ? '#10b981' : '#ef4444';

    toast.style.cssText = `
    background-color: ${bgColor};
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
    margin-bottom:8px;
    `;

    toast.innerHTML = `
        <span>${mensaje}</span>
        <button style="background:transparent; border:none; color:white; font-size:1rem; cursor:pointer; margin-left:10px; ">&times;</button>
    `;

    //btn cerrar manualmente el toast
    toast.querySelector('button').addEventListener('click',() => toast.remove());
    toastContaineer.appendChild(toast);

    setTimeout(() => toast.style.opacity = '1',10);

    //Quitar después de 4 segundos
    setTimeout(()=>{
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(),300);
    },4000);

}
*/

