import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {api} from '../lib/api';
export function Digest(){const data=useQuery({queryKey:['digest'],queryFn:()=>api<{day:string;artifacts:number;pending_approvals:number;inbox:number}>('/api/digest/today')});if(!data.data)return null;const d=data.data;return <><div className="digest"><span className="eyebrow">今日一瞥 · {d.day}</span><div className="row"><span>近 24 小时 <b>{d.artifacts}</b> 份产出</span><Link to="/approvals"><b>{d.pending_approvals}</b> 项待批</Link><Link to="/inbox"><b>{d.inbox}</b> 条待处理</Link></div></div><div className="quick-grid"><Link to="/threads">◌ 派一个任务</Link><Link to="/approvals">✓ 处理审批</Link><Link to="/ops">▥ 查看运行状态</Link><Link to="/inbox">↗ 收集灵感</Link></div></>;}
