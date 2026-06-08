let apiPayload = null;
let allCourses = [];
let latestCourseRequestId = 0;
let courseAbortController = null;

let compareMode = false;
let selectedCompareCourses = new Map();
const MAX_COMPARE_SELECTIONS = 2;

let userAcademicValue = null;
let userAcademicScoreMode = null;
let userQualificationType = "";

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getCleanFinderState() {
  const saved = getFinderState();

  const priority =
    saved.priority &&
    typeof saved.priority === "object"
      ? {
          1: Array.isArray(saved.priority["1"]) ? saved.priority["1"] : [],
          2: Array.isArray(saved.priority["2"]) ? saved.priority["2"] : [],
          3: Array.isArray(saved.priority["3"]) ? saved.priority["3"] : [],
          4: Array.isArray(saved.priority["4"]) ? saved.priority["4"] : [],
        }
      : structuredClone(DEFAULT_FINDER_STATE.priority);

  const allUsed = Object.values(priority).flat();
  const validOptions = ["interest", "prestige", "salary", "employability"];
  const hasValidPriority = allUsed.every(option => validOptions.includes(option));

  return {
    ...DEFAULT_FINDER_STATE,
    ...saved,
    priority: hasValidPriority ? priority : structuredClone(DEFAULT_FINDER_STATE.priority),
  };
}

let savedFinderState = structuredClone(DEFAULT_FINDER_STATE);

const state = {
  activeUni: "All",
  isLoadingCourses: false,
  apiError: null,
  draggedOption: null,
  priority: structuredClone(DEFAULT_FINDER_STATE.priority),
  selectedInterests: getInterestState(),
};

function persistFinderState() {
  const selectedUniversities = [...document.getElementById("preferredUniversities").selectedOptions]
    .map(option => option.value)
    .filter(Boolean);

  saveFinderState({
    activeUni: state.activeUni,
    gpaBoost: document.getElementById("gpaBoost").value,
    bandMinPercentage: document.getElementById("bandMinPercentage").value,
    selectedUniversities,
    onlyWanted: document.getElementById("onlyWanted").checked,
    excludeUnwanted: document.getElementById("excludeUnwanted").checked,
    courseKeyword: document.getElementById("courseKeyword").value,
    priority: state.priority,
  });
}

function applySavedFinderStateToInputs() {
  const gpaBoostInput = document.getElementById("gpaBoost");
  const bandMinInput = document.getElementById("bandMinPercentage");
  const bandMinValue = document.getElementById("bandMinPercentageValue");

  gpaBoostInput.value = savedFinderState.gpaBoost ?? "0";
  bandMinInput.value = savedFinderState.bandMinPercentage ?? "80";
  bandMinValue.textContent = `${savedFinderState.bandMinPercentage ?? "80"}%`;

  document.getElementById("onlyWanted").checked = Boolean(savedFinderState.onlyWanted);
  document.getElementById("excludeUnwanted").checked = Boolean(savedFinderState.excludeUnwanted);
  document.getElementById("courseKeyword").value = savedFinderState.courseKeyword || "";

  const savedUnis = savedFinderState.selectedUniversities || [];

  [...document.getElementById("preferredUniversities").options].forEach(option => {
    option.selected = savedUnis.includes(option.value);
  });
}

function getPriorityQueryParams(params) {
  Object.entries(state.priority).forEach(([priorityNumber, metrics]) => {
    if (!Array.isArray(metrics)) return;

    metrics.forEach(metric => {
      const normalizedMetric = metric === "interests" ? "interest" : metric;
      params.set(`${normalizedMetric}_priority`, priorityNumber);
    });
  });
}

function getSelectedUniversityCsv() {
  return [...document.getElementById("preferredUniversities").selectedOptions]
    .map(option => option.value)
    .filter(Boolean)
    .join(",");
}

