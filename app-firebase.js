import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  ADVISORS_COLLECTION,
  REPORTS_COLLECTION
} from "./firebase-config.js";

const INITIAL_PIN_HASHES = {
  "130257": "99529c2976202f50fed82d5c940126be745a5ac2a20e864e3ceaf24658f0af32",
  "152642": "d7fcb83baff340632f21132053f767e40b38be6bc8202f2282689db95b0567be",
  "158311": "472103ca9d0cc86abc0b5912161938d8f892b281e182a3538e84e1fa3aae11e5",
  "161328": "bf26fde81678761ffc17a8b7d035b5add4e35a519042b6bb09a221b815a74563",
  "162129": "f801ae1c445a21eafa59d53271fab28a012c3c594163cad56a4c264fd403bb94",
  "164641": "c3e8a20da78d7fdcc547a3f822b184efdf34867567864332248ea07ed96f8892",
  "165555": "840bdc7edae5507ecfc5d40028f473370998314b798a6559f65d2566ad5133ab",
  "169527": "d0e8d98bdf542abb3ec72604e5675dd592a470bec7a39d4dacdb718e32e9d2b1",
  "169884": "80fc610537ed26e2cd61bbfe4f2f9d08da333ca96b6983e41b7002d8c120a43c",
  "171033": "2bd74ca25282ca2947279b7224986049b494905b048ab8b11bf828a6647efdb4",
  "171155": "f72b1863e685713a80d9dbeeb9cc90a31a7c696a52bbe97421f44be9fb80da79",
  "172247": "8e3067bef11dac1c37508aa3f9bc626172786f3e002bcdf1cf0b36715dd7d338",
  "172852": "e9b08f027d649403701647e92db43485b016c232b7dd60f9c374f1ddfef6e7f7",
  "173151": "2966a0f8d5b2b3f83911fb5cb03397a72466a88dd9b9ed5a7710d58650db52e3",
  "173159": "86057ebdac4b526ced430f5ae2490d8675c66be5b8cba5eab146121125bb59f4",
  "502488": "a8486ecf79291f49ca260fdc11e3309a65ed5437693e2026452f320286e5f520"
};

const authScreen = document.getElementById("advisorAuthScreen");
const appRoot = document.getElementById("appRoot");
const loginForm = document.getElementById("advisorLoginForm");
const loginButton = document.getElementById("advisorLoginButton");
const loginError = document.getElementById("advisorLoginError");
const loginEmployeeNumber =
  document.getElementById("loginEmployeeNumber");
const loginPin = document.getElementById("loginPin");

let failedAttempts = 0;
let lockedUntil = 0;
let advisorActivationToken = 0;

const normalizeEmployeeNumber = value =>
  String(value || "").replace(/\D/g,"");

async function sha256(value){
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256",bytes);

  return [...new Uint8Array(digest)]
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

function setLoginError(message=""){
  loginError.textContent = message;
  loginError.classList.toggle("show",Boolean(message));
}

function setLoginBusy(isBusy){
  loginButton.disabled = isBusy;
  loginButton.textContent = isBusy
    ? "Validando…"
    : "Ingresar";
}

function currentLocalDate(){
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(
    date.getTime() - offset * 60000
  ).toISOString().slice(0,10);
}

function reportDocumentId(employeeNumber,date){
  const timestamp = Date.now();
  const randomPart = (
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0,8)
      : Math.random().toString(36).slice(2,10)
  );

  return `${employeeNumber}_${date}_${timestamp}_${randomPart}`;
}

