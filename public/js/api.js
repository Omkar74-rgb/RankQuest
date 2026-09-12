const Api = (() => {
  function token() {
    return localStorage.getItem("rq_token");
  }

  function setSession(token, user) {
    localStorage.setItem("rq_token", token);
    localStorage.setItem("rq_user", JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem("rq_token");
    localStorage.removeItem("rq_user");
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem("rq_user") || "null");
    } catch (e) {
      return null;
    }
  }

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const resp = await fetch(`/api${path}`, { ...options, headers });

    if (resp.status === 401) {
      clearSession();
      if (!location.pathname.endsWith("index.html") && location.pathname !== "/") {
        location.href = "/index.html";
      }
      throw new Error("Session expired");
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) }),
    del: (path) => request(path, { method: "DELETE" }),
    token,
    setSession,
    clearSession,
    currentUser,
  };
})();
