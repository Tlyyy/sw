const skillLibrary = window.SKILL_LIBRARY || [];

const cardsEl = document.querySelector("#cards");
const searchInput = document.querySelector("#searchInput");
const totalCount = document.querySelector("#totalCount");
const categoryCount = document.querySelector("#categoryCount");

const skillTypes = ["兽决", "御兽", "强化技能"];
let currentSkillType = "兽决";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTabs() {
  return `
    <div class="skill-tabs" role="tablist" aria-label="技能分类">
      ${skillTypes
        .map((type) => {
          const active = type === currentSkillType ? " active" : "";
          const count = skillLibrary.filter((skill) => skill.type === type).length;
          return `<button class="skill-tab${active}" type="button" data-skill-type="${escapeHtml(type)}" role="tab" aria-selected="${type === currentSkillType}">${escapeHtml(type)} <span>${count}</span></button>`;
        })
        .join("")}
    </div>
  `;
}

function renderSkill(skill, index) {
  const pendingClass = skill.certainty === "待确认" ? " pending" : "";
  return `
    <article class="skill-card">
      <div class="skill-head">
        <span class="skill-index">${index + 1}</span>
        <img class="skill-icon" src="${escapeHtml(skill.icon || "")}" alt="${escapeHtml(skill.name)}" />
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <div class="skill-meta">
            <span class="tag">${escapeHtml(skill.type)}</span>
            <span class="tag${pendingClass}">${escapeHtml(skill.certainty)}</span>
          </div>
        </div>
      </div>
      <p class="meta">${escapeHtml(skill.note || "")}</p>
    </article>
  `;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = skillLibrary.filter((skill) => {
    const matchesType = skill.type === currentSkillType;
    const matchesQuery = [skill.name, skill.type, skill.certainty, skill.note]
      .join(" ")
      .toLowerCase()
      .includes(query);
    return matchesType && matchesQuery;
  });

  totalCount.textContent = skillLibrary.length;
  categoryCount.textContent = skillTypes.length;

  const tabs = renderTabs();
  if (visible.length === 0) {
    cardsEl.innerHTML = `
      ${tabs}
      <div class="empty">没有匹配的技能</div>
    `;
    return;
  }

  cardsEl.innerHTML = `
    ${tabs}
    <section class="library-section">
      <div class="library-title">
        <h3>${escapeHtml(currentSkillType)}</h3>
        <span>${visible.length} 个</span>
      </div>
      <div class="library-grid">
        ${visible.map((skill, index) => renderSkill(skill, index)).join("")}
      </div>
    </section>
  `;
}

searchInput.addEventListener("input", render);
cardsEl.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-skill-type]");
  if (!tab) return;
  currentSkillType = tab.dataset.skillType;
  render();
});

render();
