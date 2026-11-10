"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h2>放映暂时中断了</h2>
      <p>页面加载遇到了问题，请重新尝试。</p>
      <button className="button primary" onClick={reset}>
        重新加载
      </button>
    </div>
  );
}
