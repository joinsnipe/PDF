import {handleAI} from '../../../../server/ai-service.mjs';
export const GET=(request:Request)=>handleAI(request);
export const POST=(request:Request)=>handleAI(request);
export const OPTIONS=(request:Request)=>handleAI(request);
