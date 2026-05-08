import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Pieslēgties — tirgus.izipizi.lv",
  description: "Pieslēdzies savam tirgus.izipizi.lv kontam — pircējiem un ražotājiem.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-extrabold text-gray-900">Pieslēgties</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
