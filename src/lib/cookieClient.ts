import  { getCookie, deleteCookie } from 'cookies-next'

export function getCookieClient(){
    const token = getCookie("token")
    return token;
}

export function deleteCookieClient(name: string){
    deleteCookie(name, { path: '/' });
}