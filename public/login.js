import { applyAppearance, bindAppearanceStorage } from "./appearance.js";

applyAppearance();
bindAppearanceStorage();

const form = document.getElementById("loginForm");
const username = document.getElementById("username");
const password = document.getElementById("password");
const message = document.getElementById("authMessage");

username.value = "";
password.value = "";
preloadLoginBackground().finally(() => {
  document.body.classList.add("login-bg-ready");
  window.setTimeout(() => document.body.classList.add("login-ready"), 30);
});

window.addEventListener("pageshow", () => {
  username.value = "";
  password.value = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  document.body.classList.remove("login-error");

  const login = username.value.trim();
  const pass = password.value.trim();

  if (!login || !pass) {
    message.textContent = "Zadej jmeno i heslo";
    if (!login) username.focus();
    else password.focus();
    return;
  }

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: login, password: pass })
  });

  if (response.ok) {
    sessionStorage.setItem("led-login-transition", "1");
    document.body.classList.add("login-fade-out");
    window.setTimeout(() => {
      location.href = "shell.html?view=index.html";
    }, 500);
    return;
  }

  document.body.classList.add("login-error");
  message.textContent = "Spatne jmeno nebo heslo";
  username.value = "";
  password.value = "";
  username.focus();
});

function preloadLoginBackground() {
  return new Promise((resolve) => {
    const image = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = "login.png";
    if (image.complete) finish();
    window.setTimeout(finish, 1600);
  });
}
