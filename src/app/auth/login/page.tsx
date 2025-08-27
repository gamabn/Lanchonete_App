
import Link from 'next/link'
import { Header } from '@/app/components/header'
import { handleLogin } from './loginAction'
import { LoginForm } from '@/app/components/Form'

export default function Login() {
  return (
     <div className="w-full">
            <Header/>
            <h1 className="text-3xl font-bold m-6 text-center text-black">Login</h1>
            <div className="flex flex-col gap-4 w-full max-w-md m-auto shadow-xl bg-white shadow-black  rounded-xl p-5 max-sm:shadow-none">
            { /*  <form action={handleLogin} className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      className="border p-2 rounded-xl"
                     
                      required
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label>Senha</label>
                    <input
                      type="password"
                      name="password"
                      className="border p-2 rounded-xl"
                    
                  
                      required
                    />
                </div>     
             
                 <div className="flex flex-col gap-2">
                        <button
                        type="submit"
                       
                        className="bg-blue-500 p-2 h-11 rounded-xl text-white font-bold"
                        >
                          Entrar
                            </button>
                            
                    </div>
                    </form>
                    <Link href="/auth/cadastro">
                       <p className="text-center text-blue-800 font-light text-sm">Não tem cadastro? Cadastre-se</p>
                    </Link>*/}

                    <LoginForm />
              </div>
            </div>
  )
}
