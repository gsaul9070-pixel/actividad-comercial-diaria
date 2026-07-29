import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  USERS_COLLECTION,
  REPORTS_COLLECTION,
  AUTH_EMAIL_DOMAIN
} from "./firebase-config.js";

const authScreen = document.getElementById("authScreen");
const appRoot = document.getElementById("appRoot");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");

function showError(message){
  loginError.textContent = message;
  loginError.classList.add("show");
}
function clearError(){
  loginError.textContent = "";
  loginError.classList.remove("show");
}
function digits(value){
  return String(value || "").replace(/\D/g,"");
}
function employeeEmail(number){
  return `${number}@${AUTH_EMAIL_DOMAIN}`;
}
function firebaseAdvisorPassword(pin){
  return `${pin}PF`;
}
const LEGACY_ADVISORS = {"130257": {"pin": "9435", "name": "CORREA CERON MARIA DEL CARMEN"}, "152642": {"pin": "2776", "name": "ALVAREZ SOLIS CLAUDIA IVETT"}, "158311": {"pin": "6364", "name": "RAMIREZ BLANCO ARACELI GUADALUPE"}, "161328": {"pin": "2229", "name": "GUERRERO VILLEGAS ELSA GABRIELA"}, "162129": {"pin": "1338", "name": "MEZA MELO CLAUDIA GUADALUPE"}, "164641": {"pin": "1327", "name": "MENDOZA SANTIAGO ADRIANA"}, "165555": {"pin": "5120", "name": "SALAS TORRES RUBI ANAKAREN"}, "169527": {"pin": "8122", "name": "PATIÑO SILVA FERNANDA MONSERRAT"}, "169884": {"pin": "3842", "name": "SOTO DOMINGUEZ DAYANI SHERLIN GUADALUPE"}, "171033": {"pin": "5553", "name": "REYNA ORTIZ ROSA NANCY"}, "171155": {"pin": "6810", "name": "VEGA LUNA MARIA DE JESUS"}, "172247": {"pin": "6627", "name": "GARCIA BERLANGA BRENDA BERENICE"}, "172852": {"pin": "8272", "name": "BLANCO TORRES GILDA YAMILY"}, "173151": {"pin": "6367", "name": "ANGUIANO BERLANGA FRANCISCO DE JESUS"}, "173159": {"pin": "1296", "name": "MORALES LEYVA KARLA SAMANTA"}, "502488": {"pin": "8144", "name": "RAMOS MARTINEZ LAURA GEORGINA"}};
function currentLocalDate(){
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0,10);
}
function reportDocumentId(uid, date){
  return `${uid}_${date}`;
}

const hasPlaceholder = Object.values(firebaseConfig).some(value =>
  String(value).includes("REEMPLAZAR")
);

if(hasPlaceholder){
  showError("Falta colocar la configuración real de Firebase.");
  loginButton.disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  async function readProfile(uid){
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if(!snap.exists()) throw new Error("El asesor no está registrado.");
    return {uid, ...snap.data()};
  }

  async function openAdvisorSession(user, profile){
    if(profile.active !== true){
      await signOut(auth);
      throw new Error("Tu acceso está desactivado. Consulta al gerente.");
    }
    if(profile.role !== "advisor"){
      await signOut(auth);
      window.location.assign("./dashboard.html");
      return;
    }

    window.currentUserProfile = profile;
    window.prepareAdvisorSession(profile);
    authScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    window.resetCommercialFormForSession();
    window.prepareAdvisorSession(profile);

    await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  loginForm.addEventListener("submit", async event=>{
    event.preventDefault();
    clearError();

    const employeeNumber = digits(document.getElementById("loginEmployee").value);
    const pin = digits(document.getElementById("loginPin").value);

    if(!employeeNumber){
      showError("Ingresa tu número de empleado.");
      return;
    }
    if(pin.length !== 4){
      showError("El PIN debe contener 4 dígitos.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Validando…";

    try{
      const advisor = LEGACY_ADVISORS[employeeNumber];

      if(!advisor || advisor.pin !== pin){
        throw new Error("INVALID_LOCAL_CREDENTIALS");
      }

      try{
        await signInWithEmailAndPassword(
          auth,
          employeeEmail(employeeNumber),
          firebaseAdvisorPassword(pin)
        );
      }catch(error){
        const code = String(error?.code || "");

        if(code === "auth/user-not-found" || code === "auth/invalid-credential"){
          const credential = await createUserWithEmailAndPassword(
            auth,
            employeeEmail(employeeNumber),
            firebaseAdvisorPassword(pin)
          );

          await setDoc(doc(db, USERS_COLLECTION, credential.user.uid), {
            employeeNumber,
            name: advisor.name,
            role: "advisor",
            active: true,
            authEmail: employeeEmail(employeeNumber),
            accessMode: "employee_pin",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, {merge:true});
        }else{
          throw error;
        }
      }
    }catch(error){
      console.error(error);
      showError("Número de empleado o PIN incorrecto.");
      loginButton.disabled = false;
      loginButton.textContent = "Continuar";
    }
  });

  onAuthStateChanged(auth, async user=>{
    if(!user){
      window.currentUserProfile = null;
      appRoot.classList.add("hidden");
      authScreen.classList.remove("hidden");
      loginButton.disabled = false;
      loginButton.textContent = "Continuar";
      return;
    }

    try{
      const profile = await readProfile(user.uid);
      await openAdvisorSession(user, profile);
    }catch(error){
      console.error(error);
      showError(error.message || "No fue posible validar el acceso.");
      await signOut(auth);
    }
  });

  window.logoutCommercialUser = async function(){
    if(confirm("¿Deseas cerrar la sesión?")){
      await signOut(auth);
      window.location.reload();
    }
  };

  window.saveFinalizedReportToFirebase = async function(data){
    const user = auth.currentUser;
    const profile = window.currentUserProfile;

    if(!user || !profile || profile.role !== "advisor"){
      throw new Error("La sesión del asesor no está disponible.");
    }

    const reportDate = currentLocalDate();
    const reportId = reportDocumentId(user.uid, reportDate);
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);
    const existing = await getDoc(reportRef);

    if(existing.exists()){
      throw new Error("Ya existe un reporte finalizado para este empleado en la fecha de hoy.");
    }

    const clients = (data.clients || []).map(client=>({
      ...client,
      points: Number(client.points || 0)
    }));

    const procedureCount = clients.filter(
      client => client.result === "Trámite realizado"
    ).length;

    await setDoc(reportRef, {
      advisorUid: user.uid,
      advisorName: profile.name,
      advisorEmployeeNumber: profile.employeeNumber,
      advisorRole: "advisor",
      createdDate: reportDate,
      createdAt: serverTimestamp(),
      createdAtLocal: data.createdAt,
      prospecting: data.prospecting,
      activityPlace: data.activityPlace,
      activitySchedule: data.activitySchedule,
      contacts: Number(data.peopleContacted || 0),
      appointmentsGenerated: Number(data.appointmentsGenerated || 0),
      activityDescription: data.activityDescription,
      clients,
      clientCount: clients.length,
      procedureCount,
      plan: {
        date: data.promiseDate,
        place: data.promisePlace,
        method: data.promiseMethod,
        schedule: data.promiseSchedule,
        contactGoal: Number(data.contactGoal || 0),
        appointmentGoal: Number(data.appointmentGoal || 0),
        description: data.promiseDescription
      },
      status: "finalized",
      reviewStatus: "pending",
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: serverTimestamp()
    });

    return reportId;
  };
}
