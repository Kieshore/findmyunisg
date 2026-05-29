let interests = [];
let originalAcademicPayload = null;
let originalBasicPayload = null;

const state = {
  modalTarget: null,
  selectedInterests: structuredClone(DEFAULT_INTEREST_STATE),
};

function getAcademicElements() {
  return {
    fullName: document.getElementById("fullName"),
    email: document.getElementById("email"),
    school: document.getElementById("school"),
    postalCode: document.getElementById("postal_code"),
    course: document.getElementById("course"),
    gradYear: document.getElementById("gradYear"),
    qualification: document.getElementById("qualification"),
    scoreLabel: document.getElementById("scoreLabel"),
    academicScore: document.getElementById("academicScore"),
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

function updateScoreLabel() {
  const elements = getAcademicElements();
  const qualification = elements.qualification?.value || "";

  if (!elements.scoreLabel || !elements.academicScore) return;

  const courseField = elements.course?.closest(".field");

 if (qualification === "A Level") {
  const gradYear = Number(elements.gradYear?.value || 0);
  const isOldRpSystem = gradYear && gradYear <= 2024;

  elements.scoreLabel.textContent = isOldRpSystem ? "RP" : "UAS 70";
  elements.academicScore.placeholder = isOldRpSystem ? "e.g. 80" : "e.g. 65";
  elements.academicScore.step = "0.1";
  elements.academicScore.min = "0";
  elements.academicScore.max = isOldRpSystem ? "90" : "70";

  if (courseField) {
    courseField.classList.add("hidden");
  }

  if (elements.course) {
    elements.course.value = "";
  }
} else if (qualification === "Diploma") {
    elements.scoreLabel.textContent = "GPA";
    elements.academicScore.placeholder = "e.g. 3.45";
    elements.academicScore.step = "0.01";
    elements.academicScore.min = "0";
    elements.academicScore.max = "4";

    if (courseField) {
      courseField.classList.remove("hidden");
    }
  } else {
    elements.scoreLabel.textContent = "GPA/RP";
    elements.academicScore.placeholder = "Select qualification first";
    elements.academicScore.removeAttribute("min");
    elements.academicScore.removeAttribute("max");

    if (courseField) {
      courseField.classList.remove("hidden");
    }
  }
}

function getAcademicPayloadFromForm() {
  const elements = getAcademicElements();
  const qualification = elements.qualification?.value || "";

  return {
    qualification_type: qualification,
    school: elements.school?.value.trim() || "",
    course:
      qualification === "A Level"
        ? null
        : elements.course?.value.trim() || "",
    graduation_year: elements.gradYear?.value
      ? Number(elements.gradYear.value)
      : null,
    academic_score: elements.academicScore?.value
      ? Number(elements.academicScore.value)
      : null,
  };
}

function payloadComparable(payload) {
  return JSON.stringify({
    qualification_type: payload?.qualification_type || "",
    school: payload?.school || "",
    course: payload?.course || "",
    graduation_year: payload?.graduation_year ?? null,
    academic_score: payload?.academic_score ?? null,
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

  if (payload.academic_score === null || Number.isNaN(payload.academic_score)) {
    throw new Error(
      payload.qualification_type === "A Level"
        ? "Please enter your UAS 70 / RP."
        : "Please enter your GPA."
    );
  }

  if (payload.qualification_type === "Diploma") {
    if (payload.academic_score < 0 || payload.academic_score > 4) {
      throw new Error("GPA must be between 0 and 4.");
    }
  }

  if (payload.qualification_type === "A Level") {
  const isOldRpSystem = payload.graduation_year <= 2024;

  if (isOldRpSystem) {
    if (payload.academic_score < 0 || payload.academic_score > 90) {
      throw new Error("RP must be between 0 and 90 for A Level students graduating in 2024 or earlier.");
    }
  } else {
    if (payload.academic_score < 0 || payload.academic_score > 70) {
      throw new Error("UAS 70 must be between 0 and 70 for A Level students graduating in 2025 or later.");
    }
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
      academicScore === null || academicScore === undefined
        ? null
        : Number(academicScore),
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

  updateScoreLabel();

  originalAcademicPayload = structuredClone(payload);
  updateSaveButtonVisibility();
}

async function loadBasicUserProfile() {
  try {
    const user = await getCurrentUser();
    const elements = getAcademicElements();

    if (elements.fullName) {
      elements.fullName.value = user?.full_name || user?.first_name || "";
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
  ].filter(Boolean);

  editableInputs.forEach(input => {
    input.addEventListener("input", () => {
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

      setAcademicMessage("");
      updateSaveButtonVisibility();
    });
  });

  if (elements.saveButton) {
    elements.saveButton.addEventListener("click", saveAcademicProfile);
  }
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

  document.getElementById("modalContext").textContent =
    `${state.modalTarget.kind === "wanted" ? "Favoured" : "Unfavoured"} · ${state.modalTarget.tier}`;

  document.getElementById("interestSearch").value = "";
  document.getElementById("interestModal").classList.add("active");

  renderInterestChoices();
}

function closeInterestModal() {
  document.getElementById("interestModal").classList.remove("active");
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
    btn.textContent = item;

    const alreadyUsed = Object.values(state.selectedInterests.wanted)
      .flat()
      .concat(Object.values(state.selectedInterests.unwanted).flat())
      .includes(item);

    if (alreadyUsed) {
      btn.classList.add("disabled-choice");
      btn.disabled = true;
    }

    btn.addEventListener("click", () => {
      const { kind, tier } = state.modalTarget;
      const current = state.selectedInterests[kind][tier];

      const isAlreadyUsed = Object.values(state.selectedInterests.wanted)
        .flat()
        .concat(Object.values(state.selectedInterests.unwanted).flat())
        .includes(item);

      if (!isAlreadyUsed && !current.includes(item)) {
        current.push(item);
      }

      persistInterests();
      closeInterestModal();
      renderTierLists();
    });

    results.appendChild(btn);
  });
}

function setupInterestUi() {
  document.querySelectorAll(".plus-btn-tier").forEach(button => {
    button.addEventListener("click", () => openInterestModal(button));
  });

  document.getElementById("closeModal").addEventListener("click", closeInterestModal);

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
  setupInterestUi();

  await loadBasicUserProfile();
  await loadAcademicProfile();
  await loadInterests();

  renderTierLists();
}

initProfile();
