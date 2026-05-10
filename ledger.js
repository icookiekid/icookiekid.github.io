// ver29_개인블로그_분리구조_20260511_002249 · 가계부 기능 · 최종 생성일자 2026-05-11 00:22:49 KST
(function () {
  window.BLOG = window.BLOG || { modules: {}, registerModule(name, api) { this.modules[name] = api; } };

  function init(ctx) {
    const { $, uid, today, saveLocalData } = ctx;
    const date = $("#ledgerDate");
    if (date) date.value = today();

    $("#ledgerMethod")?.addEventListener("change", () => updateCardSelectState(ctx));
    $("#ledgerForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const method = $("#ledgerMethod").value;
      ctx.state.ledger.unshift({
        id: uid(),
        date: $("#ledgerDate").value,
        type: $("#ledgerType").value,
        amount: Number($("#ledgerAmount").value || 0),
        method,
        card: method === "card" ? $("#ledgerCard").value : "",
        category: $("#ledgerCategory").value,
        desc: $("#ledgerDesc").value,
        createdAt: new Date().toISOString()
      });
      event.target.reset();
      $("#ledgerDate").value = today();
      updateCardSelectState(ctx);
      saveLocalData();
    });
  }

  function updateCardSelectState(ctx) {
    const { $ } = ctx;
    const isCard = $("#ledgerMethod")?.value === "card";
    const card = $("#ledgerCard");
    if (card) card.disabled = !isCard;
  }

  function render(ctx) {
    const { $, escapeHtml, formatMoney, methodLabel } = ctx;
    const summary = $("#ledgerSummary");
    const list = $("#ledgerList");
    if (!summary || !list) return;
    const totals = ctx.state.ledger.reduce((acc, item) => {
      const amount = Number(item.amount || 0);
      if (item.type === "income") acc.income += amount;
      if (item.type === "expense") acc.expense += amount;
      if (item.method === "card") acc.card += amount;
      if (item.method === "cash") acc.cash += amount;
      if (item.method === "transfer") acc.transfer += amount;
      return acc;
    }, { income: 0, expense: 0, card: 0, cash: 0, transfer: 0 });
    const balance = totals.income - totals.expense;
    summary.innerHTML = `
      <div class="summary-card">수입<b>${formatMoney(totals.income)}</b></div>
      <div class="summary-card">지출<b>${formatMoney(totals.expense)}</b></div>
      <div class="summary-card">잔액<b>${formatMoney(balance)}</b></div>
      <div class="summary-card">카드 사용<b>${formatMoney(totals.card)}</b></div>`;
    list.innerHTML = ctx.state.ledger.length ? ctx.state.ledger.map((item) => `
      <article class="list-item">
        <div class="meta">${escapeHtml(item.date)} · ${item.type === "income" ? "수입" : "지출"} · ${methodLabel(item.method)} ${item.card ? "· " + escapeHtml(item.card) : ""}</div>
        <h3>${formatMoney(item.amount)} ${item.category ? "· " + escapeHtml(item.category) : ""}</h3>
        <p>${escapeHtml(item.desc || "내용 없음")}</p>
        <div class="actions"><button class="btn btn-small btn-danger" type="button" data-delete="ledger" data-id="${item.id}">삭제</button></div>
      </article>`).join("") : `<div class="empty">아직 저장된 가계부 내역이 없습니다.</div>`;
  }

  window.BLOG.registerModule("ledger", { init, render, updateCardSelectState });
})();
