'use client';

import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import DataManagement from '@/components/data-management';
import ExpensesExclusionSettings from '@/components/expenses-exclusion-settings';
import CategoryReference from '@/components/category-reference';
import CashflowReference from '@/components/cashflow-reference';

export default function SettingsPage() {
  return (
    <>
      <h1 className="page-header">Settings</h1>

      <h2 className="h4 mt-4 mb-3"><i className="fa fa-wallet me-2"></i>Expenses</h2>
      <ExpensesExclusionSettings />
      <CategoryReference />

      <h2 className="h4 mt-4 mb-3"><i className="fa fa-sack-dollar me-2"></i>Cashflow</h2>
      <CashflowReference />

      <h2 className="h4 mt-4 mb-3"><i className="fa fa-database me-2"></i>Data Management</h2>
      <DataManagement />

      <Panel className="mt-4">
        <PanelHeader noButton>Build Info</PanelHeader>
        <PanelBody>
          <div className="d-flex align-items-center">
            <i className="fa fa-clock text-muted me-2"></i>
            <div>
              <small className="text-muted d-block">Last Successful Build</small>
              <span>
                {process.env.NEXT_PUBLIC_BUILD_TIME
                  ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()
                  : 'Development mode'}
              </span>
            </div>
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}
