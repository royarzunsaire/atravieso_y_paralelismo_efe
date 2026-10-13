# Preguntas para tu jefe — duración de la sesión (token)

> Borrador del 12-10-2026, listo para enviar. Cuando responda, anotar las respuestas aquí y en `CLAUDE.md` (item 18, punto A1).

**Asunto:** Decisión pendiente: cuánto debe durar la sesión de la app móvil

Hola `<nombre>`:

Necesito una decisión tuya sobre la **duración de la sesión** en la app de inspectores. Hoy, una vez que alguien inicia sesión, **la app lo recuerda 7 días** antes de pedirle la contraseña de nuevo.

**Por qué importa:** si un teléfono se pierde, se roba o se presta, quien lo tenga puede usar la app como ese inspector hasta una semana. Ya está mitigado: si nos avisan, **dar de baja al usuario corta su acceso en menos de 1 minuto**. Pero es un riesgo que Ciberseguridad probablemente nos va a señalar.

**Mi propuesta:** que la sesión dure **24 horas, pero se renueve sola mientras la persona use la app**. Así, quien trabaja a diario no vuelve a escribir su contraseña, y un teléfono sin uso por más de un día queda bloqueado. Lo construyo en cuanto me confirmes.

Para decidirlo necesito tres respuestas:

1. **¿Cuántas horas seguidas puede un inspector estar sin señal y aun así seguir registrando inspecciones?** (Por ejemplo, una jornada completa en un tramo sin cobertura.) Si su sesión vence mientras no hay señal, al volver la conexión tendría que iniciar sesión de nuevo. Sus registros pendientes no se perderían, pero hay que saber cuánto margen necesitamos.
2. **¿Los celulares de los inspectores son corporativos y tienen bloqueo de pantalla obligatorio (PIN o huella)?** Si lo son, el riesgo de un teléfono perdido baja mucho y podríamos dejar una sesión más larga con tranquilidad.
3. **¿Está previsto volver a usar el inicio de sesión con la cuenta de Microsoft (Azure AD), con doble factor (MFA)?** De ser así, la duración y el manejo de la sesión cambiarían de todos modos, y convendría no invertir demasiado en el esquema actual.

**Opciones, de la más estricta a la más cómoda:**
- A. **12 h con renovación** (más estricta; el inspector que no usa la app en media jornada vuelve a iniciar sesión).
- B. **24 h con renovación** (mi recomendación).
- C. **Dejar 7 días** y aceptarlo como riesgo documentado, apoyándonos en la baja de usuarios.

Con tu respuesta lo implemento, reconstruyo las imágenes una sola vez y se las entrego.

Gracias,
`<Rodrigo>`
