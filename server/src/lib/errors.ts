export function fail(statusCode:number,code:string,message:string):never{throw Object.assign(new Error(message),{statusCode,code});}
