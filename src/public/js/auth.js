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
    throw new Error(json.message || "Request failed");
  }

  return json;
}

function showAuthError(message) {
  const error = document.getElementById("authError");

  if (error) {
    error.textContent = message;
  }
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
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