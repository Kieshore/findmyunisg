let interests = [];
let originalAcademicPayload = null;
let originalBasicPayload = null;

const A_LEVEL_GRADES = ["A", "B", "C", "D", "E", "S", "U"];
const H1_POINTS = {
  A: 10,
  B: 8.75,
  C: 7.5,
  D: 6.25,
  E: 5,
  S: 2.5,
  U: 0,
};
const H2_POINTS = {
  A: 20,
  B: 17.5,
  C: 15,
  D: 12.5,
  E: 10,
  S: 5,
  U: 0,
};

const state = {
  modalTarget: null,
  modalSelectedInterests: new Set(),
  selectedInterests: structuredClone(DEFAULT_INTEREST_STATE),
};

function getAcademicElements() {
  return {
    firstName: document.getElementById("firstName"),
    email: document.getElementById("email"),
    school: document.getElementById("school"),
    postalCode: document.getElementById("postal_code"),
    course: document.getElementById("course"),
    gradYear: document.getElementById("gradYear"),
    qualification: document.getElementById("qualification"),
    scoreLabel: document.getElementById("scoreLabel"),
    academicScore: document.getElementById("academicScore"),
    aLevelScoreHint: document.getElementById("aLevelScoreHint"),
    aLevelGradeFields: document.getElementById("aLevelGradeFields"),
    h1GeneralPaperGrade: document.getElementById("h1GeneralPaperGrade"),
    h1ProjectWorkGrade: document.getElementById("h1ProjectWorkGrade"),
    h1ContentGrade: document.getElementById("h1ContentGrade"),
    h1MotherTongueGrade: document.getElementById("h1MotherTongueGrade"),
    h2Subject1Grade: document.getElementById("h2Subject1Grade"),
    h2Subject2Grade: document.getElementById("h2Subject2Grade"),
    h2Subject3Grade: document.getElementById("h2Subject3Grade"),
    h2Subject4Grade: document.getElementById("h2Subject4Grade"),
    saveButton: document.getElementById("saveAcademicProfileBtn"),
    message: document.getElementById("academicProfileMessage"),
  };
}

function isAlevelQualification(value) {
  const normalized = String(value || "").trim().toLowerCase();

  return (
    normalized.includes("a level") ||
    normalized.includes("a-level") ||
    normalized.includes("jc") ||
    normalized.includes("junior college")
  );
}

function isDiplomaQualification(value) {
  const normalized = String(value || "").trim().toLowerCase();

  return (
    normalized.includes("diploma") ||
    normalized.includes("poly") ||
    normalized.includes("polytechnic")
  );
}

function normalizeQualification(value) {
  if (isAlevelQualification(value)) return "A Level";
  if (isDiplomaQualification(value)) return "Diploma";
  return "";
}

function getH1Points(grade) {
  const normalized = String(grade || "").trim().toUpperCase();
  return A_LEVEL_GRADES.includes(normalized) ? H1_POINTS[normalized] : null;
}

function getH2Points(grade) {
  const normalized = String(grade || "").trim().toUpperCase();
  return A_LEVEL_GRADES.includes(normalized) ? H2_POINTS[normalized] : null;
}

function round2(value) {
  return Number(value.toFixed(2));
}

function getAlevelGradePayloadFromForm() {
  const elements = getAcademicElements();

  return {
    h1_general_paper_grade: elements.h1GeneralPaperGrade?.value || "",
    h1_project_work_grade: elements.h1ProjectWorkGrade?.value || "",
    h1_content_grade: elements.h1ContentGrade?.value || "",
    h1_mother_tongue_grade: elements.h1MotherTongueGrade?.value || "",
    h2_subject_1_grade: elements.h2Subject1Grade?.value || "",
    h2_subject_2_grade: elements.h2Subject2Grade?.value || "",
    h2_subject_3_grade: elements.h2Subject3Grade?.value || "",
    h2_subject_4_grade: elements.h2Subject4Grade?.value || "",
  };
}

