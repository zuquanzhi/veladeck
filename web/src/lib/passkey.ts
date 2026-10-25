import {startAuthentication} from '@simplewebauthn/browser';
import {api} from './api';
export async function stepUp(scope:string){const options=await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/webauthn/login/options','POST',{scope});const response=await startAuthentication({optionsJSON:options});const result=await api<{step_up_token:string}>('/api/auth/webauthn/login/verify','POST',{response});return result.step_up_token;}
