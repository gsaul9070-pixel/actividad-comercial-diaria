import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "usuarios_importacion.json"), "utf8")
);

if(!process.env.GOOGLE_APPLICATION_CREDENTIALS){
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}
if(!process.env.MANAGER_PASSWORD){
  console.error("Falta MANAGER_PASSWORD.");
  process.exit(1);
}

admin.initializeApp({credential: admin.credential.applicationDefault()});
const auth = admin.auth();
const db = admin.firestore();

for(const person of manifest.users){
  const employeeNumber = String(person.employeeNumber);
  const isManager = person.role === "manager";
  const email = isManager
    ? String(person.authEmail).toLowerCase()
    : `${employeeNumber}@actividad-comercial-diaria.com`;
  const password = isManager
    ? String(process.env.MANAGER_PASSWORD)
    : String(person.pin);

  try{
    let record;
    try{
      record = await auth.getUserByEmail(email);
      record = await auth.updateUser(record.uid,{
        email,
        password,
        disabled:person.active !== true,
        displayName:person.name
      });
    }catch(error){
      if(error.code !== "auth/user-not-found") throw error;
      record = await auth.createUser({
        email,
        password,
        disabled:person.active !== true,
        displayName:person.name
      });
    }

    await db.collection("commercial_users").doc(record.uid).set({
      employeeNumber,
      name:person.name,
      role:isManager ? "manager" : "advisor",
      active:person.active === true,
      authEmail:email,
      accessMode:isManager ? "manager_user_password" : "employee_pin",
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:true});

    console.log(`OK ${employeeNumber} ${person.name}`);
  }catch(error){
    console.error(`ERROR ${employeeNumber}: ${error.message}`);
  }
}
