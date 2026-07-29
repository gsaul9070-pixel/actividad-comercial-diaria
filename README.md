# Actividad Comercial Diaria

Versión restaurada sobre la estructura original de Firestore:

- commercial_advisors
- commercial_activity_reports
- commercial_settings

Asesores: número de empleado + PIN.
Gerente: diálogo de contraseña.
No se crean usuarios individuales en Firebase Authentication.

Importante: firebase-config.js debe contener el bloque oficial y exacto de Firebase.


## Carga automática de NIP históricos

Al abrir el dashboard gerencial, el sistema revisa la colección
`commercial_advisors` y carga automáticamente los NIP históricos conocidos
en los empleados que todavía no tengan el campo `pin`.

Los NIP existentes no se reemplazan.
