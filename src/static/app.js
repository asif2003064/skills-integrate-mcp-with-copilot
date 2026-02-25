document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");

  // Auth elements
  const userIcon = document.getElementById("user-icon");
  const userDropdown = document.getElementById("user-dropdown");
  const loginSection = document.getElementById("login-section");
  const loggedInSection = document.getElementById("logged-in-section");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginError = document.getElementById("login-error");
  const loggedInUser = document.getElementById("logged-in-user");

  // Session state
  let authToken = sessionStorage.getItem("authToken") || null;
  let loggedInUsername = sessionStorage.getItem("username") || null;

  function isLoggedIn() {
    return !!authToken;
  }

  function updateUIForAuth() {
    if (isLoggedIn()) {
      loginSection.classList.add("hidden");
      loggedInSection.classList.remove("hidden");
      loggedInUser.textContent = loggedInUsername;
      signupContainer.classList.remove("hidden");
      userIcon.textContent = "👤";
    } else {
      loginSection.classList.remove("hidden");
      loggedInSection.classList.add("hidden");
      signupContainer.classList.add("hidden");
      userIcon.textContent = "👤";
    }
    // Re-render activities to show/hide delete buttons
    fetchActivities();
  }

  // Toggle dropdown
  userIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!userDropdown.contains(e.target) && e.target !== userIcon) {
      userDropdown.classList.add("hidden");
    }
  });

  // Login handler
  loginBtn.addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    if (!username || !password) {
      loginError.textContent = "Please enter both username and password.";
      loginError.classList.remove("hidden");
      return;
    }
    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const result = await response.json();
      if (response.ok) {
        authToken = result.token;
        loggedInUsername = result.username;
        sessionStorage.setItem("authToken", authToken);
        sessionStorage.setItem("username", loggedInUsername);
        loginError.classList.add("hidden");
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
        userDropdown.classList.add("hidden");
        updateUIForAuth();
      } else {
        loginError.textContent = result.detail || "Login failed.";
        loginError.classList.remove("hidden");
      }
    } catch (err) {
      loginError.textContent = "Login request failed.";
      loginError.classList.remove("hidden");
    }
  });

  // Logout handler
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch (_) {
      // Ignore errors on logout
    }
    authToken = null;
    loggedInUsername = null;
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("username");
    userDropdown.classList.add("hidden");
    updateUIForAuth();
  });

  // Function to get auth headers
  function authHeaders() {
    if (authToken) {
      return { Authorization: `Bearer ${authToken}` };
    }
    return {};
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      // Clear and rebuild select options
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML — only show delete buttons when logged in
        let participantsHTML;
        if (details.participants.length > 0) {
          const listItems = details.participants
            .map((email) => {
              const deleteBtn = isLoggedIn()
                ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                : "";
              return `<li><span class="participant-email">${email}</span>${deleteBtn}</li>`;
            })
            .join("");
          participantsHTML = `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">${listItems}</ul>
            </div>`;
        } else {
          participantsHTML = `<p><em>No participants yet</em></p>`;
        }

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only present when logged in)
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize — set UI based on session and load activities
  updateUIForAuth();
});
