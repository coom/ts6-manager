import { useCallback, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useBot, useUpdateBot } from '@/hooks/use-bots';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Save, HelpCircle, Zap, MessageSquare, Ban, UserX, ArrowRightLeft,
  Clock, GitBranch, Variable, FileText, Webhook, Terminal, Plus, Trash2,
  Bell, PenLine, FolderPlus, FolderMinus, Users, Globe, Send,
  Moon, Timer, Megaphone, Award,
  Music, Volume2, LogIn, LogOut, Pause, SkipForward, Navigation, Mic, Sparkles,
  MessagesSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PlaceholderReference } from '@/components/bots/PlaceholderReference';
import { Textarea } from '@/components/ui/textarea';

// --- Node type definitions ---
type HandleConfig = {
  inputs: string[];   // named input ports
  outputs: string[];  // named output ports
};

interface NodeTypeDef {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  handles: HandleConfig;
}

const TRIGGER_NODES: NodeTypeDef[] = [
  { type: 'trigger_event', label: 'TS Event', icon: Zap, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_cron', label: 'Cron Timer', icon: Clock, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_webhook', label: 'Webhook', icon: Webhook, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_command', label: 'Chat Command', icon: Terminal, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_discordMessage', label: 'Discord Message', icon: MessagesSquare, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', handles: { inputs: [], outputs: ['out'] } },
];

const DISCORD_NODES: NodeTypeDef[] = [
  { type: 'action_discordSend', label: 'Discord Send', icon: MessagesSquare, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const ACTION_NODES: NodeTypeDef[] = [
  { type: 'action_message', label: 'Send Message', icon: MessageSquare, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_poke', label: 'Poke Client', icon: Bell, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_kick', label: 'Kick Client', icon: UserX, color: 'bg-red-500/20 text-red-400 border-red-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_ban', label: 'Ban Client', icon: Ban, color: 'bg-red-500/20 text-red-400 border-red-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_move', label: 'Move Client', icon: ArrowRightLeft, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_channelCreate', label: 'Create Channel', icon: FolderPlus, color: 'bg-green-500/20 text-green-400 border-green-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_channelEdit', label: 'Edit Channel', icon: PenLine, color: 'bg-green-500/20 text-green-400 border-green-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_channelDelete', label: 'Delete Channel', icon: FolderMinus, color: 'bg-red-500/20 text-red-400 border-red-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_groupAdd', label: 'Add to Group', icon: Users, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_groupRemove', label: 'Remove from Group', icon: Users, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_webquery', label: 'WebQuery', icon: Terminal, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_webhook', label: 'Webhook', icon: Send, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_httpRequest', label: 'HTTP Request', icon: Globe, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const VOICE_ACTION_NODES: NodeTypeDef[] = [
  { type: 'action_voicePlay', label: 'Voice Play', icon: Music, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceStop', label: 'Voice Stop', icon: Music, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceJoinChannel', label: 'Voice Join', icon: LogIn, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceLeaveChannel', label: 'Voice Leave', icon: LogOut, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceVolume', label: 'Voice Volume', icon: Volume2, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voicePauseResume', label: 'Voice Pause/Resume', icon: Pause, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceSkip', label: 'Voice Skip', icon: SkipForward, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceSeek', label: 'Voice Seek', icon: Navigation, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceTts', label: 'Voice TTS', icon: Mic, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const SMART_ACTION_NODES: NodeTypeDef[] = [
  { type: 'action_afkMover', label: 'AFK Mover', icon: Moon, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_idleKicker', label: 'Idle Kicker', icon: Timer, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_pokeGroup', label: 'Poke Group', icon: Megaphone, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_rankCheck', label: 'Rank Check', icon: Award, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_tempChannelCleanup', label: 'Temp Cleanup', icon: Trash2, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_animatedChannel', label: 'Animated Channel', icon: Sparkles, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: [], outputs: [] } },
];

const LOGIC_NODES: NodeTypeDef[] = [
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', handles: { inputs: ['in'], outputs: ['true', 'false'] } },
  { type: 'delay', label: 'Delay', icon: Clock, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'variable', label: 'Set Variable', icon: Variable, color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'log', label: 'Log', icon: FileText, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_generateCode', label: 'Generate Code', icon: Sparkles, color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const ALL_NODE_TYPES: NodeTypeDef[] = [...TRIGGER_NODES, ...ACTION_NODES, ...DISCORD_NODES, ...VOICE_ACTION_NODES, ...SMART_ACTION_NODES, ...LOGIC_NODES];

const NODE_CATEGORIES = [
  { label: 'Triggers', nodes: TRIGGER_NODES },
  { label: 'Actions', nodes: ACTION_NODES },
  { label: 'Discord', nodes: DISCORD_NODES },
  { label: 'Voice', nodes: VOICE_ACTION_NODES },
  { label: 'Smart Actions', nodes: SMART_ACTION_NODES },
  { label: 'Logic', nodes: LOGIC_NODES },
];

function getNodeMeta(type: string): NodeTypeDef | undefined {
  return ALL_NODE_TYPES.find((n) => n.type === type);
}

// --- Constants ---
const NODE_W = 180;
const NODE_H = 64;
const HANDLE_R = 6;

// Calculate handle positions (absolute coords on canvas)
function getOutputHandlePos(node: FlowNode, portIndex: number, portCount: number) {
  const spacing = NODE_H / (portCount + 1);
  return { x: node.x + NODE_W, y: node.y + spacing * (portIndex + 1) };
}

function getInputHandlePos(node: FlowNode, portIndex: number, portCount: number) {
  const spacing = NODE_H / (portCount + 1);
  return { x: node.x, y: node.y + spacing * (portIndex + 1) };
}

// --- Types ---
interface FlowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, any>;
  x: number;
  y: number;
}

interface FlowEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export default function BotEditor() {
  const { t } = useTranslation();
  const { botId } = useParams();
  const navigate = useNavigate();
  const { data: bot, isLoading } = useBot(botId ? parseInt(botId) : null);
  const updateBot = useUpdateBot();

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [botName, setBotName] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // Connection state
  const [connectFrom, setConnectFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Load flow data when the bot arrives/changes (adjust state during render,
  // guarded by the loaded object's identity — no setState-in-effect).
  const [seededBot, setSeededBot] = useState<typeof bot | undefined>(undefined);
  if (bot && bot !== seededBot) {
    setSeededBot(bot);
    setBotName(bot.name || '');
    try {
      const flow = typeof bot.flowData === 'string' ? JSON.parse(bot.flowData) : bot.flowData;
      const loadedNodes: FlowNode[] = flow?.nodes || [];
      const loadedEdges: FlowEdge[] = (flow?.edges || []).map((e: any) => ({
        ...e,
        sourcePort: e.sourcePort || 'out',
        targetPort: e.targetPort || 'in',
      }));
      setNodes(loadedNodes);
      setEdges(loadedEdges);
    } catch {
      setNodes([]);
      setEdges([]);
    }
  }

  const handleSave = () => {
    if (!botId) return;
    updateBot.mutate({
      id: parseInt(botId),
      data: { name: botName, flowData: { nodes, edges } },
    }, {
      onSuccess: () => toast.success(t('botEditor.flowSaved')),
      onError: () => toast.error(t('botEditor.flowSaveFailed')),
    });
  };

  const addNode = (type: string, label: string) => {
    const id = `node_${crypto.randomUUID()}`;
    setNodes((prev) => [...prev, { id, type, label, config: {}, x: 220 + Math.random() * 200, y: 80 + prev.length * 90 }]);
    setSelectedNode(id);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedNode === id) setSelectedNode(null);
  };

  const deleteEdge = (id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
  };

  // --- Canvas mouse handlers ---
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;

    if (connectFrom) {
      setMousePos({ x, y });
    }

    if (dragging) {
      didDragRef.current = true;
      setNodes((prev) => prev.map((n) =>
        n.id === dragging
          ? { ...n, x: Math.max(0, x - dragOffsetRef.current.x), y: Math.max(0, y - dragOffsetRef.current.y) }
          : n
      ));
    }
  }, [dragging, connectFrom]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    setDragging(null);

    // If connecting: check if we released on a valid target
    if (connectFrom) {
      const target = (e.target as HTMLElement).closest('[data-input-port]') as HTMLElement | null;
      const targetNode = (e.target as HTMLElement).closest('.flow-node') as HTMLElement | null;

      if (target) {
        // Released on an input handle
        const nodeId = target.getAttribute('data-node-id')!;
        const port = target.getAttribute('data-input-port')!;
        if (connectFrom.nodeId !== nodeId) {
          const exists = edges.some((ed) => ed.source === connectFrom.nodeId && ed.sourcePort === connectFrom.port && ed.target === nodeId);
          if (!exists) {
            setEdges((prev) => [...prev, {
              id: `edge_${Date.now()}`,
              source: connectFrom.nodeId,
              sourcePort: connectFrom.port,
              target: nodeId,
              targetPort: port,
            }]);
          }
        }
        setConnectFrom(null);
      } else if (targetNode) {
        // Released on a node body — connect to first input if available
        const nodeId = targetNode.getAttribute('data-node-id');
        if (nodeId && connectFrom.nodeId !== nodeId) {
          const targetMeta = getNodeMeta(nodes.find((n) => n.id === nodeId)?.type || '');
          if (targetMeta && targetMeta.handles.inputs.length > 0) {
            const targetPort = targetMeta.handles.inputs[0];
            const exists = edges.some((ed) => ed.source === connectFrom.nodeId && ed.sourcePort === connectFrom.port && ed.target === nodeId);
            if (!exists) {
              setEdges((prev) => [...prev, {
                id: `edge_${Date.now()}`,
                source: connectFrom.nodeId,
                sourcePort: connectFrom.port,
                target: nodeId,
                targetPort,
              }]);
            }
          }
        }
        setConnectFrom(null);
      } else {
        // Released on empty canvas — cancel
        setConnectFrom(null);
      }
    }
  }, [connectFrom, nodes, edges]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if we clicked directly on the canvas (not on a node)
    if ((e.target as HTMLElement).closest('.flow-node')) return;
    setSelectedNode(null);
    setConnectFrom(null); // Cancel active connection on empty canvas click
  }, []);

  // --- Node mouse handlers ---
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectFrom) return; // Don't start drag while connecting

    const canvas = (e.currentTarget as HTMLElement).closest('.flow-canvas')!;
    const rect = canvas.getBoundingClientRect();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const mx = e.clientX - rect.left + canvas.scrollLeft;
    const my = e.clientY - rect.top + canvas.scrollTop;

    dragOffsetRef.current = { x: mx - node.x, y: my - node.y };
    didDragRef.current = false;
    setDragging(nodeId);
  }, [nodes, connectFrom]);

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    // If connecting, complete the connection to this node's input
    if (connectFrom) {
      const targetMeta = getNodeMeta(nodes.find((n) => n.id === nodeId)?.type || '');
      if (connectFrom.nodeId !== nodeId && targetMeta && targetMeta.handles.inputs.length > 0) {
        const targetPort = targetMeta.handles.inputs[0];
        // Don't allow duplicate edges
        const exists = edges.some((e) => e.source === connectFrom.nodeId && e.sourcePort === connectFrom.port && e.target === nodeId);
        if (!exists) {
          setEdges((prev) => [...prev, {
            id: `edge_${Date.now()}`,
            source: connectFrom.nodeId,
            sourcePort: connectFrom.port,
            target: nodeId,
            targetPort,
          }]);
        }
      }
      setConnectFrom(null);
      return;
    }

    // Select (only if not finishing a drag)
    if (!didDragRef.current) {
      setSelectedNode(nodeId);
    }
  }, [connectFrom, nodes, edges]);

  // --- Output handle click: start connection ---
  const handleOutputClick = useCallback((e: React.MouseEvent, nodeId: string, port: string) => {
    e.stopPropagation();
    e.preventDefault();
    const canvas = (e.currentTarget as HTMLElement).closest('.flow-canvas')!;
    const rect = canvas.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left + canvas.scrollLeft,
      y: e.clientY - rect.top + canvas.scrollTop,
    });
    setConnectFrom({ nodeId, port });
  }, []);

  // --- Input handle click: complete connection ---
  const handleInputClick = useCallback((e: React.MouseEvent, nodeId: string, port: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (connectFrom && connectFrom.nodeId !== nodeId) {
      const exists = edges.some((ed) => ed.source === connectFrom.nodeId && ed.sourcePort === connectFrom.port && ed.target === nodeId);
      if (!exists) {
        setEdges((prev) => [...prev, {
          id: `edge_${Date.now()}`,
          source: connectFrom.nodeId,
          sourcePort: connectFrom.port,
          target: nodeId,
          targetPort: port,
        }]);
      }
      setConnectFrom(null);
    }
  }, [connectFrom, edges]);

  const selectedNodeData = useMemo(() => nodes.find((n) => n.id === selectedNode), [nodes, selectedNode]);
  const nodeTypeMeta = useMemo(() => getNodeMeta(selectedNodeData?.type || ''), [selectedNodeData]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/bots')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input value={botName} onChange={(e) => setBotName(e.target.value)} className="h-8 w-60 text-sm font-medium" />
          <Badge variant="outline" className="text-[10px]">{t('botEditor.nodesCount', { count: nodes.length })}</Badge>
          <Badge variant="outline" className="text-[10px]">{t('botEditor.edgesCount', { count: edges.length })}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHelp(true)} title={t('botEditor.placeholderReference')}>
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleSave} disabled={updateBot.isPending}>
            <Save className="h-4 w-4 mr-1" /> {t('botEditor.save')}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border border-border">
        {/* Node Palette */}
        <div className="w-52 border-r border-border bg-card/50 shrink-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              {NODE_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">{t(`botEditor.category.${cat.label}`, { defaultValue: cat.label })}</p>
                  <div className="space-y-1">
                    {cat.nodes.map((node) => (
                      <button
                        key={node.type}
                        className={cn('w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border transition-colors hover:opacity-80', node.color)}
                        onClick={() => addNode(node.type, node.label)}
                      >
                        <node.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{t(`botEditor.node.${node.type}`, { defaultValue: node.label })}</span>
                        <Plus className="h-3 w-3 ml-auto opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 relative bg-zinc-950/30 overflow-auto flow-canvas"
          style={{
            cursor: connectFrom ? 'crosshair' : 'default',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={handleCanvasClick}
        >
          <svg className="absolute inset-0 pointer-events-none" style={{ minWidth: 2000, minHeight: 1200, width: '100%', height: '100%' }}>
            {/* Edges */}
            {edges.map((edge) => {
              const srcNode = nodes.find((n) => n.id === edge.source);
              const tgtNode = nodes.find((n) => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              const srcMeta = getNodeMeta(srcNode.type);
              const tgtMeta = getNodeMeta(tgtNode.type);
              if (!srcMeta || !tgtMeta) return null;

              const srcPortIdx = srcMeta.handles.outputs.indexOf(edge.sourcePort);
              const tgtPortIdx = tgtMeta.handles.inputs.indexOf(edge.targetPort);
              if (srcPortIdx < 0 || tgtPortIdx < 0) return null;

              const src = getOutputHandlePos(srcNode, srcPortIdx, srcMeta.handles.outputs.length);
              const tgt = getInputHandlePos(tgtNode, tgtPortIdx, tgtMeta.handles.inputs.length);

              const dx = Math.abs(tgt.x - src.x) * 0.5;
              const isConditionTrue = edge.sourcePort === 'true';
              const isConditionFalse = edge.sourcePort === 'false';

              return (
                <g key={edge.id} className="pointer-events-auto cursor-pointer" onClick={(ev) => { ev.stopPropagation(); deleteEdge(edge.id); }}>
                  <path
                    d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                    fill="none"
                    stroke={isConditionTrue ? '#22c55e' : isConditionFalse ? '#ef4444' : 'hsl(var(--primary))'}
                    strokeWidth={2}
                    strokeOpacity={0.5}
                  />
                  {/* Invisible wider path for easier click */}
                  <path
                    d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                  />
                  {/* Arrow at target */}
                  <circle cx={tgt.x} cy={tgt.y} r={3}
                    fill={isConditionTrue ? '#22c55e' : isConditionFalse ? '#ef4444' : 'hsl(var(--primary))'}
                    fillOpacity={0.8}
                  />
                </g>
              );
            })}

            {/* Connection drag preview */}
            {connectFrom && (() => {
              const srcNode = nodes.find((n) => n.id === connectFrom.nodeId);
              const srcMeta = srcNode ? getNodeMeta(srcNode.type) : null;
              if (!srcNode || !srcMeta) return null;
              const idx = srcMeta.handles.outputs.indexOf(connectFrom.port);
              if (idx < 0) return null;
              const src = getOutputHandlePos(srcNode, idx, srcMeta.handles.outputs.length);
              const dx = Math.abs(mousePos.x - src.x) * 0.4;
              return (
                <path
                  d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${mousePos.x - dx} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeOpacity={0.7}
                />
              );
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const meta = getNodeMeta(node.type);
            if (!meta) return null;
            const Icon = meta.icon;
            const hasInputs = meta.handles.inputs.length > 0;
            const outputs = meta.handles.outputs;

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className={cn(
                  'flow-node absolute rounded-lg border bg-card/95 backdrop-blur-sm shadow-sm select-none transition-shadow',
                  selectedNode === node.id ? 'border-primary ring-1 ring-primary/30 shadow-md' : 'border-border hover:border-muted-foreground/30',
                  dragging === node.id ? 'cursor-grabbing shadow-lg z-20' : 'cursor-grab z-10',
                )}
                style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
              >
                {/* Header */}
                <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b border-border', meta.color)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium truncate">{node.label}</span>
                </div>
                {/* Body */}
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-muted-foreground truncate">{node.type.replace(/_/g, ' ')}</p>
                </div>

                {/* Input handle(s) - left side */}
                {hasInputs && meta.handles.inputs.map((port, i) => {
                  const pos = getInputHandlePos(node, i, meta.handles.inputs.length);
                  return (
                    <div
                      key={`in-${port}`}
                      data-input-port={port}
                      data-node-id={node.id}
                      className={cn(
                        'absolute rounded-full border-2 border-card transition-colors z-30',
                        connectFrom ? 'bg-primary hover:bg-primary scale-125' : 'bg-muted-foreground/50 hover:bg-primary',
                      )}
                      style={{
                        left: -HANDLE_R,
                        top: (pos.y - node.y) - HANDLE_R,
                        width: HANDLE_R * 2,
                        height: HANDLE_R * 2,
                      }}
                      onClick={(e) => handleInputClick(e, node.id, port)}
                      title={`Input: ${port}`}
                    />
                  );
                })}

                {/* Output handle(s) - right side */}
                {outputs.map((port, i) => {
                  const pos = getOutputHandlePos(node, i, outputs.length);
                  const isTrue = port === 'true';
                  const isFalse = port === 'false';
                  return (
                    <div
                      key={`out-${port}`}
                      className="absolute z-30 flex items-center gap-1"
                      style={{
                        left: NODE_W - HANDLE_R,
                        top: (pos.y - node.y) - HANDLE_R,
                      }}
                    >
                      <div
                        className={cn(
                          'rounded-full border-2 border-card cursor-crosshair transition-colors',
                          isTrue ? 'bg-green-500 hover:bg-green-400' :
                          isFalse ? 'bg-red-500 hover:bg-red-400' :
                          'bg-primary/60 hover:bg-primary',
                        )}
                        style={{ width: HANDLE_R * 2, height: HANDLE_R * 2 }}
                        onMouseDown={(e) => handleOutputClick(e, node.id, port)}
                        title={`Output: ${port}`}
                      />
                      {outputs.length > 1 && (
                        <span className={cn(
                          'text-[8px] font-mono-data ml-1 select-none pointer-events-none',
                          isTrue ? 'text-green-400' : isFalse ? 'text-red-400' : 'text-muted-foreground',
                        )}>
                          {port}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Connection hint */}
          {connectFrom && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary/20 border border-primary/30 text-primary text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              {t('botEditor.connectHint')}
            </div>
          )}
        </div>

        {/* Properties Panel */}
        {selectedNodeData && (
          <div className="w-64 border-l border-border bg-card/50 shrink-0">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{t('botEditor.nodeProperties')}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteNode(selectedNodeData.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.label')}</Label>
                  <Input
                    className="h-7 text-xs mt-1"
                    value={selectedNodeData.label}
                    onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, label: e.target.value } : n))}
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.type')}</Label>
                  <div className={cn('mt-1 text-xs px-2 py-1 rounded border', nodeTypeMeta?.color || 'bg-muted/30')}>
                    {selectedNodeData.type.replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Ports info */}
                {nodeTypeMeta && (
                  <div className="flex gap-2 text-[10px]">
                    {nodeTypeMeta.handles.inputs.length > 0 && (
                      <Badge variant="secondary" className="text-[9px]">{t('botEditor.portsIn', { ports: nodeTypeMeta.handles.inputs.join(', ') })}</Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px]">{t('botEditor.portsOut', { ports: nodeTypeMeta.handles.outputs.join(', ') })}</Badge>
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-2">{t('botEditor.configuration')}</p>

                  {selectedNodeData.type === 'trigger_event' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.eventName')}</Label>
                      <Select
                        value={selectedNodeData.config.eventName || ''}
                        onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, eventName: v } } : n))}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder={t('botEditor.placeholder.selectEvent')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="notifycliententerview">{t('botEditor.event.clientEnter')}</SelectItem>
                          <SelectItem value="notifyclientleftview">{t('botEditor.event.clientLeave')}</SelectItem>
                          <SelectItem value="notifytextmessage">{t('botEditor.event.textMessage')}</SelectItem>
                          <SelectItem value="notifyclientmoved">{t('botEditor.event.clientMoved')}</SelectItem>
                          <SelectItem value="notifyserveredited">{t('botEditor.event.serverEdited')}</SelectItem>
                          <SelectItem value="notifychanneldescriptionchanged">{t('botEditor.event.channelDescChanged')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedNodeData.type === 'trigger_cron' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.cronExpression')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="*/5 * * * *"
                          value={selectedNodeData.config.cron || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, cron: e.target.value } } : n))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.timezone')}</Label>
                        <Select
                          value={selectedNodeData.config.timezone || 'UTC'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, timezone: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                            <SelectItem value="Europe/London">Europe/London</SelectItem>
                            <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                            <SelectItem value="Europe/Moscow">Europe/Moscow</SelectItem>
                            <SelectItem value="America/New_York">America/New_York</SelectItem>
                            <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                            <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                            <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'trigger_webhook' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.webhookPath')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="my-hook"
                          value={selectedNodeData.config.path || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, path: e.target.value } } : n))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.httpMethod')}</Label>
                        <Select
                          value={selectedNodeData.config.method || 'POST'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, method: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="GET">GET</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.secretOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('botEditor.placeholder.noAuth')}
                          type="password"
                          value={selectedNodeData.config.secret || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, secret: e.target.value } } : n))}
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{t('botEditor.help.webhookSecret')}</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'trigger_command' && (
                  <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.command')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="!help"
                          value={selectedNodeData.config.command || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, command: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.listenChannelId')}</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="42"
                          value={selectedNodeData.config.channelId || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, channelId: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('botEditor.help.listenChannel')}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'trigger_discordMessage' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.discordChannelId')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('botEditor.placeholder.discordChannelId')}
                          value={selectedNodeData.config.channelId || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">{t('botEditor.help.discordChannelTrigger')}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.prefixOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('botEditor.placeholder.prefixFire')}
                          value={selectedNodeData.config.prefix || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, prefix: e.target.value } } : n))}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{t('botEditor.help.discordVariables')} {'{{discord_content}}'}, {'{{discord_author}}'}, {'{{discord_author_id}}'}, {'{{discord_channel_id}}'}.</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_discordSend' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.discordChannelId')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('botEditor.placeholder.discordChannelIdOrVar')}
                          value={selectedNodeData.config.channelId || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.message')}</Label>
                        <Textarea
                          className="min-h-[100px] text-xs mt-1 resize-y font-mono-data"
                          placeholder={t('botEditor.placeholder.messageToSend')}
                          value={selectedNodeData.config.message || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))}
                        />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_message' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.targetMode')}</Label>
                        <Select
                          value={selectedNodeData.config.targetMode || 'client'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, targetMode: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">{t('botEditor.targetMode.client')}</SelectItem>
                            <SelectItem value="channel">{t('botEditor.targetMode.channel')}</SelectItem>
                            <SelectItem value="server">{t('botEditor.targetMode.server')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedNodeData.config.targetMode !== 'server' && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">
                            {selectedNodeData.config.targetMode === 'channel' ? t('botEditor.field.channelId') : t('botEditor.field.clientId')}
                          </Label>
                          <Input
                            className="h-7 text-xs mt-1 font-mono-data"
                            placeholder={selectedNodeData.config.targetMode === 'channel' ? t('botEditor.placeholder.channelIdOrCtid') : t('botEditor.placeholder.clientIdOrClid')}
                            value={selectedNodeData.config.target || ''}
                            onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, target: e.target.value } } : n))}
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.message')}</Label>
                        <Textarea
                          className="min-h-[120px] text-xs mt-1 resize-y font-mono-data"
                          placeholder={t('botEditor.placeholder.helpListExample')}
                          value={selectedNodeData.config.message || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, message: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('botEditor.help.lineBreaks')}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_kick' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.kickFrom')}</Label>
                        <Select
                          value={selectedNodeData.config.reasonid || '5'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reasonid: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">{t('botEditor.kickFrom.channel')}</SelectItem>
                            <SelectItem value="5">{t('botEditor.kickFrom.server')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.reason')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('botEditor.placeholder.kickedByBot')} value={selectedNodeData.config.reason || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reason: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_ban' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.banDuration')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="3600" value={selectedNodeData.config.time || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, time: parseInt(e.target.value) || 0 } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.reason')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('botEditor.placeholder.bannedByBot')} value={selectedNodeData.config.reason || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reason: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_move' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.targetChannelIdOrTemplate')}</Label>
                      <Input
                        className="h-7 text-xs mt-1 font-mono-data"
                        placeholder="94  or  {{temp.lastCreatedChannelId}}"
                        value={selectedNodeData.config.cid ?? ''}
                        onChange={(e) =>
                          setNodes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNode
                                ? { ...n, config: { ...n.config, cid: e.target.value } }
                                : n
                            )
                          )
                        }
                      />
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                        {t('botEditor.help.example')} 94 or {"{{temp.lastCreatedChannelId}}"}
                      </p>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_poke' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.message')}</Label>
                      <Input className="h-7 text-xs mt-1" placeholder="Hey {{event.client_nickname}}!" value={selectedNodeData.config.message || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_channelCreate' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelName')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder="[cspacer]Info" value={selectedNodeData.config.channel_name || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_name: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.parentChannelId')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="0" value={selectedNodeData.config.cpid || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, cpid: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelPasswordOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="secret or {{temp.channelPassword}}"
                          value={selectedNodeData.config.channel_password || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, channel_password: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.temporary')}</Label>
                        <Select value={selectedNodeData.config.channel_flag_temporary || '0'} onValueChange={(v) => setNodes((prev) => prev.map((n) => { if (n.id !== selectedNode) return n; const cfg: any = { ...n.config }; if (v === '1') { cfg.channel_flag_temporary = '1'; delete cfg.channel_flag_semi_permanent; } else { cfg.channel_flag_temporary = '0'; delete cfg.channel_flag_semi_permanent; } return { ...n, config: cfg }; }) ) }>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t('botEditor.option.permanent')}</SelectItem>
                            <SelectItem value="1">{t('botEditor.option.temporary')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_channelEdit' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="42" value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelName')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder="[cspacer]{{time.time}}" value={selectedNodeData.config.channel_name || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_name: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelTopic')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('botEditor.placeholder.optional')} value={selectedNodeData.config.channel_topic || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_topic: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelDescription')}</Label>
                        <Textarea className="text-xs mt-1 min-h-[60px] font-mono-data" placeholder="{{temp.apiResult}}" value={selectedNodeData.config.channel_description || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_description: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelPasswordOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="secret or {{temp.channelPassword}}"
                          value={selectedNodeData.config.channel_password || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, channel_password: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('botEditor.help.leaveEmptyUnchanged')}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_channelDelete' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="42" value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.forceDelete')}</Label>
                        <Select value={selectedNodeData.config.force ? '1' : '0'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, force: v === '1' } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t('botEditor.option.no')}</SelectItem>
                            <SelectItem value="1">{t('botEditor.option.yesDeleteSubChannels')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {(selectedNodeData.type === 'action_groupAdd' || selectedNodeData.type === 'action_groupRemove') && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.serverGroupId')}</Label>
                      <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="6" value={selectedNodeData.config.groupId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, groupId: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_webquery' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.command')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="serverinfo" value={selectedNodeData.config.command || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, command: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.storeAsTemp')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="server" value={selectedNodeData.config.storeAs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, storeAs: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('botEditor.help.accessVia')} {'{{temp.server.virtualserver_name}}'}</p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_webhook' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.url')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="https://example.com/hook" value={selectedNodeData.config.url || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, url: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.method')}</Label>
                        <Select value={selectedNodeData.config.method || 'POST'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, method: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.bodyJson')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder='{"key":"value"}' value={selectedNodeData.config.body || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, body: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.storeAsTemp')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="response" value={selectedNodeData.config.storeAs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, storeAs: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_httpRequest' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.url')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="https://api.example.com/check" value={selectedNodeData.config.url || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, url: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.method')}</Label>
                        <Select value={selectedNodeData.config.method || 'GET'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, method: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.headersJson')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder='{"Authorization":"Bearer xxx"}'
                          value={selectedNodeData.config.headersRaw ?? (selectedNodeData.config.headers ? JSON.stringify(selectedNodeData.config.headers) : '')}
                          onChange={(e) => {
                            const raw = e.target.value;
                            let parsed: Record<string, string> | undefined;
                            try { parsed = JSON.parse(raw); } catch { /* user still typing */ }
                            setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, headersRaw: raw, headers: parsed ?? n.config.headers } } : n));
                          }}
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{t('botEditor.help.headersJson')} {'{{placeholders}}'}.</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.bodyJson')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder='{"ip":"{{event.connection_client_ip}}"}' value={selectedNodeData.config.body || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, body: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.storeAsTemp')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="apiResult" value={selectedNodeData.config.storeAs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, storeAs: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_afkMover' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.afkChannelId')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="10" value={selectedNodeData.config.afkChannelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, afkChannelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.idleThreshold')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="300" value={selectedNodeData.config.idleThresholdSeconds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, idleThresholdSeconds: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.exemptGroupIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="6,7" value={selectedNodeData.config.exemptGroupIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, exemptGroupIds: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_idleKicker' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.idleThreshold')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="1800" value={selectedNodeData.config.idleThresholdSeconds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, idleThresholdSeconds: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.kickReason')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('botEditor.placeholder.idleTimeout')} value={selectedNodeData.config.reason || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reason: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.exemptGroupIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="6,7" value={selectedNodeData.config.exemptGroupIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, exemptGroupIds: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_pokeGroup' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.serverGroupId')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="6" value={selectedNodeData.config.groupId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, groupId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.message')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('botEditor.placeholder.supportNeeded')} value={selectedNodeData.config.message || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_rankCheck' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.ranksJson')}</Label>
                      <Input className="h-7 text-xs mt-1 font-mono-data" placeholder='[{"hours":10,"groupId":"7"},{"hours":50,"groupId":"8"}]' value={selectedNodeData.config.ranks || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, ranks: e.target.value } } : n))} />
                      <p className="text-[9px] text-muted-foreground mt-1">{t('botEditor.help.ranksArray', { vars: '{hours, groupId}' })}</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_tempChannelCleanup' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.parentChannelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="19" value={selectedNodeData.config.parentChannelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, parentChannelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.protectedChannelIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="20,21" value={selectedNodeData.config.protectedChannelIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, protectedChannelIds: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('botEditor.help.protectedChannels')}</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'action_animatedChannel' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="42" value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.displayText')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('botEditor.placeholder.welcomeToMyServer')} value={selectedNodeData.config.text || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, text: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('botEditor.help.supportsTime')} {'{{time.time}}'}, {'{{time.date}}'}, etc.</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.animationStyle')}</Label>
                        <Select value={selectedNodeData.config.style || 'scroll'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, style: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scroll">{t('botEditor.animStyle.scroll')}</SelectItem>
                            <SelectItem value="typewriter">{t('botEditor.animStyle.typewriter')}</SelectItem>
                            <SelectItem value="bounce">{t('botEditor.animStyle.bounce')}</SelectItem>
                            <SelectItem value="blink">{t('botEditor.animStyle.blink')}</SelectItem>
                            <SelectItem value="wave">{t('botEditor.animStyle.wave')}</SelectItem>
                            <SelectItem value="alternateCase">{t('botEditor.animStyle.alternateCase')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.speed')}</Label>
                        <Select value={selectedNodeData.config.intervalSeconds || '3'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, intervalSeconds: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.25">{t('botEditor.speed.insane')}</SelectItem>
                            <SelectItem value="0.5">{t('botEditor.speed.ultra')}</SelectItem>
                            <SelectItem value="1">{t('botEditor.speed.veryFast')}</SelectItem>
                            <SelectItem value="2">{t('botEditor.speed.fast')}</SelectItem>
                            <SelectItem value="3">{t('botEditor.speed.medium')}</SelectItem>
                            <SelectItem value="5">{t('botEditor.speed.slow')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.prefix')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="[cspacer]" value={selectedNodeData.config.prefix ?? '[cspacer]'} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, prefix: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('botEditor.help.channelPrefix')}</p>
                      </div>
                    </div>
                  )}

                  {/* Voice Action Configs */}
                  {selectedNodeData.type === 'action_voicePlay' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1 or {{var.botId}}" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.songId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('botEditor.placeholder.songIdToPlay')} value={selectedNodeData.config.songId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, songId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.playlistId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('botEditor.placeholder.loadPlaylist')} value={selectedNodeData.config.playlistId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, playlistId: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceStop' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                      <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1 or {{var.botId}}" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceJoinChannel' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('botEditor.placeholder.channelIdOrCtid')} value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.channelPasswordOptional')}</Label>
                        <Input className="h-7 text-xs mt-1" type="password" placeholder={t('botEditor.placeholder.optional')} value={selectedNodeData.config.channelPassword || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelPassword: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceLeaveChannel' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                      <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceVolume' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.volume')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="50 or {{event.volume}}" value={selectedNodeData.config.volume || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, volume: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voicePauseResume' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.action')}</Label>
                        <Select value={selectedNodeData.config.action || 'toggle'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, action: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pause">{t('botEditor.pauseAction.pause')}</SelectItem>
                            <SelectItem value="resume">{t('botEditor.pauseAction.resume')}</SelectItem>
                            <SelectItem value="toggle">{t('botEditor.pauseAction.toggle')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceSkip' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.direction')}</Label>
                        <Select value={selectedNodeData.config.direction || 'next'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, direction: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="next">{t('botEditor.direction.next')}</SelectItem>
                            <SelectItem value="previous">{t('botEditor.direction.previous')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceSeek' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.positionSeconds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="30" value={selectedNodeData.config.position || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, position: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceTts' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.text')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder="Hello {{event.client_nickname}}" value={selectedNodeData.config.text || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, text: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.languageOptional')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="en" value={selectedNodeData.config.language || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, language: e.target.value } } : n))} />
                      </div>
                      <p className="text-[9px] text-muted-foreground/60">{t('botEditor.help.ttsNotConfigured')}</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'condition' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.expression')}</Label>
                      <Input
                        className="h-7 text-xs mt-1 font-mono-data"
                        placeholder='event.client_type == 0'
                        value={selectedNodeData.config.expression || ''}
                        onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, expression: e.target.value } } : n))}
                      />
                      <p className="text-[9px] text-muted-foreground mt-1">{t('botEditor.help.conditionOutputs')}</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'delay' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.delayMs')}</Label>
                      <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="5000" value={selectedNodeData.config.delayMs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, delayMs: parseInt(e.target.value) || 0 } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'variable' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.variableName')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="myVar" value={selectedNodeData.config.varName || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, varName: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.valueExpression')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="event.clid" value={selectedNodeData.config.varValue || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, varValue: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_generateCode' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.length')}</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="5"
                          value={selectedNodeData.config.length ?? '5'}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, length: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.storeAs')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="code"
                          value={selectedNodeData.config.storeAs ?? 'code'}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, storeAs: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('botEditor.help.useAs')} {'{{temp.'}{(selectedNodeData.config.storeAs ?? 'code')}{'}}'}
                        </p>
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.characters')}</Label>
                        <Select
                          value={(selectedNodeData.config.numericOnly ?? true) ? 'digits' : 'alnum'}
                          onValueChange={(v) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, numericOnly: v === 'digits' } }
                                  : n
                              )
                            )
                          }
                        >
                          <SelectTrigger className="h-7 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="digits">{t('botEditor.chars.digits')}</SelectItem>
                            <SelectItem value="alnum">{t('botEditor.chars.alnum')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  {selectedNodeData.type === 'log' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.logLevel')}</Label>
                        <Select
                          value={selectedNodeData.config.level || 'info'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, level: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debug">{t('botEditor.logLevel.debug')}</SelectItem>
                            <SelectItem value="info">{t('botEditor.logLevel.info')}</SelectItem>
                            <SelectItem value="warn">{t('botEditor.logLevel.warn')}</SelectItem>
                            <SelectItem value="error">{t('botEditor.logLevel.error')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('botEditor.field.message')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder="Client joined: {{event.client_nickname}}" value={selectedNodeData.config.message || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Connections overview */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">{t('botEditor.connections')}</p>
                  <div className="space-y-1">
                    {edges.filter((e) => e.source === selectedNodeData.id).map((edge) => {
                      const target = nodes.find((n) => n.id === edge.target);
                      return (
                        <div key={edge.id} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">{edge.sourcePort}</span>
                            <span>→</span>
                            <span>{target?.label || '?'}</span>
                          </span>
                          <button onClick={() => deleteEdge(edge.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    {edges.filter((e) => e.target === selectedNodeData.id).map((edge) => {
                      const source = nodes.find((n) => n.id === edge.source);
                      return (
                        <div key={edge.id} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                          <span className="flex items-center gap-1">
                            <span>{source?.label || '?'}</span>
                            <span>→</span>
                            <span className="text-muted-foreground">{edge.targetPort}</span>
                          </span>
                          <button onClick={() => deleteEdge(edge.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    {edges.filter((e) => e.source === selectedNodeData.id || e.target === selectedNodeData.id).length === 0 && (
                      <p className="text-[10px] text-muted-foreground/50">{t('botEditor.noConnections')}</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <PlaceholderReference open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
