import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>这个故事还没开场</h1>
      <p>你访问的页面不存在。</p>
      <Link className="button primary" href="/">
        回到放映室
      </Link>
    </div>
  );
}
