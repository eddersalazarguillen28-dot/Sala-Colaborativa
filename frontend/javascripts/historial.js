//Seleccion de elementos de la interfaz
const historialContainer = document.getElementById('actividad-historial');
const userListContainer = document.getElementById('user-list');
const userCountBadge = document.getElementById('user-count');
const btnExportPng = document.getElementById('btn-export-png');
const btnExportPdf = document.getElementById('btn-export-pdf');
const canvas = document.getElementById('pizarraCanvas');

//FUNCT que registra un nuevo evento en el historial
function registrarActividad(usuario,accion){
    const ahora = new Date();
    const horaFormateada = ahora.toLocaleDateString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

    //Estructura tarjeta historial
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.innerHTML = `
        <span class = "tiempo-historial">${horaFormateada}</span>
        <p style = "margin:0;"><strong>${usuario}:</strong> ${accion}</p>
    
    `;
    //Insertar al inicio(mas reciente arriba
    historialContainer.prepend(item);

}

//Prueba

registrarActividad('Estefanía','Se conectó al panel de control');

//Exportación a PNG y PDF 

//PNG

btnExportPng.addEventListener('click',() => {
    if(!canvas) return;
    const imageURI = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `pizarra-colaborativa-${Date.now()}.png`;
    link.href = imageURI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    registrarActividad('Tú','Exportaste la pizarra como PNG');
});

//Documento PDF

btnExportPdf.addEventListener('click',() => {
    if(!canvas) return;

    //Validar librería cargada
    if(!window.jspdf){
        alert('Falta cargar la librería jsPDF en el HTML');
        return;
    }

    const { jsPDF } = window.jspdf;
    const imageURI = canvas.toDataURL('image/png');

    //PDF con dimensiones proporcionales del canvas

    const pdf = new jsPDF({
        orientation:canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit:'px',
        format: [canvas.width , canvas.height]
    });

    pdf.addImage(imageURI,'PNG', 0 , 0 , canvas.width , canvas.height);
    pdf.save(`pizarra-colaborativa-${Date.now()}.pdf`);

    registrarActividad('Tú','Exportaste la pizarra como PDF');


});

//Gestión de participantes y notificaciones

const toastContaineer = document.getElementById('toast-container');

//FUNCT mostrar notificaciones toast

function mostrarNotificacion(mensaje, tipo = 'info'){
    if (!toastContaineer) return;

    const toast = document.createElement('div');

    //Colores dinámicos segun el tipo de evento
    const bgColor = tipo === 'join' ? '#198754' : '#dc3545';

    toast.style.cssText = `
    background-color: ${bgColor};
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    display:flex;
    align-items:center;
    justify-content:space-between;
    min-width:220px;
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

//Funcion actualizar la lista de usuarios
function actualizarListaUsuarios(usuarios){
    if(!userListContainer || !userCountBadge)return;

    userListContainer.innerHTML='';
    userCountBadge.textContent = usuarios.length;

    usuarios.forEach(usuario=>{
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
            <span><span class="user-indicator"></span>${usuario.nombre}</span>
            ${usuario.esAnfitrion ? '<span class = "role-badge">Anfitrion</span>': ''}
        
        `;
        userListContainer.appendChild(li);
    })


}