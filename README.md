# Sistema de Actividad Comercial — Firebase + GitHub Pages

## Contenido

- `index.html`: captura diaria protegida por número de empleado y contraseña.
- `dashboard.html`: dashboard global exclusivo para gerentes.
- `firebase-config.js`: configuración de la app web de Firebase.
- `firestore.rules`: seguridad de usuarios, roles y reportes.
- `usuarios_importacion.json`: personal extraído del Excel.
- `scripts/import-users.mjs`: crea usuarios de Authentication y contraseñas temporales.
- `pendientes_revision.txt`: registro sin número de empleado.

## Seguridad incluida

1. Inicio de sesión con Firebase Authentication.
2. El número de empleado se transforma internamente a `NUMERO@actividad.local`.
3. La contraseña temporal debe cambiarse durante el primer acceso.
4. Nombre y número de empleado quedan bloqueados en el reporte.
5. Solo el rol `manager` puede ver y administrar el dashboard.
6. Firestore Rules protege la base en el servidor.
7. El reporte se guarda en Firebase antes de habilitar WhatsApp, correo, PDF y Excel.
8. Solo puede existir un reporte por asesor y fecha.
9. El dashboard permite revisar y anular reportes sin eliminarlos.
10. Los gerentes pueden activar/desactivar usuarios y administrar roles.

## 1. Definir gerentes antes de importar

El empleado **143561** ya quedó configurado como gerente. Los demás registros permanecen como:

```json
"role": "advisor"
```

En `usuarios_importacion.json`, cambia a:

```json
"role": "manager"
```

para cada gerente autorizado.

## 2. Configurar Firebase

1. Crea un proyecto nuevo; nombre sugerido: `actividad-comercial-diaria`.
2. Agrega una app Web.
3. Copia el objeto de configuración en `firebase-config.js`.
4. En **Authentication**, habilita **Correo electrónico/contraseña**.
5. Crea Cloud Firestore.
6. Sustituye `REEMPLAZAR_PROJECT_ID` en `.firebaserc`.
7. Instala Firebase CLI y despliega las reglas:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

## 3. Crear cuentas y contraseñas

1. Descarga una cuenta de servicio desde Firebase.
2. Guárdala localmente como `serviceAccountKey.json`.
3. Nunca subas esa clave a GitHub.
4. En la carpeta `scripts` ejecuta:

```bash
npm install
```

En Windows PowerShell:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\serviceAccountKey.json"
node import-users.mjs
```

El script genera `credenciales_iniciales.csv`. Entrégalo de forma privada a cada persona y elimínalo después.

## 4. Publicar con GitHub Pages

Crea un repositorio llamado `actividad-comercial-diaria`, carga todos los archivos y configura:

- **Settings**
- **Pages**
- **Deploy from a branch**
- Rama `main`
- Carpeta `/root`

Rutas esperadas:

- Captura: `https://TU_USUARIO.github.io/actividad-comercial-diaria/`
- Dashboard: `https://TU_USUARIO.github.io/actividad-comercial-diaria/dashboard.html`

## Personal importado

Se prepararon 17 cuentas con número de empleado válido.

`MORALES VILLARREAL ARTEMIA JANETH` no se incluyó porque el Excel no contiene su número de empleado.


## Gerente inicial configurado

- Número de empleado: `143561`
- Rol: `manager`
- Contraseña temporal: se proporciona mediante la variable de entorno `MANAGER_TEMP_PASSWORD`

La contraseña temporal no se guarda en archivos públicos. Antes de ejecutar el importador, en PowerShell usa:

```powershell
$env:MANAGER_TEMP_PASSWORD="TU_CONTRASEÑA_TEMPORAL"
```

El sistema obliga al gerente a cambiarla en el primer acceso.


## Modelo de acceso temporal aprobado

### Gerente

- Portal: `dashboard.html`
- Usuario: `143561`
- Contraseña: la contraseña gerencial privada.
- Rol de Firestore: `manager`.

### Empleados / asesores

- Portal: `index.html`
- Capturan únicamente su número de empleado.
- No se solicita contraseña en pantalla.
- La cuenta técnica interna usa el número de empleado como contraseña.
- Rol de Firestore: `advisor`.

> Este modelo es adecuado únicamente para la etapa de prueba. Una persona que conozca el número de otro empleado podría intentar ingresar en su nombre. Para producción se recomienda agregar un PIN personal o contraseña.


## Acceso gerencial actualizado

El dashboard utiliza un correo real como usuario gerencial:

- Portal: `dashboard.html`
- Usuario gerencial: `jacquelinne.santos@profuturo.com.mx`
- Contraseña: se mantiene únicamente en Firebase Authentication y no se guarda en el repositorio.
- Perfil requerido en Firestore: documento con el mismo UID de Authentication y `role: "manager"`.

Los asesores continúan accediendo a `index.html` solamente con su número de empleado.
