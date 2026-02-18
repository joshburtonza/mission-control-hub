import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface EmailItem {
  id: string;
  from_email: string;
  subject: string;
  client: string;
  status: string;
  received_at: string;
  analysis?: any;
  requires_approval: boolean;
}

export const EmailQueue: React.FC = () => {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  useEffect(() => {
    fetchEmailQueue();
    const subscription = supabase
      .from('email_queue')
      .on('*', payload => {
        fetchEmailQueue();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchEmailQueue = async () => {
    const { data, error } = await supabase
      .from('email_queue')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(20);

    if (!error) {
      setEmails(data || []);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900 text-yellow-200';
      case 'analyzing':
        return 'bg-blue-900 text-blue-200';
      case 'awaiting_approval':
        return 'bg-orange-900 text-orange-200';
      case 'approved':
        return 'bg-green-900 text-green-200';
      case 'sent':
        return 'bg-green-950 text-green-300';
      case 'skipped':
        return 'bg-gray-800 text-gray-300';
      default:
        return 'bg-gray-800 text-gray-300';
    }
  };

  const getClientColor = (client: string) => {
    switch (client) {
      case 'ascend_lc':
        return 'bg-cyan-900/50 text-cyan-300';
      case 'favorite_logistics':
        return 'bg-green-900/50 text-green-300';
      case 'race_technik':
        return 'bg-purple-900/50 text-purple-300';
      default:
        return 'bg-gray-900/50 text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-black border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-cyan-400">Email Queue</CardTitle>
          <CardDescription className="text-gray-400">
            {emails.filter(e => e.status === 'awaiting_approval').length} awaiting approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {emails.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No emails in queue</div>
              ) : (
                emails.map(email => (
                  <div
                    key={email.id}
                    className="p-3 bg-gray-950 border border-gray-800 hover:border-cyan-500/50 cursor-pointer rounded transition-colors"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-cyan-300 truncate">{email.from_email}</p>
                        <p className="text-xs text-gray-400 truncate">{email.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getClientColor(email.client)}>
                          {email.client.replace('_', ' ')}
                        </Badge>
                        <Badge className={getStatusColor(email.status)}>
                          {email.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEmail && (
        <Card className="bg-black border-green-500/30">
          <CardHeader>
            <CardTitle className="text-green-400">Selected Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">From</p>
              <p className="text-sm text-green-300">{selectedEmail.from_email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Subject</p>
              <p className="text-sm text-green-300">{selectedEmail.subject}</p>
            </div>
            {selectedEmail.analysis && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Analysis</p>
                <pre className="text-xs text-gray-400 bg-gray-950 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(selectedEmail.analysis, null, 2)}
                </pre>
              </div>
            )}
            {selectedEmail.requires_approval && (
              <div className="flex gap-2">
                <Button className="bg-green-900 hover:bg-green-800 text-green-300">Approve</Button>
                <Button className="bg-red-900 hover:bg-red-800 text-red-300">Reject</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
