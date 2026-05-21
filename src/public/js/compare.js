const compareState = {
  left: null,
  right: null,
  activeSide: null,
  allCourses: [],
};

let courseSearchRequestId = 0;
let aiAssessmentRequestId = 0;

let compareCourseCache = [];
let compareCourseCacheLoaded = false;
let compareCourseCachePromise = null;

function getSelectedInterestMetrics() {
  const selected = getWantedInterestSelections();

  return selected.map(interest => ({
    key: `interest_relevance_${normalizeInterestKey(interest.name)}`,
    label: `${interest.label}: ${interest.name}`,
    higherBetter: true,
    type: "interest_relevance",
    interestName: interest.name,
  }));
}

function buildMetrics() {
  return [
    {
      key: "recommendation_score",
      label: "Recommendation score",
      higherBetter: true,
      type: "score",
      eligibleOnly: true,
    },
    ...getSelectedInterestMetrics(),
    { key: "interest_score", label: "Overall interest score", higherBetter: true },
    { key: "matched_interest_count", label: "Matched interest count", higherBetter: true },
    { key: "intake_size", label: "Intake size", higherBetter: true },
    { key: "prestige", label: "Prestige score", higherBetter: true },
    { key: "salary", label: "Gross monthly median", higherBetter: true, type: "money" },
    { key: "employability", label: "Overall employment rate", higherBetter: true, type: "percent" },
    { key: "min_gpa", label: "GPA requirement", higherBetter: false },
    { key: "tenth_percentile_rp", label: "10th percentile RP", higherBetter: false },
    { key: "tenth_percentile_uas_70", label: "10th percentile UAS 70", higherBetter: false },
    { key: "cutoff_gap", label: "Cutoff gap after boost", higherBetter: true },
  ];
}

function getCourseId(course) {
  return String(course?.course_id || course?.raw?.course_id || "");
}

function getEligibleScore(course) {
  return (
    course?.recommendation_score ??
    course?.total_score ??
    course?.priority_score ??
    course?.raw?.recommendation_score ??
    course?.raw?.total_score ??
    course?.raw?.priority_score ??
    null
  );
}

function getSalaryValue(course) {
  return (
    course?.salary ??
    course?.ges?.gross_monthly_median ??
    course?.ges?.basic_monthly_median ??
    course?.raw?.salary ??
    course?.raw?.ges?.gross_monthly_median ??
    course?.raw?.ges?.basic_monthly_median ??
    null
  );
}

function getEmployabilityValue(course) {
  return (
    course?.employability ??
    course?.ges?.employment_rate_overall ??
    course?.raw?.employability ??
    course?.raw?.ges?.employment_rate_overall ??
    null
  );
}

function normalizeCompareCourse(course) {
  const normalized = normalizeCourseForCompare(course);

  normalized.recommendation_score =
    course?.recommendation_score ??
    course?.total_score ??
    course?.priority_score ??
    course?.raw?.recommendation_score ??
    course?.raw?.total_score ??
    course?.raw?.priority_score ??
    normalized.recommendation_score ??
    null;

  normalized.total_score =
    course?.total_score ??
    course?.raw?.total_score ??
    normalized.total_score ??
    null;

  normalized.priority_score =
    course?.priority_score ??
    course?.raw?.priority_score ??
    normalized.priority_score ??
    null;

  normalized.priority_metrics =
    course?.priority_metrics ??
    course?.raw?.priority_metrics ??
    normalized.priority_metrics ??
    null;

  normalized.interest_score =
    course?.interest_fit?.score ??
    course?.interest_score ??
    normalized.interest_score ??
    null;

  normalized.matched_interest_count =
    course?.interest_fit?.matched_interest_count ??
    course?.interest_fit?.wanted_matches?.length ??
    course?.matched_interest_count ??
    normalized.matched_interest_count ??
    null;

normalized.salary = getSalaryValue(course);

normalized.employability = getEmployabilityValue(course);

normalized.ges = {
  ...(course?.ges || {}),
  ...(normalized.ges || {}),
  gross_monthly_median:
    course?.ges?.gross_monthly_median ??
    normalized.ges?.gross_monthly_median ??
    getSalaryValue(course),
  basic_monthly_median:
    course?.ges?.basic_monthly_median ??
    normalized.ges?.basic_monthly_median ??
    null,
  employment_rate_overall:
    course?.ges?.employment_rate_overall ??
    normalized.ges?.employment_rate_overall ??
    getEmployabilityValue(course),
};

  normalized.raw = {
    ...(normalized.raw || {}),
    ...course,
  };

  return normalized;
}

