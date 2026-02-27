import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, FileText, Search, Plus, ExternalLink, Calendar, Tag } from 'lucide-react';

/* ── Types ── */
interface Doc {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  file_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  tags: string[] | null;
  client_slug: string | null;
}

const B = '#4B9EFF';
const card = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '16px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

const CATEGORIES = ['All', 'SOP', 'Proposal', 'Report', 'Meeting Notes', 'Template', 'Other'];

const categoryColor: Record<string, string> = {
  'SOP':           '#6366f1',
  'Proposal':      '#4B9EFF',
  'Report':        '#4ADE80',
  'Meeting Notes': '#FBBF24',
  'Template':      '#F87171',
  'Other':         'rgba(255,255,255,0.3)',
};

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function DocsPage() {
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tableExists, setExists]  = useState(true);
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('All');

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const { data, error } = await (supabase as any).from('documents').select('*').order('created_at', { ascending: false });
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('relation') || error.code === '42P01') {
          setExists(false);
        }
      } else {
        setDocs((data as Doc[]) || []);
      }
    } catch {
      setExists(false);
    }
    setLoading(false);
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || d.category === category;
    return matchSearch && matchCat;
  });

  /* ── Table not created yet ── */
  if (!tableExists) {
    return (
      <div className="space-y-5">
        <div style={{ ...card, borderRadius: '20px' }} className="p-8 text-center space-y-4">
          <BookOpen className="h-10 w-10 mx-auto" style={{ color: `${B}50` }} />
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--tc-70)' }}>Document library ready to activate</p>
            <p className="text-sm mt-1" style={{ color: 'var(--tc-35)' }}>Run the migration to start storing SOPs, proposals, and reports.</p>
          </div>
          <div className="rounded-xl p-4 text-left font-mono text-[11px] overflow-auto"
            style={{ background: 'rgba(75,158,255,0.06)', border: '1px solid rgba(75,158,255,0.15)', color: `${B}cc` }}>
            <p style={{ color: 'var(--tc-30)' }}>-- Run in Supabase SQL editor:</p>
            <p>CREATE TABLE documents (</p>
            <p>&nbsp;&nbsp;id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),</p>
            <p>&nbsp;&nbsp;title       text NOT NULL,</p>
            <p>&nbsp;&nbsp;category    text,</p>
            <p>&nbsp;&nbsp;description text,</p>
            <p>&nbsp;&nbsp;file_url    text,</p>
            <p>&nbsp;&nbsp;client_slug text,</p>
            <p>&nbsp;&nbsp;tags        text[],</p>
            <p>&nbsp;&nbsp;created_at  timestamptz DEFAULT now(),</p>
            <p>&nbsp;&nbsp;updated_at  timestamptz DEFAULT now()</p>
            <p>);</p>
            <p>ALTER TABLE documents ENABLE ROW LEVEL SECURITY;</p>
            <p>CREATE POLICY "service_role_all" ON documents USING (true) WITH CHECK (true);</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--tc-30)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search docs..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--s-card)',
              border: '1px solid var(--s-card-b)',
              color: 'var(--tc-80)',
            }}
          />
        </div>
        <button
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ background: B, boxShadow: `0 0 20px ${B}40` }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add doc
        </button>
      </div>

      {/* ── Category filter ── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
            style={category === cat
              ? { background: `${B}20`, border: `1px solid ${B}40`, color: B }
              : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-35)' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, borderRadius: '20px' }} className="p-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} />
          <p className="text-sm" style={{ color: 'var(--tc-25)' }}>
            {search || category !== 'All' ? 'No docs match this filter' : 'No documents yet — add your first SOP or proposal'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(doc => {
            const color = categoryColor[doc.category || 'Other'] || categoryColor.Other;
            return (
              <div key={doc.id} style={card} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                      <FileText className="h-4 w-4" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--tc-85)' }}>{doc.title}</p>
                      {doc.description && (
                        <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--tc-40)' }}>{doc.description}</p>
                      )}
                    </div>
                  </div>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg transition-all shrink-0"
                      style={{ color: 'var(--tc-40)', background: 'var(--s-hover)' }}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {doc.category && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                      {doc.category}
                    </span>
                  )}
                  {doc.client_slug && (
                    <span className="text-[10px] capitalize" style={{ color: 'var(--tc-30)' }}>
                      {doc.client_slug.replace(/_/g, ' ')}
                    </span>
                  )}
                  {doc.tags?.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--tc-25)' }}>
                      <Tag className="h-2.5 w-2.5" />{tag}
                    </span>
                  ))}
                  <span className="flex items-center gap-1 ml-auto text-[10px]" style={{ color: 'var(--tc-20)' }}>
                    <Calendar className="h-2.5 w-2.5" />
                    {fmtDate(doc.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
