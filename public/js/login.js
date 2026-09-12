(function () {
  if (Api.token()) {
    location.href = "/app.html";
    return;
  }

  let mode = "login"; // or "register"

  const form = document.getElementById("authForm");
  const title = document.getElementById("formTitle");
  const sub = document.getElementById("formSub");
  const submitBtn = document.getElementById("submitBtn");
  const switchLine = document.getElementById("switchLine");
  const switchLink = document.getElementById("switchLink");
  const errorBox = document.getElementById("errorBox");

  function render() {
    if (mode === "login") {
      title.textContent = "Welcome back";
      sub.textContent = "Log in to keep climbing.";
      submitBtn.textContent = "Log in";
      switchLine.innerHTML = 'New here? <a id="switchLink">Create an account</a>';
    } else {
      title.textContent = "Create your account";
      sub.textContent = "The first account created on this app becomes the admin.";
      submitBtn.textContent = "Register";
      switchLine.innerHTML = 'Already have an account? <a id="switchLink">Log in</a>';
    }
    document.getElementById("switchLink").addEventListener("click", () => {
      mode = mode === "login" ? "register" : "login";
      errorBox.style.display = "none";
      render();
    });
  }
  render();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";
    submitBtn.disabled = true;
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const data = await Api.post(path, { username, password });
      Api.setSession(data.token, data.user);
      location.href = "/app.html";
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