function mergePreservingRecommendationScore(existingCourse, incomingCourse) {
  if (!existingCourse && !incomingCourse) return null;
  if (!existingCourse) return normalizeCompareCourse(incomingCourse);
  if (!incomingCourse) return normalizeCompareCourse(existingCourse);

  const existing = normalizeCompareCourse(existingCourse);
  const incoming = normalizeCompareCourse(incomingCourse);

return {
  ...existing,
  ...incoming,

  recommendation_score:
    incoming.recommendation_score ??
    existing.recommendation_score ??
    null,

  total_score:
    incoming.total_score ??
    existing.total_score ??
    null,

  priority_score:
    incoming.priority_score ??
    existing.priority_score ??
    null,

  priority_metrics:
    incoming.priority_metrics ??
    existing.priority_metrics ??
    null,

  interest_score:
    incoming.interest_score ??
    existing.interest_score ??
    null,

  matched_interest_count:
    incoming.matched_interest_count ??
    existing.matched_interest_count ??
    null,

  salary:
    incoming.salary ??
    existing.salary ??
    getSalaryValue(incomingCourse) ??
    getSalaryValue(existingCourse) ??
    null,

  employability:
    incoming.employability ??
    existing.employability ??
    getEmployabilityValue(incomingCourse) ??
    getEmployabilityValue(existingCourse) ??
    null,

  ges: {
    ...(existing.ges || {}),
    ...(incoming.ges || {}),
    gross_monthly_median:
      incoming.ges?.gross_monthly_median ??
      existing.ges?.gross_monthly_median ??
      incoming.salary ??
      existing.salary ??
      null,
    basic_monthly_median:
      incoming.ges?.basic_monthly_median ??
      existing.ges?.basic_monthly_median ??
      null,
    employment_rate_overall:
      incoming.ges?.employment_rate_overall ??
      existing.ges?.employment_rate_overall ??
      incoming.employability ??
      existing.employability ??
      null,
  },

  raw: {
    ...(existing.raw || {}),
    ...(incoming.raw || {}),
  },
};
}

function loadInitialCompareCourses() {
  const stored = getCompareCourses().map(normalizeCompareCourse);

  compareState.left = stored[0] || null;
  compareState.right = stored[1] || null;
}

function saveCompareState() {
  saveCompareCourses([compareState.left, compareState.right]);
}

function getMetricValue(course, key, metric = null) {
  if (!course) return null;

  if (metric?.type === "interest_relevance") {
    const selectedInterests = getWantedInterestSelections();

    if (!selectedInterests.length) {
      return null;
    }

    const rows =
      course.interest_relevance_rows?.length
        ? course.interest_relevance_rows
        : getCourseInterestRelevanceRows(course);

    const matchedRow = rows.find(row =>
      normalizeInterestKey(row.name) === normalizeInterestKey(metric.interestName)
    );

    return matchedRow?.relevance_score ?? 0;
  }

  if (key === "recommendation_score") {
    return getEligibleScore(course);
  }

  if (key === "salary") {
  return getSalaryValue(course);
}

if (key === "employability") {
  return getEmployabilityValue(course);
}

  return course[key] ?? null;
}

function formatCompareValue(value, type = "text") {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return `$${Number(value).toLocaleString()}`;
  if (type === "percent") return `${value}%`;
  if (type === "interest_relevance") return `${value}/3`;
  if (type === "score") return `${Number(value).toFixed(1)}/100`;
  return value;
}