function calculateAlevelScores(payload) {
  const gpPoint = getH1Points(payload.h1_general_paper_grade);
  const pwPoint = getH1Points(payload.h1_project_work_grade);
  const mtPoint = getH1Points(payload.h1_mother_tongue_grade);
  const h2Points = [
    payload.h2_subject_1_grade,
    payload.h2_subject_2_grade,
    payload.h2_subject_3_grade,
    payload.h2_subject_4_grade,
  ]
    .map((grade, index) => ({
      index,
      points: getH2Points(grade),
    }))
    .filter(item => item.points !== null)
    .sort((a, b) => b.points - a.points);

  if (gpPoint === null || h2Points.length < 3) {
    return null;
  }

  const graduationYear = Number(payload.graduation_year || 0);
  const isOldRpSystem = graduationYear && graduationYear <= 2024;
  const bestThreeH2 = h2Points.slice(0, 3);
  const usedH2Indexes = bestThreeH2.map(item => item.index);
  const h2Total = bestThreeH2.reduce((sum, item) => sum + item.points, 0);
  const unusedH2Content = h2Points
    .filter(item => !usedH2Indexes.includes(item.index))
    .map(item => item.points / 2);
  const h1ContentPoint = getH1Points(payload.h1_content_grade);
  const optionalContentPoints = [
    ...unusedH2Content,
    ...(h1ContentPoint === null ? [] : [h1ContentPoint]),
  ];
  const optionalContentPoint = optionalContentPoints.length
    ? Math.max(...optionalContentPoints)
    : null;

  if (isOldRpSystem) {
    if (pwPoint === null) return null;

    const base90 = h2Total + gpPoint + pwPoint + (optionalContentPoint ?? 0);
    const withMotherTongue =
      mtPoint === null ? base90 : round2(((base90 + mtPoint) / 100) * 90);
    const rp90 = round2(Math.max(base90, withMotherTongue));

    return {
      rp90,
      uas70: round2((rp90 / 90) * 70),
    };
  }

  const base70 = h2Total + gpPoint;
  const candidates = [base70];

  if (optionalContentPoint !== null) {
    candidates.push(((base70 + optionalContentPoint) / 80) * 70);
  }

  if (mtPoint !== null) {
    candidates.push(((base70 + mtPoint) / 80) * 70);
  }

  if (optionalContentPoint !== null && mtPoint !== null) {
    candidates.push(((base70 + optionalContentPoint + mtPoint) / 90) * 70);
  }

  const uas70 = round2(Math.max(...candidates));
  const rp90Base = h2Total + gpPoint + (optionalContentPoint ?? 0);
  const rp90WithMotherTongue = mtPoint === null ? rp90Base : rp90Base + mtPoint;

  return {
    rp90: round2(Math.max(rp90Base, rp90WithMotherTongue)),
    uas70,
  };
}

function updateCalculatedAlevelScore() {
  const elements = getAcademicElements();

  if (elements.qualification?.value !== "A Level") return;

  const scores = calculateAlevelScores({
    ...getAlevelGradePayloadFromForm(),
    graduation_year: elements.gradYear?.value || null,
  });

  if (!scores) {
    elements.academicScore.value = "";
    if (elements.aLevelScoreHint) {
      elements.aLevelScoreHint.textContent =
        "Select GP and at least three H2 grades to calculate your score.";
    }
    return;
  }

  elements.academicScore.value = `RP ${scores.rp90.toFixed(2)} / UAS ${scores.uas70.toFixed(2)}`;

  if (elements.aLevelScoreHint) {
    elements.aLevelScoreHint.textContent =
      "UAS is used for direct university score matching. RP is kept for SIT/SUSS band admissions.";
  }
}

