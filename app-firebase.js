import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  REPORTS_COLLECTION
} from "./firebase-config.js";

const EMPLOYEE_DIRECTORY = {
  "130257": {
    "employeeNumber": "130257",
    "name": "CORREA CERON MARIA DEL CARMEN",
    "role": "advisor",
    "active": true
  },
  "152642": {
    "employeeNumber": "152642",
    "name": "ALVAREZ SOLIS CLAUDIA IVETT",
    "role": "advisor",
    "active": true
  },
  "158311": {
    "employeeNumber": "158311",
    "name": "RAMIREZ BLANCO ARACELI GUADALUPE",
    "role": "advisor",
    "active": true
  },
  "161328": {
    "employeeNumber": "161328",
    "name": "GUERRERO VILLEGAS ELSA GABRIELA",
    "role": "advisor",
    "active": true
  },
  "162129": {
    "employeeNumber": "162129",
    "name": "MEZA MELO CLAUDIA GUADALUPE",
    "role": "advisor",
    "active": true
  },
  "164641": {
    "employeeNumber": "164641",
    "name": "MENDOZA SANTIAGO ADRIANA",
    "role": "advisor",
    "active": true
  },
  "165555": {
    "employeeNumber": "165555",
    "name": "SALAS TORRES RUBI ANAKAREN",
    "role": "advisor",
    "active": true
  },
  "169527": {
    "employeeNumber": "169527",
    "name": "PATIÑO SILVA FERNANDA MONSERRAT",
    "role": "advisor",
    "active": true
  },
  "169884": {
    "employeeNumber": "169884",
    "name": "SOTO DOMINGUEZ DAYANI SHERLIN GUADALUPE",
    "role": "advisor",
    "active": true
  },
  "171033": {
    "employeeNumber": "171033",
    "name": "REYNA ORTIZ ROSA NANCY",
    "role": "advisor",
    "active": true
  },
  "171155": {
    "employeeNumber": "171155",
    "name": "VEGA LUNA MARIA DE JESUS",
    "role": "advisor",
    "active": true
  },
  "172247": {
    "employeeNumber": "172247",
    "name": "GARCIA BERLANGA BRENDA BERENICE",
    "role": "advisor",
    "active": true
  },
  "172852": {
    "employeeNumber": "172852",
    "name": "BLANCO TORRES GILDA YAMILY",
    "role": "advisor",
    "active": true
  },
  "173151": {
    "employeeNumber": "173151",
    "name": "ANGUIANO BERLANGA FRANCISCO DE JESUS",
    "role": "advisor",
    "active": true
  },
  "173159": {
    "employeeNumber": "173159",
    "name": "MORALES LEYVA KARLA SAMANTA",
    "role": "advisor",
    "active": true
  },
  "502488": {
    "employeeNumber": "502488",
    "name": "RAMOS MARTINEZ LAURA GEORGINA",
    "role": "advisor",
    "active": true
  }
};

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

function normalizeEmployee(value){
  return String(value || "").replace(/\D/g,"");
}

function currentLocalDate(){
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0,10);
}

function reportDocumentId(employeeNumber, date){
  return `${employeeNumber}_${date}`;
}

const hasPlaceholder = Object.values(firebaseConfig).some(value =>
  String(value).includes("REEMPLAZAR")
);

if(hasPlaceholder){
  showError("Falta colocar la configuración real de Firebase.");
  loginButton.disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  function openEmployeeSession(profile){
    window.currentUserProfile = {
      uid: `employee-${profile.employeeNumber}`,
      ...profile
    };

    window.prepareAdvisorSession(window.currentUserProfile);
    authScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    window.resetCommercialFormForSession();
    window.prepareAdvisorSession(window.currentUserProfile);
  }

  loginForm.addEventListener("submit", event=>{
    event.preventDefault();
    clearError();

    const employeeNumber = normalizeEmployee(
      document.getElementById("loginEmployee").value
    );

    const profile = EMPLOYEE_DIRECTORY[employeeNumber];

    if(!profile || profile.active !== true){
      showError("Número de empleado no reconocido o acceso desactivado.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Ingresando…";
    openEmployeeSession(profile);
    loginButton.disabled = false;
    loginButton.textContent = "Ingresar";
  });

  window.logoutCommercialUser = function(){
    if(confirm("¿Deseas cerrar la sesión?")){
      window.currentUserProfile = null;
      window.location.reload();
    }
  };

  window.saveFinalizedReportToFirebase = async function(data){
    const profile = window.currentUserProfile;

    if(!profile || profile.role !== "advisor"){
      throw new Error("La sesión del asesor no está disponible.");
    }

    const reportDate = currentLocalDate();
    const reportId = reportDocumentId(profile.employeeNumber, reportDate);
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);

    const clients = (data.clients || []).map(client=>({
      ...client,
      points: Number(client.points || 0)
    }));

    const procedureCount = clients.filter(
      client => client.result === "Trámite realizado"
    ).length;

    const payload = {
      advisorUid: `employee-${profile.employeeNumber}`,
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
    };

    // setDoc falla si las reglas detectan que ya existe ese reporte.
    await setDoc(reportRef, payload);
    return reportId;
  };
}
