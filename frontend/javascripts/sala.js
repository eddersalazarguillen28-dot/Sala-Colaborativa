const nombreUsuario = sessionStorage.getItem("nombreUsuario");
const nombreSala = sessionStorage.getItem("nombreSala");

if (!nombreUsuario || !nombreSala) {
    window.location.href = "index.html";
} else {
    document.getElementById("usuarioActual").textContent = nombreUsuario;
    document.getElementById("nombreSalaActual").textContent = `Sala: ${nombreSala}`;
}