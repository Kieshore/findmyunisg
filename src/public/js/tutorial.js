(function () {
  const ACTIVE_STAGE = "tutorial_active_stage";
  const COMPLETED = "tutorial_completed";
  const UNAVAILABLE = "tutorial_unavailable";
  let activeTour = null;
  let lastReadyPage = null;

  function pageName() {
    const path = window.location.pathname;

    if (path.includes("profile")) return "profile";
    if (path.includes("course-finder")) return "course-finder";
    if (path.includes("compare")) return "compare";
    if (path.includes("saved")) return "saved";
    return "";
  }

  function storageKey(name) {
    return typeof getUserScopedStorageKey === "function"
      ? getUserScopedStorageKey(name)
      : `findmyunisg_${name}_guest`;
  }

  function isCompleted() {
    return localStorage.getItem(storageKey(COMPLETED)) === "true";
  }

  function setCompleted() {
    localStorage.setItem(storageKey(COMPLETED), "true");
    localStorage.removeItem(storageKey(ACTIVE_STAGE));
  }

  function getActiveStage() {
    return localStorage.getItem(storageKey(ACTIVE_STAGE));
  }

  function isUnavailable() {
    return sessionStorage.getItem(storageKey(UNAVAILABLE)) === "true";
  }

  function setActiveStage(stage) {
    localStorage.setItem(storageKey(ACTIVE_STAGE), stage);
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: 850px)").matches;
  }

  function tutorialMessage(message) {
    const messageElement = document.querySelector(".tutorial-step-message");

    if (messageElement) {
      messageElement.textContent = message || "";
    }
  }

  function getInterestCount() {
    if (typeof getInterestState !== "function") return 0;

    const interestState = getInterestState();

    return ["wanted", "unwanted"].reduce((total, kind) => {
      return total + ["high", "medium", "low"].reduce((tierTotal, tier) => {
        return tierTotal + (interestState?.[kind]?.[tier]?.length || 0);
      }, 0);
    }, 0);
  }

  function canContinueFromProfileDetails() {
    try {
      if (
        typeof getAcademicPayloadFromForm === "function" &&
        typeof validateAcademicPayload === "function"
      ) {
        validateAcademicPayload(getAcademicPayloadFromForm());
      }

      if (typeof hasAcademicChanged === "function" && hasAcademicChanged()) {
        tutorialMessage("Save your academic profile changes before continuing.");
        return false;
      }

      if (typeof hasBasicProfileChanged === "function" && hasBasicProfileChanged()) {
        tutorialMessage("Save your postal code changes before continuing.");
        return false;
      }

      tutorialMessage("");
      return true;
    } catch (error) {
      tutorialMessage(error.message || "Complete the required profile fields first.");
      return false;
    }
  }

  function canContinueFromInterests() {
    if (getInterestCount() === 0) {
      tutorialMessage("Add at least one favoured or unfavoured interest before continuing.");
      return false;
    }

    tutorialMessage("");
    return true;
  }

  async function saveInterestsBeforeLeaving() {
    if (typeof fetchJson !== "function" || typeof getInterestState !== "function") return;

    await fetchJson("/user-preferences/interests", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(getInterestState()),
    });
  }

  function createTour() {
    if (!window.Shepherd) {
      console.warn("Shepherd.js is not loaded. Tutorial cannot start.");
      sessionStorage.setItem(storageKey(UNAVAILABLE), "true");
      localStorage.removeItem(storageKey(ACTIVE_STAGE));
      return null;
    }

    return new Shepherd.Tour({
      useModalOverlay: !isMobileLayout(),
      keyboardNavigation: false,
      exitOnEsc: false,
      defaultStepOptions: {
        classes: isMobileLayout()
          ? "findmyunisg-tour findmyunisg-tour-mobile"
          : "findmyunisg-tour",
        canClickTarget: true,
        cancelIcon: {
          enabled: isCompleted(),
        },
        scrollTo: {
          behavior: "smooth",
          block: isMobileLayout() ? "nearest" : "center",
        },
      },
    });
  }

  function isInterestTierStepActive() {
    const currentStep = activeTour?.getCurrentStep?.();
    const stepId = currentStep?.id || currentStep?.options?.id;

    return stepId === "interest-tiers";
  }

  function setInterestModalOverlayHidden(hidden) {
    if (!isInterestTierStepActive()) return;

    document.body.classList.toggle("tutorial-interest-modal-open", hidden);
  }

  function waitForTourEvent(eventName, callback) {
    window.addEventListener(eventName, callback, {
      once: true,
    });
  }

  function goToNextStepById(tour, stepId) {
    const stepIndex = tour.steps.findIndex(step => {
      return step.id === stepId || step.options?.id === stepId;
    });

    if (stepIndex >= 0) {
      tour.show(stepIndex);
    }
  }

  function button(text, action, primary = true) {
    return {
      text,
      action,
      classes: primary ? "shepherd-button-primary" : "",
    };
  }

  function startProfileTour() {
    if (activeTour) return;

    const tour = createTour();
    if (!tour) return;

    activeTour = tour;
    setActiveStage("profile");

    tour.addStep({
      id: "profile-details",
      title: "Complete Your Profile",
      text: `
        <p>Fill in your academic details. Postal code helps with travel estimates, and the fields after it are required for course recommendations.</p>
        <p>After editing, click <strong>Save changes</strong>. You can continue only once your changes are saved.</p>
        <p class="tutorial-step-message"></p>
      `,
      attachTo: {
        element: "#profileDetailsCard",
        on: "right",
      },
      buttons: [
        button("Next", () => {
          if (canContinueFromProfileDetails()) {
            tour.next();
          }
        }),
      ],
    });

    tour.addStep({
      id: "interest-tiers",
      title: "Choose Interests",
      text: `
        <p>Favoured interests are topics you want to see in a course. Unfavoured interests are topics you would prefer to avoid.</p>
        <p>Use High, Med, and Low based on how strongly you feel. Add at least one interest to continue.</p>
        <p class="tutorial-step-message"></p>
      `,
      attachTo: {
        element: "#interestTierCard",
        on: "left",
      },
      buttons: [
        button("Back", () => tour.back(), false),
        button("Go to Course Finder", () => {
          if (!canContinueFromInterests()) return;

          tutorialMessage("Saving interests...");
          saveInterestsBeforeLeaving()
            .catch(error => {
              console.warn("Unable to save interests before tutorial navigation:", error.message);
            })
            .finally(() => {
              setActiveStage("course-finder");
              window.location.href = "/course-finder.html?tutorial=1";
            });
        }),
      ],
    });

    tour.on("cancel", () => {
      activeTour = null;
      setCompleted();
    });

    tour.start();
  }

  function startCourseFinderTour() {
    if (activeTour) return;

    const tour = createTour();
    if (!tour) return;

    activeTour = tour;
    setActiveStage("course-finder");

    tour.addStep({
      id: "course-finder-intro",
      title: "Course Finder",
      text: `
        <p>This is the main page where courses are recommended from your profile, interests, and priorities.</p>
        <p>Each course is ranked with a total score out of 100.</p>
      `,
      buttons: [
        button("Next", () => tour.next()),
      ],
    });

    tour.addStep({
      id: "priority-space",
      title: "Priority Ranking",
      text: `
        <p>Priorities decide how much each factor affects the total score. Adjust priority options based on how much you value them.</p>
        <p>${isMobileLayout()
          ? "On mobile, use the dropdowns to place each priority option."
          : "On desktop, drag and drop options into the numbered priority spaces."}</p>
        <p>You can put multiple options in the same priority level.</p>
      `,
      attachTo: {
        element: "#priorityCard",
        on: "left",
      },
      buttons: [
        button("Back", () => tour.back(), false),
        button("Next", () => tour.next()),
      ],
    });

    tour.addStep({
      id: "academic-boost",
      title: "Academic Boost",
      text: `
        <p>Use this based on your confidence level and how you interpret your portfolio strength.</p>
        <p>It can adjust your GPA, RP, or UAS score to show more eligible courses.</p>
      `,
      attachTo: {
        element: "#boostField",
        on: "right",
      },
      buttons: [
        button("Back", () => tour.back(), false),
        button("Next", () => tour.next()),
      ],
    });

    tour.addStep({
      id: "acceptance-chance",
      title: "Acceptance Chance",
      text: `
        <p>This controls the minimum acceptance chance for SIT and SUSS band-based courses.</p>
        <p>The default is 80%, but you can adjust it based on your confidence.</p>
      `,
      attachTo: {
        element: "#acceptanceChanceField",
        on: "right",
      },
      buttons: [
        button("Back", () => tour.back(), false),
        button("Next", () => tour.next()),
      ],
    });

    tour.addStep({
      id: "compare-mode",
      title: "Compare Courses",
      text: `
        <p>Click this button to enter compare mode.</p>
        <p>Then choose two course cards to compare in more detail.</p>
      `,
      attachTo: {
        element: "#toggleCompareMode",
        on: "top",
      },
      buttons: [
        button("Back", () => tour.back(), false),
      ],
      when: {
        show() {
          waitForTourEvent("findmyunisg:compare-mode-start", () => tour.next());
        },
      },
    });

    tour.addStep({
      id: "select-compare-courses",
      title: "Select Two Courses",
      text: `
        <p>Select any two courses from the recommended list.</p>
        <p>${isMobileLayout()
          ? "On mobile, tap the checkboxes on the course cards."
          : "On desktop, tick the checkboxes beside the course cards."}</p>
      `,
      attachTo: {
        element: "#courseList",
        on: "top",
      },
      buttons: [
        button("Back", () => tour.back(), false),
      ],
      when: {
        show() {
          const onSelectionChange = event => {
            if ((event.detail?.count || 0) >= 2) {
              window.removeEventListener("findmyunisg:compare-selection-change", onSelectionChange);
              tour.next();
            }
          };

          window.addEventListener("findmyunisg:compare-selection-change", onSelectionChange);
        },
      },
    });

    tour.addStep({
      id: "go-compare",
      title: "Open Comparison",
      text: `
        <p>Click this button to open the Compare page with your two selected courses.</p>
      `,
      attachTo: {
        element: "#goCompareBtn",
        on: "top",
      },
      buttons: [
        button("Back", () => goToNextStepById(tour, "select-compare-courses"), false),
      ],
      when: {
        show() {
          document.body.classList.add("tutorial-go-compare-step");
          waitForTourEvent("findmyunisg:compare-navigation", () => {
            setActiveStage("compare");
          });
        },
        hide() {
          document.body.classList.remove("tutorial-go-compare-step");
        },
      },
    });

    tour.on("complete", () => {
      activeTour = null;
      document.body.classList.remove("tutorial-go-compare-step");
    });
    tour.on("cancel", () => {
      activeTour = null;
      document.body.classList.remove("tutorial-go-compare-step");
      setCompleted();
    });

    tour.start();
  }

  function startCompareTour() {
    if (activeTour) return;

    const tour = createTour();
    if (!tour) return;

    activeTour = tour;
    setActiveStage("compare");

    tour.addStep({
      id: "compare-side-by-side",
      title: "Side-by-side Comparison",
      text: `
        <p>This page compares the two selected courses side by side.</p>
        <p>It helps you inspect scores, admissions data, outcomes, and fit in greater detail.</p>
      `,
      attachTo: {
        element: ".compare-grid",
        on: "bottom",
      },
      buttons: [
        button("Next", () => tour.next()),
      ],
    });

    tour.addStep({
      id: "ai-assessment-generator",
      title: "AI Assessment",
      text: `
        <p>The AI assessment can generate pros, cons, travel estimates, and a practical recommendation for the selected courses.</p>
        <p>This is the end of the tutorial.</p>
      `,
      attachTo: {
        element: ".ai-assessment-card",
        on: "top",
      },
      buttons: [
        button("Back", () => tour.back(), false),
        button("Finish", () => {
          setCompleted();
          tour.complete();
        }),
      ],
    });

    tour.on("complete", () => {
      activeTour = null;
      setCompleted();
    });
    tour.on("cancel", () => {
      activeTour = null;
      setCompleted();
    });

    tour.start();
  }

  async function ensureTutorialState(page) {
    if (activeTour) return;

    try {
      if (typeof getCurrentUser === "function") {
        await getCurrentUser();
      }
    } catch {
      return;
    }

    if (isUnavailable()) return;

    const activeStage = getActiveStage();

    if (activeStage === "course-finder" && page === "course-finder") {
      startCourseFinderTour();
      return;
    }

    if (activeStage === "profile" && page === "profile") {
      startProfileTour();
      return;
    }

    if (activeStage === "compare" && page === "compare") {
      setTimeout(startCompareTour, 650);
      return;
    }

    if (!isCompleted()) {
      if (page === "profile") {
        startProfileTour();
      } else {
        setActiveStage("profile");
        window.location.href = "/profile.html?tutorial=1";
      }
    }
  }

  function startTutorialFromNav() {
    if (activeTour) return;

    sessionStorage.removeItem(storageKey(UNAVAILABLE));
    setActiveStage("profile");

    if (pageName() === "profile") {
      activeTour = null;
      startProfileTour();
      return;
    }

    window.location.href = "/profile.html?tutorial=1";
  }

  function setupTutorialButton() {
    const tutorialButton = document.getElementById("tutorialNavLink");

    if (!tutorialButton) return;

    tutorialButton.addEventListener("click", startTutorialFromNav);
  }

  window.addEventListener("findmyunisg:page-ready", event => {
    lastReadyPage = event.detail?.page || pageName();
    ensureTutorialState(lastReadyPage);
  });

  window.addEventListener("findmyunisg:interest-modal-open", () => {
    setInterestModalOverlayHidden(true);
  });

  window.addEventListener("findmyunisg:interest-modal-close", () => {
    setInterestModalOverlayHidden(false);
  });

  setupTutorialButton();

  setTimeout(() => {
    const page = pageName();

    if (!["profile", "course-finder"].includes(page)) {
      ensureTutorialState(page);
      return;
    }

    if (page === "course-finder" && !lastReadyPage && !getActiveStage() && !isCompleted()) {
      ensureTutorialState(page);
      return;
    }

    if (!lastReadyPage && getActiveStage()) {
      ensureTutorialState(page);
    }
  }, 600);
})();
