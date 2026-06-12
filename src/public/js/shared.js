const PRESTIGE_SCORES = {
  NUS: 94,
  NTU: 91,
  SMU: 82,
  SUTD: 80,
  SIT: 65,
  SUSS: 41,
};

const DEFAULT_INTEREST_STATE = {
  wanted: {
    high: [],
    medium: [],
    low: [],
  },
  unwanted: {
    high: [],
    medium: [],
    low: [],
  },
};

const DEFAULT_FINDER_STATE = {
  activeUni: "All",
  gpaBoost: "0",
  bandMinPercentage: "80",
  selectedUniversities: [],
  onlyWanted: false,
  excludeUnwanted: false,
  courseKeyword: "",
  priority: {
    1: ["interest"],
    2: ["prestige"],
    3: ["salary"],
    4: ["employability"],
  },
};

let CURRENT_USER_ID = null;
let CURRENT_USER = null;

let interestStateCache = structuredClone(DEFAULT_INTEREST_STATE);
let finderStateCache = structuredClone(DEFAULT_FINDER_STATE);

let saveInterestTimer = null;
let saveFinderTimer = null;

function getUserScopedStorageKey(type) {
  const userId = CURRENT_USER_ID || "guest";

  return `findmyunisg_${type}_${userId}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(json.error || json.message || "Request failed");
    error.status = response.status;
    error.data = json.data;
    throw error;
  }

  return json;
}

async function getCurrentUser() {
  if (CURRENT_USER) {
    return CURRENT_USER;
  }

  const json = await fetchJson("/auth/me");

  CURRENT_USER = json.user;
  CURRENT_USER_ID = json.user.user_id;

  return CURRENT_USER;
}

async function requireLoggedInUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    window.location.href = "/login.html";
    throw error;
  }
}

async function logout() {
  try {
    await fetchJson("/auth/logout", {
      method: "POST",
    });
  } finally {
    CURRENT_USER = null;
    CURRENT_USER_ID = null;
    window.location.href = "/login.html";
  }
}

window.logout = logout;

function setupTutorialNav() {
  const navLinks = document.querySelector(".nav-links");

  if (!navLinks || document.getElementById("tutorialNavLink")) return;

  const tutorialButton = document.createElement("button");
  tutorialButton.id = "tutorialNavLink";
  tutorialButton.className = "nav-link tutorial-nav-link";
  tutorialButton.type = "button";
  tutorialButton.innerHTML = `
    <span class="tutorial-play-icon" aria-hidden="true"></span>
    <span>Tutorial</span>
  `;

  navLinks.insertBefore(tutorialButton, navLinks.firstElementChild);
}

function setupSiteFooter() {
  if (document.getElementById("siteFooter")) return;

  const footer = document.createElement("footer");
  footer.id = "siteFooter";
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer-inner">
      <div>
        <strong>FindMyUniSG</strong>
        <span>All rights reserved 2026.</span>
      </div>

      <nav class="footer-links" aria-label="Legal links">
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms of Use</a>
      </nav>

      <div class="footer-socials" aria-label="Social links">
        <a href="https://www.instagram.com/findmyunisg/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5"></rect>
            <circle cx="12" cy="12" r="4"></circle>
            <circle cx="17.5" cy="6.5" r="1"></circle>
          </svg>
        </a>
        <a href="https://www.linkedin.com/in/kieshore-selvaganthan/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4v11H4z"></path>
            <path d="M6 4a2 2 0 1 1 0 4a2 2 0 0 1 0-4z"></path>
            <path d="M10 9h4v1.5c.7-1 1.8-1.7 3.4-1.7c2.5 0 4.1 1.7 4.1 5V20h-4v-5.5c0-1.4-.6-2.2-1.7-2.2c-1.2 0-1.8.8-1.8 2.2V20h-4z"></path>
          </svg>
        </a>
        <a href="mailto:kieshoresel@gmail.com" target="_blank" rel="noopener noreferrer" aria-label="Gmail">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16v12H4z"></path>
            <path d="M4 7l8 6l8-6"></path>
          </svg>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
}

function setupNavToggle() {
  const navbar = document.querySelector(".navbar");
  const toggle = document.querySelector(".nav-toggle");

  if (!navbar || !toggle) return;

  toggle.addEventListener("click", () => {
    const isOpen = navbar.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });
}

setupTutorialNav();
setupNavToggle();
setupSiteFooter();

function debounce(fn, delay = 350) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function valueOrDash(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${suffix}`;
}

function moneyOrDash(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `$${Number(value).toLocaleString()}`;
}

function getPrestigeScore(uniCode) {
  return PRESTIGE_SCORES[String(uniCode || "").toUpperCase()] ?? null;
}