function getStatClass(side, metric) {
  const leftValue = Number(getMetricValue(compareState.left, metric.key, metric));
  const rightValue = Number(getMetricValue(compareState.right, metric.key, metric));

  if (!compareState.left || !compareState.right) return "";
  if (Number.isNaN(leftValue) || Number.isNaN(rightValue)) return "";
  if (leftValue === rightValue) return "";

  const sideValue = side === "left" ? leftValue : rightValue;
  const otherValue = side === "left" ? rightValue : leftValue;

  const isBetter = metric.higherBetter
    ? sideValue > otherValue
    : sideValue < otherValue;

  return isBetter ? "stat-better" : "stat-worse";
}

function getRecommendationScoreBadge(course) {
  const score = getEligibleScore(course);

  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return `
      <div class="compare-score-badge muted-badge">
        Not eligible / not ranked
      </div>
    `;
  }

  return `
    <div class="compare-score-badge">
      ${Number(score).toFixed(1)}/100
    </div>
  `;
}

function renderCourse(side) {
  const container = document.getElementById(`${side}Course`);
  const course = compareState[side];

  if (!course) {
    container.innerHTML = `
      <div class="empty-state">
        No course selected. Press the plus button to add one.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="compare-title-row">
      <div>
        <h2 class="compare-course-title">${course.course_name}</h2>
        <p class="muted">${course.university_code || "—"}</p>
      </div>

      ${getRecommendationScoreBadge(course)}
    </div>

    <div class="compare-stat-list">
      ${buildMetrics().map(metric => {
        const value = getMetricValue(course, metric.key, metric);
        const statClass = getStatClass(side, metric);

        return `
          <div class="compare-stat ${statClass}">
            <strong>${metric.label}</strong>
            <span>${formatCompareValue(value, metric.type)}</span>
          </div>
        `;
      }).join("")}
    </div>

    <button class="remove-course-btn" data-side="${side}">
      Remove course
    </button>
  `;

  container.querySelector(".remove-course-btn").addEventListener("click", () => {
    compareState[side] = null;
    saveCompareState();
    clearAiAssessment();
    renderCompare();
  });
}

function renderCompare() {
  renderCourse("left");
  renderCourse("right");

  if (!compareState.left || !compareState.right) {
    renderAiAssessmentLoading("Select two courses to generate an assessment.");
    return;
  }

  const result = document.getElementById("aiAssessmentResult");
  const status = document.getElementById("aiAssessmentStatus");

  if (status && result && !result.innerHTML.trim()) {
    status.style.display = "block";
    status.textContent = "Click Generate to create the AI pros and cons assessment.";
  }
}

function buildCompareQuery(search = "") {
  const finderState = getFinderState();
  const interestState = getInterestState();

  const params = new URLSearchParams();

  params.set("userId", CURRENT_USER_ID);
  params.set("search", search || "");
  params.set("difference", finderState.gpaBoost || "0");
  params.set("band_min_percentage", finderState.bandMinPercentage || "80");
  params.set("exclude_unwanted_interests", finderState.excludeUnwanted ? "true" : "false");
  params.set("only_wanted_interests", finderState.onlyWanted ? "true" : "false");

  params.set("high_interests", csv(interestState.wanted.high));
  params.set("medium_interests", csv(interestState.wanted.medium));
  params.set("low_interests", csv(interestState.wanted.low));

  params.set("high_unwanted_interests", csv(interestState.unwanted.high));
  params.set("medium_unwanted_interests", csv(interestState.unwanted.medium));
  params.set("low_unwanted_interests", csv(interestState.unwanted.low));

  return params;
}

function buildRankedRecommendationQuery() {
  const finderState = getFinderState();
  const interestState = getInterestState();

  const params = new URLSearchParams();

  params.set("userId", CURRENT_USER_ID);
  params.set("difference", finderState.gpaBoost || "0");
  params.set("band_min_percentage", finderState.bandMinPercentage || "80");
  params.set("exclude_unwanted_interests", finderState.excludeUnwanted ? "true" : "false");
  params.set("only_wanted_interests", finderState.onlyWanted ? "true" : "false");

  const priority = finderState.priority || DEFAULT_FINDER_STATE.priority;

  Object.entries(priority).forEach(([priorityNumber, metrics]) => {
    if (!Array.isArray(metrics)) return;

    metrics.forEach(metric => {
      const normalizedMetric = metric === "interests" ? "interest" : metric;
      params.set(`${normalizedMetric}_priority`, priorityNumber);
    });
  });

  const hasPrestige = Object.values(priority).flat().includes("prestige");
  const selectedUniversities = finderState.selectedUniversities || [];

  if (selectedUniversities.length && !hasPrestige) {
    params.set("uni_code", selectedUniversities.join(","));
  }

  params.set("high_interests", csv(interestState.wanted.high));
  params.set("medium_interests", csv(interestState.wanted.medium));
  params.set("low_interests", csv(interestState.wanted.low));

  params.set("high_unwanted_interests", csv(interestState.unwanted.high));
  params.set("medium_unwanted_interests", csv(interestState.unwanted.medium));
  params.set("low_unwanted_interests", csv(interestState.unwanted.low));

  return params;
}

function flattenRankedCourses(payload) {
  const results = payload?.data?.results || [];
  return results.flatMap(result => Array.isArray(result.courses) ? result.courses : []);
}

async function fetchCompareCoursesBase() {
  const params = buildCompareQuery("");
  const json = await fetchJson(`/course-compare?${params.toString()}`);

  return Array.isArray(json.data?.courses) ? json.data.courses : [];
}

async function fetchRankedEligibleCourses() {
  try {
    const params = buildRankedRecommendationQuery();

    const json = await fetchJson(
      `/course-priority-recommendation/eligible-ranked-courses?${params.toString()}`
    );

    return flattenRankedCourses(json);
  } catch (error) {
    console.warn("Unable to load ranked eligible courses:", error.message);
    return [];
  }
}

function mergeBaseAndRankedCourses(baseCourses, rankedCourses) {
  const rankedById = new Map(
    rankedCourses.map(course => [String(course.course_id), course])
  );

  return baseCourses.map(baseCourse => {
    const rankedCourse = rankedById.get(String(baseCourse.course_id));

    if (!rankedCourse) {
      return normalizeCompareCourse(baseCourse);
    }

    return mergePreservingRecommendationScore(baseCourse, {
      ...rankedCourse,
      recommendation_score:
        rankedCourse.total_score ??
        rankedCourse.priority_score ??
        null,
    });
  });
}

async function ensureCompareCourseCache(forceRefresh = false) {
  if (compareCourseCacheLoaded && !forceRefresh) {
    return compareCourseCache;
  }

  if (compareCourseCachePromise && !forceRefresh) {
    return compareCourseCachePromise;
  }

  compareCourseCachePromise = Promise.all([
    fetchCompareCoursesBase(),
    fetchRankedEligibleCourses(),
  ])
    .then(([baseCourses, rankedCourses]) => {
      compareCourseCache = mergeBaseAndRankedCourses(baseCourses, rankedCourses);
      compareCourseCacheLoaded = true;
      return compareCourseCache;
    })
    .finally(() => {
      compareCourseCachePromise = null;
    });

  return compareCourseCachePromise;
}

function filterCompareCourseCache(search = "") {
  const query = String(search || "").trim().toLowerCase();

  if (!query) {
    return compareCourseCache;
  }

  return compareCourseCache.filter(course => {
    return [
      course.course_name,
      course.university_code,
      course.university_name,
      course.raw?.course_name,
      course.raw?.university_code,
      course.raw?.university?.short_name,
    ]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  });
}

async function hydrateSelectedCourses() {
  const selectedSides = ["left", "right"].filter(side => compareState[side]?.course_id);

  if (!selectedSides.length) return;

  try {
    const courses = await ensureCompareCourseCache();

    selectedSides.forEach(side => {
      const current = compareState[side];

      const updated = courses.find(course =>
        String(course.course_id) === String(current.course_id)
      );

      if (updated) {
        compareState[side] = mergePreservingRecommendationScore(current, updated);
      }
    });

    saveCompareState();
    renderCompare();
  } catch (error) {
    console.warn("Unable to hydrate selected courses:", error.message);
  }
}

async function openCourseModal(side) {
  compareState.activeSide = side;

  document.getElementById("courseSearchModal").classList.add("active");
  document.getElementById("courseSearchInput").value = "";

  const results = document.getElementById("courseSearchResults");
  results.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      Loading courses...
    </div>
  `;

  try {
    await ensureCompareCourseCache();

    compareState.allCourses = filterCompareCourseCache("");
    renderCourseSearchResults();
  } catch (error) {
    results.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; color: var(--danger);">
        Unable to load courses: ${error.message}
      </div>
    `;
  }
}

