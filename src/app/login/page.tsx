import { currentUser } from "@/lib/auth";
import { configured } from "@/lib/db";
import { redirect } from "next/navigation";
import { Login } from "@/components/login";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (await currentUser()) redirect("/");
  return <Login ready={configured()} />;
}
