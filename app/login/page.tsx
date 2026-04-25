import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
export const metadata = { title: "Pieslēgties — tirgus.izipizi.lv" };
export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
