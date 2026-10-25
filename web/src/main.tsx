import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter,NavLink,Route,Routes } from 'react-router-dom';
import { QueryClient,QueryClientProvider,useQuery,useQueryClient } from '@tanstack/react-query';
import {api,ApiError,base,type Session} from './lib/api';
import {Pair} from './components/Pair';
import {Settings} from './pages/Settings';
import {Artifacts,ArtifactDetail} from './pages/Artifacts';
import {registerPWA} from './lib/pwa';
import './style.css';
const tabs=[['/','▧','产物'],['/threads','◌','对话'],['/approvals','✓','审批'],['/ops','▥','运维'],['/settings','⚙','设置']];
registerPWA();
function App(){const q=useQueryClient();const session=useQuery({queryKey:['session'],queryFn:()=>api<Session>('/api/session'),retry:false});if(session.isPending)return <div className="empty">正在连接工作台…</div>;if(session.error)return session.error instanceof ApiError&&session.error.status===401?<Pair done={()=>void q.invalidateQueries()}/>:<div className="empty">连接暂不可用，请检查服务器地址并刷新。</div>;return <div className="shell"><header><b>🦦 RunOtter</b><span>YOUR AGENTS, WITHIN REACH</span></header><main><Routes><Route path="/artifacts/:id" element={<ArtifactDetail/>}/>{tabs.map(([path,,title])=><Route key={path} path={path} element={path==='/'?<Artifacts/>:path==='/settings'?<Settings session={session.data}/>:<><h1>{title}</h1><div className="empty">工作台即将就绪</div></>}/>)}</Routes></main><nav>{tabs.map(([path,icon,title])=><NavLink key={path} to={path} end={path==='/'}><i>{icon}</i>{title}</NavLink>)}</nav></div>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter basename={base||'/'}><App/></BrowserRouter></QueryClientProvider></React.StrictMode>);
