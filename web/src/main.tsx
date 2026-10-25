import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter,NavLink,Route,Routes } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import './style.css';
const tabs=[['/','▧','产物'],['/threads','◌','对话'],['/approvals','✓','审批'],['/ops','▥','运维'],['/settings','⚙','设置']];
function App(){return <div className="shell"><header><b>🦦 RunOtter</b><span>YOUR AGENTS, WITHIN REACH</span></header><main><Routes>{tabs.map(([path,,title])=><Route key={path} path={path} element={<><h1>{title}</h1><div className="empty">工作台即将就绪</div></>}/>)}</Routes></main><nav>{tabs.map(([path,icon,title])=><NavLink key={path} to={path} end={path==='/'}><i>{icon}</i>{title}</NavLink>)}</nav></div>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></React.StrictMode>);
