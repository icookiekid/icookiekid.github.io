// ver29_개인블로그_분리구조_20260511_002249 · 메모 기능 · 최종 생성일자 2026-05-11 00:22:49 KST
(function () {
  window.BLOG = window.BLOG || { modules: {}, registerModule(name, api) { this.modules[name] = api; } };

  function init(ctx) {
    const { $, uid, saveLocalData } = ctx;
    $("#memoForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      ctx.state.memos.unshift({
        id: uid(),
        title: $("#memoTitle").value,
        body: $("#memoBody").value,
        createdAt: new Date().toISOString()
      });
      event.target.reset();
      saveLocalData();
    });
  }

  function render(ctx) {
    const { $, escapeHtml } = ctx;
    const box = $("#memoList");
    if (!box) return;
    box.innerHTML = ctx.state.memos.length ? ctx.state.memos.map((item) => `
      <article class="list-item">
        <div class="meta">${new Date(item.createdAt).toLocaleString("ko-KR")}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body).replace(/\n/g, "<br>")}</p>
        <div class="actions"><button class="btn btn-small btn-danger" type="button" data-delete="memos" data-id="${item.id}">삭제</button></div>
      </article>`).join("") : `<div class="empty">아직 저장된 메모가 없습니다.</div>`;
  }

  window.BLOG.registerModule("memo", { init, render });
})();
