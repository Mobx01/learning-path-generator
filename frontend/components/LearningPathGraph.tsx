"use client";

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { transformBranchedGraph } from '../graph/graphTransformers';
import { useSession, signIn, signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Resource { id: number; title: string; url: string; resource_type: string; difficulty: string; }
interface Project { id: number; title: string; description: string; difficulty: string; }

export default function LearningPathGraph() {
  const { data: session, status } = useSession();
  
  const currentUserId = useMemo(() => {
    const id = (session?.user as any)?.id;
    if (!id) return null;
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
  }, [session]);

  const token = (session as any)?.accessToken;

  const [loginUsername, setLoginUsername] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isExpanding, setIsExpanding] = useState(false);
  const [isMarkingKnown, setIsMarkingKnown] = useState(false);

  const [completedTopicIds, setCompletedTopicIds] = useState<number[]>([]);
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  const fetchAllTopics = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/topics/`, { headers: getHeaders() });
      if (res.ok) setAllTopics(await res.json());
    } catch (err) { console.error(err); }
  }, [getHeaders]);

  const fetchCompletedTopics = useCallback(async () => {
    if (!currentUserId || !token) return;
    try {
      const res = await fetch(`${API_URL}/users/${currentUserId}/completed-topics`, { headers: getHeaders() });
      if (res.ok) setCompletedTopicIds(await res.json());
    } catch (err) { console.error(err); }
  }, [currentUserId, token, getHeaders]);

  useEffect(() => {
    if (currentUserId && token) {
      fetchAllTopics();
      fetchCompletedTopics();
    }
  }, [currentUserId, token, fetchAllTopics, fetchCompletedTopics]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true); setLoginError(null);
    try {
      const result = await signIn("credentials", { username: loginUsername.trim(), redirect: false });
      if (result?.error) setLoginError("Connection failed. Check frequency tuner.");
    } catch (err) { setLoginError("System malfunction."); } 
    finally { setIsLoggingIn(false); }
  };

  const handleGeneratePath = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !currentUserId || !token) return;
    setIsLoading(true); setError(null); setNodes([]); setEdges([]);
    setSelectedTopic(null); setSelectedTopicId(null); setResources([]); setProjects([]);

    try {
      const response = await fetch(`${API_URL}/generator/generate-path`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ topic: searchQuery, user_id: currentUserId }),
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized access.");
        const errData = await response.json();
        throw new Error(errData.error || errData.detail || "Failed to parse roadmap.");
      }

      const data = await response.json();
      const { nodes: newNodes, edges: newEdges } = transformBranchedGraph(data.graph_data);
      
      const styledNodes = newNodes.map(node => {
        const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === node.data.label.toLowerCase());
        if (matchedTopic && completedTopicIds.includes(matchedTopic.topic_id)) {
          return { ...node, style: { backgroundColor: '#064e3b', border: '2px solid #34d399', color: '#a7f3d0', fontWeight: 'bold', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)' } };
        }
        return { ...node, style: { backgroundColor: '#1e293b', border: '2px solid #475569', color: '#f8fafc' } };
      });

      setNodes(styledNodes); setEdges(newEdges); await fetchAllTopics();
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (nodes.length > 0) {
      setNodes(nds => nds.map(node => {
        const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === node.data.label.toLowerCase());
        const isComplete = matchedTopic && completedTopicIds.includes(matchedTopic.topic_id);
        return { 
          ...node, 
          style: isComplete 
            ? { backgroundColor: '#064e3b', border: '2px solid #34d399', color: '#a7f3d0', fontWeight: 'bold', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)' } 
            : { backgroundColor: '#1e293b', border: '2px solid #475569', color: '#f8fafc' }
        };
      }));
    }
  }, [completedTopicIds, allTopics, setNodes]);

  const progressStats = useMemo(() => {
    if (nodes.length === 0) return { percent: 0, completed: 0, total: 0 };
    let completedCount = 0;
    nodes.forEach(n => {
      const matched = allTopics.find(t => t.topic_name.toLowerCase() === n.data.label.toLowerCase());
      if (matched && completedTopicIds.includes(matched.topic_id)) completedCount++;
    });
    return { percent: Math.round((completedCount / nodes.length) * 100), completed: completedCount, total: nodes.length };
  }, [nodes, allTopics, completedTopicIds]);

  const handleToggleCompletion = async () => {
    if (!selectedTopicId || !currentUserId || !token) return;
    setIsTogglingCompletion(true);
    const isCurrentlyCompleted = completedTopicIds.includes(selectedTopicId);
    try {
      if (isCurrentlyCompleted) {
        await fetch(`${API_URL}/users/${currentUserId}/completed-topics/${selectedTopicId}`, { method: 'DELETE', headers: getHeaders() });
      } else {
        await fetch(`${API_URL}/users/${currentUserId}/completed-topics`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ topic_id: selectedTopicId }) });
      }
      await fetchCompletedTopics();
    } catch (err) { console.error(err); } finally { setIsTogglingCompletion(false); }
  };

  const handleExpandTopic = async () => {
    if (!selectedTopic || !currentUserId || !token) return;
    setIsExpanding(true);
    try {
      const response = await fetch(`${API_URL}/generator/expand-topic`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ topic: selectedTopic, user_id: currentUserId }) });
      if (response.ok) {
        const data = await response.json();
        const { nodes: newNodes, edges: newEdges } = transformBranchedGraph(data.graph_data);
        const styledNodes = newNodes.map(node => {
          const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === node.data.label.toLowerCase());
          if (matchedTopic && completedTopicIds.includes(matchedTopic.topic_id)) {
            return { ...node, style: { backgroundColor: '#064e3b', border: '2px solid #34d399', color: '#a7f3d0', fontWeight: 'bold', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)' } };
          }
          return { ...node, style: { backgroundColor: '#1e293b', border: '2px solid #475569', color: '#f8fafc' } };
        });
        setNodes(styledNodes); setEdges(newEdges); await fetchAllTopics();
      }
    } catch (err: any) { console.error(err); } finally { setIsExpanding(false); }
  };

  const handleMarkAsKnown = async () => {
    if (!selectedTopicId || !currentUserId || !token) return;
    setIsMarkingKnown(true);
    try {
      const response = await fetch(`${API_URL}/users/${currentUserId}/known-topics`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ topic_id: selectedTopicId }) });
      if (response.ok) await handleGeneratePath();
    } catch (err) { console.error(err); } finally { setIsMarkingKnown(false); }
  };

  const onNodeClick: NodeMouseHandler = useCallback(async (event, node) => {
    const clickedName = node.data.label;
    setSelectedTopic(clickedName); setResources([]); setProjects([]);
    const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === clickedName.toLowerCase());
    if (matchedTopic && token) {
      setSelectedTopicId(matchedTopic.topic_id);
      setIsLoadingData(true);
      try {
        const [resResponse, projResponse] = await Promise.all([
          fetch(`${API_URL}/topics/${matchedTopic.topic_id}/resources`, { headers: getHeaders() }),
          fetch(`${API_URL}/topics/${matchedTopic.topic_id}/projects`, { headers: getHeaders() })
        ]);
        if (resResponse.ok) setResources(await resResponse.json());
        if (projResponse.ok) setProjects(await projResponse.json());
      } catch (err) { console.error(err); } finally { setIsLoadingData(false); }
    } else { setSelectedTopicId(null); }
  }, [allTopics, token, getHeaders]);

  // Base background style used across screens
  const darkRadialBg = "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-700 via-[#1a1c23] to-[#0f1115]";

  // --- Auth Loading Wall ---
  if (status === "loading") {
    return <div className={`flex items-center justify-center h-screen ${darkRadialBg} text-slate-300 font-mono tracking-widest uppercase`}>Calibrating UI...</div>;
  }

  // --- Glass & Skeuomorphic Auth Wall ---
  if (status === "unauthenticated") {
    return (
      <div className={`flex flex-col items-center justify-center h-screen ${darkRadialBg} p-4`}>
        <form onSubmit={handleLoginSubmit} className="bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] max-w-sm w-full relative">
          
          <div className="absolute top-4 left-4 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5),0_0_5px_rgba(239,68,68,0.5)]"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5),0_0_5px_rgba(234,179,8,0.5)]"></div>
          </div>

          <h2 className="text-2xl font-bold mt-4 mb-2 text-center text-slate-200 tracking-wider">SYSTEM LOGIN</h2>
          <p className="mb-8 text-xs text-slate-400 text-center font-mono uppercase tracking-widest">Awaiting Operator ID</p>
          
          <div className="mb-6">
            <input 
              type="text" 
              value={loginUsername} 
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="e.g., operator_01" 
              className="w-full p-3 bg-black/60 border-t border-black/80 border-b border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 shadow-[inset_0_3px_6px_rgba(0,0,0,0.8)] text-emerald-400 placeholder-slate-600 text-sm font-mono tracking-wider transition-all"
              required
              disabled={isLoggingIn}
            />
          </div>

          {loginError && <p className="text-red-400 text-xs font-mono mb-4 text-center">{loginError}</p>}

          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3 rounded-xl font-bold text-gray-800 tracking-widest uppercase text-xs transition-all active:translate-y-[4px] bg-gradient-to-b from-[#f0f0f0] to-[#c0c0c0] border border-[#a0a0a0] shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_4px_0_#808080,0_6px_15px_rgba(0,0,0,0.6)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_0_#808080,0_1px_2px_rgba(0,0,0,0.5)] disabled:opacity-50"
          >
            {isLoggingIn ? 'Engaging...' : 'Engage System'}
          </button>
        </form>
      </div>
    );
  }

  // --- Main App Render ---
  return (
    <div className={`flex flex-col h-screen w-full ${darkRadialBg} text-slate-200 overflow-hidden`}>
      
      {/* HEADER: Glassmorphic Panel */}
      <div className="p-4 bg-white/5 backdrop-blur-xl border-b border-white/10 z-30 flex gap-4 items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-4 flex-grow">
          <h1 className="font-bold text-xl mr-4 whitespace-nowrap tracking-wider text-slate-100 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8),inset_0_1px_2px_rgba(255,255,255,0.8)]"></div>
            A.I. MATRIX
          </h1>
          
          <form onSubmit={handleGeneratePath} className="flex gap-4 w-full max-w-2xl items-center">
            {/* Skeuomorphic Recessed Input */}
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Enter target coordinates (e.g. Python)..." 
              className="flex-grow p-2.5 bg-black/50 border-t border-black/80 border-b border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] text-emerald-100 placeholder-slate-600 font-mono text-sm transition-all" 
            />
            
            {/* Retro Mechanical Button */}
            <button 
              type="submit" 
              disabled={isLoading || !currentUserId} 
              className="px-6 py-2.5 rounded-lg font-bold text-gray-800 tracking-wider uppercase text-xs transition-all active:translate-y-[4px] bg-gradient-to-b from-[#f0f0f0] to-[#c0c0c0] border border-[#a0a0a0] shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_4px_0_#808080,0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_0_#808080,0_1px_2px_rgba(0,0,0,0.5)] disabled:opacity-50"
            >
              {isLoading ? 'Scanning...' : 'Transmit'}
            </button>
          </form>

          {error && <span className="text-red-400 font-mono text-xs uppercase ml-4">{error}</span>}
        </div>
        
        {/* User Menu */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 font-mono uppercase tracking-widest">OP: {session?.user?.name}</span>
          <button 
            onClick={() => signOut()} 
            className="w-8 h-8 rounded-full bg-gradient-to-b from-red-400 to-red-600 border border-red-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_3px_0_#7f1d1d,0_4px_5px_rgba(0,0,0,0.5)] active:translate-y-[3px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_0_#7f1d1d,0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all"
            title="Eject"
          >
            <span className="block w-3 h-3 border-2 border-white rounded-full"></span>
          </button>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden relative">
        {/* GRAPH AREA */}
        <div className="flex-grow h-full relative z-0">
          {nodes.length === 0 && !isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono uppercase tracking-widest pointer-events-none z-10">
              Awaiting transmission...
            </div>
          )}
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} fitView>
            <Background color="#334155" gap={20} size={2} />
            <Controls className="bg-slate-800 border-slate-600 fill-slate-200 shadow-lg" />
            <MiniMap nodeStrokeWidth={3} zoomable pannable className="bg-slate-900 border border-slate-700" maskColor="rgba(15, 23, 42, 0.7)" />
          </ReactFlow>
        </div>

        {/* SIDE PANEL: Glassmorphic with Recessed Modules */}
        <div className="w-1/3 bg-black/30 backdrop-blur-2xl border-l border-white/10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] overflow-y-auto flex flex-col z-20">
          
          <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold tracking-widest uppercase text-slate-200">Telemetry</h2>
              <span className="text-[10px] bg-black/50 text-emerald-400 px-2 py-1 rounded border border-emerald-900 font-mono shadow-inner">ID: {currentUserId}</span>
            </div>
            
            {nodes.length > 0 && (
              <div className="bg-black/40 p-4 rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-white/5">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sector Progress</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">{progressStats.percent}%</span>
                </div>
                {/* Glowing LED Progress Bar inside Recessed Track */}
                <div className="w-full bg-black/80 rounded-full h-3.5 mb-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-white/5 p-0.5">
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500 ease-in-out shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{ width: `${progressStats.percent}%` }}></div>
                </div>
                <span className="text-[10px] text-slate-500 font-mono uppercase">{progressStats.completed} / {progressStats.total} modules synced</span>
              </div>
            )}
          </div>
          
          <div className="p-6 flex-grow">
            {selectedTopic ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-2xl font-bold text-emerald-100 mb-6 font-mono border-b border-white/10 pb-2 shadow-[0_1px_0_rgba(0,0,0,0.5)]">{selectedTopic}</h3>
                
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {selectedTopicId && (
                    <button 
                      onClick={handleToggleCompletion}
                      disabled={isTogglingCompletion || !currentUserId}
                      className={`col-span-2 py-3 rounded-lg font-bold tracking-wider uppercase text-xs transition-all active:translate-y-[3px] border ${
                        completedTopicIds.includes(selectedTopicId)
                        ? 'bg-gradient-to-b from-[#10b981] to-[#047857] border-[#064e3b] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_0_#022c22,0_5px_10px_rgba(0,0,0,0.5)] text-white'
                        : 'bg-gradient-to-b from-[#334155] to-[#1e293b] border-[#0f172a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_0_#020617,0_5px_10px_rgba(0,0,0,0.5)] text-emerald-400'
                      } active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_0_#020617,0_1px_2px_rgba(0,0,0,0.5)]`}
                    >
                      {completedTopicIds.includes(selectedTopicId) ? '✓ Node Secured' : 'Lock Node'}
                    </button>
                  )}
                  <button 
                    onClick={handleExpandTopic} disabled={isExpanding || !currentUserId}
                    className="py-2.5 rounded-lg font-bold tracking-wider uppercase text-[10px] transition-all active:translate-y-[3px] bg-gradient-to-b from-[#6366f1] to-[#4338ca] border-[#312e81] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_0_#1e1b4b,0_5px_10px_rgba(0,0,0,0.5)] text-white active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_0_#1e1b4b,0_1px_2px_rgba(0,0,0,0.5)]"
                  >
                    {isExpanding ? 'Routing...' : 'Deep Scan'}
                  </button>
                  <button 
                    onClick={handleMarkAsKnown} disabled={isMarkingKnown || !selectedTopicId || !currentUserId}
                    className="py-2.5 rounded-lg font-bold tracking-wider uppercase text-[10px] transition-all active:translate-y-[3px] bg-gradient-to-b from-[#475569] to-[#334155] border-[#1e293b] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_0_#0f172a,0_5px_10px_rgba(0,0,0,0.5)] text-slate-300 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_0_#0f172a,0_1px_2px_rgba(0,0,0,0.5)]"
                  >
                    {isMarkingKnown ? 'Purging...' : 'Purge Node'}
                  </button>
                </div>
                
                {isLoadingData ? (
                  <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div></div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b]"></span> Objectives</h4>
                      {projects.length > 0 ? (
                        <div className="space-y-4">
                          {projects.map((proj) => (
                            <div key={proj.id} className="p-4 rounded-xl border border-white/5 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_6px_rgba(0,0,0,0.3)] hover:border-amber-500/30 transition-colors">
                              <h5 className="font-bold text-amber-400 text-sm mb-2">{proj.title}</h5>
                              {proj.description && <p className="text-xs text-slate-300 leading-relaxed opacity-80">{proj.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (<p className="text-xs text-slate-600 font-mono italic">No objectives assigned.</p>)}
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></span> Data Logs</h4>
                      {resources.length > 0 ? (
                        <div className="space-y-3">
                          {resources.map((res) => (
                            <a key={res.id} href={res.url} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-xl border border-white/5 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:border-blue-400/50 transition-all group">
                              <h5 className="font-medium text-slate-200 text-sm group-hover:text-blue-400 transition-colors">{res.title}</h5>
                            </a>
                          ))}
                        </div>
                      ) : (<p className="text-xs text-slate-600 font-mono italic">No data logs found.</p>)}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center mt-10">
                <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center mb-6 shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)] border border-white/5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"></div>
                </div>
                <p className="text-slate-500 font-mono text-xs tracking-widest uppercase">Select Node for Analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}