function updateScoreLabel() {
  const elements = getAcademicElements();
  const qualification = elements.qualification?.value || "";

  if (!elements.scoreLabel || !elements.academicScore) return;

  const courseField = elements.course?.closest(".field");

 if (qualification === "A Level") {
  const gradYear = Number(elements.gradYear?.value || 0);
  const isOldRpSystem = gradYear && gradYear <= 2024;
  const projectWorkField = elements.h1ProjectWorkGrade?.closest(".field");

  elements.scoreLabel.textContent = "Calculated RP / UAS";
  elements.academicScore.placeholder = "Select your A Level grades";
  elements.academicScore.readOnly = true;
  elements.academicScore.removeAttribute("min");
  elements.academicScore.removeAttribute("max");

  elements.aLevelGradeFields?.classList.remove("hidden");
  elements.aLevelScoreHint?.classList.remove("hidden");
  projectWorkField?.classList.toggle("hidden", !isOldRpSystem);

  if (courseField) {
    courseField.classList.add("hidden");
  }

  if (elements.course) {
    elements.course.value = "";
  }

  if (!isOldRpSystem && elements.h1ProjectWorkGrade) {
    elements.h1ProjectWorkGrade.value = "";
  }

  updateCalculatedAlevelScore();
} else if (qualification === "Diploma") {
    elements.scoreLabel.textContent = "GPA";
    elements.academicScore.placeholder = "e.g. 3.45";
    elements.academicScore.readOnly = false;
    elements.academicScore.min = "0";
    elements.academicScore.max = "4";
    elements.aLevelGradeFields?.classList.add("hidden");
    elements.aLevelScoreHint?.classList.add("hidden");

    if (courseField) {
      courseField.classList.remove("hidden");
    }
  } else {
    elements.scoreLabel.textContent = "GPA/RP";
    elements.academicScore.placeholder = "Select qualification first";
    elements.academicScore.readOnly = false;
    elements.academicScore.removeAttribute("min");
    elements.academicScore.removeAttribute("max");
    elements.aLevelGradeFields?.classList.add("hidden");
    elements.aLevelScoreHint?.classList.add("hidden");

    if (courseField) {
      courseField.classList.remove("hidden");
    }
  }
}

function getAcademicPayloadFromForm() {
  const elements = getAcademicElements();
  const qualification = elements.qualification?.value || "";
  const isAlevel = qualification === "A Level";

  return {
    qualification_type: qualification,
    school: elements.school?.value.trim() || "",
    course:
      isAlevel
        ? null
        : elements.course?.value.trim() || "",
    graduation_year: elements.gradYear?.value
      ? Number(elements.gradYear.value)
      : null,
    academic_score: !isAlevel && elements.academicScore?.value
      ? Number(elements.academicScore.value)
      : null,
    ...(isAlevel ? getAlevelGradePayloadFromForm() : {}),
  };
}

function payloadComparable(payload) {
  return JSON.stringify({
    qualification_type: payload?.qualification_type || "",
    school: payload?.school || "",
    course: payload?.course || "",
    graduation_year: payload?.graduation_year ?? null,
    academic_score: payload?.academic_score ?? null,
    h1_general_paper_grade: payload?.h1_general_paper_grade || "",
    h1_project_work_grade: payload?.h1_project_work_grade || "",
    h1_content_grade: payload?.h1_content_grade || "",
    h1_mother_tongue_grade: payload?.h1_mother_tongue_grade || "",
    h2_subject_1_grade: payload?.h2_subject_1_grade || "",
    h2_subject_2_grade: payload?.h2_subject_2_grade || "",
    h2_subject_3_grade: payload?.h2_subject_3_grade || "",
    h2_subject_4_grade: payload?.h2_subject_4_grade || "",
  });
}

function hasAcademicChanged() {
  return payloadComparable(getAcademicPayloadFromForm()) !== payloadComparable(originalAcademicPayload);
}

function getBasicProfilePayloadFromForm() {
  const elements = getAcademicElements();

  return {
    postal_code: elements.postalCode?.value.trim() || "",
  };
}

function basicPayloadComparable(payload) {
  return JSON.stringify({
    postal_code: payload?.postal_code || "",
  });
}

function hasBasicProfileChanged() {
  return basicPayloadComparable(getBasicProfilePayloadFromForm()) !==
    basicPayloadComparable(originalBasicPayload);
}

function setAcademicMessage(message = "", type = "") {
  const elements = getAcademicElements();

  if (!elements.message) return;

  elements.message.textContent = message;
  elements.message.classList.remove("success", "error");

  if (type) {
    elements.message.classList.add(type);
  }
}

function updateSaveButtonVisibility() {
  const elements = getAcademicElements();

  if (!elements.saveButton) return;

  elements.saveButton.classList.toggle(
    "hidden",
    !hasAcademicChanged() && !hasBasicProfileChanged()
  );
}

function validateBasicProfilePayload(payload) {
  if (payload.postal_code && !/^\d{6}$/.test(payload.postal_code)) {
    throw new Error("Postal code must be 6 digits.");
  }
}

