async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    const error = new Error(json.message || "Request failed");
    error.status = response.status;
    error.data = json.data;
    throw error;
  }

  return json;
}

let loginLockTimer = null;

const authErrorFromQuery = new URLSearchParams(window.location.search).get("authError");

function showAuthError(message) {
  const error = document.getElementById("authError");

  if (error) {
    error.textContent = message;
  }
}

if (authErrorFromQuery) {
  showAuthError(authErrorFromQuery);
  window.history.replaceState({}, document.title, window.location.pathname);
}

function showLoginAttempts(data) {
  if (!data || data.remainingAttempts === undefined) return;

  const label = data.remainingAttempts === 1 ? "attempt" : "attempts";
  showAuthError(`Invalid email or password. ${data.remainingAttempts} ${label} left.`);
}

function formatLockCountdown(lockedUntil) {
  const remainingMs = new Date(lockedUntil).getTime() - Date.now();
  const remainingMinutes = Math.max(Math.ceil(remainingMs / 60000), 0);

  return `${remainingMinutes} min`;
}

function setLoginLockedUntil(lockedUntil) {
  const button = loginForm?.querySelector("button[type='submit']");

  clearInterval(loginLockTimer);

  if (!button || !lockedUntil) return;

  function renderLock() {
    const isLocked = new Date(lockedUntil).getTime() > Date.now();

    button.disabled = isLocked;
    button.textContent = isLocked
      ? `Login locked (${formatLockCountdown(lockedUntil)})`
      : "Login";

    if (!isLocked) {
      clearInterval(loginLockTimer);
    }
  }

  renderLock();
  loginLockTimer = setInterval(renderLock, 1000);
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  document.getElementById("email")?.addEventListener("input", () => {
    const button = loginForm.querySelector("button[type='submit']");

    clearInterval(loginLockTimer);
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
    showAuthError("");
  });

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    showAuthError("");

    try {
      await postJson("/auth/login", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      });

      window.location.href = "/course-finder.html";
    } catch (error) {
      showAuthError(error.message);

      if (error.status === 429 && error.data?.lockedUntil) {
        setLoginLockedUntil(error.data.lockedUntil);
      } else {
        showLoginAttempts(error.data);
      }
    }
  });
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    showAuthError("");

    try {
      await postJson("/auth/register", {
        first_name: document.getElementById("fullName").value,
        full_name: document.getElementById("fullName").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        citizenship: document.getElementById("citizenship").value,
        postal_code: document.getElementById("postalCode").value,
      });

      window.location.href = "/profile.html";
    } catch (error) {
      showAuthError(error.message);
    }
  });
}
