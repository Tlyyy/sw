(() => {
  const AUTH = {
    salt: "sw-pet-auth-20260709",
    passwordHash: "e3ff871f9c52cd13db70f1fbb02502984837cf23c762a437e324f6cb71fdc892",
    sessionKey: "sw-site-auth-session",
    rememberKey: "sw-site-auth-until",
    rememberMs: 7 * 24 * 60 * 60 * 1000,
  };

  const root = document.documentElement;

  function rememberUntil() {
    return Number(window.localStorage.getItem(AUTH.rememberKey) || 0);
  }

  function clearAuthState() {
    window.sessionStorage.removeItem(AUTH.sessionKey);
    window.localStorage.removeItem(AUTH.rememberKey);
  }

  function isUnlocked() {
    return window.sessionStorage.getItem(AUTH.sessionKey) === "1" || rememberUntil() > Date.now();
  }

  function unlock() {
    root.classList.remove("auth-pending", "auth-locked");
    document.querySelector(".auth-gate")?.remove();
  }

  function setError(message) {
    const error = document.getElementById("authError");
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  async function hashPassword(password) {
    const bytes = new TextEncoder().encode(`${AUTH.salt}:${password}`);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function renderGate() {
    root.classList.add("auth-locked");

    const gate = document.createElement("section");
    gate.className = "auth-gate";
    gate.setAttribute("aria-label", "访问密码");
    gate.innerHTML = `
      <form class="auth-panel" id="authForm" autocomplete="off">
        <div class="auth-brand">
          <div class="auth-mark">兽</div>
          <div>
            <h1>账号资料工作台</h1>
            <p>输入密码后进入。</p>
          </div>
        </div>
        <label class="auth-field">
          <span>访问密码</span>
          <input id="authPassword" type="password" autocomplete="current-password" required autofocus />
        </label>
        <label class="auth-remember">
          <input id="authRemember" type="checkbox" />
          <span>本机记住 7 天</span>
        </label>
        <p id="authError" class="auth-error" hidden></p>
        <button class="auth-submit" type="submit">进入</button>
      </form>
    `;

    document.body.prepend(gate);

    document.getElementById("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const passwordInput = document.getElementById("authPassword");
      const rememberInput = document.getElementById("authRemember");
      const submitButton = event.currentTarget.querySelector("button");

      if (!window.crypto?.subtle) {
        setError("当前浏览器不支持本地密码校验。");
        return;
      }

      submitButton.disabled = true;
      setError("");

      try {
        const hash = await hashPassword(passwordInput.value);
        if (hash !== AUTH.passwordHash) {
          setError("密码不对，再试一次。");
          passwordInput.select();
          return;
        }

        window.sessionStorage.setItem(AUTH.sessionKey, "1");
        if (rememberInput.checked) {
          window.localStorage.setItem(AUTH.rememberKey, String(Date.now() + AUTH.rememberMs));
        }
        unlock();
      } catch (error) {
        setError("密码校验失败，请刷新后重试。");
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("auth") === "logout") {
    clearAuthState();
    params.delete("auth");
    const nextSearch = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`);
  }

  if (isUnlocked()) {
    unlock();
    return;
  }

  if (document.body) {
    renderGate();
    return;
  }

  document.addEventListener("DOMContentLoaded", renderGate, { once: true });
})();
