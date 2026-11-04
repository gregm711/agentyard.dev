/* 百闻广告官网 · 交互（纯本地，无依赖） */
(function () {
  "use strict";

  // 移动端菜单
  var toggle = document.getElementById("navToggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("open");
    });
  }

  // 导航滚动态
  var nav = document.getElementById("nav");
  if (nav) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 12) nav.style.boxShadow = "0 6px 24px rgba(0,0,0,.35)";
      else nav.style.boxShadow = "none";
    });
  }

  // 联系表单（本地校验 + 友好提示，无后端）
  var form = document.getElementById("contactForm");
  var hint = document.getElementById("formHint");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector("#name").value.trim();
      var phone = form.querySelector("#phone").value.trim();
      if (!name || !phone) {
        hint.hidden = false;
        hint.style.color = "#ff8a1e";
        hint.textContent = "请填写称呼与联系电话，方便顾问回访。";
        return;
      }
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        hint.hidden = false;
        hint.style.color = "#ff8a1e";
        hint.textContent = "手机号格式好像不太对，请检查一下。";
        return;
      }
      hint.hidden = false;
      hint.style.color = "var(--gold-1)";
      hint.textContent = "已收到！百闻顾问会在工作时间内与您联系，请保持电话畅通。";
      form.reset();
    });
  }
})();
