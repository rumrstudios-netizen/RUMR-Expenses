import {NextResponse,type NextRequest} from 'next/server';
// Retire the old cookie session. Workspace APIs accept only an unlocked bearer session.
export function proxy(request:NextRequest){
 const response=NextResponse.next();
 for(const {name} of request.cookies.getAll()){
  if(/^sb-.*-auth-token(?:\.\d+)?$/.test(name))response.cookies.delete(name);
 }
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)']};