function validateAcademicPayload(payload) {
  if (!payload.qualification_type) {
    throw new Error("Please select your qualification.");
  }

  if (!payload.school) {
    throw new Error("Please enter your school.");
  }

  if (payload.qualification_type === "Diploma" && !payload.course) {
  throw new Error("Please enter your course.");
}

  if (!payload.graduation_year) {
    throw new Error("Please enter your graduation year.");
  }

  if (payload.graduation_year > 2040) {
    throw new Error("Please enter a valid graduation year.");
  }

  if (payload.qualification_type === "Diploma") {
    if (payload.academic_score === null || Number.isNaN(payload.academic_score)) {
      throw new Error("Please enter your GPA.");
    }

    if (payload.academic_score < 0 || payload.academic_score > 4) {
      throw new Error("GPA must be between 0 and 4.");
    }
  }

  if (payload.qualification_type === "A Level") {
  const isOldRpSystem = payload.graduation_year <= 2024;
  const requiredGrades = [
    ["General Paper", payload.h1_general_paper_grade],
    ["H2 subject 1", payload.h2_subject_1_grade],
    ["H2 subject 2", payload.h2_subject_2_grade],
    ["H2 subject 3", payload.h2_subject_3_grade],
  ];

  if (isOldRpSystem) {
    requiredGrades.push(["Project Work", payload.h1_project_work_grade]);
  }

  const missingGrade = requiredGrades.find(([, value]) => !value);

  if (missingGrade) {
    throw new Error(`Please select your ${missingGrade[0]} grade.`);
  }

  if (!calculateAlevelScores(payload)) {
    throw new Error("Please select enough A Level grades to calculate your score.");
  }
}
}

function academicProfileRowToPayload(profile) {
  if (!profile) {
    return {
      qualification_type: "",
      school: "",
      course: "",
      graduation_year: null,
      academic_score: null,
      h1_general_paper_grade: "",
      h1_project_work_grade: "",
      h1_content_grade: "",
      h1_mother_tongue_grade: "",
      h2_subject_1_grade: "",
      h2_subject_2_grade: "",
      h2_subject_3_grade: "",
      h2_subject_4_grade: "",
      stored_rank_points: null,
      stored_uas_70: null,
    };
  }

  const qualification = normalizeQualification(profile.qualification_type);
  const graduationYear =
    profile.graduation_year === null || profile.graduation_year === undefined
      ? null
      : Number(profile.graduation_year);

  let academicScore = null;

  if (qualification === "A Level") {
    const isOldRpSystem = graduationYear !== null && graduationYear <= 2024;

    academicScore = isOldRpSystem
      ? profile.rank_points ?? profile.uas_70 ?? null
      : profile.uas_70 ?? profile.rank_points ?? null;
  } else {
    academicScore = profile.projected_gpa ?? profile.current_gpa ?? null;
  }

  return {
    qualification_type: qualification,
    school: profile.school || profile.institution_name || "",
    course: profile.course || profile.diploma_name || "",
    graduation_year: graduationYear,
    academic_score:
      qualification === "A Level" || academicScore === null || academicScore === undefined
        ? null
        : Number(academicScore),
    h1_general_paper_grade: profile.h1_general_paper_grade || "",
    h1_project_work_grade: profile.h1_project_work_grade || "",
    h1_content_grade: profile.h1_content_grade || "",
    h1_mother_tongue_grade: profile.h1_mother_tongue_grade || "",
    h2_subject_1_grade: profile.h2_subject_1_grade || "",
    h2_subject_2_grade: profile.h2_subject_2_grade || "",
    h2_subject_3_grade: profile.h2_subject_3_grade || "",
    h2_subject_4_grade: profile.h2_subject_4_grade || "",
    stored_rank_points:
      profile.rank_points === null || profile.rank_points === undefined
        ? null
        : Number(profile.rank_points),
    stored_uas_70:
      profile.uas_70 === null || profile.uas_70 === undefined
        ? null
        : Number(profile.uas_70),
  };
}

