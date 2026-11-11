import { Header } from "@/app/components/header";

import { LoginForm } from "@/app/components/Form";

export default function Login() {
  return (
    <div className="w-full">
      <Header />
      <h1 className="text-3xl font-bold m-6 text-center text-black">Login</h1>
      <div className="flex items-center justify-center mt-3 p-3">
        <LoginForm />
      </div>
    </div>
  );
}
