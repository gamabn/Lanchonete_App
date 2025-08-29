import ResetPasswordForm from "@/app/reset-password/ResetPasswordForm";


export default function Page({ searchParams}: any) {
  const token = searchParams?.token ?? "";
  return <ResetPasswordForm token={token} />;
}