function closeCourseModal() {
  document.getElementById("courseSearchModal").classList.remove("active");
}

function searchCourses(search = "") {
  const requestId = ++courseSearchRequestId;

  if (!compareCourseCacheLoaded) {
    const results = document.getElementById("courseSearchResults");

    results.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        Loading courses...
      </div>
    `;

    ensureCompareCourseCache()
      .then(() => {
        if (requestId !== courseSearchRequestId) return;

        compareState.allCourses = filterCompareCourseCache(search);
        renderCourseSearchResults();
      })
      .catch(error => {
        if (requestId !== courseSearchRequestId) return;

        results.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; color: var(--danger);">
            Unable to load courses: ${error.message}
          </div>
        `;
      });

    return;
  }

  compareState.allCourses = filterCompareCourseCache(search);
  renderCourseSearchResults();
}

function renderCourseSearchResults() {
  const results = document.getElementById("courseSearchResults");

  results.innerHTML = "";

  if (!compareState.allCourses.length) {
    results.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        No courses found.
      </div>
    `;
    return;
  }

  compareState.allCourses.forEach(course => {
    const button = document.createElement("button");
    button.className = "interest-choice";

    const score = getEligibleScore(course);

    button.innerHTML = `
      <strong>${course.course_name}</strong><br />
      <span class="muted">
        ${course.university_code || "—"}
        ${score !== null && score !== undefined ? ` · Ranked ${Number(score).toFixed(1)}/100` : ""}
      </span>
    `;

    button.addEventListener("click", () => {
      compareState[compareState.activeSide] = normalizeCompareCourse(course);
      saveCompareState();
      clearAiAssessment();
      closeCourseModal();
      renderCompare();
    });

    results.appendChild(button);
  });
}

const debouncedCourseSearch = debounce(value => {
  searchCourses(value);
}, 80);

function buildAiAssessmentPreferences() {
  const finderState = getFinderState();
  const interestState = getInterestState();

  return {
    finder_state: finderState,
    interests: interestState,
    assessment_focus: {
      cost_matters: true,
      distance_matters: true,
      curriculum_fit_matters: true,
      avoid_unfavoured_interests: true,
      citizenship_based_cost: true,
      campus_travel_burden: true,
    },
    compare_factors: [
      "citizenship-based total university cost",
      "distance from user's home region",
      "curriculum fit with wanted interests",
      "risk of unfavoured interests",
      "salary",
      "employability",
      "admission cutoff",
      "cutoff gap after boost",
      "prestige",
      "intake size competitiveness",
    ],
  };
}

function clearAiAssessment() {
  const result = document.getElementById("aiAssessmentResult");
  const status = document.getElementById("aiAssessmentStatus");

  if (result) result.innerHTML = "";

  if (status) {
    status.style.display = "block";
    status.textContent = compareState.left && compareState.right
      ? "Click Generate to create the AI pros and cons assessment."
      : "Select two courses to generate an assessment.";
  }
}

function renderAiAssessmentLoading(message) {
  const status = document.getElementById("aiAssessmentStatus");
  const result = document.getElementById("aiAssessmentResult");

  if (!status || !result) return;

  status.style.display = "block";
  status.textContent = message;
  result.innerHTML = "";
}

function renderAiCourseAssessment(course) {
  return `
    <div class="ai-course-card">
      <h3>${course.course_name}</h3>

      <p><strong>Best for:</strong> ${course.best_for}</p>

      <div class="ai-list-title">Pros</div>
      <ul>
        ${course.pros.map(item => `<li>${item}</li>`).join("")}
      </ul>

      <div class="ai-list-title">Cons</div>
      <ul>
        ${course.cons.map(item => `<li>${item}</li>`).join("")}
      </ul>

      <div class="ai-list-title">Risks</div>
      <ul>
        ${course.risks.map(item => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderAiAssessmentResult(assessment) {
  const status = document.getElementById("aiAssessmentStatus");
  const result = document.getElementById("aiAssessmentResult");

  if (!status || !result) return;

  status.style.display = "none";

  result.innerHTML = `
    <div class="ai-summary-box">
      <strong>Summary</strong><br />
      ${assessment.summary}
    </div>

    <div class="ai-two-column">
      ${renderAiCourseAssessment(assessment.left_course)}
      ${renderAiCourseAssessment(assessment.right_course)}
    </div>

    <div class="ai-summary-box">
      <strong>Side-by-side judgement</strong>
      <div class="ai-judgement-list" style="margin-top: 12px;">
        ${assessment.side_by_side_judgement.map(item => `
          <div class="ai-judgement-row">
            <strong>${item.factor}</strong><br />
            Better: ${item.better_course}<br />
            <span class="muted">${item.reason}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="ai-summary-box">
      <strong>Final recommendation</strong><br />
      ${assessment.final_recommendation}
    </div>

    ${
      assessment.missing_data_warnings?.length
        ? `
          <div class="ai-warning">
            <strong>Missing data warnings</strong>
            <ul>
              ${assessment.missing_data_warnings.map(item => `<li>${item}</li>`).join("")}
            </ul>
          </div>
        `
        : ""
    }
  `;
}

async function generateAiAssessment(forceRefresh = false) {
  const requestId = ++aiAssessmentRequestId;

  if (!compareState.left || !compareState.right) {
    renderAiAssessmentLoading("Select two courses to generate an assessment.");
    return;
  }

  renderAiAssessmentLoading("Generating AI assessment...");

  try {
    const preferences = buildAiAssessmentPreferences();

    const json = await fetchJson("/compare-ai-assessment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: CURRENT_USER_ID,
        leftCourse: compareState.left,
        rightCourse: compareState.right,
        preferences,
        forceRefresh,
      }),
    });

    if (requestId !== aiAssessmentRequestId) return;

    renderAiAssessmentResult(json.data.assessment);
  } catch (error) {
    if (requestId !== aiAssessmentRequestId) return;

    const status = document.getElementById("aiAssessmentStatus");

    if (status) {
      status.style.display = "block";
      status.textContent = `Unable to generate assessment: ${error.message}`;
    }
  }
}

document.querySelectorAll(".add-course-btn").forEach(button => {
  button.addEventListener("click", () => openCourseModal(button.dataset.side));
});

document.getElementById("closeCourseModal").addEventListener("click", closeCourseModal);

document.getElementById("courseSearchModal").addEventListener("click", event => {
  if (event.target.id === "courseSearchModal") {
    closeCourseModal();
  }
});

document.getElementById("courseSearchInput").addEventListener("input", event => {
  debouncedCourseSearch(event.target.value);
});

document.getElementById("refreshAiAssessmentBtn").addEventListener("click", () => {
  generateAiAssessment(true);
});

async function initCompare() {
  loadInitialCompareCourses();
  renderCompare();

  await hydrateSelectedCourses();
}

initCompare();