function buildRecommendationQuery() {
  const params = new URLSearchParams();

  state.selectedInterests = getInterestState();

  params.set("difference", document.getElementById("gpaBoost").value || "0");
  params.set("band_min_percentage", document.getElementById("bandMinPercentage").value || "80");

  params.set(
    "exclude_unwanted_interests",
    document.getElementById("excludeUnwanted").checked ? "true" : "false"
  );

  params.set(
    "only_wanted_interests",
    document.getElementById("onlyWanted").checked ? "true" : "false"
  );

  const hasPrestige = Object.values(state.priority).flat().includes("prestige");
  const selectedUnis = getSelectedUniversityCsv();

  if (selectedUnis && !hasPrestige) {
    params.set("uni_code", selectedUnis);
  }

  params.set("high_interests", csv(state.selectedInterests.wanted.high));
  params.set("medium_interests", csv(state.selectedInterests.wanted.medium));
  params.set("low_interests", csv(state.selectedInterests.wanted.low));

  params.set("high_unwanted_interests", csv(state.selectedInterests.unwanted.high));
  params.set("medium_unwanted_interests", csv(state.selectedInterests.unwanted.medium));
  params.set("low_unwanted_interests", csv(state.selectedInterests.unwanted.low));

  getPriorityQueryParams(params);

  return params;
}

function flattenCoursesFromPayload(payload) {
  const results = payload?.data?.results || [];
  return results.flatMap(result => Array.isArray(result.courses) ? result.courses : []);
}

async function fetchRankedCourses() {
  const requestId = ++latestCourseRequestId;

  if (courseAbortController) {
    courseAbortController.abort();
  }

  courseAbortController = new AbortController();

  state.isLoadingCourses = true;
  state.apiError = null;

  renderCourses();

  try {
    persistFinderState();

    const params = buildRecommendationQuery();

    console.log("Fetching courses with:", params.toString());

    const response = await fetch(
      `/course-priority-recommendation/eligible-ranked-courses?${params.toString()}`,
      { signal: courseAbortController.signal }
    );

    const json = await response.json();

    if (requestId !== latestCourseRequestId) return;

    if (!response.ok) {
      throw new Error(json.error || json.message || "Failed to fetch recommendations");
    }

    apiPayload = json;
    allCourses = flattenCoursesFromPayload(json);

    renderUniversityFilters();
    renderCourses();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== latestCourseRequestId) return;

    console.error("Course fetch failed:", error);

    apiPayload = null;
    allCourses = [];
    state.apiError = error.message;

    renderUniversityFilters();
    renderCourses();
  } finally {
    if (requestId === latestCourseRequestId) {
      state.isLoadingCourses = false;
      renderCourses();
    }
  }
}

const debouncedFetchRankedCourses = debounce(fetchRankedCourses, 450);

function createPriorityPill(option) {
  const span = document.createElement("span");
  span.className = "pill priority-pill";
  span.draggable = true;
  span.dataset.option = option;
  span.textContent = option[0].toUpperCase() + option.slice(1);

  attachPriorityDrag(span);

  return span;
}

function attachPriorityDrag(element) {
  element.addEventListener("dragstart", () => {
    state.draggedOption = element.dataset.option;
  });

  element.addEventListener("dragend", () => {
    state.draggedOption = null;
  });
}

function getPriorityForOption(option) {
  return Object.entries(state.priority).find(([, values]) =>
    Array.isArray(values) && values.includes(option)
  )?.[0] || "";
}

function movePriorityOption(option, priorityNumber = "") {
  Object.keys(state.priority).forEach(key => {
    state.priority[key] = state.priority[key].filter(item => item !== option);
  });

  if (priorityNumber && state.priority[priorityNumber]) {
    state.priority[priorityNumber].push(option);
  }

  renderPriority();
  updatePrestigeLock();
  persistFinderState();
  fetchRankedCourses();
}

function renderPriorityMobileControls(options) {
  const wrapper = document.getElementById("priorityMobileControls");

  if (!wrapper) return;

  wrapper.innerHTML = "";

  options.forEach(option => {
    const row = document.createElement("label");
    row.className = "priority-mobile-row";

    const text = document.createElement("span");
    text.textContent = option[0].toUpperCase() + option.slice(1);

    const select = document.createElement("select");
    select.className = "select priority-mobile-select";

    [
      ["", "Not used"],
      ["1", "Priority 1"],
      ["2", "Priority 2"],
      ["3", "Priority 3"],
      ["4", "Priority 4"],
    ].forEach(([value, label]) => {
      const optionElement = document.createElement("option");
      optionElement.value = value;
      optionElement.textContent = label;
      select.appendChild(optionElement);
    });

    select.value = getPriorityForOption(option);

    select.addEventListener("change", () => {
      movePriorityOption(option, select.value);
    });

    row.append(text, select);
    wrapper.appendChild(row);
  });
}

