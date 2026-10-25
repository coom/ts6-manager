import { useMemo, useState } from 'react';
import { useClients, useKickClient, useBanClient, usePokeClient } from '@/hooks/use-clients';
import { useServerStore } from '@/stores/server.store';
import { useAuthStore } from '@/stores/auth.store';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatUptime } from '@/lib/utils';
import { Users, MoreHorizontal, LogOut, Ban, Zap } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function Clients() {
  const { t } = useTranslation();
  const { selectedConfigId, selectedSid } = useServerStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const { data, isLoading } = useClients();
  const kickClient = useKickClient();
  const banClient = useBanClient();
  const pokeClient = usePokeClient();

  const [pokeTarget, setPokeTarget] = useState<{ clid: number; name: string } | null>(null);
  const [pokeMsg, setPokeMsg] = useState('');

  const clients = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.filter((c: any) => String(c.client_type) === '0');
  }, [data]);

  const columns: ColumnDef<any>[] = useMemo(() => {
    const cols: ColumnDef<any>[] = [
      {
        accessorKey: 'client_nickname',
        header: t('clients.nickname'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-mono-data text-primary">
              {row.original.client_nickname?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="font-medium">{row.original.client_nickname}</span>
          </div>
        ),
      },
      {
        accessorKey: 'client_country',
        header: t('clients.country'),
        cell: ({ getValue }) => <span className="font-mono-data text-xs">{(getValue() as string) || '-'}</span>,
      },
      {
        accessorKey: 'client_idle_time',
        header: t('clients.idle'),
        cell: ({ getValue }) => <span className="font-mono-data text-xs text-muted-foreground">{formatUptime(Math.floor((getValue() as number) / 1000))}</span>,
      },
      {
        accessorKey: 'client_away',
        header: t('clients.status'),
        cell: ({ row }) => {
          // WebQuery returns every field as a string, and "0" is truthy — without
          // Number() every connected client badges as away, permanently. Same
          // coercion Channels.tsx already applies to its flag columns.
          if (Number(row.original.client_away)) return <Badge variant="warning" className="text-[10px]">{t('clients.away')}</Badge>;
          if (Number(row.original.client_input_muted)) return <Badge variant="secondary" className="text-[10px]">{t('clients.muted')}</Badge>;
          return <Badge variant="success" className="text-[10px]">{t('clients.active')}</Badge>;
        },
      },
    ];
    if (isAdmin) {
      cols.push({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setPokeTarget({ clid: c.clid, name: c.client_nickname }); setPokeMsg(''); }}>
                  <Zap className="mr-2 h-4 w-4" /> {t('clients.poke')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  kickClient.mutate({ clid: c.clid, reasonid: 5, reasonmsg: 'Kicked by admin' });
                  toast.success(t('clients.kicked', { name: c.client_nickname }));
                }}>
                  <LogOut className="mr-2 h-4 w-4" /> {t('clients.kickFromServer')}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                  banClient.mutate({ clid: c.clid, time: 3600, banreason: 'Banned by admin' });
                  toast.success(t('clients.banned', { name: c.client_nickname }));
                }}>
                  <Ban className="mr-2 h-4 w-4" /> {t('clients.banOneHour')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      });
    }
    return cols;
  }, [isAdmin, kickClient, banClient, t]);

  if (!selectedConfigId || !selectedSid) return <EmptyState icon={Users} title={t('clients.noServerSelected')} />;
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('clients.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('clients.online', { count: clients.length })}</p>
        </div>
      </div>

      <DataTable columns={columns} data={clients} searchKey="client_nickname" searchPlaceholder={t('clients.searchPlaceholder')} />

      {/* Poke Dialog */}
      <Dialog open={!!pokeTarget} onOpenChange={() => setPokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clients.pokeTitle', { name: pokeTarget?.name })}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs">{t('clients.message')}</Label>
            <Input value={pokeMsg} onChange={(e) => setPokeMsg(e.target.value)} placeholder={t('clients.messagePlaceholder')} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPokeTarget(null)}>{t('clients.cancel')}</Button>
            <Button onClick={() => {
              if (pokeTarget && pokeMsg) {
                pokeClient.mutate({ clid: pokeTarget.clid, msg: pokeMsg });
                toast.success(t('clients.poked', { name: pokeTarget.name }));
                setPokeTarget(null);
              }
            }}>
              <Zap className="h-4 w-4 mr-1" /> {t('clients.poke')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
