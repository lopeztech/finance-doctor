'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { FamilyMember } from '@/lib/types';
import { listFamilyMembers, addFamilyMember, updateFamilyMember, deleteFamilyMember } from '@/lib/family-members-repo';

function getTaxBracket(salary: number): string {
  if (salary <= 18200) return '0%';
  if (salary <= 45000) return '16%';
  if (salary <= 135000) return '30%';
  if (salary <= 190000) return '37%';
  return '45%';
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', job: '', salary: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await listFamilyMembers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: form.name, salary: parseFloat(form.salary), ...(form.job ? { job: form.job } : {}) };
    if (editingId) {
      await updateFamilyMember(editingId, body);
      setMembers(prev => prev.map(m => m.id === editingId ? { ...m, ...body } : m));
    } else {
      const member = await addFamilyMember(body);
      setMembers(prev => [...prev, member]);
    }
    cancelEdit();
  };

  const startEdit = (m: FamilyMember) => {
    setForm({ name: m.name, job: m.job || '', salary: String(m.salary) });
    setEditingId(m.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm({ name: '', job: '', salary: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const removeMember = async (id: string) => {
    await deleteFamilyMember(id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  if (loading) {
    return (
      <>
        <h1 className="page-header">Family</h1>
        <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      </>
    );
  }

  return (
    <>
      <h1 className="page-header">Family</h1>

      <Panel>
        <PanelHeader noButton>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span><i className="fa fa-users me-2"></i>Family Members</span>
            <button className="btn btn-sm btn-success ms-sm-auto" onClick={() => { if (showForm) cancelEdit(); else setShowForm(true); }}>
              {showForm ? <><i className="fa fa-times me-1"></i>Cancel</> : <><i className="fa fa-plus me-1"></i>Add Member</>}
            </button>
          </div>
        </PanelHeader>
        <PanelBody>
          {showForm && (
            <form onSubmit={handleSubmit} className="row g-2 mb-3 p-3 bg-light rounded">
              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Name</label>
                <input type="text" className="form-control" placeholder="e.g. Josh" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Job / Industry</label>
                <input type="text" className="form-control" placeholder="e.g. Software Engineer" value={form.job} onChange={e => setForm({ ...form, job: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Annual Salary</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input type="number" className="form-control" placeholder="0" step="1" min="0" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} required />
                </div>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button type="submit" className="btn btn-success w-100">
                  {editingId ? <><i className="fa fa-check me-1"></i>Update</> : <><i className="fa fa-plus me-1"></i>Add</>}
                </button>
              </div>
            </form>
          )}

          {members.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa fa-users fa-3x mb-3 d-block"></i>
              <p>No family members yet. Add members to track expenses, tax, and investments per person.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Job / Industry</th>
                    <th className="text-end">Annual Salary</th>
                    <th>Tax Bracket</th>
                    <th style={{ width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td className="fw-bold">{m.name}</td>
                      <td className="text-muted">{m.job || '—'}</td>
                      <td className="text-end">${m.salary.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td><span className="badge bg-secondary">{getTaxBracket(m.salary)} + ML</span></td>
                      <td className="text-nowrap">
                        <button className="btn btn-xs btn-primary me-1" onClick={() => startEdit(m)} title="Edit">
                          <i className="fa fa-pencil-alt"></i>
                        </button>
                        <button className="btn btn-xs btn-danger" onClick={() => removeMember(m.id)} title="Delete">
                          <i className="fa fa-times"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