function csv(values) {
  return values.map(value => String(value).trim()).filter(Boolean).join(",");
}

function normalizeInterestKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanInterestState(value) {
  return {
    wanted: {
      high: Array.isArray(value?.wanted?.high) ? value.wanted.high : [],
      medium: Array.isArray(value?.wanted?.medium) ? value.wanted.medium : [],
      low: Array.isArray(value?.wanted?.low) ? value.wanted.low : [],
    },
    unwanted: {
      high: Array.isArray(value?.unwanted?.high) ? value.unwanted.high : [],
      medium: Array.isArray(value?.unwanted?.medium) ? value.unwanted.medium : [],
      low: Array.isArray(value?.unwanted?.low) ? value.unwanted.low : [],
    },
  };
}

function cleanFinderState(value) {
  const priority = value?.priority || value?.priority_space || DEFAULT_FINDER_STATE.priority;

  return {
    ...DEFAULT_FINDER_STATE,
    ...value,
    activeUni: value?.activeUni ?? value?.active_uni ?? DEFAULT_FINDER_STATE.activeUni,
    gpaBoost: value?.gpaBoost ?? value?.gpa_boost ?? DEFAULT_FINDER_STATE.gpaBoost,
    bandMinPercentage:
      value?.bandMinPercentage ??
      value?.band_min_percentage ??
      DEFAULT_FINDER_STATE.bandMinPercentage,
    selectedUniversities:
      Array.isArray(value?.selectedUniversities)
        ? value.selectedUniversities
        : Array.isArray(value?.selected_universities)
          ? value.selected_universities
          : [],
    onlyWanted: Boolean(value?.onlyWanted ?? value?.only_wanted ?? false),
    excludeUnwanted: Boolean(value?.excludeUnwanted ?? value?.exclude_unwanted ?? false),
    courseKeyword: value?.courseKeyword ?? value?.course_keyword ?? "",
    priority: {
      1: Array.isArray(priority?.["1"]) ? priority["1"] : [],
      2: Array.isArray(priority?.["2"]) ? priority["2"] : [],
      3: Array.isArray(priority?.["3"]) ? priority["3"] : [],
      4: Array.isArray(priority?.["4"]) ? priority["4"] : [],
    },
  };
}

function getInterestState() {
  return structuredClone(interestStateCache);
}

function saveInterestState(nextState) {
  interestStateCache = cleanInterestState(nextState);

  clearTimeout(saveInterestTimer);

  saveInterestTimer = setTimeout(async () => {
    try {
      await fetchJson("/user-preferences/interests", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(interestStateCache),
      });
    } catch (error) {
      console.warn("Unable to save interest preference:", error.message);
    }
  }, 300);
}

async function hydrateInterestState() {
  const json = await fetchJson("/user-preferences/interests");
  interestStateCache = cleanInterestState(json.data);
  return getInterestState();
}

function getFinderState() {
  return structuredClone(finderStateCache);
}

function saveFinderState(nextState) {
  finderStateCache = cleanFinderState(nextState);

  clearTimeout(saveFinderTimer);

  saveFinderTimer = setTimeout(async () => {
    try {
      await fetchJson("/user-preferences/course-finder", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finderStateCache),
      });
    } catch (error) {
      console.warn("Unable to save course finder preference:", error.message);
    }
  }, 300);
}

async function hydrateFinderState() {
  const json = await fetchJson("/user-preferences/course-finder");
  finderStateCache = cleanFinderState(json.data);
  return getFinderState();
}

function saveCompareCourses(courses) {
  localStorage.setItem(
    getUserScopedStorageKey("compare"),
    JSON.stringify(courses.filter(Boolean))
  );
}

function getCompareCourses() {
  try {
    return JSON.parse(localStorage.getItem(getUserScopedStorageKey("compare")) || "[]");
  } catch {
    return [];
  }
}

function clearCompareCourses() {
  localStorage.removeItem(getUserScopedStorageKey("compare"));
}

function getWantedInterestSelections() {
  const state = getInterestState();

  return [
    ...state.wanted.high.map(name => ({
      name,
      label: "High interest",
      tier: "high",
      weight: 3,
    })),
    ...state.wanted.medium.map(name => ({
      name,
      label: "Medium interest",
      tier: "medium",
      weight: 2,
    })),
    ...state.wanted.low.map(name => ({
      name,
      label: "Low interest",
      tier: "low",
      weight: 1,
    })),
  ];
}

