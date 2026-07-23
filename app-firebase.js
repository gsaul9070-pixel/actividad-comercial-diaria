import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  ADVISORS_COLLECTION,
  REPORTS_COLLECTION
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
      employeeNumber: profile.employeeNumber,
      name: profile.name,
      role: "advisor",
      active: profile.active === true,
      accessMode: "employee_number_only"
    };

    window.prepareAdvisorSession(window.currentUserProfile);
    authScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    window.resetCommercialFormForSession();
    window.prepareAdvisorSession(window.currentUserProfile);
  }

  loginForm.addEventListener("submit", async event=>{
    event.preventDefault();
    clearError();

    const employeeNumber = normalizeEmployee(
      document.getElementById("loginEmployee").value
    );

    if(!employeeNumber){
      showError("Ingresa tu número de empleado.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Validando…";

    try{
      const advisorSnap = await getDoc(
        doc(db, ADVISORS_COLLECTION, employeeNumber)
      );

      if(!advisorSnap.exists()){
        throw new Error("Número de empleado no reconocido.");
      }

      const profile = advisorSnap.data();

      if(profile.active !== true){
        throw new Error("Tu acceso está desactivado. Consulta a tu gerente.");
      }

      openEmployeeSession({
        ...profile,
        employeeNumber
      });
    }catch(error){
      console.error(error);
      showError(error?.message || "No fue posible validar el número de empleado.");
    }finally{
      loginButton.disabled = false;
      loginButton.textContent = "Ingresar";
    }
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

    try{
      await setDoc(reportRef, payload);
      return reportId;
    }catch(error){
      if(error?.code === "permission-denied"){
        throw new Error(
          "No fue posible guardar. Revisa que el asesor siga activo y que no exista ya un reporte de hoy."
        );
      }
      throw error;
    }
  };
}
