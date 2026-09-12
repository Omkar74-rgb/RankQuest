(function () {
  const user = Api.currentUser();
  if (!Api.token() || !user) {
    location.href = "/index.html";
    return;
  }
  if (user.role !== "admin") {
    alert("Admin access required.");
    location.href = "/app.html";
    return;
  }

  document.getElementById("whoName").textContent = user.username;
  document.getElementById("logoutBtn").addEventListener("click", () => {
    Api.clearSession();
    location.href = "/index.html";
  });

  function fmt(n) {
    return Number(n).toLocaleString();
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function countFor(taskCounts, type) {
    const row = taskCounts.find((r) => r.type === type);
    if (!row) return "0/0";
    return `${row.done || 0}/${row.total}`;
  }

  async function loadUsers() {
    const users = await Api.get("/admin/users");
    const body = document.getElementById("usersBody");
    if (!users.length) {
      body.innerHTML = `<tr><td colspan="7" class="loading">No users yet.</td></tr>`;
      return;
    }
    body.innerHTML = users
      .map(
        (u) => `
      <tr class="admin-row" data-id="${u.id}" data-name="${escapeHtml(u.username)}">
        <td>${escapeHtml(u.username)}${u.role === "admin" ? ' <span class="badge-label">admin</span>' : ""}</td>
        <td>${u.rank}</td>
        <td>${fmt(u.points)}</td>
        <td>${u.streak}d</td>
        <td>${countFor(u.taskCounts, "daily")}</td>
        <td>${countFor(u.taskCounts, "goal")}</td>
        <td>${countFor(u.taskCounts, "bucket")}</td>
      </tr>`
      )
      .join("");

    document.querySelectorAll(".admin-row").forEach((row) => {
      row.addEventListener("click", () => loadUserDetail(row.dataset.id, row.dataset.name));
    });
  }

  async function loadUserDetail(id, name) {
    const tasks = await Api.get(`/admin/users/${id}/tasks`);
    document.getElementById("detailPanel").style.display = "block";
    document.getElementById("detailUser").textContent = name;
    const list = document.getElementById("detailList");
    if (!tasks.length) {
      list.innerHTML = `<div class="empty">No tasks yet.</div>`;
      return;
    }
    list.innerHTML = tasks
      .map(
        (t) => `
      <div class="task ${t.done ? "done" : ""} ${t.missed && !t.done ? "missed" : ""}">
        <span class="badge-label" style="margin-left:0;">${t.type}</span>
        <div class="task-body">
          <p class="task-title ${t.done ? "strike" : ""}">${escapeHtml(t.title)}</p>
          ${t.deadline ? `<p class="task-sub ${t.missed ? "miss" : ""}">${t.missed ? "Missed — " : "Due "}${new Date(t.deadline).toLocaleString()}</p>` : ""}
        </div>
        <span class="task-pts">${t.done ? "✓ " : ""}${t.points} pts</span>
      </div>`
      )
      .join("");
  }

  loadUsers();
})();
