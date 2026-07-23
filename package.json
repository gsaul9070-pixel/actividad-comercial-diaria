import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "usuarios_importacion.json");
const resultPath = path.join(root, "resultado_importacion.csv");

if(!process.env.GOOGLE_APPLICATION_CREDENTIALS){
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS con la ruta a serviceAccountKey.json");
  process.exit(1);
}

if(!process.env.MANAGER_PASSWORD){
  console.error("Falta MANAGER_PASSWORD para crear la cuenta del gerente 143561.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath,"utf8"));
const users = manifest.users || [];

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const auth = admin.auth();
const db = admin.firestore();

function csv(value){
  const text = String(value ?? "");
  return `"${text.replaceAll('"','""')}"`;
}

const output = [
  ["Número de empleado","Nombre","Rol","Método de acceso","Resultado"]
];

for(const person of users){
  const employeeNumber = String(person.employeeNumber);
  const isManager = person.role === "manager";
  const email = isManager
    ? String(person.authEmail || "").trim().toLowerCase()
    : `${employeeNumber}@actividad.local`;

  // Gerente: contraseña privada proporcionada por variable de entorno.
  // Asesor: contraseña técnica igual al número de empleado.
  if(isManager && !email){
    throw new Error(`Falta authEmail para el gerente ${employeeNumber}`);
  }

  const password = isManager
    ? String(process.env.MANAGER_PASSWORD)
    : employeeNumber;

  try{
    let userRecord;

    try{
      userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid,{
        password,
        disabled:person.active !== true,
        displayName:person.name
      });
    }catch(error){
      if(error.code !== "auth/user-not-found") throw error;

      userRecord = await auth.createUser({
        email,
        password,
        disabled:person.active !== true,
        displayName:person.name
      });
    }

    await db.collection("commercial_users").doc(userRecord.uid).set({
      employeeNumber,
      name:person.name,
      role:isManager ? "manager" : "advisor",
      active:person.active === true,
      mustChangePassword:false,
      authEmail:email,
      accessMode:isManager ? "username_password" : "employee_number_only",
      createdAt:admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:true});

    output.push([
      employeeNumber,
      person.name,
      isManager ? "manager" : "advisor",
      isManager ? "Usuario y contraseña" : "Solo número de empleado",
      "Creado/actualizado"
    ]);

    console.log(`OK ${employeeNumber} ${person.name}`);
  }catch(error){
    output.push([
      employeeNumber,
      person.name,
      person.role,
      "",
      `ERROR: ${error.message}`
    ]);
    console.error(`ERROR ${employeeNumber}:`,error.message);
  }
}

fs.writeFileSync(
  resultPath,
  output.map(row=>row.map(csv).join(",")).join("\n"),
  "utf8"
);

console.log(`\nResultado generado en: ${resultPath}`);