function populateAcademicForm(payload) {
  const elements = getAcademicElements();

  if (elements.qualification) {
    elements.qualification.value = payload.qualification_type || "";
  }

  if (elements.school) {
    elements.school.value = payload.school || "";
  }

  if (elements.course) {
    elements.course.value = payload.course || "";
  }

  if (elements.gradYear) {
    elements.gradYear.value = payload.graduation_year || "";
  }

  if (elements.academicScore) {
    elements.academicScore.value =
      payload.academic_score === null || payload.academic_score === undefined
        ? ""
        : payload.academic_score;
  }

  if (elements.h1GeneralPaperGrade) {
    elements.h1GeneralPaperGrade.value = payload.h1_general_paper_grade || "";
  }

  if (elements.h1ProjectWorkGrade) {
    elements.h1ProjectWorkGrade.value = payload.h1_project_work_grade || "";
  }

  if (elements.h1ContentGrade) {
    elements.h1ContentGrade.value = payload.h1_content_grade || "";
  }

  if (elements.h1MotherTongueGrade) {
    elements.h1MotherTongueGrade.value = payload.h1_mother_tongue_grade || "";
  }

  if (elements.h2Subject1Grade) {
    elements.h2Subject1Grade.value = payload.h2_subject_1_grade || "";
  }

  if (elements.h2Subject2Grade) {
    elements.h2Subject2Grade.value = payload.h2_subject_2_grade || "";
  }

  if (elements.h2Subject3Grade) {
    elements.h2Subject3Grade.value = payload.h2_subject_3_grade || "";
  }

  if (elements.h2Subject4Grade) {
    elements.h2Subject4Grade.value = payload.h2_subject_4_grade || "";
  }

  updateScoreLabel();

  if (payload.qualification_type === "A Level" && !elements.academicScore.value) {
    const storedRp = payload.stored_rank_points;
    const storedUas = payload.stored_uas_70;

    if (storedRp !== null || storedUas !== null) {
      elements.academicScore.value =
        `Saved RP ${storedRp ?? "-"} / UAS ${storedUas ?? "-"}`;
    }
  }

  originalAcademicPayload = structuredClone(payload);
  updateSaveButtonVisibility();
}

async function loadBasicUserProfile() {
  try {
    const user = await getCurrentUser();
    const elements = getAcademicElements();

    if (elements.firstName) {
      elements.firstName.value = user?.first_name || "";
    }

    if (elements.email) {
      elements.email.value = user?.email || "";
    }

    if (elements.postalCode) {
      elements.postalCode.value = user?.postal_code || "";
    }

    originalBasicPayload = getBasicProfilePayloadFromForm();
    updateSaveButtonVisibility();
  } catch (error) {
    console.warn("Unable to load basic user profile:", error.message);
  }
}

async function loadAcademicProfile() {
  try {
    const json = await fetchJson("/users/me/academic-profile");
    const payload = academicProfileRowToPayload(json.data);

    populateAcademicForm(payload);
    setAcademicMessage("");
  } catch (error) {
    console.warn("Unable to load academic profile:", error.message);

    populateAcademicForm({
      qualification_type: "",
      school: "",
      course: "",
      graduation_year: null,
      academic_score: null,
      h1_general_paper_grade: "",
      h1_project_work_grade: "",
      h1_content_grade: "",
      h1_mother_tongue_grade: "",
      h2_subject_1_grade: "",
      h2_subject_2_grade: "",
      h2_subject_3_grade: "",
      h2_subject_4_grade: "",
      stored_rank_points: null,
      stored_uas_70: null,
    });

    setAcademicMessage("No academic profile saved yet.", "");
  }
}

