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
  updateDoc,
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

const digits = value => String(value || "").replace(/\D/g, "");
const showError = message => {
  loginError.textContent = message;
  loginError.classList.add("show");
};
const clearError = () => {
  loginError.textContent = "";
  loginError.classList.remove("show");
};
const currentLocalDate = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};
const advisorIsActive = advisor =>
  advisor.active !== false &&
  !["inactive", "inactivo"].includes(String(advisor.status || "").toLowerCase());
const advisorPin = advisor =>
  digits(advisor.pin ?? advisor.nip ?? advisor.accessPin ?? advisor.password ?? advisor.PIN ?? "");
const advisorName = advisor =>
  advisor.name || advisor.advisorName || advisor.fullName || "ASESOR";
const advisorNumber = (advisor, fallback) =>
  String(advisor.employeeNumber || advisor.advisorEmployeeNumber || advisor.number || fallback || "");

const hasPlaceholder = Object.values(firebaseConfig).some(value =>
  String(value).includes("REEMPLAZAR")
);

if (hasPlaceholder) {
  showError("Falta colocar la configuración real de Firebase.");
  loginButton.disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  async function findAdvisor(employeeNumber) {
    const direct = await getDoc(doc(db, ADVISORS_COLLECTION, employeeNumber));
    if (direct.exists()) return { id: direct.id, ...direct.data() };

    for (const field of ["employeeNumber", "advisorEmployeeNumber", "number"]) {
      const result = await getDocs(
        query(collection(db, ADVISORS_COLLECTION), where(field, "==", employeeNumber))
      );
      if (!result.empty) {
        const item = result.docs[0];
        return { id: item.id, ...item.data() };
      }
    }
    return null;
  }

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearError();

    const employeeNumber = digits(document.getElementById("loginEmployee").value);
    const pin = digits(document.getElementById("loginPin").value);

    if (!employeeNumber) {
      showError("Ingresa tu número de empleado.");
      return;
    }
    if (pin.length !== 4) {
      showError("El NIP debe contener 4 dígitos.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Validando…";

    try {
      const advisor = await findAdvisor(employeeNumber);

      if (!advisor || advisorPin(advisor) !== pin) {
        throw new Error("Número de empleado o NIP incorrecto.");
      }
      if (!advisorIsActive(advisor)) {
        throw new Error("Tu acceso está desactivado. Consulta al gerente.");
      }

      const profile = {
        uid: `employee-${employeeNumber}`,
        advisorDocId: advisor.id,
        employeeNumber: advisorNumber(advisor, employeeNumber),
        name: advisorName(advisor),
        role: "advisor",
        active: true
      };

      window.currentUserProfile = profile;
      sessionStorage.setItem("commercial_advisor_session", JSON.stringify(profile));

      try {
        await updateDoc(doc(db, ADVISORS_COLLECTION, advisor.id), {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("No se actualizó el último acceso:", error);
      }

      window.prepareAdvisorSession(profile);
      authScreen.classList.add("hidden");
      appRoot.classList.remove("hidden");
      document.body.classList.add("report-app-open");
      window.resetCommercialFormForSession();
      window.prepareAdvisorSession(profile);
    } catch (error) {
      console.error(error);
      showError(error.message || "No fue posible iniciar sesión.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Continuar";
    }
  });

  window.logoutCommercialUser = function () {
    if (confirm("¿Deseas cerrar la sesión?")) {
      sessionStorage.removeItem("commercial_advisor_session");
      window.location.reload();
    }
  };

  window.saveFinalizedReportToFirebase = async function (data) {
    const profile = window.currentUserProfile;

    if (!profile || profile.role !== "advisor") {
      throw new Error("La sesión del asesor no está disponible.");
    }

    const reportDate = currentLocalDate();
    const reportId = `${profile.employeeNumber}_${reportDate}_${Date.now()}`;
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);

    const clients = (data.clients || []).map(client => ({
      ...client,
      points: Number(client.points || 0)
    }));

    const closureCount = clients.filter(client =>
      ["Cierre", "Trámite realizado"].includes(client.result)
    ).length;

    const socialFromClients = clients.some(
      client => client.result === "Servicio social"
    );

    const socialService = {
      performed: data.socialService?.performed === true || socialFromClients,
      type: data.socialService?.type ||
        (socialFromClients ? "Atención a prospecto o cliente" : ""),
      place: data.socialService?.place || "",
      peopleReached: Number(data.socialService?.peopleReached || 0),
      description: data.socialService?.description ||
        (socialFromClients
          ? "Actividad identificada como Servicio social en el resultado del contacto."
          : "")
    };

    await setDoc(reportRef, {
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
      closureCount,
      procedureCount: closureCount,
      socialService,
      socialServiceCount: socialService.performed ? 1 : 0,
      peopleReached: socialService.peopleReached,
      generalNotes: data.generalNotes || "",
      notePriority: data.notePriority || "Normal",
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
