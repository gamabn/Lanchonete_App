import type { Metadata } from "next";
import "./globals.css";
import { ContextProvider } from "./Context";
import 'react-toastify/dist/ReactToastify.css'
import { ToastContainer } from "react-toastify";



export const metadata: Metadata = {
  title: "Sistema de Lanchonete",
  description: "Sistema lanchonet de Itambe Bahia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body>
        <ContextProvider>
       <ToastContainer/>
        {children}
        </ContextProvider>
      </body>
    </html>
  );
}
