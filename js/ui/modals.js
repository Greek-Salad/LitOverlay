import { icon } from "../core/icons.js";
import { saveAgeGateConfirmed } from "../core/storage.js";
import { escapeHtml } from "../core/utils.js";

export function showAgeGateModal({ bookTitle = "", immediate = false } = {}) {
  return new Promise((resolve) => {
    const layer = document.createElement("div");
    const contentWarning = bookTitle
      ? `Произведение «${escapeHtml(bookTitle)}» содержит контент, предназначенный исключительно для лиц, достигших 18 лет.`
      : "Этот сайт содержит контент, предназначенный исключительно для лиц, достигших 18 лет.";
    layer.className = "modal-layer";
    layer.innerHTML = `
      <section class="modal-card age-gate-card" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
        <h2 id="age-gate-title">Предупреждение о возрасте</h2>
        <p>${contentWarning}</p>
        <p>
          Входя на этот сайт, вы подтверждаете, что вам уже есть 18 лет и вы согласны использовать этот сайт
          на свой страх и риск. Владелец сайта не несёт ответственности за любой ущерб, который может возникнуть
          в результате использования этого сайта несовершеннолетними лицами.
        </p>
        <p>Если вам ещё нет 18 лет, пожалуйста, покиньте этот сайт.</p>
        <div class="modal-actions">
          <button class="text-btn success" data-confirm>Мне уже есть 18 лет</button>
          <button class="text-btn danger" data-decline>Мне ещё нет 18 лет</button>
        </div>
      </section>
    `;
    document.body.append(layer);
    const confirm = layer.querySelector("[data-confirm]");
    const decline = layer.querySelector("[data-decline]");
    const close = (value) => {
      layer.remove();
      resolve(value);
    };
    confirm.focus();
    confirm.addEventListener("click", () => {
      saveAgeGateConfirmed();
      close(true);
    });
    decline.addEventListener("click", () => close(false));
    layer.addEventListener("click", (event) => {
      if (event.target === layer && !immediate) close(null);
    });
  });
}

export function showResumeModal(progress, chapterTitle) {
  return new Promise((resolve) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.scrollPercent || 0)));
    const layer = document.createElement("div");
    layer.className = "modal-layer";
    layer.innerHTML = `
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="resume-title">
        <h2 id="resume-title">Продолжить чтение?</h2>
        <p>${chapterTitle || `Глава ${progress.chapter}`}</p>
        <div class="resume-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
          <p>${percent}% главы</p>
        </div>
        <div class="modal-actions">
          <button class="text-btn" data-start>Открыть начало</button>
          <button class="text-btn primary" data-resume>Продолжить с этого места</button>
        </div>
      </section>
    `;
    document.body.append(layer);
    const cleanup = (result) => {
      document.removeEventListener("keydown", onKey);
      layer.remove();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === "Escape") cleanup("home");
    };
    document.addEventListener("keydown", onKey);
    layer.querySelector("[data-start]").addEventListener("click", () => cleanup("start"));
    layer.querySelector("[data-resume]").addEventListener("click", () => cleanup("resume"));
    layer.addEventListener("click", (event) => {
      if (event.target === layer) cleanup("resume");
    });
    layer.querySelector("[data-resume]").focus();
  });
}

export function toast(message) {
  const node = document.createElement("div");
  node.className = "modal-card";
  node.style.position = "fixed";
  node.style.right = "1rem";
  node.style.bottom = "1rem";
  node.style.zIndex = "12000";
  node.style.width = "auto";
  node.style.maxWidth = "min(360px, calc(100vw - 2rem))";
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 1800);
}

export function iconButton(name, label, className = "icon-btn", size = 20) {
  return `<button class="${className}" type="button" aria-label="${label}" title="${label}">${icon(name, size)}</button>`;
}