async function saveAcademicProfile() {
  const elements = getAcademicElements();
  const academicPayload = getAcademicPayloadFromForm();
  const basicPayload = getBasicProfilePayloadFromForm();
  const shouldSaveAcademic = hasAcademicChanged();
  const shouldSaveBasic = hasBasicProfileChanged();

  try {
    if (!shouldSaveAcademic && !shouldSaveBasic) {
      return;
    }

    if (shouldSaveBasic) {
      validateBasicProfilePayload(basicPayload);
    }

    if (shouldSaveAcademic) {
      validateAcademicPayload(academicPayload);
    }

    if (elements.saveButton) {
      elements.saveButton.disabled = true;
      elements.saveButton.textContent = "Saving...";
    }

    setAcademicMessage("Saving profile changes...", "");

    if (shouldSaveBasic) {
      const profileJson = await fetchJson("/users/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(basicPayload),
      });

      originalBasicPayload = {
        postal_code: profileJson.data?.postal_code || "",
      };

      if (CURRENT_USER) {
        CURRENT_USER.postal_code = profileJson.data?.postal_code || "";
      }
    }

    if (shouldSaveAcademic) {
      const academicJson = await fetchJson("/users/me/academic-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(academicPayload),
      });

      populateAcademicForm(academicProfileRowToPayload(academicJson.data));
    }

    setAcademicMessage("Profile changes saved.", "success");
    window.dispatchEvent(new CustomEvent("findmyunisg:profile-saved"));
  } catch (error) {
    console.error("Profile save failed:", error);
    setAcademicMessage(error.message || "Failed to save profile changes.", "error");
  } finally {
    if (elements.saveButton) {
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = "Save changes";
    }

    updateSaveButtonVisibility();
  }
}
function setupAcademicProfileForm() {
  const elements = getAcademicElements();

  const editableInputs = [
    elements.postalCode,
    elements.qualification,
    elements.school,
    elements.course,
    elements.gradYear,
    elements.academicScore,
    elements.h1GeneralPaperGrade,
    elements.h1ProjectWorkGrade,
    elements.h1ContentGrade,
    elements.h1MotherTongueGrade,
    elements.h2Subject1Grade,
    elements.h2Subject2Grade,
    elements.h2Subject3Grade,
    elements.h2Subject4Grade,
  ].filter(Boolean);

  editableInputs.forEach(input => {
    input.addEventListener("input", () => {
      updateCalculatedAlevelScore();
      setAcademicMessage("");
      updateSaveButtonVisibility();
    });

    input.addEventListener("change", () => {
     if (input === elements.qualification) {
  elements.academicScore.value = "";
}

if (input === elements.qualification || input === elements.gradYear) {
  updateScoreLabel();
}

      updateCalculatedAlevelScore();

      setAcademicMessage("");
      updateSaveButtonVisibility();
    });
  });

  if (elements.saveButton) {
    elements.saveButton.addEventListener("click", saveAcademicProfile);
  }
}

async function deleteAccount() {
  const shouldDelete = window.confirm(
    "Are you sure you want to delete your account and all its associated data?"
  );

  if (!shouldDelete) {
    window.location.hash = "#";
    return;
  }

  const deleteButton = document.getElementById("deleteAccountBtn");

  try {
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.textContent = "Deleting...";
    }

    await fetchJson("/users/me", {
      method: "DELETE",
    });

    window.location.href = "/login.html";
  } catch (error) {
    console.error("Account delete failed:", error);
    setAcademicMessage(error.message || "Failed to delete account.", "error");

    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.textContent = "Delete account";
    }
  }
}

function setupDeleteAccountButton() {
  const deleteButton = document.getElementById("deleteAccountBtn");

  if (!deleteButton) return;

  deleteButton.addEventListener("click", deleteAccount);
}

