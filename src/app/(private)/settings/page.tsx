import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Settings } from "@/components/settings";
export default async function Page() {
  if ((await currentUser())?.role !== "admin") redirect("/");
  return <Settings />;
}