function renderPriority() {
  const allPriorityOptions = ["interest", "prestige", "salary", "employability"];

  document.querySelectorAll(".priority-zone").forEach(zone => {
    const priorityNumber = zone.dataset.priority;

    if (!Array.isArray(state.priority[priorityNumber])) {
      state.priority[priorityNumber] = [];
    }

    zone.innerHTML = "";

    state.priority[priorityNumber].forEach(option => {
      zone.appendChild(createPriorityPill(option));
    });
  });

  const priorityBank = document.getElementById("priorityBank");
priorityBank.innerHTML = "";

const usedOptions = Object.values(state.priority).flat();
const unusedOptions = allPriorityOptions.filter(option => !usedOptions.includes(option));

if (!unusedOptions.length) {
  const placeholder = document.createElement("div");
  placeholder.className = "priority-bank-placeholder";
  placeholder.textContent = "Drop priority options here to remove them";
  priorityBank.appendChild(placeholder);
  renderPriorityMobileControls(allPriorityOptions);
  return;
}

unusedOptions.forEach(option => {
  priorityBank.appendChild(createPriorityPill(option));
});

renderPriorityMobileControls(allPriorityOptions);
}

function updatePrestigeLock() {
  const hasPrestige = Object.values(state.priority).flat().includes("prestige");

  document.getElementById("preferredUniField").classList.toggle("disabled-field", hasPrestige);
  document.getElementById("prestigeError").classList.toggle("active", hasPrestige);

  if (hasPrestige) {
    [...document.getElementById("preferredUniversities").options].forEach(option => {
      option.selected = false;
    });
  }
}

function setupPriorityDragDrop() {
  document.querySelectorAll(".priority-zone, #priorityBank").forEach(zone => {
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", event => {
      event.preventDefault();
      zone.classList.remove("drag-over");

      const option = state.draggedOption;
      if (!option) return;

      state.draggedOption = null;
      movePriorityOption(option, zone.id === "priorityBank" ? "" : zone.dataset.priority);
    });
  });
}

function renderUniversityFilters() {
  const universities = ["All", ...new Set(allCourses.map(course => course.university_code).filter(Boolean))];
  const wrapper = document.getElementById("universityFilters");

  wrapper.innerHTML = "";

  universities.forEach(uni => {
    const button = document.createElement("button");
    button.className = `filter-chip ${state.activeUni === uni ? "active" : ""}`;
    button.textContent = uni;

    button.addEventListener("click", () => {
      state.activeUni = uni;
      persistFinderState();
      renderUniversityFilters();
      renderCourses();
    });

    wrapper.appendChild(button);
  });
}

function getScore(course) {
  const score = course.total_score ?? course.priority_score;
  return score === null || score === undefined ? "—" : `${Number(score).toFixed(1)}/100`;
}

function isBandBasedUniversity(course) {
  return ["SIT", "SUSS"].includes(String(course.university_code || "").toUpperCase());
}

function formatBandRange(bandMetric) {
  if (!bandMetric) return "—";

  return `${valueOrDash(bandMetric.band_min)}-${valueOrDash(bandMetric.band_max)}`;
}

function formatBandAdmissionDetails(course) {
  const bandMetric = course.band_metric;

  if (!bandMetric) {
    return `
      Band admission chance: —<br />
      Year recorded: ${valueOrDash(course.year_recorded)} ·
      GES source year: ${valueOrDash(course.ges?.source_year)}
    `;
  }

  const isGpaBand = String(bandMetric.qualification_type || "")
    .toLowerCase()
    .includes("gpa");
  const scoreLabel = isGpaBand ? "GPA band" : "RP/UAS band";
  const userScoreLabel = isGpaBand ? "Your GPA" : "Your score";
  const chanceLabel = bandMetric.percentage_value === null || bandMetric.percentage_value === undefined
    ? "—"
    : `${Number(bandMetric.percentage_value).toFixed(0)}%`;

  return `
    ${scoreLabel}: ${formatBandRange(bandMetric)} ·
    Admission chance: ${chanceLabel}<br />
    ${userScoreLabel}: ${valueOrDash(course.benchmark_value)} ·
    Band: ${valueOrDash(bandMetric.band_label)}<br />
    Year recorded: ${valueOrDash(course.year_recorded)} ·
    GES source year: ${valueOrDash(course.ges?.source_year)}
  `;
}

