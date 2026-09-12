(function () {
  if (!Api.token()) {
    location.href = "/index.html";
    return;
  }

  const user = Api.currentUser();
  document.getElementById("whoName").textContent = user?.username || "";
  if (user?.role === "admin") document.getElementById("adminLink").style.display = "inline";

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Api.clearSession();
    location.href = "/index.html";
  });

  let TIERS = [];
  let me = null;
  let tasks = [];
  const subTab = { daily: "todo", goals: "todo", bucket: "todo" };

  function tierIndex(points) {
    let idx = 0;
    for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) idx = i;
    return idx;
  }

  function fmt(n) {
    return Number(n).toLocaleString();
  }

  function badgeHTML(tier, size) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${tier.color}1A;border:2px solid ${tier.color};color:${tier.color};font-family:Georgia,serif;font-weight:700;font-size:${size * 0.4}px;">${tier.name[0]}</div>`;
  }

  async function loadMe() {
    me = await Api.get("/auth/me");
  }

  async function loadTasks() {
    tasks = await Api.get("/tasks");
  }

  function renderRankCard() {
    const idx = tierIndex(me.points);
    const tier = TIERS[idx];
    const next = TIERS[idx + 1] || null;
    const span = next ? next.min - tier.min : 1;
    const progress = next ? Math.min(100, ((me.points - tier.min) / span) * 100) : 100;

    document.getElementById("rankBadge").outerHTML = badgeHTML(tier, 52).replace("<div", '<div id="rankBadge"');
    document.getElementById("rankName").textContent = tier.name;
    document.getElementById("rankName").style.color = tier.color;
    document.getElementById("rankPts").textContent = `${fmt(me.points)} pts`;
    const fill = document.getElementById("progressFill");
    fill.style.width = progress + "%";
    fill.style.background = tier.color;
    document.getElementById("progressNote").textContent = next
      ? `${fmt(next.min - me.points)} pts to ${next.name}`
      : "Peak rank reached";
  }

  function renderLadder() {
    const idx = tierIndex(me.points);
    document.getElementById("ladderCard").innerHTML = TIERS.map((t, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:5px 0;">
        ${badgeHTML(t, 26)}
        <span style="flex:1;font-size:13px;${i === idx ? `font-weight:600;color:${t.color}` : "color:var(--muted)"}">${t.name}</span>
        <span style="font-size:11px;color:var(--muted)">${fmt(t.min)}+</span>
      </div>
    `).join("");
  }

  function renderStats() {
    const dailies = tasks.filter((t) => t.type === "daily");
    const doneToday = dailies.filter((t) => t.done).length;
    const bucketWins = tasks.filter((t) => t.type === "bucket" && t.done).length;
    document.getElementById("statStreak").textContent = `${me.streak}d`;
    document.getElementById("statToday").textContent = `${doneToday}/${dailies.length}`;
    document.getElementById("statBucket").textContent = bucketWins;
  }

  function deadlineNote(task) {
    if (task.done) return "";
    if (task.missed) return `<p class="task-sub miss">Missed deadline — points already deducted</p>`;
    if (task.deadline) {
      const d = new Date(task.deadline);
      return `<p class="task-sub">Due ${d.toLocaleString()}</p>`;
    }
    return "";
  }

  function taskRowHTML(task) {
    const titleClass = task.done ? "task-title strike" : "task-title";
    return `
      <div class="task ${task.done ? "done" : ""} ${task.missed && !task.done ? "missed" : ""}" data-id="${task.id}">
        <button class="check ${task.done ? "done" : ""}" data-action="complete" ${task.done ? "disabled" : ""}>${task.done ? "✓" : ""}</button>
        <div class="task-body">
          <p class="${titleClass}">${escapeHtml(task.title)}</p>
          ${task.reasoning && !task.done ? `<p class="task-sub">${task.category ? escapeHtml(task.category) + " — " : ""}${escapeHtml(task.reasoning)}</p>` : ""}
          ${deadlineNote(task)}
        </div>
        <span class="task-pts">+${task.points}</span>
        <button class="x-btn" data-action="delete">✕</button>
      </div>
    `;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // Completed daily quests show a lifetime ×N multiplier instead of a date,
  // since the same quest can be completed again every day.
  function completedDailyRowHTML(task) {
    return `
      <div class="task done" data-id="${task.id}">
        <div class="check done">✓</div>
        <div class="task-body">
          <p class="task-title strike">${escapeHtml(task.title)}<span class="mult-badge">×${task.timesCompleted || 1}</span></p>
          <p class="task-sub">Completed today</p>
        </div>
        <span class="task-pts">+${task.points}</span>
        <button class="x-btn" data-action="delete">✕</button>
      </div>
    `;
  }

  // Completed goals/bucket items just show the date they were finished.
  function completedWithDateHTML(task) {
    return `
      <div class="task done" data-id="${task.id}">
        <div class="check done">✓</div>
        <div class="task-body">
          <p class="task-title strike">${escapeHtml(task.title)}</p>
          <p class="task-sub">Completed ${formatDate(task.completedAt)}</p>
        </div>
        <span class="task-pts">+${task.points}</span>
        <button class="x-btn" data-action="delete">✕</button>
      </div>
    `;
  }

  function setActiveSubtab(section, sub) {
    subTab[section] = sub;
    document.querySelectorAll(`.subtabs[data-section="${section}"] .subtab-btn`).forEach((b) => {
      b.classList.toggle("active", b.dataset.sub === sub);
    });
  }

  function renderDaily() {
    const el = document.getElementById("dailyList");
    if (subTab.daily === "todo") {
      const list = tasks.filter((t) => t.type === "daily" && !t.done);
      el.innerHTML = list.length
        ? list.map(taskRowHTML).join("")
        : `<div class="empty">No daily quests yet. Add a small habit to repeat.</div>`;
    } else {
      const list = tasks.filter((t) => t.type === "daily" && t.done);
      el.innerHTML = list.length
        ? list.map(completedDailyRowHTML).join("")
        : `<div class="empty">Nothing completed today yet.</div>`;
    }
    attachTaskHandlers(el);
  }

  function renderGoals() {
    const el = document.getElementById("goalList");
    if (subTab.goals === "todo") {
      const list = tasks.filter((t) => t.type === "goal" && !t.done);
      el.innerHTML = list.length
        ? list.map(taskRowHTML).join("")
        : `<div class="empty">No goals yet. Add one — the AI scores it for you.</div>`;
    } else {
      const list = tasks.filter((t) => t.type === "goal" && t.done);
      el.innerHTML = list.length
        ? list.map(completedWithDateHTML).join("")
        : `<div class="empty">Nothing completed yet.</div>`;
    }
    attachTaskHandlers(el);
  }

  function chainHTML(task) {
    if (!task.chain) {
      return `<button class="btn btn-outline" data-action="gen-chain" style="font-size:11.5px;padding:7px 12px;margin-top:8px;">✦ Generate quest chain</button>`;
    }
    const rows = task.chain
      .map(
        (m, i) => `
      <div class="chain-row">
        <button class="chain-num ${m.done ? "done" : ""}" data-action="complete-milestone" data-mid="${m.id}" ${m.done ? "disabled" : ""}>${m.done ? "✓" : i + 1}</button>
        <span class="chain-title ${m.done ? "strike" : ""}">${escapeHtml(m.title)}</span>
        <span class="chain-pts">+${m.points}</span>
      </div>`
      )
      .join("");
    const allDone = task.chain.every((m) => m.done);
    return `
      <div class="chain">
        ${rows}
        <div class="chain-row">
          <span style="width:20px;text-align:center;color:var(--muted);font-size:11px;">→</span>
          <span class="chain-title" style="color:var(--muted-2);">Completion bonus</span>
          <span class="chain-pts">+${task.bonus}</span>
        </div>
      </div>
      <button class="btn" data-action="complete" style="width:100%;margin-top:10px;font-size:12px;" ${allDone ? "" : "disabled"}>Mark achieved</button>
    `;
  }

  function bucketCardHTML(task) {
    return `
      <div class="card" data-id="${task.id}">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <p style="font-size:14px;font-weight:500;">${escapeHtml(task.title)}</p>
            ${task.reasoning ? `<p class="task-sub">${task.category ? escapeHtml(task.category) + " — " : ""}${escapeHtml(task.reasoning)}</p>` : ""}
            ${deadlineNote(task)}
          </div>
          <span class="task-pts">${fmt(task.points)} pts</span>
          <button class="x-btn" data-action="delete">✕</button>
        </div>
        ${chainHTML(task)}
      </div>
    `;
  }

  function renderBucket() {
    const el = document.getElementById("bucketList");
    if (subTab.bucket === "todo") {
      const list = tasks.filter((t) => t.type === "bucket" && !t.done);
      el.innerHTML = list.length
        ? list.map(bucketCardHTML).join("")
        : `<div class="empty">Nothing here yet. Add a big one — a trip, a milestone, a dream.</div>`;
      attachBucketHandlers(el);
    } else {
      const list = tasks.filter((t) => t.type === "bucket" && t.done);
      el.innerHTML = list.length
        ? list.map(completedWithDateHTML).join("")
        : `<div class="empty">Nothing achieved yet.</div>`;
      attachTaskHandlers(el);
    }
  }

  function attachTaskHandlers(container) {
    container.querySelectorAll(".task").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-action="complete"]')?.addEventListener("click", () => completeTask(id));
      row.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteTask(id));
    });
  }

  function attachBucketHandlers(container) {
    container.querySelectorAll(".card[data-id]").forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteTask(id));
      card.querySelector('[data-action="gen-chain"]')?.addEventListener("click", (e) => generateChain(id, e.target));
      card.querySelector('[data-action="complete"]')?.addEventListener("click", () => completeTask(id));
      card.querySelectorAll('[data-action="complete-milestone"]').forEach((btn) => {
        btn.addEventListener("click", () => completeMilestone(id, btn.dataset.mid));
      });
    });
  }

  async function renderAll() {
    renderRankCard();
    renderLadder();
    renderStats();
    renderDaily();
    renderGoals();
    renderBucket();
  }

  async function refresh() {
    await Promise.all([loadMe(), loadTasks()]);
    await renderAll();
  }

  function showRankUp(tierName) {
    const tier = TIERS.find((t) => t.name === tierName);
    if (!tier) return;
    document.getElementById("rankUpBadge").outerHTML = badgeHTML(tier, 64).replace("<div", '<div id="rankUpBadge" style="margin:0 auto 12px;"');
    document.getElementById("rankUpName").textContent = tier.name;
    document.getElementById("rankUpName").style.color = tier.color;
    document.getElementById("rankUpModal").style.display = "flex";
  }

  document.getElementById("rankUpClose").addEventListener("click", () => {
    document.getElementById("rankUpModal").style.display = "none";
  });

  async function completeTask(id) {
    const before = tierIndex(me.points);
    try {
      const res = await Api.post(`/tasks/${id}/complete`, {});
      await refresh();
      const after = tierIndex(res.points);
      if (after > before) showRankUp(res.rank);
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteTask(id) {
    try {
      await Api.del(`/tasks/${id}`);
      await refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function generateChain(id, btn) {
    btn.disabled = true;
    btn.textContent = "Building path…";
    try {
      await Api.post(`/tasks/${id}/chain`, {});
      await refresh();
    } catch (e) {
      alert(e.message);
      btn.disabled = false;
      btn.textContent = "✦ Generate quest chain";
    }
  }

  async function completeMilestone(id, mid) {
    const before = tierIndex(me.points);
    try {
      const res = await Api.post(`/tasks/${id}/chain/${mid}/complete`, {});
      await refresh();
      const after = tierIndex(res.points);
      if (after > before) {
        const idx = tierIndex(res.points);
        showRankUp(TIERS[idx].name);
      }
    } catch (e) {
      alert(e.message);
    }
  }

  // ---- Add forms ----
  async function addTask(type, title, deadline, btn, input) {
    if (!title.trim()) return;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Scoring…";
    try {
      await Api.post("/tasks", { type, title: title.trim(), deadline: deadline || undefined });
      input.value = "";
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  document.getElementById("dailyAddBtn").addEventListener("click", () => {
    const input = document.getElementById("dailyInput");
    addTask("daily", input.value, null, document.getElementById("dailyAddBtn"), input);
  });
  document.getElementById("dailyInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("dailyAddBtn").click();
  });

  document.getElementById("goalAddBtn").addEventListener("click", () => {
    const input = document.getElementById("goalInput");
    const deadline = document.getElementById("goalDeadline").value;
    if (!deadline) return alert("Set a deadline for this goal.");
    addTask("goal", input.value, deadline, document.getElementById("goalAddBtn"), input);
  });

  document.getElementById("bucketAddBtn").addEventListener("click", () => {
    const input = document.getElementById("bucketInput");
    const deadline = document.getElementById("bucketDeadline").value;
    if (!deadline) return alert("Set a deadline for this bucket-list item.");
    addTask("bucket", input.value, deadline, document.getElementById("bucketAddBtn"), input);
  });

  // ---- Oracle ----
  document.getElementById("oracleBtn").addEventListener("click", async () => {
    const btn = document.getElementById("oracleBtn");
    btn.disabled = true;
    btn.textContent = "Consulting…";
    try {
      const res = await Api.post("/oracle", {});
      document.getElementById("oracleText").textContent = res.text;
      btn.textContent = "Ask again";
    } catch (e) {
      document.getElementById("oracleText").textContent = "The Oracle is silent right now.";
      btn.textContent = "Consult the Oracle";
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Tabs ----
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`section-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // ---- Sub-tabs (To do / Completed) ----
  const renderBySection = { daily: renderDaily, goals: renderGoals, bucket: renderBucket };
  document.querySelectorAll(".subtabs").forEach((bar) => {
    const section = bar.dataset.section;
    bar.querySelectorAll(".subtab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveSubtab(section, btn.dataset.sub);
        renderBySection[section]();
      });
    });
  });

  // ---- Boot ----
  (async function init() {
    try {
      TIERS = await Api.get("/tiers");
      await refresh();
    } catch (e) {
      console.error(e);
    }
  })();
})();