async function loadInterests() {
  try {
    const json = await fetchJson("/interest-groups");
    interests = json.data
      .map(item => item.interest_name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    interests = [];
    console.warn("Unable to load interests:", error.message);
  }
}

function persistInterests() {
  saveInterestState(state.selectedInterests);
}

function makePill(name, onRemove) {
  const pill = document.createElement("span");
  pill.className = "pill";
  pill.innerHTML = `<span>${name}</span><button type="button">×</button>`;
  pill.querySelector("button").addEventListener("click", onRemove);
  return pill;
}

function renderTierLists() {
  document.querySelectorAll(".tier-list").forEach(list => {
    const kind = list.dataset.kind;

    list.querySelectorAll(".tier-row").forEach(row => {
      const tier = row.dataset.tier;
      const zone = row.querySelector(".tier-dropzone");

      zone.innerHTML = "";

      state.selectedInterests[kind][tier].forEach(name => {
        zone.appendChild(
          makePill(name, () => {
            state.selectedInterests[kind][tier] =
              state.selectedInterests[kind][tier].filter(item => item !== name);

            persistInterests();
            renderTierLists();
          })
        );
      });
    });
  });
}

function openInterestModal(button) {
  const row = button.closest(".tier-row");
  const list = button.closest(".tier-list");

  state.modalTarget = {
    kind: list.dataset.kind,
    tier: row.dataset.tier,
  };
  state.modalSelectedInterests.clear();

  document.getElementById("modalContext").textContent =
    `${state.modalTarget.kind === "wanted" ? "Favoured" : "Unfavoured"} · ${state.modalTarget.tier}`;

  document.getElementById("interestSearch").value = "";
  updateInterestSelectionCount();
  document.getElementById("interestModal").classList.add("active");
  window.dispatchEvent(new CustomEvent("findmyunisg:interest-modal-open"));

  renderInterestChoices();
}

function closeInterestModal() {
  state.modalSelectedInterests.clear();
  updateInterestSelectionCount();
  document.getElementById("interestModal").classList.remove("active");
  window.dispatchEvent(new CustomEvent("findmyunisg:interest-modal-close"));
}

function getUsedInterests() {
  return Object.values(state.selectedInterests.wanted)
    .flat()
    .concat(Object.values(state.selectedInterests.unwanted).flat());
}

function updateInterestSelectionCount() {
  const count = state.modalSelectedInterests.size;
  const countElement = document.getElementById("interestSelectionCount");
  const addButton = document.getElementById("addSelectedInterests");

  if (countElement) {
    countElement.textContent = count
      ? `${count} interest${count === 1 ? "" : "s"} selected`
      : "No interests selected";
  }

  if (addButton) {
    addButton.disabled = count === 0;
  }
}

function addSelectedInterestsToTier() {
  if (!state.modalTarget || state.modalSelectedInterests.size === 0) return;

  const { kind, tier } = state.modalTarget;
  const current = state.selectedInterests[kind][tier];
  const usedInterests = new Set(getUsedInterests());

  state.modalSelectedInterests.forEach(item => {
    if (!usedInterests.has(item) && !current.includes(item)) {
      current.push(item);
      usedInterests.add(item);
    }
  });

  persistInterests();
  closeInterestModal();
  renderTierLists();
}

function renderInterestChoices() {
  const query = document.getElementById("interestSearch").value.trim().toLowerCase();
  const results = document.getElementById("interestResults");

  const matches = interests.filter(item => item.toLowerCase().includes(query));

  results.innerHTML = "";

  if (!matches.length) {
    results.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No interests found.</div>`;
    return;
  }

  matches.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "interest-choice";
    btn.type = "button";
    btn.textContent = item;

    const alreadyUsed = getUsedInterests().includes(item);
    const selectedInModal = state.modalSelectedInterests.has(item);

    if (alreadyUsed) {
      btn.classList.add("disabled-choice");
      btn.disabled = true;
    }

    btn.classList.toggle("selected", selectedInModal);
    btn.setAttribute("aria-pressed", selectedInModal ? "true" : "false");

    btn.addEventListener("click", () => {
      if (state.modalSelectedInterests.has(item)) {
        state.modalSelectedInterests.delete(item);
      } else {
        state.modalSelectedInterests.add(item);
      }

      updateInterestSelectionCount();
      renderInterestChoices();
    });

    results.appendChild(btn);
  });
}

function setupInterestUi() {
  document.querySelectorAll(".plus-btn-tier").forEach(button => {
    button.addEventListener("click", () => openInterestModal(button));
  });

  document.getElementById("closeModal").addEventListener("click", closeInterestModal);
  document.getElementById("addSelectedInterests").addEventListener("click", addSelectedInterestsToTier);

  document.getElementById("interestModal").addEventListener("click", event => {
    if (event.target.id === "interestModal") closeInterestModal();
  });

  document.getElementById("interestSearch").addEventListener("input", renderInterestChoices);
}

async function initProfile() {
  await requireLoggedInUser();
  await hydrateInterestState();

  state.selectedInterests = getInterestState();

  setupAcademicProfileForm();
  setupDeleteAccountButton();
  setupInterestUi();

  await loadBasicUserProfile();
  await loadAcademicProfile();
  await loadInterests();

  renderTierLists();
  window.dispatchEvent(new CustomEvent("findmyunisg:page-ready", {
    detail: {
      page: "profile",
    },
  }));
}

initProfile();