function getCourseInterestRelevanceRows(course) {
  const rows = [];

  const relatedInterests =
    course.related_interests ||
    course.raw?.related_interests ||
    course.course_related_interests ||
    course.raw?.course_related_interests ||
    [];

  relatedInterests.forEach(item => {
    const name =
      item.interest_name ||
      item.interest?.interest_name ||
      item.interestGroup?.interest_name ||
      item.interest_group?.interest_name ||
      item.name;

    if (!name) return;

    rows.push({
      name,
      relevance_score: Number(item.relevance_score ?? 0),
    });
  });

  const interestFit = course.interest_fit || course.raw?.interest_fit;

  if (interestFit?.zones) {
    Object.values(interestFit.zones).forEach(zoneRows => {
      if (!Array.isArray(zoneRows)) return;

      zoneRows.forEach(item => {
        if (!item.interest_name) return;

        const existing = rows.find(row =>
          normalizeInterestKey(row.name) === normalizeInterestKey(item.interest_name)
        );

        if (existing) {
          existing.relevance_score = Number(item.relevance_score ?? existing.relevance_score ?? 0);
        } else {
          rows.push({
            name: item.interest_name,
            relevance_score: Number(item.relevance_score ?? 0),
          });
        }
      });
    });
  }

  return rows;
}

function normalizeCourseForCompare(course) {
  const admission = course.admissions?.[0] || {};
  const outcome = course.outcomes?.[0] || {};

  const salary =
    course.salary ??
    course.ges?.gross_monthly_median ??
    course.ges?.basic_monthly_median ??
    outcome.gross_monthly_median ??
    outcome.basic_monthly_median ??
    course.raw?.salary ??
    course.raw?.ges?.gross_monthly_median ??
    course.raw?.ges?.basic_monthly_median ??
    null;

  const employability =
    course.employability ??
    course.ges?.employment_rate_overall ??
    outcome.employment_rate_overall ??
    course.raw?.employability ??
    course.raw?.ges?.employment_rate_overall ??
    null;

  return {
    course_id: course.course_id,
    course_name: course.course_name,
    university_code:
      course.university?.short_name ||
      course.university_code ||
      course.raw?.university?.short_name ||
      course.raw?.university_code ||
      null,
    university_name:
      course.university?.university_name ||
      course.university_name ||
      course.raw?.university?.university_name ||
      course.raw?.university_name ||
      null,
    university_postal_code:
      course.university_postal_code ||
      course.university?.postal_code ||
      course.raw?.university_postal_code ||
      course.raw?.university?.postal_code ||
      null,
    intake_size: course.intake_size ?? admission.intake_size ?? course.raw?.intake_size ?? null,
    min_gpa: course.min_gpa ?? admission.min_gpa ?? course.raw?.min_gpa ?? null,
    tenth_percentile_rp:
      course.tenth_percentile_rp ??
      admission.tenth_percentile_rp ??
      course.raw?.tenth_percentile_rp ??
      null,
    tenth_percentile_uas_70:
      course.tenth_percentile_uas_70 ??
      admission.tenth_percentile_uas_70 ??
      course.raw?.tenth_percentile_uas_70 ??
      null,
    cutoff_gap: course.cutoff_gap ?? course.raw?.cutoff_gap ?? null,
    salary,
    employability,
    ges: {
      ...(course.ges || {}),
      gross_monthly_median: course.ges?.gross_monthly_median ?? salary,
      basic_monthly_median: course.ges?.basic_monthly_median ?? null,
      employment_rate_overall: course.ges?.employment_rate_overall ?? employability,
      source_year: course.ges?.source_year ?? outcome.source_year ?? null,
    },
    recommendation_score:
      course.recommendation_score ??
      course.total_score ??
      course.priority_score ??
      course.raw?.recommendation_score ??
      course.raw?.total_score ??
      course.raw?.priority_score ??
      null,
    total_score:
      course.total_score ??
      course.raw?.total_score ??
      null,
    priority_score:
      course.priority_score ??
      course.raw?.priority_score ??
      null,
    priority_metrics:
      course.priority_metrics ??
      course.raw?.priority_metrics ??
      null,
    interest_score:
      course.interest_fit?.score ??
      course.interest_score ??
      course.raw?.interest_fit?.score ??
      course.raw?.interest_score ??
      null,
    matched_interest_count:
      course.interest_fit?.matched_interest_count ??
      course.interest_fit?.wanted_matches?.length ??
      course.matched_interest_count ??
      course.raw?.interest_fit?.matched_interest_count ??
      course.raw?.interest_fit?.wanted_matches?.length ??
      course.raw?.matched_interest_count ??
      null,
    prestige: getPrestigeScore(
      course.university?.short_name ||
      course.university_code ||
      course.raw?.university?.short_name ||
      course.raw?.university_code
    ),
    interest_relevance_rows: getCourseInterestRelevanceRows(course),
    raw: course,
  };
}
