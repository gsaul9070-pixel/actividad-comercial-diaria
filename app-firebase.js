import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  ADVISORS_COLLECTION,
  REPORTS_COLLECTION
} from "./firebase-config.js";

const advisorSelector = document.getElementById("advisorSelector");
const appRoot = document.getElementById("appRoot");
let advisors = [];

function currentLocalDate(){
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0,10);
}

function reportDocumentId(employeeNumber, date){
  return `${employeeNumber}_${date}`;
}

function showConfigurationError(message){
  const status = document.getElementById("status1");
  if(status){
    status.textContent = message;
    status.className = "status error show";
  } else {
    alert(message);
  }
}

function activateAdvisor(employeeNumber){
  const profile = advisors.find(
    advisor => advisor.employeeNumber === employeeNumber
  );

  if(!profile){
    window.currentUserProfile = null;
    document.getElementById("advisorName").value = "";
    document.getElementById("employeeNumber").value = "";
    document.getElementById("sessionName").textContent =
      "Selecciona un asesor";
    document.getElementById("sessionMeta").textContent =
      "Captura directa sin inicio de sesión";
    return;
  }

  window.prepareAdvisorSession({
    uid:`employee-${profile.employeeNumber}`,
    employeeNumber:profile.employeeNumber,
    name:profile.name,
    role:"advisor",
    active:true,
    accessMode:"public_selector"
  });
}

const hasPlaceholder = Object.values(firebaseConfig).some(value =>
  String(value).includes("REEMPLAZAR")
);

appRoot.classList.remove("hidden");

if(hasPlaceholder){
  showConfigurationError(
    "Falta colocar la configuración real de Firebase en firebase-config.js."
  );
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);

  onSnapshot(
    collection(db, ADVISORS_COLLECTION),
    snapshot=>{
      const selected = advisorSelector.value;

      advisors = snapshot.docs
        .map(item=>({
          employeeNumber:item.id,
          ...item.data()
        }))
        .filter(advisor=>advisor.active === true)
        .sort((a,b)=>(a.name || "").localeCompare(b.name || ""));

      advisorSelector.innerHTML =
        '<option value="">Selecciona un asesor</option>' +
        advisors.map(advisor=>
          `<option value="${advisor.employeeNumber}">${advisor.name} · ${advisor.employeeNumber}</option>`
        ).join("");

      if(advisors.some(item=>item.employeeNumber === selected)){
        advisorSelector.value = selected;
        activateAdvisor(selected);
      } else {
        activateAdvisor("");
      }
    },
    error=>{
      console.error(error);
      showConfigurationError(
        "No fue posible cargar la lista de asesores desde Firebase."
      );
    }
  );

  advisorSelector.addEventListener("change",()=>{
    activateAdvisor(advisorSelector.value);
  });

  window.logoutCommercialUser = function(){
    advisorSelector.value = "";
    activateAdvisor("");
    window.resetCommercialFormForSession();
  };

  window.saveFinalizedReportToFirebase = async function(data){
    const profile = window.currentUserProfile;

    if(!profile || profile.role !== "advisor"){
      throw new Error("Selecciona un asesor antes de guardar.");
    }

    const reportDate = currentLocalDate();
    const reportId = reportDocumentId(profile.employeeNumber, reportDate);
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);

    const clients = (data.clients || []).map(client=>({
      ...client,
      points:Number(client.points || 0)
    }));

    const procedureCount = clients.filter(
      client => client.result === "Trámite realizado"
    ).length;

    const payload = {
      advisorUid:`employee-${profile.employeeNumber}`,
      advisorName:profile.name,
      advisorEmployeeNumber:profile.employeeNumber,
      advisorRole:"advisor",
      createdDate:reportDate,
      createdAt:serverTimestamp(),
      createdAtLocal:data.createdAt,
      prospecting:data.prospecting,
      activityPlace:data.activityPlace,
      activitySchedule:data.activitySchedule,
      contacts:Number(data.peopleContacted || 0),
      appointmentsGenerated:Number(data.appointmentsGenerated || 0),
      activityDescription:data.activityDescription,
      clients,
      clientCount:clients.length,
      procedureCount,
      plan:{
        date:data.promiseDate,
        place:data.promisePlace,
        method:data.promiseMethod,
        schedule:data.promiseSchedule,
        contactGoal:Number(data.contactGoal || 0),
        appointmentGoal:Number(data.appointmentGoal || 0),
        description:data.promiseDescription
      },
      status:"finalized",
      reviewStatus:"pending",
      reviewedAt:null,
      reviewedBy:null,
      updatedAt:serverTimestamp()
    };

    await setDoc(reportRef,payload);
    return reportId;
  };
}
