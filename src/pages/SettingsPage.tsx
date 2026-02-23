import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Bell, Users, Save, RefreshCw } from 'lucide-react';

interface ClientConfig {
  id: string;
  name: string;
  slug: string;
  email_addresses: string[] | null;
  status: string | null;
}

export default function SettingsPage() {
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [operatorName, setOperatorName] = useState('Josh');
  const [killSwitchPath, setKillSwitchPath] = useState('/Users/henryburton/.openclaw/KILL_SWITCH');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: clientData } = await supabase.from('clients').select('*').order('name');
    if (clientData) setClients(clientData);

    const { data: configs } = await supabase.from('system_config').select('*');
    if (configs) {
      configs.forEach((c: any) => {
        const v = c.value?.value;
        if (c.key === 'telegram_token' && v) setTelegramToken(String(v));
        if (c.key === 'telegram_chat_id' && v) setTelegramChatId(String(v));
        if (c.key === 'discord_webhook' && v) setDiscordWebhook(String(v));
        if (c.key === 'operator_name' && v) setOperatorName(String(v));
        if (c.key === 'kill_switch_path' && v) setKillSwitchPath(String(v));
      });
    }
  };

  const upsertConfig = async (key: string, value: string) => {
    await supabase.from('system_config').upsert(
      { key, value: { value } },
      { onConflict: 'key' }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        upsertConfig('telegram_token', telegramToken),
        upsertConfig('telegram_chat_id', telegramChatId),
        upsertConfig('discord_webhook', discordWebhook),
        upsertConfig('operator_name', operatorName),
        upsertConfig('kill_switch_path', killSwitchPath),
      ]);

      await supabase.from('audit_log').insert({
        agent: 'System',
        action: 'settings_updated',
        details: { updated_by: operatorName },
        status: 'success',
      });

      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleClientStatus = async (client: ClientConfig) => {
    const newStatus = client.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('clients')
      .update({ status: newStatus })
      .eq('id', client.id);
    if (!error) {
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
      toast.success(`${client.name} → ${newStatus}`);
    }
  };

  const B = '#4B9EFF';
  const glassCard = { background: 'var(--s-card)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--s-card-b)', borderRadius: '20px', boxShadow: 'var(--s-card-shadow)' } as React.CSSProperties;
  const inputClass = "h-9 rounded-xl bg-white/5 border-0 text-sm text-card-foreground placeholder:text-card-foreground/30 focus-visible:ring-primary/30";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Operator */}
      <div style={glassCard} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Operator Settings</h3>
        </div>
        <p className="text-xs text-card-foreground/40 mb-4">Your identity and primary control settings</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-card-foreground/40 uppercase tracking-wider">
              Operator Name
            </Label>
            <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-card-foreground/40 uppercase tracking-wider">
              Kill Switch File Path
            </Label>
            <Input value={killSwitchPath} onChange={e => setKillSwitchPath(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Clients */}
      <div style={glassCard} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Client Accounts</h3>
        </div>
        <p className="text-xs text-card-foreground/40 mb-4">Toggle to pause inbox monitoring</p>
        <div className="space-y-2">
          {clients.map(client => (
            <div key={client.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div>
                <p className="text-xs text-card-foreground font-medium">{client.name}</p>
                <p className="text-[10px] text-card-foreground/30 mt-0.5">
                  {client.email_addresses?.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium" style={{ color: client.status === 'active' ? B : 'var(--tc-40)' }}>
                  {client.status?.toUpperCase()}
                </span>
                <Switch
                  checked={client.status === 'active'}
                  onCheckedChange={() => toggleClientStatus(client)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div style={glassCard} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Integrations</h3>
        </div>
        <p className="text-xs text-card-foreground/40 mb-4">Telegram (approvals) and Discord (notifications)</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Telegram Bot Token</Label>
            <Input type="password" value={telegramToken} onChange={e => setTelegramToken(e.target.value)} placeholder="1234567890:AAF..." className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Telegram Chat ID</Label>
            <Input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="-100123456789" className={inputClass} />
          </div>
          <div className="h-px bg-white/5" />
          <div className="space-y-1.5">
            <Label className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Discord Webhook URL</Label>
            <Input type="password" value={discordWebhook} onChange={e => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className={inputClass} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button
          variant="ghost"
          onClick={fetchData}
          className="rounded-xl text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl text-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