function reportTimestampValue(report){
  if(report.createdAt?.toMillis){
    return report.createdAt.toMillis();
  }

  const localValue =
    report.createdAtLocal
    || report.createdAt
    || "";

  const parsed = new Date(localValue).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

const hasPlaceholder = Object.values(firebaseConfig).some(
  value=>String(value).includes("REEMPLAZAR")
);

let db = null;

if(hasPlaceholder){
  setLoginError(
    "Falta configurar Firebase en firebase-config.js."
  );
}else{
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
}

async function detectRepeatEntry(profile){
  const activationToken = ++advisorActivationToken;

  try{
    const snapshots = await getDocs(
      query(
        collection(db,REPORTS_COLLECTION),
        where(
          "advisorEmployeeNumber",
          "==",
          profile.employeeNumber
        )
      )
    );

    if(activationToken !== advisorActivationToken) return;

    const today = currentLocalDate();
    const reportsToday = snapshots.docs
      .map(item=>({
        id:item.id,
        ...item.data()
      }))
      .filter(report=>
        report.createdDate === today
        && report.status !== "cancelled"
      )
      .sort(
        (a,b)=>
          reportTimestampValue(b)
          - reportTimestampValue(a)
      );

    const previousReport = reportsToday[0] || null;

    window.setRepeatEntryMode?.(
      Boolean(previousReport),
      previousReport
    );
  }catch(error){
    console.error(
      "No fue posible validar registros previos:",
      error
    );
    window.setRepeatEntryMode?.(false,null);
  }
}

async function authenticateAdvisor(employeeNumber,pin){
  if(!db){
    throw new Error("Firebase no está disponible.");
  }

  const employeeRef = doc(
    db,
    ADVISORS_COLLECTION,
    employeeNumber
  );
  const employeeSnapshot = await getDoc(employeeRef);

  if(!employeeSnapshot.exists()){
    throw new Error("Usuario o PIN incorrectos.");
  }

  const employee = {
    employeeNumber:employeeSnapshot.id,
    ...employeeSnapshot.data()
  };

  if(employee.active !== true){
    throw new Error("Este usuario se encuentra inactivo.");
  }

  const storedHash =
    employee.pinHash
    || INITIAL_PIN_HASHES[employeeNumber]
    || "";

  const candidateHash = await sha256(
    `${employeeNumber}:${pin}`
  );

  if(!storedHash || candidateHash !== storedHash){
    throw new Error("Usuario o PIN incorrectos.");
  }

  if(!employee.pinHash && INITIAL_PIN_HASHES[employeeNumber]){
    await setDoc(
      employeeRef,
      {
        pinHash:INITIAL_PIN_HASHES[employeeNumber],
        pinEnabled:true,
        accessMode:"employee_pin",
        pinUpdatedAt:serverTimestamp()
      },
      {merge:true}
    );
  }

  return {
    uid:`employee-${employeeNumber}`,
    employeeNumber,
    name:employee.name || "Empleado",
    role:"advisor",
    active:true,
    accessMode:"employee_pin"
  };
}

loginPin.addEventListener("input",event=>{
  event.target.value = event.target.value
    .replace(/\D/g,"")
    .slice(0,4);
});

loginEmployeeNumber.addEventListener("input",event=>{
  event.target.value = normalizeEmployeeNumber(
    event.target.value
  ).slice(0,10);
});

loginForm.addEventListener("submit",async event=>{
  event.preventDefault();
  setLoginError();

  if(Date.now() < lockedUntil){
    const seconds = Math.ceil(
      (lockedUntil - Date.now()) / 1000
    );
    setLoginError(
      `Demasiados intentos. Espera ${seconds} segundos.`
    );
    return;
  }

  const employeeNumber = normalizeEmployeeNumber(
    loginEmployeeNumber.value
  );
  const pin = loginPin.value.trim();

  if(employeeNumber.length < 3 || !/^\d{4}$/.test(pin)){
    setLoginError(
      "Ingresa tu número de empleado y un PIN de cuatro dígitos."
    );
    return;
  }

  setLoginBusy(true);

  try{
    const profile = await authenticateAdvisor(
      employeeNumber,
      pin
    );

    failedAttempts = 0;
    lockedUntil = 0;

    window.prepareAdvisorSession(profile);
    window.resetCommercialFormForSession();
    await detectRepeatEntry(profile);

    authScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    loginPin.value = "";
  }catch(error){
    console.error(error);
    failedAttempts += 1;

    if(failedAttempts >= 5){
      lockedUntil = Date.now() + 60_000;
      failedAttempts = 0;
      setLoginError(
        "Demasiados intentos. El acceso se bloqueó durante 60 segundos."
      );
    }else{
      setLoginError(
        error?.message || "No fue posible validar el acceso."
      );
    }
  }finally{
    setLoginBusy(false);
  }
});

window.logoutCommercialUser = function(){
  advisorActivationToken += 1;
  window.currentUserProfile = null;
  window.setRepeatEntryMode?.(false,null);

  appRoot.classList.add("hidden");
  authScreen.classList.remove("hidden");

  loginForm.reset();
  setLoginError();
  loginEmployeeNumber.focus();
};

window.saveFinalizedReportToFirebase = async function(data){
  const profile = window.currentUserProfile;

  if(!profile || profile.role !== "advisor"){
    throw new Error(
      "La sesión del usuario ya no está disponible."
    );
  }

  const reportDate = currentLocalDate();
  const reportId = reportDocumentId(
    profile.employeeNumber,
    reportDate
  );
  const reportRef = doc(
    db,
    REPORTS_COLLECTION,
    reportId
  );

  const clients = (data.clients || []).map(client=>({
    ...client,
    points:Number(client.points || 0)
  }));

  const procedureCount = clients.filter(
    client=>client.result === "Trámite realizado"
  ).length;

  const payload = {
    reportId,
    advisorUid:`employee-${profile.employeeNumber}`,
    advisorName:profile.name,
    advisorEmployeeNumber:profile.employeeNumber,
    advisorRole:"advisor",
    entryType:data.repeatEntry
      ? "additional_report_without_plan"
      : "daily_full_report",
    inheritedFromReportId:
      data.inheritedFromReportId || "",
    createdDate:reportDate,
    createdAt:serverTimestamp(),
    createdAtLocal:data.createdAt,
    prospecting:data.prospecting,
    activityPlace:data.activityPlace,
    activitySchedule:data.activitySchedule,
    contacts:Number(data.peopleContacted || 0),
    appointmentsGenerated:Number(
      data.appointmentsGenerated || 0
    ),
    activityDescription:data.activityDescription,
    clients,
    clientCount:clients.length,
    procedureCount,
    planSkipped:data.repeatEntry === true,
    plan:{
      date:data.repeatEntry ? "" : data.promiseDate,
      place:data.repeatEntry ? "" : data.promisePlace,
      method:data.repeatEntry ? "" : data.promiseMethod,
      schedule:data.repeatEntry
        ? ""
        : data.promiseSchedule,
      contactGoal:data.repeatEntry
        ? 0
        : Number(data.contactGoal || 0),
      appointmentGoal:data.repeatEntry
        ? 0
        : Number(data.appointmentGoal || 0),
      description:data.repeatEntry
        ? ""
        : data.promiseDescription
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
