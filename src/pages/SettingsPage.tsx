import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Settings, Bot, Mail, Save, RefreshCw, Shield, Bell, Users,
} from 'lucide-react';

interface ClientConfig {
  id: string;
  name: string;
  slug: string;
  email_addresses: string[] | null;
  status: string | null;
}

export default function SettingsPage() {
  const [autoResponse, setAutoResponse] = useState(true);
  const [responseTimeMin, setResponseTimeMin] = useState('15');
  const [responseTimeMax, setResponseTimeMax] = useState('60');
  const [escalationKeywords, setEscalationKeywords] = useState('urgent, asap, bug, broken, down, error');
  const [ccEmails, setCcEmails] = useState('josh@amalfiai.com, salah@amalfiai.com');
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [operatorName, setOperatorName] = useState('Josh');
  const [killSwitchPath, setKillSwitchPath] = useState('/Users/josh/.openclaw/KILL_SWITCH');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Settings</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          System configuration · Agent settings · Integrations
        </p>
      </div>

      {/* Operator */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-display tracking-wide">Operator Settings</CardTitle>
          </div>
          <CardDescription className="font-mono text-[10px] text-muted-foreground">
            Your identity and primary control settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Operator Name (who approves things)
            </Label>
            <Input
              value={operatorName}
              onChange={e => setOperatorName(e.target.value)}
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Kill Switch File Path (on your Mac)
            </Label>
            <Input
              value={killSwitchPath}
              onChange={e => setKillSwitchPath(e.target.value)}
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Management */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-display tracking-wide">Client Accounts</CardTitle>
          </div>
          <CardDescription className="font-mono text-[10px] text-muted-foreground">
            Sophia monitors these inboxes — toggle to pause monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {clients.map(client => (
            <div key={client.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded border border-border/30">
              <div>
                <p className="font-mono text-xs text-foreground">{client.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {client.email_addresses?.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] ${client.status === 'active' ? 'text-success' : 'text-warning'}`}>
                  {client.status?.toUpperCase()}
                </span>
                <Switch
                  checked={client.status === 'active'}
                  onCheckedChange={() => toggleClientStatus(client)}
                  className="data-[state=checked]:bg-success"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sophia CSM Config */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-display tracking-wide">Sophia CSM — Config</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded border border-border/30">
            <div>
              <p className="font-mono text-xs text-foreground">Auto-Response</p>
              <p className="font-mono text-[10px] text-muted-foreground">Sophia sends routine responses without your approval</p>
            </div>
            <Switch
              checked={autoResponse}
              onCheckedChange={setAutoResponse}
              className="data-[state=checked]:bg-success"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Min Response Time (mins)
              </Label>
              <Input
                type="number"
                value={responseTimeMin}
                onChange={e => setResponseTimeMin(e.target.value)}
                className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Max Response Time (mins)
              </Label>
              <Input
                type="number"
                value={responseTimeMax}
                onChange={e => setResponseTimeMax(e.target.value)}
                className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Escalation Keywords (comma-separated)
            </Label>
            <Input
              value={escalationKeywords}
              onChange={e => setEscalationKeywords(e.target.value)}
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              CC Emails (comma-separated)
            </Label>
            <Input
              value={ccEmails}
              onChange={e => setCcEmails(e.target.value)}
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-display tracking-wide">Integrations</CardTitle>
          </div>
          <CardDescription className="font-mono text-[10px] text-muted-foreground">
            Telegram (phone approvals) · Discord (notifications)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Telegram Bot Token
            </Label>
            <Input
              type="password"
              value={telegramToken}
              onChange={e => setTelegramToken(e.target.value)}
              placeholder="1234567890:AAF..."
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Telegram Chat ID (your phone)
            </Label>
            <Input
              value={telegramChatId}
              onChange={e => setTelegramChatId(e.target.value)}
              placeholder="-100123456789"
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
          <Separator className="border-border/30" />
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Discord Webhook URL (#csm-responses channel)
            </Label>
            <Input
              type="password"
              value={discordWebhook}
              onChange={e => setDiscordWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="font-mono text-sm bg-secondary/30 border-border/50 h-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={fetchData}
          className="font-mono text-xs border-border/50 text-muted-foreground hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="font-mono text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40"
        >
          <Save className="h-3.5 w-3.5 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
