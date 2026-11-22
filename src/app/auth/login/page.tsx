import { Header } from "@/app/components/header";

import { LoginForm } from "@/app/components/Form";

export default function Login() {
  return (
    <div className="w-full bg-white">
      <Header />
      <div className="flex items-center justify-center mt-3 p-3">
        <LoginForm />
      </div>
    </div>
  );
}