function renderAdmissionsDetails(course) {
  if (isBandBasedUniversity(course)) {
    return formatBandAdmissionDetails(course);
  }

  return `
    Min GPA: ${valueOrDash(course.min_gpa)} ·
    10th percentile RP: ${valueOrDash(course.tenth_percentile_rp)} ·
    UAS 70: ${valueOrDash(course.tenth_percentile_uas_70)}<br />
    Year recorded: ${valueOrDash(course.year_recorded)} ·
    GES source year: ${valueOrDash(course.ges?.source_year)}
  `;
}

function formatPriorityMetricValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return Number(value).toFixed(2);
  }

  return value;
}

function getFinalScoreDisplay(course) {
  return (
    course.total_score_display ||
    course.priority_score_display ||
    `${Number(course.total_score ?? course.priority_score ?? 0).toFixed(2)} / 100.00`
  );
}

function renderScoreBreakdown(course) {
  const metrics = course.priority_metrics || {};
  const metricEntries = Object.entries(metrics);

  if (!metricEntries.length) {
    return `
      <div class="score-breakdown-empty">
        No priority score breakdown available for this course.
      </div>
    `;
  }

  const rows = metricEntries.map(([metricKey, metric]) => {
    const weightPercent = Number((metric.weight || 0) * 100).toFixed(1);
    const normalizedScore =
      metric.normalized_score === null || metric.normalized_score === undefined
        ? "0.00"
        : Number(metric.normalized_score).toFixed(2);

    const contribution =
      metric.weighted_contribution === null || metric.weighted_contribution === undefined
        ? "0.00"
        : Number(metric.weighted_contribution).toFixed(2);

    const maxContribution = Number((100 * (metric.weight || 0))).toFixed(2);

    return `
      <div class="score-breakdown-row">
        <div>
          <strong>${metric.label || metricKey}</strong>
          <div class="course-meta">
            ${
              metricKey === "interest"
                ? `
                  Wanted score: ${formatPriorityMetricValue(metric.wanted_score)} ·
                  Unwanted penalty: ${formatPriorityMetricValue(metric.unwanted_penalty)} ·
                  Signed score: ${formatPriorityMetricValue(metric.signed_score)}
                `
                : `Raw value: ${formatPriorityMetricValue(metric.raw_value)}`
            }
          </div>
        </div>

        <div class="score-formula">
          <span>${weightPercent}%</span>
          <span>×</span>
          <span>${normalizedScore}</span>
          <span>=</span>
          <strong>${contribution}</strong>
        </div>

        <div class="course-meta">
          ${contribution} / ${maxContribution}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="score-breakdown">
      <div class="score-breakdown-header">
        <strong>Final score calculation</strong>
        <span>${getFinalScoreDisplay(course)}</span>
      </div>

      <div class="score-breakdown-explainer">
        Each selected priority is converted into a score out of 100, multiplied by its priority weight,
        then added together to form the final recommendation score.
      </div>

      ${rows}

      <div class="score-breakdown-total">
        <strong>Total recommendation score</strong>
        <strong>${getFinalScoreDisplay(course)}</strong>
      </div>
    </div>
  `;
}

function renderCourses() {
  const list = document.getElementById("courseList");
  const keyword = document.getElementById("courseKeyword").value.trim().toLowerCase();

  if (state.isLoadingCourses) {
    list.innerHTML = `<div class="empty-state">Loading ranked eligible courses...</div>`;
    return;
  }

  if (state.apiError) {
    list.innerHTML = `<div class="empty-state" style="color: var(--danger);">${state.apiError}</div>`;
    return;
  }

  const filtered = allCourses.filter(course => {
    const uniMatch = state.activeUni === "All" || course.university_code === state.activeUni;
    const keywordMatch = !keyword || String(course.course_name || "").toLowerCase().includes(keyword);
    return uniMatch && keywordMatch;
  });

  list.innerHTML = "";

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">No eligible courses match the current filters.</div>`;
    return;
  }

  filtered.forEach((course, index) => {
    const card = document.createElement("article");
    card.className = "course-card";

    card.innerHTML = `
      <label class="compare-checkbox">
        <input type="checkbox" class="course-compare-input" value="${course.course_id}" />
      </label>

      <div class="rank">${course.rank_number || index + 1}</div>

      <div class="course-main">
        <div>
          <div class="course-name">${course.course_name}</div>
          <div class="course-meta">${course.university_code || "—"} · ${valueOrDash(course.matched_via)}</div>
        </div>

        <div>
          <div><strong>Median gross salary:</strong> ${moneyOrDash(course.ges?.gross_monthly_median)}</div>
          <div><strong>Employability:</strong> ${valueOrDash(course.ges?.employment_rate_overall, "%")}</div>
          <div class="course-meta">Cutoff gap: ${valueOrDash(course.cutoff_gap)} · Intake: ${valueOrDash(course.intake_size)}</div>
        </div>
      </div>

      <div class="score-box">
        <div class="score">${getScore(course)}</div>
        <button class="read-more" type="button">Read more</button>
      </div>

      <div class="details">
        <strong>Admissions</strong><br />
        ${renderAdmissionsDetails(course)}<br /><br />

        <strong>Interest fit</strong><br />
        Interest score: ${valueOrDash(course.interest_fit?.score)} ·
        Wanted score: ${valueOrDash(course.interest_fit?.wanted_score)} ·
        Unwanted penalty: ${valueOrDash(course.interest_fit?.unwanted_penalty)} ·
        Matched interests: ${valueOrDash(course.interest_fit?.matched_interest_count)}<br /><br />

        ${renderScoreBreakdown(course)}
      </div>
    `;

    card.querySelector(".read-more").addEventListener("click", () => {
      card.querySelector(".details").classList.toggle("active");
    });

    attachCompareCheckbox(card, course);
    list.appendChild(card);
  });
}

function attachCompareCheckbox(card, course) {
  const input = card.querySelector(".course-compare-input");

  input.checked = selectedCompareCourses.has(String(course.course_id));
  card.classList.toggle("compare-selected", input.checked);

  input.addEventListener("change", () => {
    const courseId = String(course.course_id);

    if (input.checked) {
      if (
        selectedCompareCourses.size >= MAX_COMPARE_SELECTIONS &&
        !selectedCompareCourses.has(courseId)
      ) {
        input.checked = false;
        card.classList.remove("compare-selected");
        return;
      }

      selectedCompareCourses.set(courseId, course);
      card.classList.add("compare-selected");
    } else {
      selectedCompareCourses.delete(courseId);
      card.classList.remove("compare-selected");
    }

    updateCompareButton();
  });
}

function updateCompareButton() {
  const button = document.getElementById("goCompareBtn");
  const count = selectedCompareCourses.size;

  button.disabled = count < 2;
  button.classList.toggle("active", count >= 2);
  button.textContent = count >= 2
    ? `Compare ${MAX_COMPARE_SELECTIONS} selected courses`
    : "Select at least 2 courses";
}

function setupCompareMode() {
  document.getElementById("toggleCompareMode").addEventListener("click", () => {
    compareMode = !compareMode;
    document.body.classList.toggle("compare-mode", compareMode);

    if (!compareMode) {
      selectedCompareCourses.clear();
      document.querySelectorAll(".course-compare-input").forEach(input => {
        input.checked = false;
      });
      document.querySelectorAll(".course-card").forEach(card => {
        card.classList.remove("compare-selected");
      });
    }

    updateCompareButton();
  });

  document.getElementById("goCompareBtn").addEventListener("click", () => {
    const selected = Array.from(selectedCompareCourses.values()).slice(0, 2);
    saveCompareCourses(selected);
    window.location.href = "/compare.html";
  });
}

function setupFilters() {
  const gpaBoostInput = document.getElementById("gpaBoost");

  ["input", "change"].forEach(eventName => {
    gpaBoostInput.addEventListener(eventName, () => {
      updateBoostedAcademicScore();
      persistFinderState();
      debouncedFetchRankedCourses();
    });
  });

  document.getElementById("bandMinPercentage").addEventListener("input", () => {
    document.getElementById("bandMinPercentageValue").textContent =
      `${document.getElementById("bandMinPercentage").value}%`;

    persistFinderState();
    debouncedFetchRankedCourses();
  });

  document.getElementById("preferredUniversities").addEventListener("change", fetchRankedCourses);
  document.getElementById("onlyWanted").addEventListener("change", fetchRankedCourses);
  document.getElementById("excludeUnwanted").addEventListener("change", fetchRankedCourses);

  document.getElementById("courseKeyword").addEventListener("input", () => {
    persistFinderState();
    renderCourses();
  });
}

async function loadUserBoostLabel() {
  try {
    const json = await fetchJson("/users/me/academic-profile");
    const profile = json.data;

    const boostLabel = document.getElementById("boostLabel");
    const boostInput = document.getElementById("gpaBoost");
    const academicScoreLabel = document.getElementById("academicScoreLabel");
    const academicScoreInput = document.getElementById("academicScore");

    if (!boostLabel || !boostInput || !academicScoreLabel || !academicScoreInput) {
      console.warn("Missing boost-related HTML elements.");
      return;
    }

    if (!profile) {
      userAcademicValue = null;
      userAcademicScoreMode = null;
      userQualificationType = "";

      boostLabel.textContent = "Academic boost";
      academicScoreLabel.textContent = "Academic score after boost";
      academicScoreInput.value = "";
      return;
    }

    const qualification = String(profile.qualification_type || "").trim().toLowerCase();

    const isAlevel =
      qualification.includes("a-level") ||
      qualification.includes("a level") ||
      qualification.includes("jc") ||
      qualification.includes("junior college");

    const isDiploma =
      qualification.includes("poly") ||
      qualification.includes("polytechnic") ||
      qualification.includes("diploma");

    if (isAlevel) {
      const gradYear = Number(profile.graduation_year || 0);
      const isOldRpSystem = gradYear && gradYear <= 2024;

      userQualificationType = "a_level";
      userAcademicScoreMode = isOldRpSystem ? "rp" : "uas70";

      userAcademicValue = isOldRpSystem
        ? toNumberOrNull(profile.rank_points)
        : toNumberOrNull(profile.uas_70);

      boostLabel.textContent = isOldRpSystem ? "RP boost" : "UAS 70 boost";
      academicScoreLabel.textContent = isOldRpSystem
        ? "RP after boost"
        : "UAS 70 after boost";

      boostInput.step = "0.1";
      boostInput.placeholder = isOldRpSystem ? "e.g. 2.5" : "e.g. 1.5";
    } else if (isDiploma) {
      userQualificationType = "diploma";
      userAcademicScoreMode = "gpa";

      userAcademicValue = toNumberOrNull(
        profile.projected_gpa ?? profile.current_gpa
      );

      boostLabel.textContent = "GPA boost";
      academicScoreLabel.textContent = "GPA after boost";

      boostInput.step = "0.01";
      boostInput.placeholder = "e.g. 0.15";
    } else {
      userAcademicValue = null;
      userAcademicScoreMode = null;
      userQualificationType = "";

      boostLabel.textContent = "Academic boost";
      academicScoreLabel.textContent = "Academic score after boost";
      academicScoreInput.value = "";
      return;
    }

    updateBoostedAcademicScore();
  } catch (error) {
    console.warn("Unable to load academic profile for boost:", error.message);

    const boostLabel = document.getElementById("boostLabel");
    const academicScoreLabel = document.getElementById("academicScoreLabel");
    const academicScoreInput = document.getElementById("academicScore");

    if (boostLabel) boostLabel.textContent = "Academic boost";
    if (academicScoreLabel) academicScoreLabel.textContent = "Academic score after boost";
    if (academicScoreInput) academicScoreInput.value = "";
  }
}

function updateBoostedAcademicScore() {
  const boostInput = document.getElementById("gpaBoost");
  const academicScoreInput = document.getElementById("academicScore");

  if (!boostInput || !academicScoreInput) return;

  const boostValue = Number(boostInput.value || 0);

  if (
    userAcademicValue === null ||
    userAcademicValue === undefined ||
    Number.isNaN(Number(userAcademicValue))
  ) {
    academicScoreInput.value = "";
    return;
  }

  const boostedValue = Number(userAcademicValue) + boostValue;

  if (userAcademicScoreMode === "gpa") {
    academicScoreInput.value = boostedValue.toFixed(2);
  } else {
    academicScoreInput.value = boostedValue.toFixed(1);
  }
}

async function initCourseFinder() {
  await requireLoggedInUser();
  await hydrateInterestState();
  await hydrateFinderState();

  savedFinderState = getCleanFinderState();

  state.activeUni = savedFinderState.activeUni || "All";
  state.priority = savedFinderState.priority;
  state.selectedInterests = getInterestState();

  applySavedFinderStateToInputs();
  await loadUserBoostLabel();
  updateBoostedAcademicScore();

  renderPriority();
  updatePrestigeLock();
  setupPriorityDragDrop();
  setupFilters();
  setupCompareMode();
  renderUniversityFilters();
  renderCourses();

  await fetchRankedCourses();
}

initCourseFinder();
