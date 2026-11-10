document.addEventListener("DOMContentLoaded", () => {

    const formulario = document.getElementById("formularioIngreso");

    if (!formulario) {
        console.error("No se encontró el formulario de ingreso.");
        return;
    }

    formulario.addEventListener("submit", (event) => {

        event.preventDefault();

        const campoUsuario = document.getElementById("nombreUsuario");
        const campoSala = document.getElementById("nombreSala");

        if (!campoUsuario || !campoSala) {
            console.error("No se encontraron los campos del formulario.");
            return;
        }

        const nombreUsuario = campoUsuario.value.trim();
        const nombreSala = campoSala.value.trim();

        if (!nombreUsuario || !nombreSala) {
            alert("Por favor, completa todos los campos.");
            return;
        }

        // Guardar información de sesión
        sessionStorage.setItem("nombreUsuario", nombreUsuario);
        sessionStorage.setItem("nombreSala", nombreSala);

        console.log("Usuario:", nombreUsuario);
        console.log("Sala:", nombreSala);

        // Entrar a la sala
        window.location.href = "sala.html";

    });

});